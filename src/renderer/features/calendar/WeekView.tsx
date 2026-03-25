import React, { useMemo } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
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

interface WeekViewProps {
  date: Date;
}

export function WeekView({ date }: WeekViewProps) {
  const { tasks } = useTaskStore();
  const { selectTask } = useUIStore();

  const weekDays = useMemo(() => {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [date]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const getTasksForDayAndHour = (day: Date, hour: number) => {
    return tasks.filter((task) => {
      if (!task.dueDate) return false;
      const dueDate = parseISO(task.dueDate);
      return isSameDay(dueDate, day) && dueDate.getHours() === hour;
    });
  };

  const getAllDayTasks = (day: Date) => {
    return tasks.filter((task) => {
      if (!task.dueDate) return false;
      const dueDate = parseISO(task.dueDate);
      if (!isSameDay(dueDate, day)) return false;
      return dueDate.getHours() === 0 && dueDate.getMinutes() === 0;
    });
  };

  const weekDayNames = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      {/* Header with day names */}
      <div className="flex border-b">
        <div className="w-16 flex-shrink-0 border-r" />
        {weekDays.map((day, index) => (
          <div
            key={day.toISOString()}
            className={cn(
              'flex-1 text-center py-2 border-r last:border-r-0',
              isToday(day) && 'bg-primary/5'
            )}
          >
            <div className="text-xs text-muted-foreground">{weekDayNames[index]}</div>
            <div
              className={cn(
                'text-lg font-semibold',
                isToday(day) && 'text-primary'
              )}
            >
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* All-day tasks row */}
      <div className="flex border-b min-h-[40px]">
        <div className="w-16 flex-shrink-0 text-xs text-muted-foreground p-2 border-r">
          全天
        </div>
        {weekDays.map((day) => {
          const allDayTasks = getAllDayTasks(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'flex-1 p-1 border-r last:border-r-0 overflow-hidden',
                isToday(day) && 'bg-primary/5'
              )}
            >
              {allDayTasks.slice(0, 2).map((task) => (
                <button
                  key={task.id}
                  onClick={() => selectTask(task.id)}
                  className={cn(
                    'w-full text-xs px-1 py-0.5 rounded truncate text-left mb-0.5',
                    task.status === 'done'
                      ? 'bg-muted text-muted-foreground line-through'
                      : task.priority === 3
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-primary/10 text-primary'
                  )}
                >
                  {task.title}
                </button>
              ))}
              {allDayTasks.length > 2 && (
                <div className="text-xs text-muted-foreground">
                  +{allDayTasks.length - 2}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <ScrollArea className="flex-1">
        <div className="relative">
          {hours.map((hour) => (
            <div key={hour} className="flex border-b min-h-[48px]">
              {/* Time label */}
              <div className="w-16 flex-shrink-0 text-xs text-muted-foreground p-1 border-r">
                {hour.toString().padStart(2, '0')}:00
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                const hourTasks = getTasksForDayAndHour(day, hour);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'flex-1 p-0.5 border-r last:border-r-0 relative',
                      isToday(day) && 'bg-primary/5'
                    )}
                  >
                    {hourTasks.map((task, index) => (
                      <button
                        key={task.id}
                        onClick={() => selectTask(task.id)}
                        className={cn(
                          'w-full text-xs px-1 py-0.5 rounded truncate text-left',
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
