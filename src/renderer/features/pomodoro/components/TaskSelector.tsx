import { useState } from 'react';
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
  const tasks = useTaskStore(s => s.tasks);
  const [query, setQuery] = useState('');

  const todoTasks = tasks.filter((task) => task.status === 'todo' && task.title.toLowerCase().includes(query.toLowerCase()));

  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.id === selectedTaskId)
    : null;

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
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <input aria-label="筛选专注任务" placeholder="搜索待办任务" className="w-full border-b bg-transparent p-2 text-sm" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.stopPropagation()} />
        {selectedTaskId && <DropdownMenuItem onSelect={() => onSelect(null)}>清除关联任务</DropdownMenuItem>}
        <ScrollArea className="h-64">
          {todoTasks.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              暂无待办任务
            </div>
          ) : (
            todoTasks.slice(0, 100).map((task) => (
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
        {todoTasks.length > 100 && <p className="px-2 py-1 text-xs text-muted-foreground">显示前 100 项，请搜索缩小范围。</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
