import { dbRun, dbGet, dbAll } from '../client';
import { v4 as uuidv4 } from 'uuid';
import type { List, CreateListDto } from '../../../../types/models';

export const listRepo = {
  findAll(): List[] {
    const rows = dbAll(`
      SELECT * FROM lists
      WHERE is_archived = 0
      ORDER BY sort_order ASC
    `);
    return rows.map(mapRowToList);
  },

  findById(id: string): List | null {
    const row = dbGet('SELECT * FROM lists WHERE id = ?', [id]);
    return row ? mapRowToList(row) : null;
  },

  create(data: CreateListDto): List {
    const id = uuidv4();
    const now = new Date().toISOString();

    const maxOrderRow = dbGet('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM lists');
    const sortOrder = maxOrderRow?.next || 0;

    dbRun(
      `INSERT INTO lists (id, name, color, project_group_id, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.color || null, data.groupId ?? null, sortOrder, now, now]
    );

    return this.findById(id)!;
  },

  update(id: string, data: Partial<List>): List {
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color);
    }
    if (data.groupId !== undefined) {
      updates.push('project_group_id = ?');
      params.push(data.groupId);
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }
    if (data.isArchived !== undefined) {
      updates.push('is_archived = ?');
      params.push(data.isArchived ? 1 : 0);
    }

    params.push(id);
    dbRun(`UPDATE lists SET ${updates.join(', ')} WHERE id = ?`, params);

    return this.findById(id)!;
  },

  delete(id: string): void {
    if (id === 'inbox') {
      throw new Error('Cannot delete inbox');
    }
    dbRun('DELETE FROM lists WHERE id = ?', [id]);
  },

  reorder(ids: string[]): void {
    ids.forEach((id, index) => {
      dbRun('UPDATE lists SET sort_order = ? WHERE id = ?', [index, id]);
    });
  },
};

function mapRowToList(row: any): List {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    groupId: row.project_group_id ?? null,
    sortOrder: row.sort_order,
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
