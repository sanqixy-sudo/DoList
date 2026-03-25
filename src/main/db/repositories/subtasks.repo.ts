import { dbRun, dbGet, dbAll } from '../client';
import { v4 as uuidv4 } from 'uuid';
import type { Subtask, CreateSubtaskDto } from '../../../../types/models';

export const subtaskRepo = {
  findByTaskId(taskId: string): Subtask[] {
    const rows = dbAll(
      'SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order ASC',
      [taskId]
    );
    return rows.map(mapRowToSubtask);
  },

  findById(id: string): Subtask | null {
    const row = dbGet('SELECT * FROM subtasks WHERE id = ?', [id]);
    return row ? mapRowToSubtask(row) : null;
  },

  create(data: CreateSubtaskDto): Subtask {
    const id = uuidv4();
    const now = new Date().toISOString();

    const maxOrderRow = dbGet(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM subtasks WHERE task_id = ?',
      [data.taskId]
    );
    const sortOrder = maxOrderRow?.next || 0;

    dbRun(
      `INSERT INTO subtasks (id, task_id, title, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.taskId, data.title, sortOrder, now, now]
    );

    return this.findById(id)!;
  },

  update(id: string, data: Partial<Subtask>): Subtask {
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.isDone !== undefined) {
      updates.push('is_done = ?');
      params.push(data.isDone ? 1 : 0);
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }

    params.push(id);
    dbRun(`UPDATE subtasks SET ${updates.join(', ')} WHERE id = ?`, params);

    return this.findById(id)!;
  },

  toggle(id: string): Subtask {
    const subtask = this.findById(id);
    if (!subtask) throw new Error('Subtask not found');
    return this.update(id, { isDone: !subtask.isDone });
  },

  delete(id: string): void {
    dbRun('DELETE FROM subtasks WHERE id = ?', [id]);
  },

  reorder(taskId: string, ids: string[]): void {
    ids.forEach((id, index) => {
      dbRun('UPDATE subtasks SET sort_order = ? WHERE id = ? AND task_id = ?', [index, id, taskId]);
    });
  },
};

function mapRowToSubtask(row: any): Subtask {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    isDone: Boolean(row.is_done),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
