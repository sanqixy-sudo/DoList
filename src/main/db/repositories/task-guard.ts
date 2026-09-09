import { dbGet } from '../client';
export function requireActiveTask(id: string): void {
  if (!dbGet('SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL', [id])) throw new Error('任务已删除或不存在，请刷新后重试');
}
