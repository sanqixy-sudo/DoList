import { SaveNotice } from './SaveNotice';
import { lazy, Suspense, useEffect, useState, useRef } from 'react';
import { MotionConfig } from 'framer-motion';
import { useHotkeys } from 'react-hotkeys-hook';
import { CalendarDays, Columns, List, PanelLeft, Plus, Sun, Clock3 } from 'lucide-react';
import { Sidebar } from '@/features/navigation/Sidebar';
import { useListStore } from '@/features/navigation/listStore';
import { useUIStore, type ViewMode } from '@/features/settings/uiStore';
import { useTaskStore } from '@/features/tasks/store';
import { ActionNotice } from '@/features/tasks/components/ActionNotice';
import { TaskWorkspace } from '@/features/tasks/components/TaskWorkspace';
import { WindowControls } from './WindowControls';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useLocalDay } from '@/features/tasks/use-workspace-tasks';
import { cn } from '@/lib/utils';
const TaskDetail = lazy(() => import('@/features/tasks/components/TaskDetail').then(m => ({ default: m.TaskDetail })));
const QuickAdd = lazy(() => import('@/features/tasks/components/QuickAdd').then(m => ({ default: m.QuickAdd })));
const SearchPanel = lazy(() => import('@/features/tasks/components/SearchPanel').then(m => ({ default: m.SearchPanel })));
const PomodoroTimer = lazy(() => import('@/features/pomodoro/PomodoroTimer').then(m => ({ default: m.PomodoroTimer })));
const SettingsDialog = lazy(() => import('@/features/settings/SettingsDialog').then(m => ({ default: m.SettingsDialog })));
const KeyboardShortcuts = lazy(() => import('@/features/shortcuts/KeyboardShortcuts').then(m => ({ default: m.KeyboardShortcuts })));
const TrashView = lazy(() => import('@/features/tasks/components/TrashView').then(m => ({ default: m.TrashView })));
const CalendarView = lazy(() => import('@/features/calendar/CalendarView').then(m => ({ default: m.CalendarView })));
const KanbanView = lazy(() => import('@/features/kanban/KanbanView').then(m => ({ default: m.KanbanView })));
const TimelineView = lazy(() => import('@/features/timeline/TimelineView').then(m => ({ default: m.TimelineView })));
const MatrixView = lazy(() => import('@/features/matrix/MatrixView').then(m => ({ default: m.MatrixView })));
const ProjectReportView = lazy(() => import('@/features/project-report/ProjectReportView').then(m => ({ default: m.ProjectReportView })));

