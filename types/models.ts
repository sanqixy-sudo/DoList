// Task status
export type TaskStatus = 'todo' | 'done' | 'canceled';

// Priority levels
export type Priority = 0 | 1 | 2 | 3; // 0=none, 1=low, 2=medium, 3=high

// Repeat frequency
export type RepeatFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';

// List/Project
export interface List {
  id: string;
  name: string;
  color: string | null;
  groupId: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectGroup {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Task
export interface Task {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  completion: number; // 0-100
  sortOrder: number;
  isArchived: boolean;
  repeatRuleId: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations (populated)
  subtasks?: Subtask[];
  tags?: Tag[];
  reminders?: Reminder[];
  attachments?: TaskAttachment[];
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  name: string;
  storedName: string;
  filePath: string;
  mimeType: string | null;
  fileSize: number;
  createdAt: string;
}

export interface CreateTaskAttachmentDto {
  sourcePath: string;
  name: string;
  mimeType?: string | null;
  fileSize?: number;
}

// Subtask
export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Tag
export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

// Repeat Rule
export interface RepeatRule {
  id: string;
  freq: RepeatFreq;
  interval: number;
  byDay: string | null; // e.g., "MO,WE,FR"
  byMonthDay: string | null; // e.g., "1,15"
  byMonth: string | null; // e.g., "1,6,12"
  count: number | null;
  until: string | null;
  timezone: string | null;
  startDate: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Reminder
export interface Reminder {
  id: string;
  taskId: string;
  remindAt: string;
  method: 'local' | 'push';
  isSent: boolean;
  createdAt: string;
  updatedAt: string;
}

// Create/Update DTOs
export interface CreateTaskDto {
  listId: string;
  title: string;
  notes?: string;
  priority?: Priority;
  startDate?: string;
  dueDate?: string;
  tags?: string[];
  attachments?: CreateTaskAttachmentDto[];
}

export interface UpdateTaskDto {
  title?: string;
  notes?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  startDate?: string | null;
  dueDate?: string | null;
  listId?: string;
  sortOrder?: number;
}

export interface CreateListDto {
  name: string;
  color?: string;
  groupId?: string | null;
}

export interface CreateProjectGroupDto {
  name: string;
  color?: string;
}

export interface CreateSubtaskDto {
  taskId: string;
  title: string;
}

export interface CreateReminderDto {
  taskId: string;
  remindAt: string;
}
