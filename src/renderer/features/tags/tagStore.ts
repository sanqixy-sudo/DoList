import { create } from 'zustand';
import type { Tag } from '../../../../types/models';

interface TagState {
  tags: Tag[];
  isLoading: boolean;
  error: string | null;

  fetchTags: () => Promise<void>;
  createTag: (name: string, color?: string) => Promise<Tag>;
  updateTag: (id: string, data: Partial<Tag>) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  isLoading: false,
  error: null,

  fetchTags: async () => {
    set({ isLoading: true, error: null });
    try {
      const tags = await window.electronAPI.tags.list();
      set({ tags, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createTag: async (name: string, color?: string) => {
    try {
      const tag = await window.electronAPI.tags.create(name, color);
      set((state) => ({ tags: [...state.tags, tag] }));
      return tag;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  updateTag: async (id: string, data: Partial<Tag>) => {
    try {
      const tag = await window.electronAPI.tags.update(id, data);
      set((state) => ({
        tags: state.tags.map((t) => (t.id === id ? tag : t)),
      }));
      return tag;
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  deleteTag: async (id: string) => {
    try {
      await window.electronAPI.tags.delete(id);
      set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },
}));
