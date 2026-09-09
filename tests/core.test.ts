import { createDraftMap } from '../src/renderer/features/tasks/draft-storage';
import { normalizeTimestamp } from '../types/validation';
import { validateIpcArgs } from '../src/main/ipc/validated-ipc';
import { IPC_CHANNELS } from '../types/ipc';
import { scanUnusedAttachments, cleanupUnusedAttachments } from '../src/main/maintenance/attachments';
import { usePomodoroStore } from '../src/renderer/features/pomodoro/pomodoroStore';
import { flushDatabase, getSaveStatus } from '../src/main/db/client';
import { gzipSync, gunzipSync } from 'node:zlib';
import { exportBackup, inspectBackup, restoreBackup } from '../src/main/backup/service';
import { recordUndo, undoTaskChange, clearUndo } from '../src/main/db/repositories/task-undo';
import { groupBoardTasks } from '../src/renderer/features/kanban/kanban-model';
import { groupPlannedTasks } from '../src/renderer/features/tasks/plan-groups';
import { getMatrixQuadrantUpdates } from '../src/renderer/features/matrix/matrix-utils';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { initDatabase, closeDatabase, dbGet, dbRunMany, dbRun } from '../src/main/db/client';
import { listRepo } from '../src/main/db/repositories/lists.repo';
import { subtaskRepo } from '../src/main/db/repositories/subtasks.repo';
import { reminderRepo } from '../src/main/db/repositories/reminders.repo';
import { tagRepo } from '../src/main/db/repositories/tags.repo';
import { taskRepo } from '../src/main/db/repositories/tasks.repo';
import { localDay, selectScope, isTodayTask, needsReschedule } from '../src/renderer/features/tasks/task-selectors';
import { buildCalendarIndex } from '../src/renderer/features/calendar/calendar-index';
import { useTaskStore } from '../src/renderer/features/tasks/store';
import type { Task } from '../types/models';
const dataPath = (globalThis as any).__TEST_DATA_PATH__;
const today = '2026-09-09';
const task = (data: Partial<Task> = {}): Task => ({ id: 'a', listId: 'inbox', title: '任务', notes: null, status: 'todo', priority: 0, startDate: null, dueDate: null, plannedDate: null, completedAt: null, completion: 0, sortOrder: 0, isArchived: false, repeatRuleId: null, createdAt: '2026-09-09T01:00:00Z', updatedAt: '2026-09-09T01:00:00Z', ...data });
test('今日计划独立于截止日期，合并去重并保留待重排任务', () => {
  const both = task({ plannedDate: today, dueDate: '2026-09-09T12:00:00+08:00' });
  const previous = task({ id: 'b', plannedDate: '2026-09-08' });
  const tomorrow = task({ id: 'c', plannedDate: '2026-09-10' });
  assert.equal(isTodayTask(both, today), true);
  assert.equal(needsReschedule(both, today), false);
  assert.equal(needsReschedule(previous, today), true);
  assert.deepEqual(selectScope([both, previous, tomorrow], 'today', null, today).map(t => t.id), ['a', 'b']);
  assert.equal(selectScope([both, previous], 'list', 'other', today).length, 0);
  assert.equal(localDay(new Date(2026, 8, 9, 0, 1)), today);
});
test('日历按天/小时索引，全天不会重复进入午夜格', () => {
  const planned = task({ plannedDate: today, dueDate: '2026-09-20T10:00:00+08:00' });
  const timed = task({ id: 'b', dueDate: '2026-09-09T10:30:00' });
  const midnight = task({ id: 'c', dueDate: '2026-09-09T00:00:00' });
  const index = buildCalendarIndex([planned, timed, midnight, task({ id: 'bad', dueDate: 'invalid' })]);
  assert.deepEqual(index.get(today)?.allDay.map(t => t.id), ['a', 'c']);
  assert.equal(index.get(today)?.hours[0].length, 0);
  assert.equal(index.get(today)?.hours[10][0].id, 'b');
  assert.equal(index.size, 1);
});
test('增量迁移保留旧任务及截止日期，生成备份并允许重新启动', async () => {
  await initDatabase(dataPath);
  const legacy = taskRepo.create({ title: '旧任务', listId: 'inbox', dueDate: '2026-09-20T10:00:00Z' });
  closeDatabase();
  const SQL = await initSqlJs();
  const dbPath = path.join(dataPath, 'ticklike.db');
  const old = new SQL.Database(fs.readFileSync(dbPath));
  old.run('DROP INDEX idx_tasks_planned; ALTER TABLE tasks DROP COLUMN planned_date;');
  old.run('DROP INDEX idx_tasks_deleted; ALTER TABLE tasks DROP COLUMN deleted_at;');
  old.run("DELETE FROM migrations WHERE name IN ('004_daily_plan', '005_task_trash')");
  fs.writeFileSync(dbPath, Buffer.from(old.export())); old.close();
  await initDatabase(dataPath);
  assert.equal(taskRepo.findById(legacy.id)?.dueDate, legacy.dueDate);
  assert.equal(taskRepo.findById(legacy.id)?.plannedDate, null);
  assert.equal(fs.existsSync(dbPath + '.before-004_daily_plan.bak'), true);
  assert.equal(fs.existsSync(dbPath + '.before-005_task_trash.bak'), true);
  assert.equal(taskRepo.findById(legacy.id)?.deletedAt, null);
  const planned = taskRepo.update(legacy.id, { plannedDate: today });
  assert.equal(planned.dueDate, legacy.dueDate);
  assert.throws(() => taskRepo.update(legacy.id, { plannedDate: '2026-02-30' }));
  taskRepo.update(legacy.id, { plannedDate: null });
  closeDatabase();
  await initDatabase(dataPath);
  assert.equal(taskRepo.findById(legacy.id)?.plannedDate, null);
  assert.equal(dbGet('PRAGMA foreign_keys').foreign_keys, 1);
  assert.throws(() => taskRepo.create({ title: '孤立任务', listId: 'missing' }));
  closeDatabase();
});
test('过期加载不能覆盖较新的任务，修改串行保持输入顺序', async () => {
  let resolveFirst!: (tasks: Task[]) => void;
  let calls = 0;
  (globalThis as any).window = { electronAPI: { tasks: {
    list: () => ++calls === 1 ? new Promise<Task[]>(r => resolveFirst = r) : Promise.resolve([task({ title: '最新' })]),
    update: async (_id: string, data: any) => ({ task: task(data), undo: null })
  } } };
  const first = useTaskStore.getState().fetchTasks();
  await useTaskStore.getState().fetchTasks();
  resolveFirst([task({ title: '过期' })]); await first;
  assert.equal(useTaskStore.getState().tasks[0].title, '最新');
  await Promise.all([useTaskStore.getState().updateTask('a', { title: '第一版' }), useTaskStore.getState().updateTask('a', { title: '第二版' })]);
  assert.equal(useTaskStore.getState().tasks[0].title, '第二版');
});
after(() => { closeDatabase(); });

