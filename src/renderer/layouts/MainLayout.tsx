import { useCallback, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Sidebar } from '@/features/navigation/Sidebar';
import { useListStore } from '@/features/navigation/listStore';
import { PomodoroTimer } from '@/features/pomodoro';
import { ProjectReportView } from '@/features/project-report';
import { KeyboardShortcuts } from '@/features/shortcuts';
import { useUIStore } from '@/features/settings/uiStore';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { SortableTaskList, TaskDetail, QuickAdd, SearchPanel } from '@/features/tasks/components';
import { useTaskStore } from '@/features/tasks/store';
import { TimelineView } from '@/features/timeline';
import { CalendarView } from '@/features/calendar';
import { KanbanView } from '@/features/kanban';
import { MatrixView } from '@/features/matrix';
import { WindowControls } from './WindowControls';

const BOARD_VIEWS = ['calendar', 'kanban', 'timeline', 'matrix', 'project-report'] as const;

export function MainLayout() {
  const { setFilter } = useTaskStore();
  const { fetchLists, activeListId } = useListStore();
  const {
    currentView,
    isDetailPanelOpen,
    isQuickAddOpen,
    isSidebarOpen,
    isShortcutsHelpOpen,
    openQuickAdd,
    closeQuickAdd,
    toggleSearch,
    togglePomodoro,
    toggleSidebar,
    toggleShortcutsHelp,
    setCurrentView,
    theme,
  } = useUIStore();
  const usesOverlayDetail = BOARD_VIEWS.includes(currentView as (typeof BOARD_VIEWS)[number]);
  const detailMode =
    currentView === 'project-report' ? 'modal' : usesOverlayDetail ? 'drawer' : 'inline';

  useEffect(() => {
    void fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    switch (currentView) {
      case 'inbox':
        setFilter({ listId: 'inbox', status: 'todo' });
        break;
      case 'today':
        setFilter({ dueDate: 'today', status: 'todo' });
        break;
      case 'upcoming':
        setFilter({ dueDate: 'week', status: 'todo' });
        break;
      case 'calendar':
      case 'timeline':
      case 'kanban':
      case 'matrix':
      case 'project-report':
        setFilter({ status: 'all' });
        break;
      case 'list':
        if (activeListId) {
          setFilter({ listId: activeListId, status: 'todo' });
        }
        break;
      default:
        setFilter({ status: 'todo' });
    }
  }, [activeListId, currentView, setFilter]);

  useEffect(() => {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  useEffect(() => {
    if (BOARD_VIEWS.includes(currentView as (typeof BOARD_VIEWS)[number]) && isQuickAddOpen) {
      closeQuickAdd();
    }
  }, [closeQuickAdd, currentView, isQuickAddOpen]);

  const showQuickAdd = useCallback(() => {
    if (BOARD_VIEWS.includes(currentView as (typeof BOARD_VIEWS)[number])) {
      setCurrentView('inbox');
    }
    openQuickAdd();
  }, [currentView, openQuickAdd, setCurrentView]);

  useEffect(() => window.electronAPI.app.onQuickAdd(showQuickAdd), [showQuickAdd]);

  useHotkeys('n', showQuickAdd, { preventDefault: true });
  useHotkeys('ctrl+f, cmd+f', () => toggleSearch(), { preventDefault: true });
  useHotkeys('p', () => togglePomodoro(), { preventDefault: true });
  useHotkeys('shift+/', () => toggleShortcutsHelp(), { preventDefault: true });
  useHotkeys(
    'escape',
    () => {
      if (isShortcutsHelpOpen) toggleShortcutsHelp();
    },
    { preventDefault: true }
  );
  useHotkeys(
    '[',
    () => {
      if (isSidebarOpen) toggleSidebar();
    },
    { preventDefault: true }
  );
  useHotkeys(
    ']',
    () => {
      if (!isSidebarOpen) toggleSidebar();
    },
    { preventDefault: true }
  );
  useHotkeys('g i', () => setCurrentView('inbox'), { preventDefault: true });
  useHotkeys('g t', () => setCurrentView('today'), { preventDefault: true });
  useHotkeys('g u', () => setCurrentView('upcoming'), { preventDefault: true });
  useHotkeys('g c', () => setCurrentView('calendar'), { preventDefault: true });
  useHotkeys('g k', () => setCurrentView('kanban'), { preventDefault: true });
  useHotkeys('g l', () => setCurrentView('timeline'), { preventDefault: true });
  useHotkeys('g m', () => setCurrentView('matrix'), { preventDefault: true });
  useHotkeys('g r', () => setCurrentView('project-report'), { preventDefault: true });

  const viewTitles: Record<string, string> = {
    inbox: '收件箱',
    today: '今天',
    upcoming: '即将到来',
    calendar: '日历',
    list: '列表',
    kanban: '看板',
    timeline: '时间线',
    matrix: '四象限',
    'project-report': '项目报告',
  };

  const renderContent = () => {
    switch (currentView) {
      case 'calendar':
        return <CalendarView />;
      case 'kanban':
        return <KanbanView />;
      case 'timeline':
        return <TimelineView />;
      case 'matrix':
        return <MatrixView />;
      case 'project-report':
        return <ProjectReportView />;
      default:
        return (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-hidden">
              <SortableTaskList />
            </div>

            <div className="border-t p-4">
              <QuickAdd
                isOpen={isQuickAddOpen}
                onOpenChange={(open) => {
                  if (open) {
                    openQuickAdd();
                    return;
                  }
                  closeQuickAdd();
                }}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="drag-region flex h-14 items-center justify-between border-b">
          <div className="flex min-w-0 flex-1 items-center px-6">
            <h2 className="no-drag text-lg font-semibold">{viewTitles[currentView] || '任务'}</h2>
          </div>
          <WindowControls />
        </header>

        <div className="relative flex flex-1 overflow-hidden">
          {renderContent()}
          {isDetailPanelOpen && <TaskDetail mode={detailMode} />}
        </div>
      </div>

      <SearchPanel />
      <PomodoroTimer />
      <KeyboardShortcuts isOpen={isShortcutsHelpOpen} onClose={toggleShortcutsHelp} />
      <SettingsDialog />
    </div>
  );
}
