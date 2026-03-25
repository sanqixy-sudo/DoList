import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/features/tasks/store';
import { useUIStore } from '@/features/settings/uiStore';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { MultiDayView } from './MultiDayView';
import { MultiWeekView } from './MultiWeekView';
import type { Task } from '../../../../types/models';

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { tasks } = useTaskStore();
  const { selectTask, calendarViewType, setCalendarViewType } = useUIStore();

  const navigatePrev = () => {
    switch (calendarViewType) {
      case 'month':
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case 'day':
        setCurrentDate(subDays(currentDate, 1));
        break;
      case 'multiDay':
        setCurrentDate(subDays(currentDate, 3));
        break;
      case 'multiWeek':
        setCurrentDate(subWeeks(currentDate, 2));
        break;
    }
  };

  const navigateNext = () => {
    switch (calendarViewType) {
      case 'month':
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case 'day':
        setCurrentDate(addDays(currentDate, 1));
        break;
      case 'multiDay':
        setCurrentDate(addDays(currentDate, 3));
        break;
      case 'multiWeek':
        setCurrentDate(addWeeks(currentDate, 2));
        break;
    }
  };

  const getHeaderTitle = () => {
    switch (calendarViewType) {
      case 'month':
        return format(currentDate, 'yyyy年M月', { locale: zhCN });
      case 'week': {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'M月d日', { locale: zhCN })} - ${format(weekEnd, 'M月d日', { locale: zhCN })}`;
      }
      case 'day':
        return format(currentDate, 'yyyy年M月d日 EEEE', { locale: zhCN });
      case 'multiDay':
        return `${format(currentDate, 'M月d日', { locale: zhCN })} - ${format(addDays(currentDate, 2), 'M月d日', { locale: zhCN })}`;
      case 'multiWeek':
        return format(currentDate, 'yyyy年M月', { locale: zhCN });
    }
  };

  const viewTypeLabels = {
    month: '月视图',
    week: '周视图',
    day: '日视图',
    multiDay: '3日视图',
    multiWeek: '双周视图',
  };

  const days = useMemo(() => {
    if (calendarViewType !== 'month') return [];
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate, calendarViewType]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      if (task.dueDate) {
        const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd');
        const existing = map.get(dateKey) || [];
        map.set(dateKey, [...existing, task]);
      }
    });
    return map;
  }, [tasks]);

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  const renderContent = () => {
    switch (calendarViewType) {
      case 'day':
        return <DayView date={currentDate} />;
      case 'week':
        return <WeekView date={currentDate} />;
      case 'multiDay':
        return <MultiDayView date={currentDate} days={3} />;
      case 'multiWeek':
        return <MultiWeekView date={currentDate} weeks={2} />;
      case 'month':
      default:
        return (
          <>
            <div className="grid grid-cols-7 border-b">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-sm font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            <ScrollArea className="flex-1">
              <div className="grid grid-cols-7 auto-rows-fr min-h-full">
                {days.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayTasks = tasksByDate.get(dateKey) || [];
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isCurrentDay = isToday(day);

                  return (
                    <div
                      key={dateKey}
                      className={cn(
                        'min-h-[100px] border-b border-r p-1',
                        !isCurrentMonth && 'bg-muted/30'
                      )}
                    >
                      <div
                        className={cn(
                          'w-7 h-7 flex items-center justify-center text-sm rounded-full mb-1',
                          isCurrentDay && 'bg-primary text-primary-foreground',
                          !isCurrentMonth && 'text-muted-foreground'
                        )}
                      >
                        {format(day, 'd')}
                      </div>

                      <div className="space-y-0.5">
                        {dayTasks.slice(0, 3).map((task) => (
                          <button
                            key={task.id}
                            onClick={() => selectTask(task.id)}
                            className={cn(
                              'w-full text-left text-xs px-1.5 py-0.5 rounded truncate transition-colors',
                              task.status === 'done'
                                ? 'bg-muted text-muted-foreground line-through'
                                : task.priority === 3
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : task.priority === 2
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                            )}
                          >
                            {task.title}
                          </button>
                        ))}
                        {dayTasks.length > 3 && (
                          <div className="text-xs text-muted-foreground px-1.5">
                            +{dayTasks.length - 3} 更多
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        );
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">{getHeaderTitle()}</h2>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <LayoutGrid className="h-4 w-4 mr-2" />
                {viewTypeLabels[calendarViewType]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCalendarViewType('day')}>
                日视图
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCalendarViewType('multiDay')}>
                3日视图
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCalendarViewType('week')}>
                周视图
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCalendarViewType('multiWeek')}>
                双周视图
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCalendarViewType('month')}>
                月视图
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              今天
            </Button>
            <Button variant="ghost" size="icon" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {renderContent()}
    </div>
  );
}