test('四象限仅调整重要性时保留已有截止时间', () => {
  const urgent = task({ dueDate: new Date(Date.now() + 3600000).toISOString() });
  assert.deepEqual(getMatrixQuadrantUpdates('urgent-important', urgent), { priority: 3 });
  const later = task({ dueDate: new Date(Date.now() + 10 * 86400000).toISOString() });
  assert.deepEqual(getMatrixQuadrantUpdates('not-urgent-important', later), { priority: 3 });
});

test('计划分组跨年排序，计划日期优先且不修改截止日期', () => {
  const future = task({ id: 'future', plannedDate: '2027-01-03', dueDate: '2026-12-01T12:00:00' });
  const groups = groupPlannedTasks([
    future,
    task({ id: 'tomorrow', dueDate: '2027-01-01T12:00:00' }),
    task({ id: 'past', plannedDate: '2026-12-30' }),
    task({ id: 'today', plannedDate: '2026-12-31' }),
    task({ id: 'earlier', plannedDate: '2027-01-02' }),
    task({ id: 'later', plannedDate: '2027-02-01' }),
    task({ id: 'done', status: 'done', plannedDate: '2026-12-31' }),
    task({ id: 'unscheduled' }),
  ], '2026-12-31');
  assert.deepEqual(groups.map(g => [g.id, g.tasks.map(t => t.id)]), [
    ['past', ['past']], ['today', ['today']], ['tomorrow', ['tomorrow']], ['week', ['earlier', 'future']], ['later', ['later']],
  ]);
  assert.equal(future.dueDate, '2026-12-01T12:00:00');
});

