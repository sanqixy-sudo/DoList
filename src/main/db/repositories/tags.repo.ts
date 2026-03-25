import { dbRun, dbGet, dbAll } from '../client';
import { v4 as uuidv4 } from 'uuid';
import type { Tag } from '../../../../types/models';

export const tagRepo = {
  findAll(): Tag[] {
    const rows = dbAll('SELECT * FROM tags ORDER BY name ASC');
    return rows.map(mapRowToTag);
  },

  findById(id: string): Tag | null {
    const row = dbGet('SELECT * FROM tags WHERE id = ?', [id]);
    return row ? mapRowToTag(row) : null;
  },

  findByName(name: string): Tag | null {
    const row = dbGet('SELECT * FROM tags WHERE name = ?', [name]);
    return row ? mapRowToTag(row) : null;
  },

  create(name: string, color?: string): Tag {
    const id = uuidv4();
    dbRun('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', [id, name, color || null]);
    return this.findById(id)!;
  },

  update(id: string, data: Partial<Tag>): Tag {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color);
    }

    if (updates.length > 0) {
      params.push(id);
      dbRun(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return this.findById(id)!;
  },

  delete(id: string): void {
    dbRun('DELETE FROM tags WHERE id = ?', [id]);
  },

  addToTask(taskId: string, tagId: string): void {
    dbRun('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)', [taskId, tagId]);
  },

  removeFromTask(taskId: string, tagId: string): void {
    dbRun('DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?', [taskId, tagId]);
  },
};

function mapRowToTag(row: any): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
  };
}
