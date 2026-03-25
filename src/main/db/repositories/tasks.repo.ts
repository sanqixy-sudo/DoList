import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { dbRun, dbGet, dbAll } from '../client';
import { v4 as uuidv4 } from 'uuid';
import type {
  Task,
  TaskAttachment,
  CreateTaskDto,
  CreateTaskAttachmentDto,
  UpdateTaskDto,
} from '../../../../types/models';
import type { TaskFilter } from '../../../../types/ipc';
import {
  buildDueDateClause,
  buildPlaceholders,
  resolveTaskSortOrder,
} from '../utils/task-logic';

export const taskRepo = {
  findAll(filter?: TaskFilter): Task[] {
    let sql = `
      SELECT * FROM tasks
      WHERE is_archived = 0
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
    const row = dbGet('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!row) return null;

    return hydrateTasks([mapRowToTask(row)])[0] ?? null;
  },

  create(data: CreateTaskDto): Task {
    const id = uuidv4();
    const now = new Date().toISOString();
    const sortOrder = getNextSortOrder(data.listId);

    dbRun(
      `INSERT INTO tasks (id, list_id, title, notes, priority, start_date, due_date, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.listId, data.title, data.notes || null, data.priority || 0, data.startDate || null, data.dueDate || null, sortOrder, now, now]
    );

    if (data.tags && data.tags.length > 0) {
      for (const tagId of data.tags) {
        dbRun('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)', [id, tagId]);
      }
    }

    if (data.attachments && data.attachments.length > 0) {
      for (const attachment of data.attachments) {
        try {
          importAttachment(id, attachment);
        } catch (error) {
          console.error('Failed to import attachment during task creation:', error);
        }
      }
    }

    return this.findById(id)!;
  },

  update(id: string, data: UpdateTaskDto): Task {
    const existingTask = dbGet('SELECT list_id FROM tasks WHERE id = ?', [id]);
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
        params.push(now);
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
    const attachments = dbAll('SELECT * FROM task_attachments WHERE task_id = ?', [id]);
    attachments.forEach((attachment) => {
      removeAttachmentFile(attachment.file_path);
    });
    dbRun('DELETE FROM tasks WHERE id = ?', [id]);
  },

  search(query: string): Task[] {
    const rows = dbAll(
      `SELECT * FROM tasks
       WHERE (title LIKE ? OR notes LIKE ?) AND is_archived = 0
       ORDER BY created_at DESC
       LIMIT 50`,
      [`%${query}%`, `%${query}%`]
    );
    return hydrateTasks(rows.map(mapRowToTask));
  },

  reorder(ids: string[]): void {
    ids.forEach((id, index) => {
      dbRun('UPDATE tasks SET sort_order = ? WHERE id = ?', [index, id]);
    });
  },

  addAttachment(taskId: string, data: CreateTaskAttachmentDto): TaskAttachment {
    return importAttachment(taskId, data);
  },

  removeAttachment(id: string): void {
    const attachment = dbGet('SELECT * FROM task_attachments WHERE id = ?', [id]);
    if (!attachment) return;

    removeAttachmentFile(attachment.file_path);
    dbRun('DELETE FROM task_attachments WHERE id = ?', [id]);
  },
};

function getNextSortOrder(listId: string): number {
  const maxOrderRow = dbGet(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM tasks WHERE list_id = ?',
    [listId]
  );

  return Number(maxOrderRow?.next ?? 0);
}

