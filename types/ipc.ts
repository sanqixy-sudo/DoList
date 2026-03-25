import type {
  Task,
  List,
  Tag,
  Subtask,
  Reminder,
  ProjectGroup,
  CreateTaskDto,
  UpdateTaskDto,
  CreateTaskAttachmentDto,
  TaskAttachment,
  CreateListDto,
  CreateProjectGroupDto,
  CreateSubtaskDto,
  CreateReminderDto,
} from './models';

// IPC Channel names
export const IPC_CHANNELS = {
  // Tasks
  TASKS_LIST: 'tasks:list',
  TASKS_GET: 'tasks:get',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',
  TASKS_SEARCH: 'tasks:search',
  TASKS_REORDER: 'tasks:reorder',
  TASKS_PICK_ATTACHMENTS: 'tasks:pickAttachments',
  TASKS_PASTE_CLIPBOARD_IMAGE: 'tasks:pasteClipboardImage',
  TASKS_GET_ATTACHMENT_PREVIEW_URL: 'tasks:getAttachmentPreviewUrl',
  TASKS_ADD_ATTACHMENT: 'tasks:addAttachment',
  TASKS_REMOVE_ATTACHMENT: 'tasks:removeAttachment',
  TASKS_OPEN_ATTACHMENT: 'tasks:openAttachment',

  // Lists
  LISTS_LIST: 'lists:list',
  LISTS_GET: 'lists:get',
  LISTS_CREATE: 'lists:create',
  LISTS_UPDATE: 'lists:update',
  LISTS_DELETE: 'lists:delete',
  LISTS_REORDER: 'lists:reorder',

  // Project groups
  PROJECT_GROUPS_LIST: 'projectGroups:list',
  PROJECT_GROUPS_GET: 'projectGroups:get',
  PROJECT_GROUPS_CREATE: 'projectGroups:create',
  PROJECT_GROUPS_UPDATE: 'projectGroups:update',
  PROJECT_GROUPS_DELETE: 'projectGroups:delete',
  PROJECT_GROUPS_REORDER: 'projectGroups:reorder',

  // Tags
  TAGS_LIST: 'tags:list',
  TAGS_CREATE: 'tags:create',
  TAGS_UPDATE: 'tags:update',
  TAGS_DELETE: 'tags:delete',

  // Subtasks
  SUBTASKS_CREATE: 'subtasks:create',
  SUBTASKS_UPDATE: 'subtasks:update',
  SUBTASKS_DELETE: 'subtasks:delete',
  SUBTASKS_TOGGLE: 'subtasks:toggle',
  SUBTASKS_REORDER: 'subtasks:reorder',

  // Reminders
  REMINDERS_CREATE: 'reminders:create',
  REMINDERS_DELETE: 'reminders:delete',

  // App
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_THEME: 'app:getTheme',
  APP_SET_THEME: 'app:setTheme',
  APP_WINDOW_MINIMIZE: 'app:windowMinimize',
  APP_WINDOW_TOGGLE_MAXIMIZE: 'app:windowToggleMaximize',
  APP_WINDOW_CLOSE: 'app:windowClose',
  APP_MINIMIZE_TO_TRAY: 'app:minimizeToTray',
  APP_QUIT: 'app:quit',
  APP_OPEN_EXTERNAL: 'app:openExternal',
  APP_QUICK_ADD: 'app:quickAdd',
} as const;

// IPC API interface exposed to renderer
export interface ElectronAPI {
  // Tasks
  tasks: {
    list: (filter?: TaskFilter) => Promise<Task[]>;
    get: (id: string) => Promise<Task | null>;
    create: (data: CreateTaskDto) => Promise<Task>;
    update: (id: string, data: UpdateTaskDto) => Promise<Task>;
    delete: (id: string) => Promise<void>;
    search: (query: string) => Promise<Task[]>;
    reorder: (ids: string[]) => Promise<void>;
    pickAttachments: () => Promise<CreateTaskAttachmentDto[]>;
    pasteClipboardImage: () => Promise<CreateTaskAttachmentDto | null>;
    getAttachmentPreviewUrl: (filePath: string) => Promise<string | null>;
    addAttachment: (taskId: string, data: CreateTaskAttachmentDto) => Promise<TaskAttachment>;
    removeAttachment: (attachmentId: string) => Promise<void>;
    openAttachment: (filePath: string) => Promise<void>;
  };

  // Lists
  lists: {
    list: () => Promise<List[]>;
    get: (id: string) => Promise<List | null>;
    create: (data: CreateListDto) => Promise<List>;
    update: (id: string, data: Partial<List>) => Promise<List>;
    delete: (id: string) => Promise<void>;
    reorder: (ids: string[]) => Promise<void>;
  };

  projectGroups: {
    list: () => Promise<ProjectGroup[]>;
    get: (id: string) => Promise<ProjectGroup | null>;
    create: (data: CreateProjectGroupDto) => Promise<ProjectGroup>;
    update: (id: string, data: Partial<ProjectGroup>) => Promise<ProjectGroup>;
    delete: (id: string) => Promise<void>;
    reorder: (ids: string[]) => Promise<void>;
  };

  // Tags
  tags: {
    list: () => Promise<Tag[]>;
    create: (name: string, color?: string) => Promise<Tag>;
    update: (id: string, data: Partial<Tag>) => Promise<Tag>;
    delete: (id: string) => Promise<void>;
  };

  // Subtasks
  subtasks: {
    create: (data: CreateSubtaskDto) => Promise<Subtask>;
    update: (id: string, data: Partial<Subtask>) => Promise<Subtask>;
    delete: (id: string) => Promise<void>;
    toggle: (id: string) => Promise<Subtask>;
    reorder: (taskId: string, ids: string[]) => Promise<void>;
  };

  // Reminders
  reminders: {
    create: (data: CreateReminderDto) => Promise<Reminder>;
    delete: (id: string) => Promise<void>;
  };

  // App
  app: {
    getVersion: () => Promise<string>;
    getTheme: () => Promise<'light' | 'dark' | 'system'>;
    setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
    minimizeWindow: () => Promise<void>;
    toggleMaximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    minimizeToTray: () => Promise<void>;
    quit: () => Promise<void>;
    openExternal: (url: string) => Promise<void>;
    onQuickAdd: (callback: () => void) => () => void;
  };
}

// Task filter options
export interface TaskFilter {
  listId?: string;
  status?: 'todo' | 'done' | 'all';
  priority?: number;
  tagId?: string;
  dueDate?: 'today' | 'week' | 'month' | 'overdue';
  search?: string;
}

// Extend Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
