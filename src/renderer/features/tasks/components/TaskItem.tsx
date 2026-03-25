import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MoreHorizontal, Trash2, Flag, Timer, FileText } from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/features/settings/uiStore';
import type { Task, Priority } from '../../../../../types/models';

interface TaskItemProps {
  task: Task;
  isSelected?: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, priority: Priority) => void;
}

export function TaskItem({
  task,
  isSelected,
  onToggle,
  onSelect,
  onDelete,
  onPriorityChange,
}: TaskItemProps) {
  const { startPomodoroForTask } = useUIStore();

  const formatDueDate = useCallback((dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isToday(date)) return '今天';
    if (isTomorrow(date)) return '明天';
    return format(date, 'M月d日', { locale: zhCN });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(task.id);
    }
  }, [onSelect, task.id]);

  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status === 'todo';
  const isDone = task.status === 'done';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`任务: ${task.title}${isDone ? ', 已完成' : ''}`}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex items-start gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        isSelected ? 'bg-accent' : 'hover:bg-accent/50',
        isDone && 'opacity-60'
      )}
      onClick={() => onSelect(task.id)}
    >
      {/* Checkbox */}
      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isDone}
          priority={task.priority}
          onCheckedChange={() => onToggle(task.id)}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm font-medium truncate',
            isDone && 'line-through text-muted-foreground'
          )}
        >
          {task.title}
        </p>

        {/* Meta info */}
        <div className="flex items-center gap-2 mt-1">
          {task.dueDate && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs',
                isOverdue ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              <Calendar className="h-3 w-3" />
              {formatDueDate(task.dueDate)}
            </span>
          )}

          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-1">
              {task.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="px-1.5 py-0.5 text-xs rounded"
                  style={{ backgroundColor: tag.color || '#e5e5e5' }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {task.notes && (
            <FileText className="h-3 w-3 text-muted-foreground" />
          )}

          {task.subtasks && task.subtasks.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {task.subtasks.filter((s) => s.isDone).length}/{task.subtasks.length}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => startPomodoroForTask(task.id)}
          title="开始番茄钟"
        >
          <Timer className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Flag className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPriorityChange(task.id, 3)}>
              <Flag className="h-4 w-4 mr-2 text-priority-high" />
              高优先级
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPriorityChange(task.id, 2)}>
              <Flag className="h-4 w-4 mr-2 text-priority-medium" />
              中优先级
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPriorityChange(task.id, 1)}>
              <Flag className="h-4 w-4 mr-2 text-priority-low" />
              低优先级
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onPriorityChange(task.id, 0)}>
              <Flag className="h-4 w-4 mr-2 text-muted-foreground" />
              无优先级
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
