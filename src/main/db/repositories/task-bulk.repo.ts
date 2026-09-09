import { normalizeTimestamp } from '../../../../types/validation';
import { dbAll, dbGet, dbRunMany, dbRun, dbDurableTransaction } from '../client';
import { buildPlaceholders } from '../utils/task-logic';
import { hydrateTasks, mapRowToTask } from './task-hydration';
import { getNextSortOrder, validatePlannedDate, validateTaskIds } from './task-query-utils';
import { removeAttachmentFile } from './task-attachments.repo';
import type { Task, BulkTaskUpdateDto } from '../../../../types/models';
export const taskBulkRepo = {
  findTrash(): Task[] {
    return hydrateTasks(dbAll('SELECT * FROM tasks WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').map(mapRowToTask));
  },

  trash(ids: string[]): void {
    validateTaskIds(ids, false);
    const now = new Date().toISOString();
    dbRunMany('UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?', ids.map(id => [now, now, id]));
  },

  restore(ids: string[]): Task[] {
    validateTaskIds(ids, true);
    dbRunMany('UPDATE tasks SET deleted_at = NULL, is_archived = 0, updated_at = ? WHERE id = ?', ids.map(id => [new Date().toISOString(), id]));
    return hydrateTasks(dbAll(`SELECT * FROM tasks WHERE id IN (${buildPlaceholders(ids.length)})`, ids).map(mapRowToTask));
  },

  purge(ids: string[]): void {
    validateTaskIds(ids, true);
    const files = dbAll(`SELECT file_path FROM task_attachments WHERE task_id IN (${buildPlaceholders(ids.length)})`, ids);
    dbDurableTransaction(() => dbRun(`DELETE FROM tasks WHERE id IN (${buildPlaceholders(ids.length)}) AND deleted_at IS NOT NULL`, ids));
    files.forEach(file => removeAttachmentFile(file.file_path));
  },

  bulkUpdate(ids: string[], data: BulkTaskUpdateDto): Task[] {
    const rows = validateTaskIds(ids, false);
    if (!data || !Object.keys(data).length || Object.keys(data).some(key => !['plannedDate', 'dueDate', 'listId', 'status', 'priority'].includes(key))) throw new Error('批量修改字段无效');
    if (data.dueDate !== undefined) data = { ...data, dueDate: normalizeTimestamp(data.dueDate, true) };
    validatePlannedDate(data.plannedDate);
    if (data.dueDate !== undefined && data.dueDate !== null && !Number.isFinite(Date.parse(data.dueDate))) throw new Error('截止时间无效');
    if (data.status !== undefined && !['todo', 'done', 'canceled'].includes(data.status)) throw new Error('任务状态无效');
    if (data.priority !== undefined && ![0, 1, 2, 3].includes(data.priority)) throw new Error('优先级无效');
    if (data.listId !== undefined && !dbGet('SELECT id FROM lists WHERE id = ? AND is_archived = 0', [data.listId])) throw new Error('目标项目不存在');
    const now = new Date().toISOString(), columns = ['updated_at = ?'];
    const values: (string | number | null)[] = [now];
    const fields = { plannedDate: 'planned_date', dueDate: 'due_date', listId: 'list_id', status: 'status', priority: 'priority' };
    for (const key of Object.keys(fields) as (keyof BulkTaskUpdateDto)[]) {
      if (data[key] !== undefined) { columns.push(fields[key] + ' = ?'); values.push(data[key]!); }
    }
    if (data.status !== undefined) columns.push("completed_at = CASE WHEN ? = 'done' THEN COALESCE(completed_at, ?) ELSE NULL END");
    if (data.status !== undefined) values.push(data.status, now);
    const nextOrder = data.listId ? getNextSortOrder(data.listId) : 0;
    if (data.listId !== undefined) columns.push('sort_order = ?');
    dbRunMany(`UPDATE tasks SET ${columns.join(', ')} WHERE id = ?`, rows.map((row, index) =>
      [...values, ...(data.listId !== undefined ? [row.list_id === data.listId ? row.sort_order : nextOrder + index] : []), row.id]));
    return hydrateTasks(dbAll(`SELECT * FROM tasks WHERE id IN (${buildPlaceholders(ids.length)})`, ids).map(mapRowToTask));
  },

};
