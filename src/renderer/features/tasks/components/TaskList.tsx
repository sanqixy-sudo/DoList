import { useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TaskItem } from './TaskItem';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTaskStore } from '../store';
import { useUIStore } from '@/features/settings/uiStore';
import type { Priority } from '../../../../../types/models';

export function TaskList() {
  const { tasks, toggleTask, deleteTask, updateTask } = useTaskStore();
  const { activeTaskId, selectTask } = useUIStore();

  const handlePriorityChange = useCallback(async (id: string, priority: Priority) => {
    await updateTask(id, { priority });
  }, [updateTask]);

  // Sort tasks: todo first, then done
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return 0;
    });
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <div className="text-6xl mb-4">📝</div>
        <p className="text-lg">暂无任务</p>
        <p className="text-sm">按 N 键快速添加任务</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        <AnimatePresence mode="popLayout">
          {sortedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isSelected={activeTaskId === task.id}
              onToggle={toggleTask}
              onSelect={selectTask}
              onDelete={deleteTask}
              onPriorityChange={handlePriorityChange}
            />
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
