import { create } from 'zustand';
import type { Task, CreateTaskDto, UpdateTaskDto } from '../../../../types/models';
import type { TaskFilter } from '../../../../types/ipc';

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  filter: TaskFilter;

  // Actions
  fetchTasks: (filter?: TaskFilter) => Promise<void>;
  createTask: (data: CreateTaskDto) => Promise<Task>;
  updateTask: (id: string, data: UpdateTaskDto) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  searchTasks: (query: string) => Promise<Task[]>;
  setFilter: (filter: TaskFilter) => void;
  reorderTasks: (ids: string[]) => Promise<void>;
  setTask: (task: Task) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  filter: { status: 'all' },

  setTask: (task: Task) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
    }));
  },

  fetchTasks: async (filter?: TaskFilter) => {
    set({ isLoading: true, error: null });
    try {
      const currentFilter = filter || get().filter;
      const tasks = await window.electronAPI.tasks.list(currentFilter);
      set({ tasks, filter: currentFilter, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createTask: async (data: CreateTaskDto) => {
    try {
      const task = await window.electronAPI.tasks.create(data);
      set((state) => ({ tasks: [task, ...state.tasks] }));
      return task;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  updateTask: async (id: string, data: UpdateTaskDto) => {
    try {
      const task = await window.electronAPI.tasks.update(id, data);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? task : t)),
      }));
      return task;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteTask: async (id: string) => {
    try {
      await window.electronAPI.tasks.delete(id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  toggleTask: async (id: string) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;

    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await get().updateTask(id, { status: newStatus });
  },

  searchTasks: async (query: string) => {
    try {
      return await window.electronAPI.tasks.search(query);
    } catch (error) {
      set({ error: (error as Error).message });
      return [];
    }
  },

  setFilter: (filter: TaskFilter) => {
    set({ filter });
    get().fetchTasks(filter);
  },

  reorderTasks: async (ids: string[]) => {
    try {
      await window.electronAPI.tasks.reorder(ids);
      // Reorder local state
      const taskMap = new Map(get().tasks.map((t) => [t.id, t]));
      const reorderedTasks = ids.map((id) => taskMap.get(id)!).filter(Boolean);
      set({ tasks: reorderedTasks });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
}));