test('批量排序原子提交，失败回滚，重启保留顺序及任务字段', async () => {
  await initDatabase(dataPath);
  const a = taskRepo.create({ title: '批量 A', listId: 'inbox', plannedDate: today, priority: 3 });
  const b = taskRepo.create({ title: '批量 B', listId: 'inbox', dueDate: '2026-09-15T12:00:00Z' });
  taskRepo.reorder([b.id, a.id]);
  assert.equal(taskRepo.findById(b.id)?.sortOrder, 0);
  assert.equal(taskRepo.findById(a.id)?.sortOrder, 1);
  assert.throws(() => taskRepo.reorder([a.id, a.id]));
  assert.throws(() => dbRunMany('INSERT INTO lists (id,name) VALUES (?,?)', [['rollback-list','第一次'], ['rollback-list','重复键']]));
  assert.equal(dbGet('SELECT id FROM lists WHERE id = ?', ['rollback-list']), null);
  closeDatabase();
  await initDatabase(dataPath);
  assert.equal(taskRepo.findById(a.id)?.sortOrder, 1);
  assert.equal(taskRepo.findById(a.id)?.priority, 3);
  assert.equal(taskRepo.findById(a.id)?.plannedDate, today);
  assert.equal(taskRepo.findById(b.id)?.dueDate, b.dueDate);
  closeDatabase();
});

test('看板按状态分组，筛选备注且保留任务顺序', () => {
  const groups = groupBoardTasks([task({ id: 'last', sortOrder: 5, notes: 'UI 讨论' }), task({ id: 'first', notes: 'ui 设计' }), task({ id: 'done', status: 'done', title: 'UI 完成' }), task({ id: 'skip', title: '其他' })], ' UI ');
  assert.deepEqual(groups.todo.map(t => t.id), ['first', 'last']);
  assert.deepEqual(groups.done.map(t => t.id), ['done']);
  assert.equal(groups.canceled.length, 0);
});
test('撤销状态变更可恢复原完成时间，不改计划和截止日期', async () => {
  await initDatabase(dataPath);
  const original = taskRepo.create({ title: '历史完成任务', listId: 'inbox', plannedDate: today, dueDate: '2026-09-10T12:00:00Z' });
  taskRepo.update(original.id, { status: 'done', restoreCompletedAt: '2025-08-01T10:00:00Z' });
  taskRepo.update(original.id, { status: 'todo' });
  const restored = taskRepo.update(original.id, { status: 'done', restoreCompletedAt: '2025-08-01T10:00:00Z' });
  assert.equal(restored.completedAt, '2025-08-01T10:00:00Z');
  assert.equal(restored.dueDate, original.dueDate);
  assert.equal(restored.plannedDate, today);
  assert.throws(() => taskRepo.update(original.id, { status: 'todo', restoreCompletedAt: '2025-08-01T10:00:00Z' }));
  assert.throws(() => taskRepo.update(original.id, { status: 'done', restoreCompletedAt: 'invalid' }));
  closeDatabase();
});

test('日历索引沿用更新后的排序值，不依赖任务集合的旧数组顺序', () => {
  const index = buildCalendarIndex([task({ id: 'a', plannedDate: today, sortOrder: 2 }), task({ id: 'b', plannedDate: today, sortOrder: 0 }), task({ id: 'c', plannedDate: today, sortOrder: 1 })]);
  assert.deepEqual(index.get(today)?.allDay.map(task => task.id), ['b', 'c', 'a']);
});

test('回收站保留关系和附件，暂停提醒，重启后可恢复并限制永久删除', async () => {
  await initDatabase(dataPath);
  const source = path.join(dataPath, 'attachment.txt'); fs.writeFileSync(source, '保留的附件');
  const original = taskRepo.create({ title: '回收站完整任务', listId: 'inbox', plannedDate: today, dueDate: '2026-10-01T12:00:00Z', attachments: [{ sourcePath: source, name: '附件.txt' }] });
  const sub = subtaskRepo.create({ taskId: original.id, title: '一个步骤' });
  const reminder = reminderRepo.create({ taskId: original.id, remindAt: '2020-01-01T00:00:00Z' });
  const tag = tagRepo.create('回收站测试');
  dbRun('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', [original.id, tag.id]);
  assert.ok(reminderRepo.findPending().some(r => r.id === reminder.id));
  const attachment = taskRepo.findById(original.id)!.attachments![0];
  taskRepo.delete(original.id);
  assert.equal(taskRepo.findById(original.id), null);
  assert.ok(!taskRepo.findAll().some(t => t.id === original.id));
  assert.equal(taskRepo.search('回收站完整任务').length, 0);
  assert.ok(!reminderRepo.findPending().some(r => r.id === reminder.id));
  assert.throws(() => taskRepo.update(original.id, { title: '不能编辑' }));
  assert.throws(() => subtaskRepo.update(sub.id, { title: '不能编辑' }));
  assert.throws(() => taskRepo.removeAttachment(attachment.id));
  assert.ok(fs.existsSync(attachment.filePath));
  closeDatabase(); await initDatabase(dataPath);
  const recycled = taskRepo.findTrash().find(t => t.id === original.id)!;
  assert.ok(recycled.deletedAt);
  assert.equal(recycled.subtasks![0].id, sub.id);
  assert.equal(recycled.tags![0].id, tag.id);
  assert.equal(recycled.reminders![0].id, reminder.id);
  const restored = taskRepo.restore([original.id])[0];
  assert.equal(restored.plannedDate, original.plannedDate);
  assert.equal(restored.dueDate, original.dueDate);
  assert.equal(restored.status, original.status);
  assert.ok(reminderRepo.findPending().some(r => r.id === reminder.id));
  assert.throws(() => taskRepo.purge([original.id]));
  assert.ok(fs.existsSync(attachment.filePath));
  taskRepo.delete(original.id); taskRepo.purge([original.id]);
  assert.equal(dbGet('SELECT * FROM tasks WHERE id = ?', [original.id]), null);
  assert.equal(subtaskRepo.findById(sub.id), null);
  assert.equal(reminderRepo.findById(reminder.id), null);
  assert.equal(fs.existsSync(attachment.filePath), false);
  closeDatabase();
});

