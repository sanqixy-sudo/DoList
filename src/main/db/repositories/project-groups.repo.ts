import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../client';
import type { CreateProjectGroupDto, ProjectGroup } from '../../../../types/models';

export const projectGroupRepo = {
  findAll(): ProjectGroup[] {
    const rows = dbAll(`
      SELECT * FROM project_groups
      ORDER BY sort_order ASC, created_at ASC
    `);
    return rows.map(mapRowToProjectGroup);
  },

  findById(id: string): ProjectGroup | null {
    const row = dbGet('SELECT * FROM project_groups WHERE id = ?', [id]);
    return row ? mapRowToProjectGroup(row) : null;
  },

  create(data: CreateProjectGroupDto): ProjectGroup {
    const id = uuidv4();
    const now = new Date().toISOString();
    const maxOrderRow = dbGet('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM project_groups');
    const sortOrder = maxOrderRow?.next || 0;

    dbRun(
      `INSERT INTO project_groups (id, name, color, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.color || null, sortOrder, now, now]
    );

    return this.findById(id)!;
  },

  update(id: string, data: Partial<ProjectGroup>): ProjectGroup {
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color);
    }
    if (data.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(data.sortOrder);
    }

    params.push(id);
    dbRun(`UPDATE project_groups SET ${updates.join(', ')} WHERE id = ?`, params as any[]);

    return this.findById(id)!;
  },

  delete(id: string): void {
    if (id === 'default-group') {
      throw new Error('Cannot delete default project group');
    }

    dbRun(`UPDATE lists SET project_group_id = 'default-group' WHERE project_group_id = ?`, [id]);
    dbRun('DELETE FROM project_groups WHERE id = ?', [id]);
  },

  reorder(ids: string[]): void {
    ids.forEach((id, index) => {
      dbRun('UPDATE project_groups SET sort_order = ? WHERE id = ?', [index, id]);
    });
  },
};

function mapRowToProjectGroup(row: any): ProjectGroup {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
