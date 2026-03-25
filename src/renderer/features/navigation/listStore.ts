import { create } from 'zustand';
import type { CreateListDto, CreateProjectGroupDto, List, ProjectGroup } from '../../../../types/models';

interface ListState {
  lists: List[];
  projectGroups: ProjectGroup[];
  activeListId: string | null;
  activeProjectGroupId: string | null;
  isLoading: boolean;

  fetchLists: () => Promise<void>;
  fetchProjectGroups: () => Promise<void>;
  createList: (data: CreateListDto) => Promise<List>;
  updateList: (id: string, data: Partial<List>) => Promise<List>;
  deleteList: (id: string) => Promise<void>;
  createProjectGroup: (data: CreateProjectGroupDto) => Promise<ProjectGroup>;
  updateProjectGroup: (id: string, data: Partial<ProjectGroup>) => Promise<ProjectGroup>;
  deleteProjectGroup: (id: string) => Promise<void>;
  setActiveList: (id: string | null) => void;
  setActiveProjectGroup: (id: string | null) => void;
}

export const useListStore = create<ListState>((set, get) => ({
  lists: [],
  projectGroups: [],
  activeListId: null,
  activeProjectGroupId: 'default-group',
  isLoading: false,

  fetchLists: async () => {
    set({ isLoading: true });
    try {
      const [lists, projectGroups] = await Promise.all([
        window.electronAPI.lists.list(),
        window.electronAPI.projectGroups.list(),
      ]);

      set((state) => ({
        lists,
        projectGroups,
        isLoading: false,
        activeProjectGroupId:
          state.activeProjectGroupId && projectGroups.some((group) => group.id === state.activeProjectGroupId)
            ? state.activeProjectGroupId
            : projectGroups[0]?.id ?? null,
      }));
    } catch (error) {
      console.error('Failed to fetch lists/project groups:', error);
      set({ isLoading: false });
    }
  },

  fetchProjectGroups: async () => {
    try {
      const projectGroups = await window.electronAPI.projectGroups.list();
      set((state) => ({
        projectGroups,
        activeProjectGroupId:
          state.activeProjectGroupId && projectGroups.some((group) => group.id === state.activeProjectGroupId)
            ? state.activeProjectGroupId
            : projectGroups[0]?.id ?? null,
      }));
    } catch (error) {
      console.error('Failed to fetch project groups:', error);
    }
  },

  createList: async (data: CreateListDto) => {
    const list = await window.electronAPI.lists.create(data);
    set((state) => ({
      lists: [...state.lists, list],
      activeProjectGroupId: list.groupId ?? state.activeProjectGroupId,
    }));
    return list;
  },

  updateList: async (id: string, data: Partial<List>) => {
    const list = await window.electronAPI.lists.update(id, data);
    set((state) => ({
      lists: state.lists.map((entry) => (entry.id === id ? list : entry)),
    }));
    return list;
  },

  deleteList: async (id: string) => {
    await window.electronAPI.lists.delete(id);
    set((state) => ({
      lists: state.lists.filter((entry) => entry.id !== id),
      activeListId: state.activeListId === id ? null : state.activeListId,
    }));
  },

  createProjectGroup: async (data: CreateProjectGroupDto) => {
    const projectGroup = await window.electronAPI.projectGroups.create(data);
    set((state) => ({
      projectGroups: [...state.projectGroups, projectGroup],
      activeProjectGroupId: projectGroup.id,
    }));
    return projectGroup;
  },

  updateProjectGroup: async (id: string, data: Partial<ProjectGroup>) => {
    const projectGroup = await window.electronAPI.projectGroups.update(id, data);
    set((state) => ({
      projectGroups: state.projectGroups.map((entry) => (entry.id === id ? projectGroup : entry)),
    }));
    return projectGroup;
  },

  deleteProjectGroup: async (id: string) => {
    await window.electronAPI.projectGroups.delete(id);
    await get().fetchLists();
    set((state) => ({
      activeProjectGroupId:
        state.activeProjectGroupId === id
          ? get().projectGroups[0]?.id ?? null
          : state.activeProjectGroupId,
    }));
  },

  setActiveList: (id: string | null) => {
    const list = id ? get().lists.find((entry) => entry.id === id) : null;
    set({
      activeListId: id,
      activeProjectGroupId: list?.groupId ?? get().activeProjectGroupId,
    });
  },

  setActiveProjectGroup: (id: string | null) => {
    set({ activeProjectGroupId: id });
  },
}));