function hydrateTasks(tasks: Task[]): Task[] {
  if (tasks.length === 0) {
    return tasks;
  }

  const taskIds = tasks.map((task) => task.id);
  const taskMap = new Map(tasks.map((task) => [task.id, task] as const));
  const placeholders = buildPlaceholders(taskIds.length);

  const subtasks = dbAll(
    `SELECT * FROM subtasks
     WHERE task_id IN (${placeholders})
     ORDER BY task_id ASC, sort_order ASC`,
    taskIds
  );
  for (const row of subtasks) {
    taskMap.get(row.task_id)?.subtasks?.push(mapRowToSubtask(row));
  }

  const tags = dbAll(
    `SELECT tt.task_id, t.*
     FROM task_tags tt
     JOIN tags t ON t.id = tt.tag_id
     WHERE tt.task_id IN (${placeholders})
     ORDER BY tt.task_id ASC, t.name ASC`,
    taskIds
  );
  for (const row of tags) {
    taskMap.get(row.task_id)?.tags?.push(mapRowToTag(row));
  }

  const reminders = dbAll(
    `SELECT * FROM reminders
     WHERE task_id IN (${placeholders})
     ORDER BY task_id ASC, remind_at ASC`,
    taskIds
  );
  for (const row of reminders) {
    taskMap.get(row.task_id)?.reminders?.push(mapRowToReminder(row));
  }

  const attachments = dbAll(
    `SELECT * FROM task_attachments
     WHERE task_id IN (${placeholders})
     ORDER BY task_id ASC, created_at DESC`,
    taskIds
  );
  for (const row of attachments) {
    taskMap.get(row.task_id)?.attachments?.push(mapRowToTaskAttachment(row));
  }

  return tasks;
}

function importAttachment(taskId: string, data: CreateTaskAttachmentDto): TaskAttachment {
  if (!fs.existsSync(data.sourcePath)) {
    throw new Error(`Attachment source file not found: ${data.sourcePath}`);
  }

  ensureAttachmentDirectory();

  const attachmentId = uuidv4();
  const sourceExtension = path.extname(data.sourcePath);
  const storedName = `${taskId}-${attachmentId}${sourceExtension}`;
  const filePath = path.join(getAttachmentDirectory(), storedName);
  const stat = fs.statSync(data.sourcePath);
  const fileSize = data.fileSize ?? stat.size;
  const mimeType = data.mimeType ?? inferMimeType(data.sourcePath);
  const now = new Date().toISOString();

  fs.copyFileSync(data.sourcePath, filePath);
  cleanupImportedSourcePath(data.sourcePath);

  dbRun(
    `INSERT INTO task_attachments (id, task_id, name, stored_name, file_path, mime_type, file_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [attachmentId, taskId, data.name, storedName, filePath, mimeType, fileSize, now]
  );

  return {
    id: attachmentId,
    taskId,
    name: data.name,
    storedName,
    filePath,
    mimeType,
    fileSize,
    createdAt: now,
  };
}

function getAttachmentDirectory(): string {
  return path.join(app.getPath('userData'), 'attachments');
}

function ensureAttachmentDirectory(): void {
  const attachmentDirectory = getAttachmentDirectory();
  if (!fs.existsSync(attachmentDirectory)) {
    fs.mkdirSync(attachmentDirectory, { recursive: true });
  }
}

function getClipboardAttachmentStagingDirectory(): string {
  return path.join(app.getPath('temp'), 'dolist-clipboard-attachments');
}

function cleanupImportedSourcePath(sourcePath: string): void {
  const stagingDirectory = getClipboardAttachmentStagingDirectory();
  const relativePath = path.relative(stagingDirectory, sourcePath);
  const isStagedClipboardFile = relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);

  if (isStagedClipboardFile) {
    removeAttachmentFile(sourcePath);
  }
}

function removeAttachmentFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Failed to remove attachment file:', error);
  }
}

function inferMimeType(filePath: string): string | null {
  const extension = path.extname(filePath).toLowerCase();
  const mimeByExtension: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
  };

  return mimeByExtension[extension] ?? null;
}

function mapRowToTask(row: any): Task {
  return {
    id: row.id,
    listId: row.list_id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    priority: row.priority,
    startDate: row.start_date,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    completion: row.completion,
    sortOrder: row.sort_order,
    isArchived: Boolean(row.is_archived),
    repeatRuleId: row.repeat_rule_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subtasks: [],
    tags: [],
    reminders: [],
    attachments: [],
  };
}

function mapRowToTaskAttachment(row: any): TaskAttachment {
  return {
    id: row.id,
    taskId: row.task_id,
    name: row.name,
    storedName: row.stored_name,
    filePath: row.file_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  };
}

function mapRowToSubtask(row: any) {
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

function mapRowToTag(row: any) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
  };
}

function mapRowToReminder(row: any) {
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