test('批量修改全部成功或全部失败，并保留截止日期和历史完成时间', async () => {
  await initDatabase(dataPath);
  const project = listRepo.create({ name: '批量目标' });
  const a = taskRepo.create({ title: '批量原子 A', listId: 'inbox', dueDate: '2027-01-01T08:00:00Z' });
  const b = taskRepo.create({ title: '批量原子 B', listId: 'inbox' });
  taskRepo.update(b.id, { status: 'done', restoreCompletedAt: '2025-01-01T08:00:00Z' });
  for (const data of [{ plannedDate: '2026-02-30' }, { listId: 'missing' }, { priority: 9 }, { title: '非法字段' }]) {
    assert.throws(() => taskRepo.bulkUpdate([a.id, b.id], data as any));
    assert.equal(taskRepo.findById(a.id)?.plannedDate, null);
  }
  assert.throws(() => taskRepo.bulkUpdate([a.id, 'missing'], { plannedDate: today }));
  assert.throws(() => taskRepo.trash([a.id, 'missing']));
  assert.ok(taskRepo.findById(a.id));
  // Force a failure during the second write, not just during validation.
  dbRun(`CREATE TRIGGER fail_bulk BEFORE UPDATE ON tasks WHEN NEW.id = '${b.id}' AND NEW.planned_date = '2026-09-09' BEGIN SELECT RAISE(ABORT, 'injected'); END`);
  assert.throws(() => taskRepo.bulkUpdate([a.id, b.id], { plannedDate: today }));
  assert.equal(taskRepo.findById(a.id)?.plannedDate, null);
  dbRun('DROP TRIGGER fail_bulk');
  taskRepo.bulkUpdate([a.id, b.id], { plannedDate: today, status: 'done', listId: project.id });
  assert.equal(taskRepo.findById(a.id)?.dueDate, a.dueDate);
  assert.equal(taskRepo.findById(b.id)?.completedAt, '2025-01-01T08:00:00Z');
  assert.equal(taskRepo.findById(a.id)?.listId, project.id);
  taskRepo.trash([a.id, b.id]); taskRepo.restore([a.id, b.id]);
  assert.equal(taskRepo.findById(b.id)?.completedAt, '2025-01-01T08:00:00Z');
  closeDatabase();
});

test('删除项目将现有和已删除任务保留在回收站，恢复到收件箱', async () => {
  await initDatabase(dataPath);
  const project = listRepo.create({ name: '待删除项目' });
  const a = taskRepo.create({ title: '项目任务 A', listId: project.id });
  const b = taskRepo.create({ title: '项目任务 B', listId: project.id });
  subtaskRepo.create({ taskId: a.id, title: '保留步骤' });
  taskRepo.delete(b.id);
  const deletedAt = taskRepo.findTrash().find(t => t.id === b.id)!.deletedAt;
  listRepo.delete(project.id);
  assert.equal(listRepo.findById(project.id), null);
  assert.equal(taskRepo.findById(a.id), null);
  assert.equal(taskRepo.findTrash().find(t => t.id === b.id)?.deletedAt, deletedAt);
  const restored = taskRepo.restore([a.id, b.id]);
  assert.ok(restored.every(t => t.listId === 'inbox'));
  assert.equal(restored.find(t => t.id === a.id)?.subtasks?.length, 1);
  assert.throws(() => listRepo.delete('inbox'));
  closeDatabase();
});

