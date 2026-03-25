import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  isTomorrow,
  isWithinInterval,
  isYesterday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useListStore } from '@/features/navigation/listStore';
import { useUIStore } from '@/features/settings/uiStore';
import { TaskContextMenu } from '@/features/tasks/components';
import { useTaskStore } from '@/features/tasks/store';
import type { Task } from '../../../../types/models';

type ReportMode = 'week' | 'month';
type ReportEventType = 'completed' | 'created' | 'due';

interface ReportEvent {
  id: string;
  taskId: string;
  type: ReportEventType;
  title: string;
  time: Date;
  task: Task;
}

interface TrendPoint {
  date: Date;
  created: number;
  completed: number;
}

const ALL_GROUPS = '__all_groups__';
const UNGROUPED_GROUP = '__ungrouped_group__';
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function toDay(dateString: string | null): Date | null {
  if (!dateString) return null;
  return startOfDay(parseISO(dateString));
}

function formatTimelineDay(date: Date): string {
  if (isToday(date)) return '今天';
  if (isTomorrow(date)) return '明天';
  if (isYesterday(date)) return '昨天';
  return format(date, 'M月d日', { locale: zhCN });
}

function eventTypeLabel(type: ReportEventType) {
  return type === 'completed' ? '完成' : type === 'created' ? '新建' : '到期';
}

function eventTypeClasses(type: ReportEventType) {
  if (type === 'completed') return 'border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300';
  if (type === 'created') return 'border-blue-500/30 bg-blue-500/8 text-blue-700 dark:text-blue-300';
  return 'border-amber-500/30 bg-amber-500/8 text-amber-700 dark:text-amber-300';
}

function getTaskStatusLabel(status: Task['status']) {
  if (status === 'done') return '已完成';
  if (status === 'canceled') return '已取消';
  return '待处理中';
}

function getHeatmapLevel(score: number, maxScore: number) {
  if (score <= 0) return 'bg-muted/40';
  const ratio = score / Math.max(maxScore, 1);
  if (ratio >= 0.75) return 'bg-emerald-600';
  if (ratio >= 0.5) return 'bg-emerald-500';
  if (ratio >= 0.25) return 'bg-emerald-400';
  return 'bg-emerald-300';
}

function getPeriodLabel(mode: ReportMode, anchorDate: Date) {
  if (mode === 'week') {
    const from = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const to = endOfWeek(anchorDate, { weekStartsOn: 1 });
    return `周报 ${format(from, 'M.d')} - ${format(to, 'M.d')}`;
  }
  return format(anchorDate, 'yyyy年M月月报', { locale: zhCN });
}

