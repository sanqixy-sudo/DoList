import type { UndoInfo } from '../../../../types/task-mutations';
import { create } from 'zustand';
import type { Task, CreateTaskDto, UpdateTaskDto, BulkTaskUpdateDto } from '../../../../types/models';
import type { TaskFilter } from '../../../../types/ipc';
interface TaskState {
  undoInfo: UndoInfo | null; undoChange: () => Promise<void>; dismissUndo: () => void;
  drainWrites: () => Promise<void>;
  trashedTasks: Task[]; trashLoading: boolean; trashError: string | null; lastTrashedIds: string[];
  fetchTrash: () => Promise<void>;
  bulkUpdateTasks: (ids: string[], data: BulkTaskUpdateDto) => Promise<void>;
  trashTasks: (ids: string[]) => Promise<void>;
  restoreTasks: (ids: string[]) => Promise<void>;
  purgeTasks: (ids: string[]) => Promise<void>;
  dismissTrashNotice: () => void;
  tasks: Task[]; isLoading: boolean; error: string | null; filter: TaskFilter;
  fetchTasks: (filter?: TaskFilter) => Promise<void>;
  createTask: (data: CreateTaskDto) => Promise<Task>;
  updateTask: (id: string, data: UpdateTaskDto) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>; toggleTask: (id: string) => Promise<void>;
  searchTasks: (query: string) => Promise<Task[]>; setFilter: (filter: TaskFilter) => void;
  reorderTasks: (ids: string[]) => Promise<void>; setTask: (task: Task) => void; clearError: () => void;
}
let fetchSequence = 0, trashSequence = 0, revision = 0;
const removedIds = new Set<string>();
// Preserve ordering between single-task writes and overlapping bulk writes.
let writeTail: Promise<unknown> = Promise.resolve();
function serial<T>(action: () => Promise<T>): Promise<T> {
  const next = writeTail.then(action);
  writeTail = next.catch(() => {});
  return next;
}
// Canonical collection: changing a view never replaces task data.
export const useTaskStore = create<TaskState>((set, get) => ({
  undoInfo: null, dismissUndo: () => set({ undoInfo: null }), drainWrites: () => writeTail.then(() => {}),
  undoChange: () => serial(async () => {
    const info = get().undoInfo; if (!info) return;
    const tasks = await window.electronAPI.tasks.undo(info.token);
    const changes = new Map(tasks.map(task => [task.id, task])); revision++;
    set(state => ({ tasks: state.tasks.map(task => changes.get(task.id) ?? task), undoInfo: null }));
  }),
  trashedTasks: [], trashLoading: false, trashError: null, lastTrashedIds: [],
  dismissTrashNotice: () => set({ lastTrashedIds: [] }),
  fetchTrash: async () => {
    const sequence = ++trashSequence, startedAt = revision;
    set({ trashLoading: true, trashError: null });
    try {
      const tasks = await window.electronAPI.tasks.trashList();
      if (sequence !== trashSequence) return;
      if (startedAt !== revision) return get().fetchTrash();
      set({ trashedTasks: tasks, trashLoading: false });
    } catch { if (sequence === trashSequence) set({ trashLoading: false, trashError: '回收站加载失败，请重试。' }); }
  },
  bulkUpdateTasks: (ids, data) => serial(async () => {
    const result = await window.electronAPI.tasks.bulkUpdate(ids, data);
    const updated = result.tasks;
    const byId = new Map(updated.map(task => [task.id, task]));
    revision++;
    set(state => ({ tasks: state.tasks.map(task => byId.get(task.id) ?? task), undoInfo: result.undo, lastTrashedIds: [] }));
  }),
  trashTasks: ids => serial(async () => {
    await window.electronAPI.tasks.trash(ids);
    ids.forEach(id => removedIds.add(id)); revision++;
    const members = new Set(ids);
    set(state => ({ tasks: state.tasks.filter(task => !members.has(task.id)), lastTrashedIds: ids, undoInfo: null }));
  }),
  restoreTasks: ids => serial(async () => {
    const restored = await window.electronAPI.tasks.restore(ids);
    ids.forEach(id => removedIds.delete(id)); revision++;
    const members = new Set(ids);
    set(state => ({
      tasks: [...state.tasks.filter(task => !members.has(task.id)), ...restored],
      trashedTasks: state.trashedTasks.filter(task => !members.has(task.id)),
      lastTrashedIds: state.lastTrashedIds.filter(id => !members.has(id)),
    }));
  }),
  purgeTasks: ids => serial(async () => {
    await window.electronAPI.tasks.purge(ids); revision++;
    const members = new Set(ids);
    set(state => ({ trashedTasks: state.trashedTasks.filter(task => !members.has(task.id)), lastTrashedIds: state.lastTrashedIds.filter(id => !members.has(id)) }));
  }),
  tasks: [], isLoading: false, error: null, filter: { status: 'all' },
  clearError: () => set({ error: null }),
  setTask: task => {
    if (task.deletedAt || removedIds.has(task.id)) return;
    revision++;
    set(state => ({ tasks: state.tasks.some(t => t.id === task.id)
      ? state.tasks.map(t => t.id === task.id ? task : t) : [...state.tasks, task] }));
  },
  fetchTasks: async () => {
    const sequence = ++fetchSequence, startedAt = revision;
    set({ isLoading: true, error: null });
    try {
      const tasks = await window.electronAPI.tasks.list({ status: 'all' });
      if (sequence !== fetchSequence) return;
      if (startedAt !== revision) return get().fetchTasks();
      set({ tasks, isLoading: false });
    } catch { if (sequence === fetchSequence) set({ error: '任务加载失败，请重试。', isLoading: false }); }
  },
  createTask: async data => {
    try { const task = await window.electronAPI.tasks.create(data); get().setTask(task); return task; }
    catch (error) { set({ error: '任务未能保存，请保留输入并重试。' }); throw error; }
  },
  updateTask: (id, data) => serial(async () => {
    try { const result = await window.electronAPI.tasks.update(id, data); get().setTask(result.task); set({ error: null });
      if (result.undo) set({ undoInfo: result.undo, lastTrashedIds: [] });
      return result.task; }
    catch (error) { set({ error: '“' + (get().tasks.find(t => t.id === id)?.title ?? '任务') + '”的' + (data.title !== undefined || data.notes !== undefined ? '标题或备注' : data.listId !== undefined ? '项目归属' : data.status !== undefined ? '完成状态' : data.plannedDate !== undefined ? '计划日期' : '修改') + '未能保存，请重试。' }); throw error; }
  }),
  deleteTask: async id => {
    try { await get().trashTasks([id]); }
    catch (error) { set({ error: '移入回收站失败，任务仍保留。' }); throw error; }
  },
  toggleTask: async id => {
    const task = get().tasks.find(t => t.id === id);
    if (task) await get().updateTask(id, { status: task.status === 'done' ? 'todo' : 'done' });
  },
  searchTasks: query => window.electronAPI.tasks.search(query),
  setFilter: filter => set({ filter }),
  reorderTasks: ids => serial(async () => {
    try {
      await window.electronAPI.tasks.reorder(ids); revision++;
      const order = new Map(ids.map((id, index) => [id, index]));
      set(state => ({ tasks: state.tasks.map(t => order.has(t.id) ? { ...t, sortOrder: order.get(t.id)! } : t) }));
    } catch { set({ error: '排序未能保存，请重试。' }); }
  }),
}));
