import { useEffect, type MouseEvent } from 'react';
import { ChevronDown, X, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/features/tasks/store';
import type { Priority } from '../../../../../types/models';

interface TaskSelectorProps {
  selectedTaskId: string | null;
  onSelect: (taskId: string | null) => void;
  disabled?: boolean;
  className?: string;
}

const priorityColors: Record<Priority, string> = {
  0: 'text-muted-foreground',
  1: 'text-priority-low',
  2: 'text-priority-medium',
  3: 'text-priority-high',
};

export function TaskSelector({
  selectedTaskId,
  onSelect,
  disabled,
  className,
}: TaskSelectorProps) {
  const { tasks, fetchTasks } = useTaskStore();

  const todoTasks = tasks.filter((task) => task.status === 'todo');

  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.id === selectedTaskId)
    : null;

  useEffect(() => {
    void fetchTasks({ status: 'all' });
  }, [fetchTasks]);

  const handleClear = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect(null);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('w-full justify-between h-9', className)}
          disabled={disabled}
        >
          <span className="truncate text-left flex-1">
            {selectedTask ? selectedTask.title : '选择任务...'}
          </span>
          <div className="flex items-center gap-1 ml-2">
            {selectedTask && (
              <button
                type="button"
                onClick={handleClear}
                className="hover:bg-accent rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <ScrollArea className="max-h-64">
          {todoTasks.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              暂无待办任务
            </div>
          ) : (
            todoTasks.map((task) => (
              <DropdownMenuItem
                key={task.id}
                onClick={() => onSelect(task.id)}
                className={cn(
                  'flex items-center gap-2 cursor-pointer',
                  selectedTaskId === task.id && 'bg-accent'
                )}
              >
                <Flag className={cn('h-3 w-3', priorityColors[task.priority])} />
                <span className="flex-1 truncate">{task.title}</span>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
