import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTaskStore } from '../store';
import { TaskRow } from './TaskRow';
import { cn } from '@/lib/utils';
import type { Task } from '../../../../../types/models';

interface TaskSectionProps {
  title: string;
  tasks: Task[];
  today: string;
  scrollRef: RefObject<HTMLDivElement>;
  collapsed?: boolean;
  tone?: string;
  dateOrdered?: boolean;
}

export function TaskSection({ title, tasks, today, scrollRef, collapsed = false, tone, dateOrdered = false }: TaskSectionProps) {
  const [open, setOpen] = useState(!collapsed);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; selector: string } | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const reorder = useTaskStore(s => s.reorderTasks);
  const virtualized = tasks.length > 80;
  const ids = useMemo(() => tasks.map(task => task.id), [tasks]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const rangeExtractor = useCallback((range: Range) => {
    const indexes = new Set(defaultRangeExtractor(range));
    // Keep the dragged row and keyboard focus mounted while the viewport moves.
    for (const id of [activeId, focusedId]) {
      const index = id ? ids.indexOf(id) : -1;
      if (index >= 0) indexes.add(index);
    }
    return [...indexes].sort((a, b) => a - b);
  }, [activeId, focusedId, ids]);
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 68, // 62px task row + 6px separation.
    getItemKey: index => ids[index],
    overscan: 8,
    scrollMargin,
    rangeExtractor,
    enabled: virtualized && open,
  });
  const items = virtualizer.getVirtualItems();

  useLayoutEffect(() => {
    const body = bodyRef.current, scroller = scrollRef.current;
    if (!open || !virtualized || !body || !scroller) return;
    const update = () => {
      const offset = body.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      setScrollMargin(previous => Math.abs(previous - offset) > 0.5 ? offset : previous);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    // Expanding a preceding section changes this section's position.
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    return () => observer.disconnect();
  }, [open, virtualized, scrollRef, tasks.length]);

  useLayoutEffect(() => {
    if (!focusRequest) return;
    const row = bodyRef.current?.querySelector<HTMLElement>('[data-task-id="' + focusRequest.id + '"]');
    const target = row?.querySelector<HTMLElement>(focusRequest.selector);
    if (target) {
      target.focus({ preventScroll: true });
      if (!virtualized) target.scrollIntoView({ block: 'nearest' });
      setFocusRequest(null);
    }
  }, [focusRequest, items, virtualized]);

  const moveTask = (from: number, to: number) => {
    if (dateOrdered) return;
    if (from < 0 || to < 0 || to >= tasks.length || from === to) return;
    const reordered = arrayMove(tasks, from, to).map(task => task.id);
    const members = new Set(reordered);
    let index = 0;
    const all = [...useTaskStore.getState().tasks].sort((a, b) => a.sortOrder - b.sortOrder);
    void reorder(all.map(task => members.has(task.id) ? reordered[index++] : task.id));
  };
  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (!event.over) return;
    moveTask(ids.indexOf(String(event.active.id)), ids.indexOf(String(event.over.id)));
  };
  const focusTask = (index: number, selector = '.task-body') => {
    const task = tasks[index];
    if (!task) return;
    setFocusedId(task.id);
    if (virtualized) virtualizer.scrollToIndex(index, { align: 'auto' });
    setFocusRequest({ id: task.id, selector });
  };
  if (!tasks.length) return null;

  return <section className="task-section">
    <button type="button" className={cn('section-label', tone)} aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      {title}<span className="section-count">{tasks.length}</span>
    </button>
    {open && <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={event => setActiveId(String(event.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={bodyRef}
          role="list"
          aria-label={title}
          className={virtualized ? 'virtual-task-list' : undefined}
          style={virtualized ? { height: virtualizer.getTotalSize() } : undefined}
          onFocusCapture={event => {
            const row = (event.target as HTMLElement).closest<HTMLElement>('[data-task-id]');
            if (row) setFocusedId(row.dataset.taskId ?? null);
          }}
          onBlurCapture={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedId(null);
          }}
          onKeyDownCapture={event => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            const target = event.target as HTMLElement;
            const row = target.closest<HTMLElement>('[data-task-id]');
            if (!row) return;
            const index = ids.indexOf(row.dataset.taskId ?? '');
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            if (target.closest('.task-drag') && event.altKey && event.key.startsWith('Arrow')) {
              event.preventDefault(); event.stopPropagation();
              moveTask(index, index + delta);
              return;
            }
            if (!target.closest('.task-body') || event.altKey || event.ctrlKey || event.metaKey) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tasks.length - 1 : index + delta;
            focusTask(Math.max(0, Math.min(tasks.length - 1, next)));
          }}
        >
          {virtualized ? items.map(item => <div
            key={item.key}
            role="listitem"
            aria-posinset={item.index + 1}
            aria-setsize={tasks.length}
            className="virtual-task-item"
            style={{ height: item.size, transform: 'translateY(' + (item.start - scrollMargin) + 'px)', zIndex: activeId === tasks[item.index].id ? 2 : undefined }}
          ><TaskRow canReorder={!dateOrdered} task={tasks[item.index]} today={today} /></div>)
            : tasks.map(task => <div key={task.id} role="listitem"><TaskRow canReorder={!dateOrdered} task={task} today={today} /></div>)}
        </div>
      </SortableContext>
    </DndContext>}
  </section>;
}
