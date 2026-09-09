import { PagedCollection } from '@/features/tasks/components/PagedCollection';
import { useWorkspaceTasks } from '@/features/tasks/use-workspace-tasks';
import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/features/settings/uiStore';
import { TaskContextMenu } from '@/features/tasks/components/TaskContextMenu';
import { useTaskStore } from '@/features/tasks/store';
import { cn } from '@/lib/utils';
import type { Task } from '../../../../types/models';

type TimelineViewType = 'week' | 'month' | 'custom';
type TimelineEventType = 'completed' | 'planned' | 'due' | 'start';

interface TimelineEntry {
  task: Task;
  date: Date;
  type: TimelineEventType;
  sortTime: number;
}

function toTimelineDate(dateString: string | null): Date | null {
  if (!dateString) return null;

  const parsed = parseISO(dateString);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function formatDateLabel(date: Date): string {
  if (isToday(date)) return '今天';
  if (isTomorrow(date)) return '明天';
  if (isYesterday(date)) return '昨天';
  return format(date, 'M月d日', { locale: zhCN });
}

function getPriorityColor(priority: number): string {
  switch (priority) {
    case 3:
      return 'bg-red-500';
    case 2:
      return 'bg-yellow-500';
    case 1:
      return 'bg-blue-500';
    default:
      return 'bg-primary';
  }
}

function getPriorityBorderColor(priority: number): string {
  switch (priority) {
    case 3:
      return 'border-red-500';
    case 2:
      return 'border-yellow-500';
    case 1:
      return 'border-blue-500';
    default:
      return 'border-primary/30';
  }
}

function getEventBadgeClasses(type: TimelineEventType): string {
  if (type === 'completed') {
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }

  if (type === 'start' || type === 'planned') {
    return 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300';
  }

  return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
}

function getEventLabel(type: TimelineEventType): string {
  if (type === 'completed') return '已完成';
  if (type === 'start') return '开始';
  if (type === 'planned') return '计划';
  return '截止';
}

function getEventWeight(type: TimelineEventType): number {
  if (type === 'completed') return 0;
  if (type === 'due') return 1;
  return 2;
}

function getTimelineEntry(task: Task): TimelineEntry | null {
  const completedAt = toTimelineDate(task.completedAt);
  if (task.status === 'done' && completedAt) {
    return {
      task,
      date: startOfDay(completedAt),
      type: 'completed',
      sortTime: completedAt.getTime(),
    };
  }

  const planned = toTimelineDate(task.plannedDate);
  if (planned) return { task, date: startOfDay(planned), type: 'planned', sortTime: planned.getTime() };
  const dueDate = toTimelineDate(task.dueDate);
  if (dueDate) {
    return {
      task,
      date: startOfDay(dueDate),
      type: 'due',
      sortTime: dueDate.getTime(),
    };
  }

  const startDate = toTimelineDate(task.startDate);
  if (startDate) {
    return {
      task,
      date: startOfDay(startDate),
      type: 'start',
      sortTime: startDate.getTime(),
    };
  }

  return null;
}

export function TimelineView() {
  const tasks = useWorkspaceTasks();
  const { selectTask } = useUIStore();

  const [viewType, setViewType] = useState<TimelineViewType>('week');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => ({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  }));

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: dateRange.from,
        end: dateRange.to,
      }),
    [dateRange]
  );

  const entriesByDate = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();

    tasks.forEach((task) => {
      const entry = getTimelineEntry(task);
      if (!entry) return;

      const key = format(entry.date, 'yyyy-MM-dd');
      const existing = map.get(key) || [];
      existing.push(entry);
      map.set(key, existing);
    });

    map.forEach((entries, key) => {
      entries.sort((left, right) => {
        const weightDiff = getEventWeight(left.type) - getEventWeight(right.type);
        if (weightDiff !== 0) return weightDiff;

        if (left.sortTime !== right.sortTime) return right.sortTime - left.sortTime;
        if (left.task.priority !== right.task.priority) return right.task.priority - left.task.priority;

        return right.task.updatedAt.localeCompare(left.task.updatedAt);
      });
      map.set(key, entries);
    });

    return map;
  }, [tasks]);

  const navigatePrev = () => {
    if (viewType === 'week') {
      setDateRange((previous) => ({
        from: subWeeks(previous.from, 1),
        to: subWeeks(previous.to, 1),
      }));
      return;
    }

    if (viewType === 'month') {
      const newStart = subMonths(dateRange.from, 1);
      setDateRange({
        from: startOfMonth(newStart),
        to: endOfMonth(newStart),
      });
      return;
    }

    const duration = differenceInDays(dateRange.to, dateRange.from) + 1;
    setDateRange((previous) => ({
      from: subDays(previous.from, duration),
      to: subDays(previous.to, duration),
    }));
  };

  const navigateNext = () => {
    if (viewType === 'week') {
      setDateRange((previous) => ({
        from: addWeeks(previous.from, 1),
        to: addWeeks(previous.to, 1),
      }));
      return;
    }

    if (viewType === 'month') {
      const newStart = addMonths(dateRange.from, 1);
      setDateRange({
        from: startOfMonth(newStart),
        to: endOfMonth(newStart),
      });
      return;
    }

    const duration = differenceInDays(dateRange.to, dateRange.from) + 1;
    setDateRange((previous) => ({
      from: addDays(previous.from, duration),
      to: addDays(previous.to, duration),
    }));
  };

  const handleSelectWeek = () => {
    setViewType('week');
    const today = new Date();
    setDateRange({
      from: startOfWeek(today, { weekStartsOn: 1 }),
      to: endOfWeek(today, { weekStartsOn: 1 }),
    });
  };

  const handleSelectMonth = () => {
    setViewType('month');
    const today = new Date();
    setDateRange({
      from: startOfMonth(today),
      to: endOfMonth(today),
    });
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (!range?.from) return;

    setViewType('custom');
    setDateRange({
      from: range.from,
      to: range.to && differenceInDays(range.to, range.from) <= 365 ? range.to : addDays(range.from, Math.min(365, differenceInDays(range.to ?? range.from, range.from))),
    });
  };

  const formatDateRange = () => {
    if (viewType === 'week') {
      return `${format(dateRange.from, 'yyyy.M.d')} - ${format(dateRange.to, 'M.d')}`;
    }

    if (viewType === 'month') {
      return format(dateRange.from, 'yyyy年M月', { locale: zhCN });
    }

    return `${format(dateRange.from, 'M.d')} - ${format(dateRange.to, 'M.d')}`;
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">时间线</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            已完成任务按完成日期显示，其余按计划日期、截止日期或开始日期显示。自定义范围最多一年。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="上一时间段" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[160px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formatDateRange()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex gap-2 border-b p-3">
                <Button
                  variant={viewType === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleSelectWeek}
                  className="flex-1"
                >
                  本周
                </Button>
                <Button
                  variant={viewType === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleSelectMonth}
                  className="flex-1"
                >
                  本月
                </Button>
              </div>

              <div className="p-3">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={handleCalendarSelect}
                  numberOfMonths={2}
                  defaultMonth={dateRange.from}
                  initialFocus
                />
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" aria-label="下一时间段" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <PagedCollection key={dateRange.from.toISOString() + dateRange.to.toISOString()} label="时间线" items={days.flatMap(day => entriesByDate.get(format(day, 'yyyy-MM-dd')) ?? [])} renderItem={entry => (
        <TaskContextMenu task={entry.task}>
          <button className="timeline-entry flex w-full min-w-0 items-start gap-3 rounded-lg border bg-card p-3 text-left hover:border-primary/40" onClick={() => selectTask(entry.task.id)}>
            <span className="w-16 shrink-0 text-xs text-muted-foreground">{formatDateLabel(entry.date)}<br />{format(entry.date, 'EEE', { locale: zhCN })}</span>
            <span className="min-w-0 flex-1"><span className={cn('block break-words text-sm font-medium', entry.task.status === 'done' && 'line-through text-muted-foreground')}>{entry.task.title}</span>
              {entry.task.notes && <span className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{entry.task.notes}</span>}
            </span>
            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-xs', getEventBadgeClasses(entry.type))}>{getEventLabel(entry.type)}</span>
          </button>
        </TaskContextMenu>
      )} />
    </div>
  );
}