test('3000 项批量计划、删除和恢复覆盖整个选择', async () => {
  await initDatabase(dataPath);
  const ids = Array.from({ length: 3000 }, (_, i) => 'bulk-large-' + i);
  dbRunMany('INSERT INTO tasks (id, list_id, title) VALUES (?, ?, ?)', ids.map(id => [id, 'inbox', id]));
  assert.equal(taskRepo.bulkUpdate(ids, { plannedDate: today }).length, 3000);
  taskRepo.trash(ids);
  assert.equal(taskRepo.findTrash().filter(t => t.id.startsWith('bulk-large-')).length, 3000);
  assert.equal(taskRepo.restore(ids).length, 3000);
  closeDatabase();
});

test('单项修改与批量删除串行，过期任务响应不能复活任务', async () => {
  let resolveUpdate!: (task: Task) => void;
  let trashed = false;
  (globalThis as any).window = { electronAPI: { tasks: {
    update: () => new Promise<Task>(resolve => resolveUpdate = resolve).then(task => ({ task, undo: null })),
    trash: async () => { trashed = true; },
    restore: async () => [task({ id: 'queue-task' })],
  } } };
  const store = useTaskStore.getState();
  store.setTask(task({ id: 'queue-task' }));
  const update = store.updateTask('queue-task', { title: '先保存' });
  const deletion = store.trashTasks(['queue-task']);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(trashed, false);
  resolveUpdate(task({ id: 'queue-task', title: '先保存' }));
  await Promise.all([update, deletion]);
  store.setTask(task({ id: 'queue-task', title: '延迟响应' }));
  assert.ok(!useTaskStore.getState().tasks.some(t => t.id === 'queue-task'));
  await store.restoreTasks(['queue-task']);
  assert.ok(useTaskStore.getState().tasks.some(t => t.id === 'queue-task'));
});

test('完整备份预览、恢复及安全备份保留任务和附件，重启后仍可用', async () => {
  await initDatabase(dataPath);
  const source = path.join(dataPath, 'backup-source.txt'); fs.writeFileSync(source, '备份附件内容');
  const a = taskRepo.create({ title: '备份中的任务', listId: 'inbox', attachments: [{ sourcePath: source, name: '资料.txt' }] });
  const sub = subtaskRepo.create({ taskId: a.id, title: '备份步骤' });
  const deleted = taskRepo.create({ title: '备份回收站任务', listId: 'inbox' }); taskRepo.delete(deleted.id);
  const archive = path.join(dataPath, 'round5.dolist-backup');
  exportBackup(archive);
  const preview = inspectBackup(archive);
  assert.ok(preview.summary.tasks > 0); assert.ok(preview.summary.trashed > 0); assert.equal(preview.summary.attachments, 1);
  const later = taskRepo.create({ title: '导出后新增', listId: 'inbox' });
  const { safetyBackupPath } = restoreBackup(archive, preview.fingerprint);
  assert.ok(fs.existsSync(safetyBackupPath));
  assert.equal(taskRepo.findById(later.id), null);
  const restored = taskRepo.findById(a.id)!;
  assert.equal(restored.subtasks![0].id, sub.id);
  assert.equal(fs.readFileSync(restored.attachments![0].filePath, 'utf8'), '备份附件内容');
  assert.ok(restored.attachments![0].filePath.includes('restored-attachments'));
  assert.ok(taskRepo.findTrash().some(t => t.id === deleted.id));
  closeDatabase(); await initDatabase(dataPath);
  assert.ok(taskRepo.findById(a.id));
  const safety = inspectBackup(safetyBackupPath);
  restoreBackup(safetyBackupPath, safety.fingerprint);
  assert.ok(taskRepo.findById(later.id));
  closeDatabase();
});

test('备份损坏、预览后被替换以及写入失败均不会覆盖当前数据', async () => {
  await initDatabase(dataPath);
  const marker = taskRepo.create({ title: '不得覆盖的任务', listId: 'inbox' });
  const file = path.join(dataPath, 'failure.dolist-backup'); exportBackup(file);
  const valid = fs.readFileSync(file), preview = inspectBackup(file);
  fs.writeFileSync(file, 'broken'); assert.throws(() => inspectBackup(file));
  fs.writeFileSync(file, valid);
  const changed = JSON.parse(gunzipSync(valid).toString('utf8')); changed.createdAt = '2020-01-01T00:00:00Z';
  fs.writeFileSync(file, gzipSync(JSON.stringify(changed)));
  assert.throws(() => restoreBackup(file, preview.fingerprint));
  assert.ok(taskRepo.findById(marker.id));
  fs.writeFileSync(file, valid);
  const renamed = fs.renameSync;
  fs.renameSync = ((from: any, to: any) => { if (String(from).endsWith('.restore.tmp')) throw new Error('Injected disk failure'); return renamed(from, to); }) as typeof fs.renameSync;
  try { assert.throws(() => restoreBackup(file, preview.fingerprint)); }
  finally { fs.renameSync = renamed; }
  assert.ok(taskRepo.findById(marker.id));
  assert.equal(dbGet('PRAGMA foreign_keys').foreign_keys, 1);
  // A missing current attachment prevents a supposedly complete safety backup.
  const attachment = taskRepo.findAll().flatMap(t => t.attachments ?? [])[0];
  const content = fs.readFileSync(attachment.filePath); fs.unlinkSync(attachment.filePath);
  try { assert.throws(() => restoreBackup(file, preview.fingerprint)); assert.ok(taskRepo.findById(marker.id)); }
  finally { fs.writeFileSync(attachment.filePath, content); }
  closeDatabase();
});

