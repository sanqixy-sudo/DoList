import React, { useState, useMemo } from 'react';
import {
  format,
  startOfDay,
  endOfDay,
  addHours,
  isSameDay,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/features/tasks/store';
import { useUIStore } from '@/features/settings/uiStore';
import type { Task } from '../../../../types/models';

interface DayViewProps {
  date: Date;
}

export function DayView({ date }: DayViewProps) {
  const { tasks } = useTaskStore();
  const { selectTask } = useUIStore();

  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i);
  }, []);

  const dayTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.dueDate) return false;
      return isSameDay(parseISO(task.dueDate), date);
    });
  }, [tasks, date]);

  const allDayTasks = dayTasks.filter((task) => {
    if (!task.dueDate) return false;
    const dueDate = parseISO(task.dueDate);
    // Tasks without specific time are all-day tasks
    return dueDate.getHours() === 0 && dueDate.getMinutes() === 0;
  });

  const timedTasks = dayTasks.filter((task) => {
    if (!task.dueDate) return false;
    const dueDate = parseISO(task.dueDate);
    return dueDate.getHours() !== 0 || dueDate.getMinutes() !== 0;
  });

  const getTasksForHour = (hour: number) => {
    return timedTasks.filter((task) => {
      if (!task.dueDate) return false;
      const dueDate = parseISO(task.dueDate);
      return dueDate.getHours() === hour;
    });
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full">
      {/* All-day tasks */}
      {allDayTasks.length > 0 && (
        <div className="border-b p-2">
          <div className="text-xs text-muted-foreground mb-1">全天</div>
          <div className="flex flex-wrap gap-1">
            {allDayTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => selectTask(task.id)}
                className={cn(
                  'text-xs px-2 py-1 rounded truncate max-w-[200px]',
                  task.status === 'done'
                    ? 'bg-muted text-muted-foreground line-through'
                    : task.priority === 3
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : task.priority === 2
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-primary/10 text-primary'
                )}
              >
                {task.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <ScrollArea className="flex-1">
        <div className="relative">
          {hours.map((hour) => {
            const hourTasks = getTasksForHour(hour);
            return (
              <div key={hour} className="flex border-b min-h-[60px]">
                {/* Time label */}
                <div className="w-16 flex-shrink-0 text-xs text-muted-foreground p-2 border-r">
                  {hour.toString().padStart(2, '0')}:00
                </div>

                {/* Tasks */}
                <div className="flex-1 p-1 relative">
                  {hourTasks.map((task, index) => (
                    <button
                      key={task.id}
                      onClick={() => selectTask(task.id)}
                      className={cn(
                        'absolute left-1 right-1 text-xs px-2 py-1 rounded truncate text-left',
                        task.status === 'done'
                          ? 'bg-muted text-muted-foreground line-through'
                          : task.priority === 3
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : task.priority === 2
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                      )}
                      style={{ top: `${index * 24 + 4}px` }}
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
