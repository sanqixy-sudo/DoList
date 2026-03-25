import { useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { AnimatePresence } from 'framer-motion';
import { SortableTaskItem } from './SortableTaskItem';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTaskStore } from '../store';
import { useUIStore } from '@/features/settings/uiStore';
import type { Priority } from '../../../../../types/models';

export function SortableTaskList() {
  const { tasks, toggleTask, deleteTask, updateTask, reorderTasks } = useTaskStore();
  const { activeTaskId, selectTask } = useUIStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedTasks.findIndex((t) => t.id === active.id);
      const newIndex = sortedTasks.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(sortedTasks, oldIndex, newIndex);
        reorderTasks(newOrder.map((t) => t.id));
      }
    }
  }, [sortedTasks, reorderTasks]);

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="p-2 space-y-1">
            <AnimatePresence mode="popLayout">
              {sortedTasks.map((task) => (
                <SortableTaskItem
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
        </SortableContext>
      </DndContext>
    </ScrollArea>
  );
}