test('拒绝不完整附件或额外触发器，恢复路径只使用受控目录', async () => {
  await initDatabase(dataPath);
  const file = path.join(dataPath, 'validation.dolist-backup'); exportBackup(file);
  const original = JSON.parse(gunzipSync(fs.readFileSync(file)).toString('utf8'));
  const corrupt = structuredClone(original); corrupt.files[0].data = Buffer.from('伪造').toString('base64');
  fs.writeFileSync(file, gzipSync(JSON.stringify(corrupt))); assert.throws(() => inspectBackup(file));
  const SQL = await initSqlJs();
  const db = new SQL.Database(Buffer.from(original.database, 'base64'));
  db.run("CREATE TRIGGER injected AFTER INSERT ON tasks BEGIN DELETE FROM tasks; END");
  const unsafe = { ...original, database: Buffer.from(db.export()).toString('base64') }; db.close();
  fs.writeFileSync(file, gzipSync(JSON.stringify(unsafe))); assert.throws(() => inspectBackup(file));
  const portable = new SQL.Database(Buffer.from(original.database, 'base64'));
  portable.run("UPDATE task_attachments SET file_path = 'C:/untrusted/outside.txt', stored_name = '../../outside.txt'");
  original.database = Buffer.from(portable.export()).toString('base64'); portable.close();
  fs.writeFileSync(file, gzipSync(JSON.stringify(original)));
  const preview = inspectBackup(file); restoreBackup(file, preview.fingerprint);
  const files = taskRepo.findAll().flatMap(t => t.attachments ?? []);
  assert.ok(files.every(f => path.relative(path.join(dataPath, 'restored-attachments'), f.filePath).startsWith('..') === false));
  closeDatabase();
});

test('统一撤销只还原本次字段，保留新备注，冲突时整个批次不变', async () => {
  await initDatabase(dataPath);
  const a = taskRepo.create({ title: '撤销 A', listId: 'inbox', plannedDate: today });
  const b = taskRepo.create({ title: '撤销 B', listId: 'inbox' });
  const after = taskRepo.bulkUpdate([a.id, b.id], { status: 'done', plannedDate: '2027-01-01' });
  const info = recordUndo([a,b], after)!;
  taskRepo.update(a.id, { notes: '之后补充的备注' });
  const restored = undoTaskChange(info.token);
  assert.equal(restored.find(t=>t.id===a.id)?.plannedDate, today);
  assert.equal(restored.find(t=>t.id===a.id)?.notes, '之后补充的备注');
  assert.ok(restored.every(t=>t.status === 'todo' && t.completedAt === null));
  assert.throws(() => undoTaskChange(info.token));
  const before = [taskRepo.findById(a.id)!, taskRepo.findById(b.id)!];
  const next = taskRepo.bulkUpdate([a.id,b.id], { plannedDate: '2027-01-01' });
  const conflict = recordUndo(before,next)!;
  taskRepo.update(b.id, { plannedDate: '2027-02-01' });
  assert.throws(() => undoTaskChange(conflict.token));
  assert.equal(taskRepo.findById(a.id)?.plannedDate, '2027-01-01');
  assert.equal(taskRepo.findById(b.id)?.plannedDate, '2027-02-01');
  const project = listRepo.create({name:'撤销移动目标'});
  const old = taskRepo.findById(a.id)!;
  const move = taskRepo.update(a.id,{listId:project.id});
  const moving = recordUndo([old],[move])!;
  assert.equal(undoTaskChange(moving.token)[0].listId, 'inbox');
  clearUndo(); closeDatabase();
});

test('没有待迁移内容时启动不会重写数据库文件', async () => {
  await initDatabase(dataPath); closeDatabase();
  const file = path.join(dataPath, 'ticklike.db');
  const before = fs.statSync(file).mtimeMs;
  await initDatabase(dataPath);
  assert.equal(fs.statSync(file).mtimeMs, before);
  closeDatabase();
});


