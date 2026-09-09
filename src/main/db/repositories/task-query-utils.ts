import { dbGet, dbAll } from '../client';
import { buildPlaceholders } from '../utils/task-logic';
export function getNextSortOrder(listId: string): number {
  const maxOrderRow = dbGet(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM tasks WHERE list_id = ?',
    [listId]
  );

  return Number(maxOrderRow?.next ?? 0);
}

export function validatePlannedDate(value: string | null | undefined): void {
  if (value == null) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error('计划日期无效');
  }
}

export function validateTaskIds(ids: string[], trashed: boolean): any[] {
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) throw new Error('请选择有效且不重复的任务');
  const rows = dbAll(`SELECT id, list_id, sort_order FROM tasks WHERE id IN (${buildPlaceholders(ids.length)}) AND deleted_at IS ${trashed ? 'NOT NULL' : 'NULL'} ORDER BY sort_order ASC, created_at ASC`, ids);
  if (rows.length !== ids.length) throw new Error('部分任务已变更，请刷新后重试');
  return rows;
}
