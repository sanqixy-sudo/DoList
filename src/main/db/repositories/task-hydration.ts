import { dbAll } from '../client';
import { buildPlaceholders } from '../utils/task-logic';
import type { Task, TaskAttachment } from '../../../../types/models';
export function hydrateTasks(tasks: Task[]): Task[] {
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

export function mapRowToTask(row: any): Task {
  return {
    id: row.id,
    listId: row.list_id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    priority: row.priority,
    startDate: row.start_date,
    dueDate: row.due_date,
    plannedDate: row.planned_date ?? null,
    deletedAt: row.deleted_at ?? null,
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