test('附件导入失败完整回滚任务、标签及文件，保留源文件以便重试', async () => {
  await initDatabase(dataPath);
  const source = path.join(dataPath, 'audit-source.txt'); fs.writeFileSync(source, '附件内容');
  const tag = tagRepo.create('audit-tag');
  const count = taskRepo.findAll().length;
  const directory = path.join(dataPath, 'attachments');
  const before = fs.existsSync(directory) ? fs.readdirSync(directory).sort() : [];
  const attachments = [{ sourcePath: source, name: 'source.txt' }, { sourcePath: source + '.missing', name: 'missing.txt' }];
  assert.throws(() => taskRepo.create({ title: '不能部分创建', listId: 'inbox', tags: [tag.id], attachments }));
  assert.equal(taskRepo.findAll().length, count);
  assert.deepEqual(fs.readdirSync(directory).sort(), before);
  assert.ok(fs.existsSync(source));
  assert.throws(() => taskRepo.create({ title: '坏标签', listId: 'inbox', tags: ['missing'] }));
  assert.equal(taskRepo.findAll().length, count);
  const created = taskRepo.create({ title: '附件重试成功', listId: 'inbox', tags: [tag.id], attachments: attachments.slice(0, 1) });
  assert.equal(created.attachments?.length, 1); assert.equal(created.tags?.[0].id, tag.id);
  closeDatabase();
});

test('磁盘保存失败不关闭内存数据库，外键持续生效且重试后可重启读取', async () => {
  await initDatabase(dataPath); flushDatabase();
  const created = taskRepo.create({ title: '等待落盘', listId: 'inbox' });
  const rename = fs.renameSync;
  fs.renameSync = (() => { throw new Error('Injected disk write failure'); }) as typeof fs.renameSync;
  try {
    assert.throws(flushDatabase, /Injected/);
    assert.equal(getSaveStatus().pending, true); assert.ok(getSaveStatus().error);
    assert.equal(dbGet('PRAGMA foreign_keys').foreign_keys, 1);
    assert.throws(closeDatabase, /Injected/);
    assert.equal(taskRepo.findById(created.id)?.title, '等待落盘');
  } finally { fs.renameSync = rename; }
  flushDatabase(); assert.deepEqual(getSaveStatus(), { pending: false, error: null });
  closeDatabase(); await initDatabase(dataPath); assert.ok(taskRepo.findById(created.id)); closeDatabase();
});

test('无效任务字段不会污染数据库，重复完成不改写历史完成时间', async () => {
  await initDatabase(dataPath);
  const created = taskRepo.create({ title: '字段检查', listId: 'inbox' });
  for (const data of [{ title: ' ' }, { status: 'bad' }, { dueDate: 'invalid' }, { priority: 99 }, { listId: 'missing' }]) {
    assert.throws(() => taskRepo.update(created.id, data as any));
  }
  const timestamp = '2024-01-01T01:00:00Z';
  taskRepo.update(created.id, { status: 'done', restoreCompletedAt: timestamp });
  assert.equal(taskRepo.update(created.id, { status: 'done' }).completedAt, timestamp);
  closeDatabase();
});

test('专注计时按实际经过时间更新，暂停不计时，延迟唤醒只完成一轮', () => {
  const clock = Date.now; let now = 100000;
  Date.now = () => now;
  try {
    const store = usePomodoroStore;
    store.getState().reset(); store.getState().updateSettings({ workDuration: 1, autoStartBreaks: false });
    store.getState().start(); now += 17500; store.getState().tick();
    assert.equal(store.getState().timeRemaining, 43);
    store.getState().pause(); now += 3600000; store.getState().tick();
    assert.equal(store.getState().timeRemaining, 43);
    store.getState().resume(); now += 43000; store.getState().tick();
    assert.equal(store.getState().completedPomodoros, 1); assert.equal(store.getState().totalWorkTime, 60);
    store.getState().tick(); assert.equal(store.getState().completedPomodoros, 1);
    store.getState().reset(); store.getState().start(); store.getState().updateSettings({ workDuration: 5 });
    now += 3600000; store.getState().tick();
    assert.equal(store.getState().completedPomodoros, 2); assert.equal(store.getState().totalWorkTime, 120);
    store.setState({ lastResetDate: 'yesterday', todayPomodoros: 9 }); store.getState().tick();
    assert.equal(store.getState().todayPomodoros, 0);
    store.getState().updateSettings({ workDuration: 0, longBreakInterval: NaN });
    assert.equal(store.getState().settings.workDuration, 1); assert.equal(store.getState().settings.longBreakInterval, 4);
  } finally { Date.now = clock; usePomodoroStore.getState().reset(); }
});


