import { useMemo, useState } from 'react';
import { Plus, Sun, Inbox } from 'lucide-react';
import { useTaskStore } from '../store';
import { useUIStore } from '@/features/settings/uiStore';
import { useLocalDay, useWorkspaceTasks } from '../use-workspace-tasks';
import { isTodayTask, needsReschedule } from '../task-selectors';
import { groupPlannedTasks } from '../plan-groups';
import { BatchSelection } from './BatchSelection';
import { TaskSection } from './TaskSection';

export function TaskWorkspace() {
  const tasks = useWorkspaceTasks();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const scrollRef = useMemo(() => ({ current: scrollElement }), [scrollElement]);
  const today = useLocalDay();
  const view = useUIStore(s => s.currentView);
  const planGroups = useMemo(() => view === 'upcoming' ? groupPlannedTasks(tasks, today) : [], [tasks, today, view]);
  const openQuick = useUIStore(s => s.openQuickAdd);
  const isLoading = useTaskStore(s => s.isLoading);
  const error = useTaskStore(s => s.error);
  const fetchTasks = useTaskStore(s => s.fetchTasks);
  const groups = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
    return { today: sorted.filter(t => isTodayTask(t, today)), later: sorted.filter(t => needsReschedule(t, today)), todo: sorted.filter(t => t.status === 'todo'), done: sorted.filter(t => t.status === 'done'), canceled: sorted.filter(t => t.status === 'canceled') };
  }, [tasks, today]);
  return <div className="task-workspace-frame"><BatchSelection tasks={tasks} today={today}>
    <div ref={setScrollElement} className="task-workspace"><div className="task-workspace-inner">
    {error && <div role="alert" className="inline-error">{error}<button onClick={() => void fetchTasks()}>重试加载</button><button onClick={() => useTaskStore.getState().clearError()}>关闭提示</button></div>}
    {isLoading && !tasks.length ? <div className="task-skeleton" role="status">正在读取任务…</div> : <>
      {view === 'today' ? <>
        <div className="daily-progress"><span>{groups.today.length ? <><strong>{groups.today.length}</strong> 件事，留给今天</> : '今天的安排，由你决定。'}</span><span>{groups.done.length} 件已完成</span></div>
        <TaskSection scrollRef={scrollRef} title="今天要做" tasks={groups.today} today={today} />
        {!groups.today.length && <div className="today-empty"><Sun size={30} strokeWidth={1.3} /><h2>留一点空间，给重要的事</h2><p>添加一件任务，或从项目中加入今天。</p><button onClick={openQuick}><Plus size={15} />安排今天</button></div>}
        <TaskSection scrollRef={scrollRef} title="待重新安排" tasks={groups.later} today={today} tone="text-amber-700 dark:text-amber-400" />
      </> : view === 'upcoming' ? <><p className="plan-explanation">按计划日期排列；没有计划日期时，按截止日期排列。</p>{planGroups.map(group => <TaskSection dateOrdered key={group.id} scrollRef={scrollRef} title={group.title} tasks={group.tasks} today={today} tone={group.id === 'past' ? 'text-amber-700 dark:text-amber-400' : undefined} />)}</> : <TaskSection scrollRef={scrollRef} title="待办任务" tasks={groups.todo} today={today} />}
      <button type="button" className="inline-add" onClick={openQuick}><Plus size={18} />添加任务<span>N</span></button>
      <TaskSection scrollRef={scrollRef} title={view === 'today' ? '今日已完成' : '已完成'} tasks={groups.done} today={today} collapsed />
      <TaskSection scrollRef={scrollRef} title="已取消" tasks={groups.canceled} today={today} collapsed />
      {view !== 'today' && !tasks.length && !error && <div className="today-empty"><Inbox size={30} strokeWidth={1.3} /><h2>这里还没有任务</h2><p>{view === 'upcoming' ? '给任务设置计划日期或截止日期，就会出现在这里。' : '从一件小事开始，慢慢整理你的计划。'}</p></div>}
    </>}
    </div></div>
  </BatchSelection></div>;
}