export function ProjectReportView() {
  const { tasks } = useTaskStore();
  const {
    lists,
    projectGroups,
    activeListId,
    activeProjectGroupId,
    setActiveList,
    setActiveProjectGroup,
  } = useListStore();
  const { selectTask } = useUIStore();

  const [mode, setMode] = useState<ReportMode>('week');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const projectLists = useMemo(() => lists.filter((list) => list.id !== 'inbox'), [lists]);
  const hasUngroupedProjects = useMemo(() => projectLists.some((list) => !list.groupId), [projectLists]);

  const reportGroups = useMemo(
    () => [
      { id: ALL_GROUPS, name: '全部项目组', color: '#64748b' },
      ...projectGroups,
      ...(hasUngroupedProjects ? [{ id: UNGROUPED_GROUP, name: '未分组', color: '#94a3b8' }] : []),
    ],
    [hasUngroupedProjects, projectGroups]
  );

  const selectedGroupId = useMemo(() => {
    if (activeProjectGroupId === ALL_GROUPS) return ALL_GROUPS;
    if (activeProjectGroupId && projectGroups.some((group) => group.id === activeProjectGroupId)) return activeProjectGroupId;
    if (!activeProjectGroupId && hasUngroupedProjects) return UNGROUPED_GROUP;
    return ALL_GROUPS;
  }, [activeProjectGroupId, hasUngroupedProjects, projectGroups]);

  const visibleProjects = useMemo(() => {
    if (selectedGroupId === ALL_GROUPS) return projectLists;
    if (selectedGroupId === UNGROUPED_GROUP) return projectLists.filter((list) => !list.groupId);
    return projectLists.filter((list) => list.groupId === selectedGroupId);
  }, [projectLists, selectedGroupId]);

  const selectedProject = visibleProjects.find((list) => list.id === activeListId) ?? null;
  const selectedGroupName = reportGroups.find((group) => group.id === selectedGroupId)?.name ?? '全部项目组';

  const period = useMemo(() => {
    if (mode === 'week') {
      return {
        start: startOfWeek(anchorDate, { weekStartsOn: 1 }),
        end: endOfWeek(anchorDate, { weekStartsOn: 1 }),
      };
    }
    return { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) };
  }, [anchorDate, mode]);

  const scopedTasks = useMemo(() => {
    if (selectedProject) {
      return tasks.filter((task) => task.listId === selectedProject.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    const allowedIds = new Set(visibleProjects.map((project) => project.id));
    return tasks.filter((task) => allowedIds.has(task.listId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [selectedProject, tasks, visibleProjects]);

  const createdTasks = useMemo(() => scopedTasks.filter((task) => {
    const date = toDay(task.createdAt);
    return date && isWithinInterval(date, period);
  }), [period, scopedTasks]);

  const completedTasks = useMemo(() => scopedTasks.filter((task) => {
    const date = toDay(task.completedAt);
    return date && isWithinInterval(date, period);
  }), [period, scopedTasks]);

  const dueTasks = useMemo(() => scopedTasks.filter((task) => {
    const date = toDay(task.dueDate);
    return date && isWithinInterval(date, period);
  }), [period, scopedTasks]);

  const completionRate = createdTasks.length ? Math.round((completedTasks.length / createdTasks.length) * 100) : completedTasks.length > 0 ? 100 : 0;

  const trendPoints = useMemo<TrendPoint[]>(() => {
    const points = eachDayOfInterval({ start: period.start, end: period.end }).map((date) => ({ date, created: 0, completed: 0 }));
    const indexByKey = new Map(points.map((point, index) => [format(point.date, 'yyyy-MM-dd'), index]));
    createdTasks.forEach((task) => {
      const date = toDay(task.createdAt);
      if (!date) return;
      const index = indexByKey.get(format(date, 'yyyy-MM-dd'));
      if (index !== undefined) points[index].created += 1;
    });
    completedTasks.forEach((task) => {
      const date = toDay(task.completedAt);
      if (!date) return;
      const index = indexByKey.get(format(date, 'yyyy-MM-dd'));
      if (index !== undefined) points[index].completed += 1;
    });
    return points;
  }, [completedTasks, createdTasks, period.end, period.start]);

  const maxTrendValue = Math.max(1, ...trendPoints.flatMap((point) => [point.created, point.completed]));
  const heatmapCells = useMemo(() => trendPoints.map((point) => ({
    ...point,
    score: point.created + point.completed * 1.5,
    inCurrentMonth: true,
  })), [trendPoints]);
  const maxHeatmapScore = Math.max(1, ...heatmapCells.map((cell) => cell.score));

  const events = useMemo(() => {
    const reportEvents: ReportEvent[] = [];
    for (const task of scopedTasks) {
      const createdAt = toDay(task.createdAt);
      const completedAt = toDay(task.completedAt);
      const dueDate = toDay(task.dueDate);
      if (createdAt && isWithinInterval(createdAt, period)) {
        reportEvents.push({ id: `${task.id}-created`, taskId: task.id, type: 'created', title: `创建了任务《${task.title}》`, time: createdAt, task });
      }
      if (completedAt && isWithinInterval(completedAt, period)) {
        reportEvents.push({ id: `${task.id}-completed`, taskId: task.id, type: 'completed', title: `完成了任务《${task.title}》`, time: completedAt, task });
      }
      if (dueDate && isWithinInterval(dueDate, period) && (!completedAt || !isSameDay(completedAt, dueDate))) {
        reportEvents.push({ id: `${task.id}-due`, taskId: task.id, type: 'due', title: `任务《${task.title}》在这一天到期`, time: dueDate, task });
      }
    }
    return reportEvents.sort((left, right) => right.time.getTime() - left.time.getTime());
  }, [period, scopedTasks]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ReportEvent[]>();
    events.forEach((event) => {
      const key = format(event.time, 'yyyy-MM-dd');
      const existing = map.get(key) || [];
      existing.push(event);
      map.set(key, existing);
    });
    return map;
  }, [events]);

  const filteredDays = useMemo(() => {
    const days = eachDayOfInterval({ start: period.start, end: period.end }).reverse();
    if (!selectedDayKey) return days;
    return days.filter((day) => format(day, 'yyyy-MM-dd') === selectedDayKey);
  }, [period.end, period.start, selectedDayKey]);

  useEffect(() => {
    if (mode === 'week') setSelectedDayKey(null);
  }, [mode]);

  if (projectGroups.length === 0 && projectLists.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <FolderKanban className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h3 className="text-xl font-semibold">还没有项目组</h3>
          <p className="mt-2 text-sm text-muted-foreground">先创建项目组和项目，这里会自动汇总任务节奏和时间线。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto">
      <div className="border-b px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {reportGroups.map((group) => (
              <Button
                key={String(group.id)}
                variant={selectedGroupId === group.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setActiveProjectGroup(group.id === ALL_GROUPS ? ALL_GROUPS : group.id === UNGROUPED_GROUP ? null : group.id);
                  setActiveList(null);
                }}
              >
                <span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color || '#64748b' }} />
                {group.name}
              </Button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center rounded-lg border p-1">
              <Button variant={mode === 'week' ? 'default' : 'ghost'} size="sm" className="h-8" onClick={() => setMode('week')}>周报</Button>
              <Button variant={mode === 'month' ? 'default' : 'ghost'} size="sm" className="h-8" onClick={() => setMode('month')}>月报</Button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setAnchorDate((d) => mode === 'week' ? subWeeks(d, 1) : subMonths(d, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="min-w-[170px] text-center text-sm font-medium">{getPeriodLabel(mode, anchorDate)}</div>
            <Button variant="ghost" size="icon" onClick={() => setAnchorDate((d) => mode === 'week' ? addWeeks(d, 1) : addMonths(d, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant={selectedProject ? 'outline' : 'default'} size="sm" onClick={() => setActiveList(null)}>当前项目组全部项目</Button>
          {visibleProjects.map((project) => (
            <Button key={project.id} variant={selectedProject?.id === project.id ? 'default' : 'outline'} size="sm" onClick={() => setActiveList(project.id)}>
              {project.name}
            </Button>
          ))}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          当前查看{selectedProject ? ` 项目《${selectedProject.name}》` : ` 项目组《${selectedGroupName}》`}的周期复盘。
        </p>
      </div>

      <div className="grid gap-4 border-b px-6 py-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={CheckCircle2} label="本期完成" value={completedTasks.length} iconClass="text-emerald-500" />
        <SummaryCard icon={ClipboardList} label="本期新增" value={createdTasks.length} iconClass="text-blue-500" />
        <SummaryCard icon={CalendarDays} label="本期到期" value={dueTasks.length} iconClass="text-amber-500" />
        <SummaryCard icon={Target} label="完成率" value={`${completionRate}%`} helper={`项目数 ${visibleProjects.length}`} iconClass="text-violet-500" />
      </div>

      <div className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(420px,1fr),minmax(320px,0.9fr)]">
        <div className="rounded-3xl border bg-card/30 p-4 lg:p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-primary" />
            {mode === 'month' ? '月度热力图' : '进展趋势'}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === 'month' ? '按天查看当前月份的新增与完成热度。' : '按天对比新增与完成，快速识别本周期的推进节奏。'}
          </p>

          {mode === 'week' ? (
            <div className="mt-5">
              <div className="flex min-h-[240px] items-end gap-2">
                {trendPoints.map((point) => (
                  <div key={format(point.date, 'yyyy-MM-dd')} className="flex min-w-0 flex-1 flex-col items-center gap-3">
                    <div className="flex h-44 w-full items-end justify-center gap-1 rounded-lg bg-muted/30 px-1.5 py-3">
                      <div className="w-2.5 rounded-sm bg-blue-500/85" style={{ height: `${Math.max((point.created / maxTrendValue) * 100, point.created > 0 ? 10 : 0)}%` }} />
                      <div className="w-2.5 rounded-sm bg-emerald-500/85" style={{ height: `${Math.max((point.completed / maxTrendValue) * 100, point.completed > 0 ? 10 : 0)}%` }} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{format(point.date, 'EEE', { locale: zhCN })}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />新增</span>
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />完成</span>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <div className="mb-3 grid grid-cols-[auto,1fr] gap-3">
                <div className="grid grid-rows-7 gap-2 text-[11px] text-muted-foreground">
                  {WEEKDAY_LABELS.map((label) => <div key={label} className="flex h-[22px] items-center">{label}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {heatmapCells.map((cell) => {
                    const key = format(cell.date, 'yyyy-MM-dd');
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDayKey((current) => current === key ? null : key)}
                        className={cn('h-[22px] w-[22px] rounded-md transition-transform hover:scale-110', getHeatmapLevel(cell.score, maxHeatmapScore), selectedDayKey === key && 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background')}
                        title={`${format(cell.date, 'M月d日', { locale: zhCN })} · 新增 ${cell.created} / 完成 ${cell.completed}`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>低活跃</span>
                <span>高活跃</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex min-h-[420px] max-h-[680px] flex-col overflow-hidden rounded-3xl border bg-card/20">
          <section className="flex min-h-0 flex-1 flex-col p-4 lg:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">项目时间线</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedDayKey ? `当前只看 ${selectedDayKey} 这一天的项目事件。` : '按天查看当前范围内的新建、完成和到期事件。'}
                </p>
              </div>
              {selectedDayKey && <Button variant="outline" size="sm" onClick={() => setSelectedDayKey(null)}>清除日期筛选</Button>}
            </div>

            <ScrollArea className="min-h-0 flex-1 pr-3">
              <div className="relative">
                <div className="absolute bottom-0 left-[88px] top-0 w-px bg-border" />
                {filteredDays.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayEvents = eventsByDay.get(key) || [];
                  return (
                    <div key={key} className="relative mb-5 flex last:mb-0">
                      <div className="w-[72px] pr-3 text-right">
                        <button type="button" onClick={() => setSelectedDayKey(key)} className={cn('ml-auto block rounded-md px-2 py-1 text-sm font-medium transition-colors hover:bg-muted', isToday(day) && 'text-primary', selectedDayKey === key && 'bg-muted text-primary')}>
                          {formatTimelineDay(day)}
                        </button>
                        <div className="text-xs text-muted-foreground">{format(day, 'EEE', { locale: zhCN })}</div>
                      </div>
                      <div className="relative w-8 shrink-0">
                        <div className={cn('absolute left-[10px] top-2 z-10 h-3 w-3 rounded-full border-2 bg-background', dayEvents.length > 0 ? 'border-primary' : 'border-muted-foreground/30', isToday(day) && 'bg-primary')} />
                      </div>
                      <div className="min-h-[36px] flex-1 space-y-2.5">
                        {dayEvents.length > 0 ? dayEvents.map((event) => (
                          <TaskContextMenu key={event.id} task={event.task}>
                            <div
                              onClick={() => selectTask(event.taskId)}
                              className={cn('cursor-pointer rounded-xl border p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md', eventTypeClasses(event.type))}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-xs font-medium uppercase tracking-wide opacity-80">{eventTypeLabel(event.type)}</div>
                                  <div className="mt-1 text-sm font-medium">{event.title}</div>
                                  {event.task.notes && <div className="mt-1.5 text-xs text-muted-foreground">{event.task.notes}</div>}
                                </div>
                                <div className="shrink-0 text-xs text-muted-foreground">{getTaskStatusLabel(event.task.status)}</div>
                              </div>
                            </div>
                          </TaskContextMenu>
                        )) : <div className="flex h-10 items-center text-sm text-muted-foreground/60">这一天没有项目事件。</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  iconClass,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: React.ReactNode;
  helper?: string;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={cn('h-4 w-4', iconClass)} />
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
      {helper && <div className="mt-2 text-sm text-muted-foreground">{helper}</div>}
    </div>
  );
}
