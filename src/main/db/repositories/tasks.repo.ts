import { normalizeTimestamp } from '../../../../types/validation';
import { taskBulkRepo } from './task-bulk.repo';
import { taskAttachmentRepo, importAttachment, removeAttachmentFile, cleanupImportedSourcePath } from './task-attachments.repo';
import { hydrateTasks, mapRowToTask } from './task-hydration';
import { getNextSortOrder, validatePlannedDate, validateTaskIds } from './task-query-utils';
import { dbRun, dbGet, dbAll, dbRunMany, dbTransaction } from '../client';
import { randomUUID as uuidv4 } from 'node:crypto';
import type {
  Task,
  CreateTaskDto,
  UpdateTaskDto,
} from '../../../../types/models';
import type { TaskFilter } from '../../../../types/ipc';
import {
  buildDueDateClause,
  resolveTaskSortOrder,
} from '../utils/task-logic';

export const taskRepo = {
  findAll(filter?: TaskFilter): Task[] {
    let sql = `
      SELECT * FROM tasks
      WHERE is_archived = 0 AND deleted_at IS NULL
    `;
    const params: any[] = [];

    if (filter?.listId) {
      sql += ' AND list_id = ?';
      params.push(filter.listId);
    }

    if (filter?.status && filter.status !== 'all') {
      sql += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.priority !== undefined) {
      sql += ' AND priority = ?';
      params.push(filter.priority);
    }

    const dueDateClause = buildDueDateClause(filter?.dueDate);
    sql += dueDateClause.sql;
    params.push(...dueDateClause.params);

    sql += ' ORDER BY sort_order ASC, created_at DESC';

    const rows = dbAll(sql, params);
    return hydrateTasks(rows.map(mapRowToTask));
  },

  findById(id: string): Task | null {
    const row = dbGet('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!row) return null;

    return hydrateTasks([mapRowToTask(row)])[0] ?? null;
  },

  create(data: CreateTaskDto): Task {
    data = { ...data, dueDate: normalizeTimestamp(data.dueDate, true) ?? undefined, startDate: normalizeTimestamp(data.startDate) ?? undefined };
    validateTaskFields(data);
    const id = uuidv4();
    const now = new Date().toISOString();
    const sortOrder = getNextSortOrder(data.listId);

    const importedFiles: string[] = [];
    try { dbTransaction(() => {
    dbRun(
      `INSERT INTO tasks (id, list_id, title, notes, priority, start_date, due_date, planned_date, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.listId, data.title, data.notes || null, data.priority || 0, data.startDate || null, data.dueDate || null, data.plannedDate || null, sortOrder, now, now]
    );

    if (data.tags && data.tags.length > 0) {
      for (const tagId of data.tags) {
        dbRun('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)', [id, tagId]);
      }
    }

    if (data.attachments && data.attachments.length > 0) {
      for (const attachment of data.attachments) {
        importedFiles.push(importAttachment(id, attachment, false).filePath);
      }
    }
    }); } catch (error) {
      importedFiles.forEach(removeAttachmentFile);
      throw error;
    }
    data.attachments?.forEach(attachment => cleanupImportedSourcePath(attachment.sourcePath));

    return this.findById(id)!;
  },

  update(id: string, data: UpdateTaskDto): Task {
    if (data.restoreCompletedAt !== undefined && (data.status !== 'done' || !Number.isFinite(Date.parse(data.restoreCompletedAt)))) {
      throw new Error('恢复完成时间需要有效时间与已完成状态');
    }
    data = { ...data, dueDate: normalizeTimestamp(data.dueDate, true), startDate: normalizeTimestamp(data.startDate) };
    validateTaskFields(data);
    const existingTask = dbGet('SELECT list_id, status, completed_at FROM tasks WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!existingTask) {
      throw new Error(`Task not found: ${id}`);
    }

    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
      if (data.status === 'done') {
        updates.push('completed_at = ?');
        params.push(data.restoreCompletedAt ?? (existingTask.status === 'done' ? existingTask.completed_at ?? now : now));
      } else {
        updates.push('completed_at = NULL');
      }
    }
    if (data.priority !== undefined) {
      updates.push('priority = ?');
      params.push(data.priority);
    }
    if (data.startDate !== undefined) {
      updates.push('start_date = ?');
      params.push(data.startDate);
    }
    if (data.dueDate !== undefined) {
      updates.push('due_date = ?');
      params.push(data.dueDate);
    }
    if (data.plannedDate !== undefined) {
      updates.push('planned_date = ?');
      params.push(data.plannedDate);
    }
    if (data.listId !== undefined) {
      updates.push('list_id = ?');
      params.push(data.listId);

      const resolvedSortOrder = resolveTaskSortOrder({
        currentListId: existingTask.list_id,
        nextListId: data.listId,
        explicitSortOrder: data.sortOrder,
        nextSortOrder: getNextSortOrder(data.listId),
      });
      if (resolvedSortOrder !== undefined) {
        updates.push('sort_order = ?');
        params.push(resolvedSortOrder);
      }
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }

    params.push(id);
    dbRun(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params);

    return this.findById(id)!;
  },

  delete(id: string): void {
    this.trash([id]);
  },


  ...taskBulkRepo,

  search(query: string): Task[] {
    const rows = dbAll(
      `SELECT * FROM tasks
       WHERE (title LIKE ? OR notes LIKE ?) AND is_archived = 0 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 50`,
      [`%${query}%`, `%${query}%`]
    );
    return hydrateTasks(rows.map(mapRowToTask));
  },

  reorder(ids: string[]): void {
    if (!ids.length) return;
    validateTaskIds(ids, false);
    if (new Set(ids).size !== ids.length) throw new Error('排序中存在重复任务');
    dbRunMany('UPDATE tasks SET sort_order = ? WHERE id = ?', ids.map((id, index) => [index, id]));
  },

  ...taskAttachmentRepo,
};


function validateTaskFields(data: CreateTaskDto | UpdateTaskDto) {
  validatePlannedDate(data.plannedDate);
  if (data.title !== undefined && (typeof data.title !== 'string' || !data.title.trim())) throw new Error('任务标题不能为空');
  if (data.priority !== undefined && ![0, 1, 2, 3].includes(data.priority)) throw new Error('优先级无效');
  if ('status' in data && data.status !== undefined && !['todo', 'done', 'canceled'].includes(data.status)) throw new Error('任务状态无效');
  for (const date of [data.startDate, data.dueDate]) {
    if (date !== undefined && date !== null && !Number.isFinite(Date.parse(date))) throw new Error('任务日期无效');
  }
  if (data.listId !== undefined && !dbGet('SELECT id FROM lists WHERE id = ? AND is_archived = 0', [data.listId])) throw new Error('目标项目不存在');
}
