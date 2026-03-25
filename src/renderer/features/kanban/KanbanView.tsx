import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/features/tasks/store';
import { useUIStore } from '@/features/settings/uiStore';
import { TaskContextMenu } from '@/features/tasks/components';
import type { Task, TaskStatus } from '../../../../types/models';

interface KanbanColumn {
  id: TaskStatus | 'all';
  title: string;
  color: string;
}

const columns: KanbanColumn[] = [
  { id: 'todo', title: '待办', color: 'bg-blue-500' },
  { id: 'done', title: '已完成', color: 'bg-green-500' },
  { id: 'canceled', title: '已取消', color: 'bg-gray-500' },
];

export function KanbanView() {
  const { tasks, updateTask } = useTaskStore();
  const { selectTask, openQuickAdd, setCurrentView } = useUIStore();

  const tasksByStatus = useMemo(() => {
    const map = new Map<string, Task[]>();
    columns.forEach((column) => map.set(column.id, []));

    tasks.forEach((task) => {
      const existing = map.get(task.status) || [];
      map.set(task.status, [...existing, task]);
    });

    return map;
  }, [tasks]);

  const handleDragStart = (event: React.DragEvent, taskId: string) => {
    event.dataTransfer.setData('taskId', taskId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (event: React.DragEvent, status: TaskStatus) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('taskId');
    if (taskId) {
      await updateTask(taskId, { status });
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 3:
        return 'border-l-red-500';
      case 2:
        return 'border-l-yellow-500';
      case 1:
        return 'border-l-blue-500';
      default:
        return 'border-l-transparent';
    }
  };

  const handleOpenQuickAdd = () => {
    setCurrentView('inbox');
    openQuickAdd();
  };

  return (
    <div className="flex-1 w-full h-full p-4 overflow-auto">
      <div className="grid grid-cols-3 gap-4 h-full min-h-0">
        {columns.map((column) => {
          const columnTasks = tasksByStatus.get(column.id) || [];

          return (
            <div
              key={column.id}
              className="flex flex-col bg-muted/30 rounded-lg min-h-0 overflow-hidden"
              onDragOver={handleDragOver}
              onDrop={(event) => void handleDrop(event, column.id as TaskStatus)}
            >
              <div className="flex items-center justify-between p-3 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className={cn('w-3 h-3 rounded-full', column.color)} />
                  <span className="font-medium">{column.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {columnTasks.length}
                  </span>
                </div>
                {column.id === 'todo' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleOpenQuickAdd}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                  {columnTasks.map((task) => (
                    <TaskContextMenu key={task.id} task={task}>
                      <div
                        draggable
                        onDragStart={(event) => handleDragStart(event, task.id)}
                        onClick={() => selectTask(task.id)}
                        className={cn(
                          'bg-background rounded-lg p-3 shadow-sm border border-l-4 cursor-pointer',
                          'hover:shadow-md transition-shadow',
                          getPriorityColor(task.priority)
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={cn(
                              'text-sm font-medium',
                              task.status === 'done' && 'line-through text-muted-foreground'
                            )}
                          >
                            {task.title}
                          </h4>
                        </div>

                        {task.notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {task.notes}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          {task.dueDate && (
                            <span>
                              {new Date(task.dueDate).toLocaleDateString('zh-CN', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          )}
                          {task.subtasks && task.subtasks.length > 0 && (
                            <span>
                              {task.subtasks.filter((subtask) => subtask.isDone).length}/
                              {task.subtasks.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </TaskContextMenu>
                  ))}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
