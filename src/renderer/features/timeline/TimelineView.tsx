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
import { TaskContextMenu } from '@/features/tasks/components';
import { useTaskStore } from '@/features/tasks/store';
import { cn } from '@/lib/utils';
import type { Task } from '../../../../types/models';

type TimelineViewType = 'week' | 'month' | 'custom';
type TimelineEventType = 'completed' | 'due' | 'start';

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

  if (type === 'start') {
    return 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300';
  }

  return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
}

function getEventLabel(type: TimelineEventType): string {
  if (type === 'completed') return '已完成';
  if (type === 'start') return '开始';
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
  const { tasks } = useTaskStore();
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
      to: range.to || range.from,
    });
  };

  const formatDateRange = () => {
    if (viewType === 'week') {
      return `本周 (${format(dateRange.from, 'M.d')} - ${format(dateRange.to, 'M.d')})`;
    }

    if (viewType === 'month') {
      return format(dateRange.from, 'yyyy年M月', { locale: zhCN });
    }

    return `${format(dateRange.from, 'M.d')} - ${format(dateRange.to, 'M.d')}`;
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">时间线</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            已完成任务按完成日期显示，未完成任务按截止日期或开始日期显示。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={navigatePrev}>
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

          <Button variant="ghost" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="relative px-6 py-4">
          <div className="absolute bottom-0 left-[120px] top-0 w-px bg-border" />

          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEntries = entriesByDate.get(dateKey) || [];
            const hasEntry = dayEntries.length > 0;
            const today = isToday(day);

            return (
              <div key={dateKey} className="relative mb-6 flex last:mb-0">
                <div className="w-[100px] shrink-0 pr-6 text-right">
                  <div className={cn('text-sm font-medium', today && 'text-primary')}>{formatDateLabel(day)}</div>
                  <div className="text-xs text-muted-foreground">{format(day, 'EEEE', { locale: zhCN })}</div>
                </div>

                <div className="relative flex items-start">
                  <div
                    className={cn(
                      'absolute left-[20px] top-2 z-10 h-3 w-3 rounded-full border-2 bg-background',
                      today
                        ? 'border-primary bg-primary'
                        : hasEntry
                          ? 'border-primary'
                          : 'border-muted-foreground/30'
                    )}
                  />
                </div>

                <div className="min-h-[40px] flex-1 pl-12">
                  {hasEntry ? (
                    <div className="space-y-2">
                      {dayEntries.map((entry) => {
                        const { task, type } = entry;

                        return (
                          <TaskContextMenu key={`${task.id}-${type}-${dateKey}`} task={task}>
                            <div
                              onClick={() => selectTask(task.id)}
                              className={cn(
                                'group cursor-pointer rounded-lg border-l-4 bg-card p-3 shadow-sm',
                                'transition-all hover:translate-x-1 hover:shadow-md',
                                getPriorityBorderColor(task.priority),
                                task.status === 'done' && 'opacity-70'
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={cn(
                                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                                    task.status === 'done'
                                      ? 'bg-green-500'
                                      : task.status === 'canceled'
                                        ? 'bg-gray-400'
                                        : getPriorityColor(task.priority)
                                  )}
                                />

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <h4
                                      className={cn(
                                        'text-sm font-medium',
                                        task.status === 'done' && 'text-muted-foreground line-through'
                                      )}
                                    >
                                      {task.title}
                                    </h4>

                                    <span
                                      className={cn(
                                        'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                        getEventBadgeClasses(type)
                                      )}
                                    >
                                      {getEventLabel(type)}
                                    </span>
                                  </div>

                                  {task.notes && (
                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.notes}</p>
                                  )}

                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {task.subtasks && task.subtasks.length > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        子任务 {task.subtasks.filter((subtask) => subtask.isDone).length}/{task.subtasks.length}
                                      </span>
                                    )}

                                    {task.tags && task.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {task.tags.slice(0, 2).map((tag) => (
                                          <span
                                            key={tag.id}
                                            className="rounded px-1.5 py-0.5 text-xs"
                                            style={{ backgroundColor: tag.color || '#e5e5e5' }}
                                          >
                                            {tag.name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TaskContextMenu>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex h-[40px] items-center">
                      <span className="text-xs text-muted-foreground/50">这一天没有时间线记录</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