test('永久删除遇到磁盘失败保留任务和附件，重试后才移除文件', async () => {
  await initDatabase(dataPath);
  const source = path.join(dataPath, 'purge-audit.txt'); fs.writeFileSync(source, '不能丢失');
  const created = taskRepo.create({ title: '删除落盘保护', listId: 'inbox', attachments: [{ sourcePath: source, name: 'audit.txt' }] });
  taskRepo.trash([created.id]); flushDatabase();
  const sync = fs.fsyncSync;
  fs.fsyncSync = (() => { throw new Error('Injected delete persistence failure'); }) as typeof fs.fsyncSync;
  try {
    assert.throws(() => taskRepo.purge([created.id]));
    assert.ok(taskRepo.findTrash().some(task => task.id === created.id));
    assert.ok(fs.existsSync(created.attachments![0].filePath));
  } finally { fs.fsyncSync = sync; }
  taskRepo.purge([created.id]);
  assert.equal(fs.existsSync(created.attachments![0].filePath), false);
  closeDatabase(); await initDatabase(dataPath); assert.equal(taskRepo.findTrash().some(task => task.id === created.id), false); closeDatabase();
});

test('IPC 模糊参数与严格日期校验拒绝非法值', () => {
  const bad = [null, 1, true, [], {}, '', ' '.repeat(4)];
  for (const value of bad) assert.throws(() => validateIpcArgs('tasks:update', [value, { title: 'ok' }]));
  for (const value of [null, [], 0, { title: '' }, { priority: 4 }, { dueDate: '2026-02-30' }, { plannedDate:'2026-13-01' }, { title:'ok', deletedAt:'now' }]) {
    assert.throws(() => validateIpcArgs('tasks:create', [value]));
  }
  for (const date of ['2026-02-30','2026-09-09T25:00:00Z','2026-09-09T12:61:00Z','2026-09-09T12:00:00+14:30',42]) assert.throws(() => normalizeTimestamp(date));
  assert.equal(normalizeTimestamp('2026-09-09T12:00:00+08:00'),'2026-09-09T04:00:00.000Z');
  assert.throws(() => validateIpcArgs('reminders:create', [{taskId:'valid',remindAt:null}]));
  for (const channel of Object.values(IPC_CHANNELS)) assert.throws(() => validateIpcArgs(channel, Array(8).fill({})));
});

test('附件清理保留引用文件，锁定失败可再次清理', async () => {
  await initDatabase(dataPath);
  const source = path.join(dataPath,'cleanup-source.txt'); fs.writeFileSync(source,'正在使用');
  const created = taskRepo.create({title:'清理保护',listId:'inbox',attachments:[{sourcePath:source,name:'使用中.txt'}]});
  const unused = path.join(dataPath,'attachments','unused-audit.txt');fs.writeFileSync(unused,'孤立');
  assert.ok((await scanUnusedAttachments()).files >= 1);
  const unlink = fs.promises.unlink;
  fs.promises.unlink = async file => { if (String(file) === unused) throw new Error('EBUSY'); return unlink(file); };
  try { assert.ok((await cleanupUnusedAttachments()).failed >= 1); } finally { fs.promises.unlink = unlink; }
  assert.ok(fs.existsSync(unused)); await cleanupUnusedAttachments();
  assert.equal(fs.existsSync(unused),false);assert.ok(fs.existsSync(created.attachments![0].filePath));closeDatabase();
});


test('草稿存储失败保留内存输入，恢复空间后可再次保存，丢弃损坏条目', () => {
  const key = 'audit-drafts';
  localStorage.setItem(key, JSON.stringify([['broken', { title: 12 }], ['valid', { title: '保留' }]]));
  const drafts = createDraftMap<{title:string}>(key, value => typeof value.title === 'string');
  assert.equal(drafts.has('broken'), false); assert.equal(drafts.get('valid')?.title, '保留');
  const set = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  try { drafts.set('task', {title:'不能丢失'}); assert.equal(drafts.get('task')?.title,'不能丢失'); assert.ok(drafts.persistenceError); }
  finally { localStorage.setItem = set; }
  drafts.set('task', {title:'重试成功'}); assert.equal(drafts.persistenceError,'');
  assert.equal(createDraftMap<{title:string}>(key).get('task')?.title,'重试成功');
  drafts.delete('task'); assert.equal(createDraftMap(key).has('task'), false);
});
