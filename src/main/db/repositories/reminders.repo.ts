import { dbRun, dbGet, dbAll } from '../client';
import { v4 as uuidv4 } from 'uuid';
import type { Reminder, CreateReminderDto } from '../../../../types/models';

export const reminderRepo = {
  findByTaskId(taskId: string): Reminder[] {
    const rows = dbAll(
      'SELECT * FROM reminders WHERE task_id = ? ORDER BY remind_at ASC',
      [taskId]
    );
    return rows.map(mapRowToReminder);
  },

  findById(id: string): Reminder | null {
    const row = dbGet('SELECT * FROM reminders WHERE id = ?', [id]);
    return row ? mapRowToReminder(row) : null;
  },

  findPending(): (Reminder & { taskTitle?: string })[] {
    const now = new Date().toISOString();
    const rows = dbAll(
      `SELECT r.*, t.title as task_title
       FROM reminders r
       JOIN tasks t ON r.task_id = t.id
       WHERE r.is_sent = 0 AND r.remind_at <= ?
       ORDER BY r.remind_at ASC`,
      [now]
    );
    return rows.map(r => ({
      ...mapRowToReminder(r),
      taskTitle: r.task_title,
    }));
  },

  create(data: CreateReminderDto): Reminder {
    const id = uuidv4();
    const now = new Date().toISOString();

    dbRun(
      `INSERT INTO reminders (id, task_id, remind_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, data.taskId, data.remindAt, now, now]
    );

    return this.findById(id)!;
  },

  markSent(id: string): void {
    const now = new Date().toISOString();
    dbRun('UPDATE reminders SET is_sent = 1, updated_at = ? WHERE id = ?', [now, id]);
  },

  delete(id: string): void {
    dbRun('DELETE FROM reminders WHERE id = ?', [id]);
  },

  deleteByTaskId(taskId: string): void {
    dbRun('DELETE FROM reminders WHERE task_id = ?', [taskId]);
  },
};

function mapRowToReminder(row: any): Reminder {
  return {
    id: row.id,
    taskId: row.task_id,
    remindAt: row.remind_at,
    method: row.method,
    isSent: Boolean(row.is_sent),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