export function MainLayout() {
  const view = useUIStore(s => s.currentView);
  const mode = useUIStore(s => s.viewMode);
  const setMode = useUIStore(s => s.setViewMode);
  const setView = useUIStore(s => s.setCurrentView);
  const quickOpen = useUIStore(s => s.isQuickAddOpen);
  const openQuick = useUIStore(s => s.openQuickAdd);
  const closeQuick = useUIStore(s => s.closeQuickAdd);
  const detailOpen = useUIStore(s => s.isDetailPanelOpen);
  const activeTaskId = useUIStore(s => s.activeTaskId);
  const theme = useUIStore(s => s.theme);
  const helpOpen = useUIStore(s => s.isShortcutsHelpOpen);
  const toggleHelp = useUIStore(s => s.toggleShortcutsHelp);
  const lists = useListStore(s => s.lists);
  const listId = useListStore(s => s.activeListId);
  const fetchTasks = useTaskStore(s => s.fetchTasks);
  const fetchLists = useListStore(s => s.fetchLists);
  const today = useLocalDay();
  const quickSaving = useRef(false);
  const settingsOpen = useUIStore(s => s.isSettingsOpen);
  const searchOpen = useUIStore(s => s.isSearchOpen);
  const pomodoroOpen = useUIStore(s => s.isPomodoroOpen);
  const pomodoroLoaded = useRef(false);
  if (pomodoroOpen) pomodoroLoaded.current = true;
  const [restorePath, setRestorePath] = useState(() => sessionStorage.getItem('dolist-restored-backup'));

  const [compact, setCompact] = useState(() => window.innerWidth < 1100);
  useEffect(() => { void fetchTasks(); void fetchLists(); }, [fetchTasks, fetchLists]);
  useEffect(() => {
    const query = matchMedia('(max-width: 1099px)');
    const update = () => setCompact(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && query.matches));
    apply(); query.addEventListener('change', apply);
    void window.electronAPI.app.setTheme(theme).catch(() => {});
    return () => query.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => window.electronAPI.app.onQuickAdd(openQuick), [openQuick]);
  useHotkeys('n', openQuick, { preventDefault: true, enabled: !settingsOpen && !searchOpen && !helpOpen });
  useHotkeys('ctrl+f,meta+f', () => useUIStore.getState().toggleSearch(), { preventDefault: true, enabled: !settingsOpen && !quickOpen && !helpOpen });
  useHotkeys('p', () => useUIStore.getState().togglePomodoro(), { preventDefault: true, enabled: !settingsOpen && !quickOpen && !searchOpen && !helpOpen });
  useHotkeys('shift+/', toggleHelp, { preventDefault: true });
  useHotkeys('g i', () => setView('inbox'));
  useHotkeys('g t', () => setView('today'));
  useHotkeys('g u', () => setView('upcoming'));
  useHotkeys('[,]', () => useUIStore.getState().toggleSidebar());
  const names: Record<string, string> = { trash: '回收站', today: '今天', inbox: '收件箱', upcoming: '计划', list: lists.find(l => l.id === listId)?.name ?? '项目', matrix: '四象限', 'project-report': '回顾', calendar: '日历', kanban: '看板', timeline: '时间线' };
  const title = names[view] ?? '任务';
  const subtitle = view === 'today'
    ? new Date(today + 'T12:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
    : view === 'trash' ? '误删的任务，随时找回来。'
    : view === 'inbox' ? '先记下来，再从容安排。'
    : view === 'upcoming' ? '按自己的节奏，安排接下来的日子。'
    : view === 'list' ? '把大事拆小，一件件完成。' : '用适合自己的方式，整理任务。';
  const showModes = ['today', 'inbox', 'upcoming', 'list'].includes(view);
  const effectiveMode = showModes ? mode : view;
  const content = view === 'trash' ? <TrashView /> : effectiveMode === 'calendar' ? <CalendarView /> : effectiveMode === 'kanban' ? <KanbanView />
    : effectiveMode === 'timeline' ? <TimelineView /> : view === 'matrix' ? <MatrixView />
    : view === 'project-report' ? <ProjectReportView /> : <TaskWorkspace key={view + ':' + listId} />;
  const tabs: { id: ViewMode; label: string; icon: typeof List }[] = [
    { id: 'list', label: '列表', icon: List }, { id: 'calendar', label: '日历', icon: CalendarDays },
    { id: 'kanban', label: '看板', icon: Columns }, { id: 'timeline', label: '时间线', icon: Clock3 },
  ];
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          <div className="drag-region window-bar">
            <div className="no-drag flex items-center gap-2 pl-4">
              <Button variant="ghost" size="icon" aria-label="展开或收起侧栏" onClick={() => useUIStore.getState().toggleSidebar()}><PanelLeft size={16} /></Button>
              <span className="text-xs text-muted-foreground">我的空间 <span className="mx-2 opacity-40">/</span> {title}</span>
            </div>
            <WindowControls />
          </div>
          <div className="workspace-shell">
            <div className="workspace-main">
              <header className="workspace-header">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {view === 'today' && <div className="mb-3 flex items-center gap-2 text-sm text-primary"><Sun size={18} /><span>我的一天</span></div>}
                    <h1 className="workspace-title">{title}</h1>
                    <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
                  </div>
                  {view !== 'trash' && <Button onClick={openQuick} className="mt-1 shrink-0 gap-2"><Plus size={16} />添加任务</Button>}
                </div>
                {showModes && <div className="view-tabs" role="group" aria-label="任务展示方式">
                  {tabs.map(tab => <button key={tab.id} type="button" aria-pressed={mode === tab.id} onClick={() => setMode(tab.id)} className={cn('view-tab', mode === tab.id && 'is-active')}><tab.icon size={15} />{tab.label}</button>)}
                </div>}
              </header>
              <SaveNotice />
              <ActionNotice />
              {restorePath && <div role="status" className="restore-success"><span>备份已恢复。恢复前的完整备份保存在：{restorePath}</span><button onClick={() => { sessionStorage.removeItem('dolist-restored-backup'); setRestorePath(null); }}>关闭恢复提示</button></div>}
              <div className="workspace-content"><Suspense fallback={<div role="status" className="p-8 text-sm text-muted-foreground">正在打开视图…</div>}>{content}</Suspense></div>
            </div>
            {detailOpen && !compact && <aside className="detail-rail" aria-label="任务详情"><Suspense fallback={<p role="status" className="p-6 text-sm">正在打开任务详情…</p>}><TaskDetail key={activeTaskId} mode="inline" /></Suspense></aside>}
          </div>
        </main>
        <Dialog open={detailOpen && compact} onOpenChange={open => { if (!open) useUIStore.getState().closeDetailPanel(); }}>
          <DialogContent className="detail-dialog" aria-describedby={undefined}><DialogTitle className="sr-only">任务详情</DialogTitle><Suspense fallback={<p role="status" className="p-6 text-sm">正在打开任务详情…</p>}><TaskDetail key={activeTaskId} mode="inline" /></Suspense></DialogContent>
        </Dialog>
        <Dialog open={quickOpen} onOpenChange={open => { if (!open && !quickSaving.current) closeQuick(); }}>
          <DialogContent className="quick-dialog" onPointerDownOutside={event => event.preventDefault()}><DialogTitle>添加任务</DialogTitle><DialogDescription>记下这件事，安排好自己的节奏。</DialogDescription><Suspense fallback={<p role="status">正在打开任务输入…</p>}><QuickAdd onSavingChange={saving => { quickSaving.current = saving; }} isOpen={true} onOpenChange={open => { if (!open && !quickSaving.current) closeQuick(); }} /></Suspense></DialogContent>
        </Dialog>
        <Suspense fallback={<div role="status" className="lazy-status">正在打开…</div>}>
          {searchOpen && <SearchPanel />}{pomodoroLoaded.current && <PomodoroTimer />}{settingsOpen && <SettingsDialog />}
          {helpOpen && <KeyboardShortcuts isOpen={helpOpen} onClose={toggleHelp} />}
        </Suspense>
      </div>
    </MotionConfig>
  );
}
