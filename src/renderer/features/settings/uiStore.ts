import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'list' | 'calendar' | 'kanban' | 'timeline';
type Theme = 'light' | 'dark' | 'system';
type CalendarViewType = 'month' | 'week' | 'day' | 'multiDay' | 'multiWeek';

interface UIState {
  // Sidebar
  isSidebarOpen: boolean;
  sidebarWidth: number;

  // Task detail panel
  activeTaskId: string | null;
  isDetailPanelOpen: boolean;

  // View
  viewMode: ViewMode;
  currentView:
    | 'inbox'
    | 'today'
    | 'upcoming'
    | 'calendar'
    | 'list'
    | 'tag'
    | 'trash'
    | 'kanban'
    | 'timeline'
    | 'matrix'
    | 'project-report';
  calendarViewType: CalendarViewType;

  // Theme
  theme: Theme;

  // Quick add
  isQuickAddOpen: boolean;
  quickAddPlannedDate: string | null;

  // Search
  isSearchOpen: boolean;
  searchQuery: string;

  // Pomodoro
  isPomodoroOpen: boolean;
  pomodoroTaskId: string | null;

  // Keyboard shortcuts help
  isShortcutsHelpOpen: boolean;

  // Settings
  isSettingsOpen: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  selectTask: (id: string | null) => void;
  closeDetailPanel: () => void;
  setViewMode: (mode: ViewMode) => void;
  setCurrentView: (view: UIState['currentView']) => void;
  setCalendarViewType: (type: CalendarViewType) => void;
  setTheme: (theme: Theme) => void;
  openQuickAdd: () => void;
  openQuickAddForDate: (date: string) => void;
  closeQuickAdd: () => void;
  toggleQuickAdd: () => void;
  toggleSearch: () => void;
  setSearchQuery: (query: string) => void;
  togglePomodoro: () => void;
  startPomodoroForTask: (taskId: string) => void;
  toggleShortcutsHelp: () => void;
  toggleSettings: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      isSidebarOpen: true,
      sidebarWidth: 240,
      activeTaskId: null,
      isDetailPanelOpen: false,
      viewMode: 'list',
      currentView: 'today',
      calendarViewType: 'month',
      theme: 'system',
      isQuickAddOpen: false,
      quickAddPlannedDate: null,
      isSearchOpen: false,
      searchQuery: '',
      isPomodoroOpen: false,
      pomodoroTaskId: null,
      isShortcutsHelpOpen: false,
      isSettingsOpen: false,

      // Actions
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      setSidebarWidth: (width: number) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),

      selectTask: (id: string | null) => set({
        activeTaskId: id,
        isDetailPanelOpen: id !== null,
      }),

      closeDetailPanel: () => set({
        activeTaskId: null,
        isDetailPanelOpen: false,
      }),

      setViewMode: (mode: ViewMode) => set({ viewMode: mode }),

      setCurrentView: (view) => set({ currentView: view, viewMode: 'list', activeTaskId: null, isDetailPanelOpen: false }),

      setCalendarViewType: (type: CalendarViewType) => set({ calendarViewType: type }),

      setTheme: (theme: Theme) => {
        set({ theme });
        // Apply theme to document
        if (theme === 'system') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.classList.toggle('dark', isDark);
        } else {
          document.documentElement.classList.toggle('dark', theme === 'dark');
        }
        // Sync with main process
        window.electronAPI.app.setTheme(theme);
      },

      openQuickAdd: () => set({ isQuickAddOpen: true, quickAddPlannedDate: null }),

      openQuickAddForDate: date => set({ isQuickAddOpen: true, quickAddPlannedDate: date }),

      closeQuickAdd: () => set({ isQuickAddOpen: false, quickAddPlannedDate: null }),

      toggleQuickAdd: () => set((state) => ({ isQuickAddOpen: !state.isQuickAddOpen, quickAddPlannedDate: null })),

      toggleSearch: () => set((state) => ({
        isSearchOpen: !state.isSearchOpen,
        searchQuery: state.isSearchOpen ? '' : state.searchQuery,
      })),

      setSearchQuery: (query: string) => set({ searchQuery: query }),

      togglePomodoro: () => set((state) => ({ isPomodoroOpen: !state.isPomodoroOpen })),

      startPomodoroForTask: (taskId: string) => set({
        isPomodoroOpen: true,
        pomodoroTaskId: taskId,
      }),

      toggleShortcutsHelp: () => set((state) => ({ isShortcutsHelpOpen: !state.isShortcutsHelpOpen })),

      toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
    }),
    {
      name: 'dolist-ui-storage',
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
        sidebarWidth: state.sidebarWidth,
        theme: state.theme,
        viewMode: state.viewMode,
        calendarViewType: state.calendarViewType,
      }),
    }
  )
);
