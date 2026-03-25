import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, ElectronAPI } from '../../types/ipc';
import type {
  CreateTaskDto,
  CreateTaskAttachmentDto,
  UpdateTaskDto,
  CreateListDto,
  CreateProjectGroupDto,
  CreateSubtaskDto,
  CreateReminderDto,
  List,
  ProjectGroup,
  Tag,
  Subtask,
} from '../../types/models';
import type { TaskFilter } from '../../types/ipc';

const electronAPI: ElectronAPI = {
  tasks: {
    list: (filter?: TaskFilter) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_LIST, filter),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_GET, id),
    create: (data: CreateTaskDto) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_CREATE, data),
    update: (id: string, data: UpdateTaskDto) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_UPDATE, id, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_DELETE, id),
    search: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_SEARCH, query),
    reorder: (ids: string[]) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_REORDER, ids),
    pickAttachments: () => ipcRenderer.invoke(IPC_CHANNELS.TASKS_PICK_ATTACHMENTS),
    pasteClipboardImage: () => ipcRenderer.invoke(IPC_CHANNELS.TASKS_PASTE_CLIPBOARD_IMAGE),
    getAttachmentPreviewUrl: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_GET_ATTACHMENT_PREVIEW_URL, filePath),
    addAttachment: (taskId: string, data: CreateTaskAttachmentDto) =>
      ipcRenderer.invoke(IPC_CHANNELS.TASKS_ADD_ATTACHMENT, taskId, data),
    removeAttachment: (attachmentId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.TASKS_REMOVE_ATTACHMENT, attachmentId),
    openAttachment: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_OPEN_ATTACHMENT, filePath),
  },

  lists: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.LISTS_LIST),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.LISTS_GET, id),
    create: (data: CreateListDto) => ipcRenderer.invoke(IPC_CHANNELS.LISTS_CREATE, data),
    update: (id: string, data: Partial<List>) => ipcRenderer.invoke(IPC_CHANNELS.LISTS_UPDATE, id, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.LISTS_DELETE, id),
    reorder: (ids: string[]) => ipcRenderer.invoke(IPC_CHANNELS.LISTS_REORDER, ids),
  },

  projectGroups: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GROUPS_LIST),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GROUPS_GET, id),
    create: (data: CreateProjectGroupDto) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GROUPS_CREATE, data),
    update: (id: string, data: Partial<ProjectGroup>) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GROUPS_UPDATE, id, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GROUPS_DELETE, id),
    reorder: (ids: string[]) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GROUPS_REORDER, ids),
  },

  tags: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.TAGS_LIST),
    create: (name: string, color?: string) => ipcRenderer.invoke(IPC_CHANNELS.TAGS_CREATE, name, color),
    update: (id: string, data: Partial<Tag>) => ipcRenderer.invoke(IPC_CHANNELS.TAGS_UPDATE, id, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TAGS_DELETE, id),
  },

  subtasks: {
    create: (data: CreateSubtaskDto) => ipcRenderer.invoke(IPC_CHANNELS.SUBTASKS_CREATE, data),
    update: (id: string, data: Partial<Subtask>) => ipcRenderer.invoke(IPC_CHANNELS.SUBTASKS_UPDATE, id, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SUBTASKS_DELETE, id),
    toggle: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SUBTASKS_TOGGLE, id),
    reorder: (taskId: string, ids: string[]) => ipcRenderer.invoke(IPC_CHANNELS.SUBTASKS_REORDER, taskId, ids),
  },

  reminders: {
    create: (data: CreateReminderDto) => ipcRenderer.invoke(IPC_CHANNELS.REMINDERS_CREATE, data),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.REMINDERS_DELETE, id),
  },

  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
    getTheme: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_THEME),
    setTheme: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke(IPC_CHANNELS.APP_SET_THEME, theme),
    minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_WINDOW_MINIMIZE),
    toggleMaximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_WINDOW_TOGGLE_MAXIMIZE),
    closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.APP_WINDOW_CLOSE),
    minimizeToTray: () => ipcRenderer.invoke(IPC_CHANNELS.APP_MINIMIZE_TO_TRAY),
    quit: () => ipcRenderer.invoke(IPC_CHANNELS.APP_QUIT),
    openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_EXTERNAL, url),
    onQuickAdd: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.APP_QUICK_ADD, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.APP_QUICK_ADD, listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
