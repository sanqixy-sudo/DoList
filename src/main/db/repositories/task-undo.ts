import { randomUUID } from 'node:crypto';
import { dbAll, dbGet, dbRun, dbTransaction } from '../client';
import { hydrateTasks, mapRowToTask } from './task-hydration';
import { buildPlaceholders } from '../utils/task-logic';
import type { Task } from '../../../../types/models';
import type { UndoInfo } from '../../../../types/task-mutations';
const fields = { status: 'status', completedAt: 'completed_at', priority: 'priority', plannedDate: 'planned_date', dueDate: 'due_date', startDate: 'start_date', listId: 'list_id', sortOrder: 'sort_order' } as const;
type Field = keyof typeof fields;
type Change = { id: string; before: Partial<Pick<Task, Field>>; after: Partial<Pick<Task, Field>> };
let last: { info: UndoInfo; changes: Change[] } | null = null;
export function recordUndo(before: Task[], after: Task[]): UndoInfo | null {
  const previous = new Map(before.map(task => [task.id, task]));
  const changes: Change[] = [];
  for (const next of after) {
    const old = previous.get(next.id); if (!old) continue;
    const change: Change = { id: next.id, before: {}, after: {} };
    for (const key of Object.keys(fields) as Field[]) {
      if (old[key] !== next[key]) { (change.before as any)[key] = old[key]; (change.after as any)[key] = next[key]; }
    }
    if (Object.keys(change.before).length) changes.push(change);
  }
  if (!changes.length) return null;
  const first = changes[0].after;
  const label = first.listId !== undefined ? '移动项目' : first.status !== undefined ? '更改完成状态' : first.plannedDate !== undefined ? '调整计划日期' : first.dueDate !== undefined ? '调整截止时间' : '修改任务';
  const info = { token: randomUUID(), label, count: changes.length };
  last = { info, changes };
  return info;
}
export function clearUndo(): void { last = null; }
export function undoTaskChange(token: string): Task[] {
  if (!last || last.info.token !== token) throw new Error('撤销记录已失效');
  const changes = last.changes;
  dbTransaction(() => {
    for (const change of changes) {
      const row = dbGet('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL', [change.id]);
      if (!row) throw new Error('任务已删除，无法撤销');
      for (const key of Object.keys(change.after) as Field[]) {
        if (row[fields[key]] !== change.after[key]) throw new Error('任务已再次修改，未覆盖新的内容');
      }
      if (change.before.listId && !dbGet('SELECT id FROM lists WHERE id = ?', [change.before.listId])) throw new Error('原项目已不存在，无法撤销移动');
    }
    for (const change of changes) {
      const keys = Object.keys(change.before) as Field[];
      dbRun('UPDATE tasks SET ' + keys.map(key => fields[key] + ' = ?').join(', ') + ', updated_at = ? WHERE id = ?', [...keys.map(key => change.before[key]), new Date().toISOString(), change.id]);
    }
  });
  last = null;
  return hydrateTasks(dbAll('SELECT * FROM tasks WHERE id IN (' + buildPlaceholders(changes.length) + ')', changes.map(change => change.id)).map(mapRowToTask));
}
