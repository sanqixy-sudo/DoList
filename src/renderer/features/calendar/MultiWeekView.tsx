import React, { useMemo } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/features/tasks/store';
import { useUIStore } from '@/features/settings/uiStore';
import type { Task } from '../../../../types/models';

interface MultiWeekViewProps {
  date: Date;
  weeks?: number;
}

export function MultiWeekView({ date, weeks = 2 }: MultiWeekViewProps) {
  const { tasks } = useTaskStore();
  const { selectTask } = useUIStore();

  const allDays = useMemo(() => {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(addWeeks(date, weeks - 1), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [date, weeks]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      if (task.dueDate) {
        const dateKey = format(parseISO(task.dueDate), 'yyyy-MM-dd');
        const existing = map.get(dateKey) || [];
        map.set(dateKey, [...existing, task]);
      }
    });
    return map;
  }, [tasks]);

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  // Group days into weeks
  const weeksArray = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      result.push(allDays.slice(i, i + 7));
    }
    return result;
  }, [allDays]);

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      {/* Week days header */}
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

      {/* Calendar grid */}
      <ScrollArea className="flex-1">
        <div className="min-h-full">
          {weeksArray.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7">
              {week.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDate.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(day, date);
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      'min-h-[80px] border-b border-r p-1',
                      !isCurrentMonth && 'bg-muted/30'
                    )}
                  >
                    {/* Day number */}
                    <div
                      className={cn(
                        'w-6 h-6 flex items-center justify-center text-sm rounded-full mb-1',
                        isCurrentDay && 'bg-primary text-primary-foreground',
                        !isCurrentMonth && 'text-muted-foreground'
                      )}
                    >
                      {format(day, 'd')}
                    </div>

                    {/* Tasks */}
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 2).map((task) => (
                        <button
                          key={task.id}
                          onClick={() => selectTask(task.id)}
                          className={cn(
                            'w-full text-left text-xs px-1 py-0.5 rounded truncate',
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
                      {dayTasks.length > 2 && (
                        <div className="text-xs text-muted-foreground px-1">
                          +{dayTasks.length - 2}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
