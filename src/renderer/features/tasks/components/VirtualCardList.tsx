import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react';
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual';
import type { Task } from '../../../../../types/models';

export function VirtualCardList({ tasks, renderTask, activeId, label, itemHeight = 180 }: {
  tasks: Task[]; renderTask: (task: Task) => ReactNode; activeId?: string | null; label: string; itemHeight?: number;
}) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<string | null>(null);
  const rangeExtractor = useCallback((range: Range) => {
    const indexes = new Set(defaultRangeExtractor(range));
    for (const id of [activeId, focused]) {
      const index = id ? tasks.findIndex(task => task.id === id) : -1;
      if (index >= 0) indexes.add(index);
    }
    return [...indexes].sort((a, b) => a - b);
  }, [tasks, activeId, focused]);
  const virtualizer = useVirtualizer({
    count: tasks.length, getScrollElement: () => scroller, estimateSize: () => itemHeight,
    getItemKey: index => tasks[index].id, overscan: 4, rangeExtractor,
  });
  const items = virtualizer.getVirtualItems();
  useLayoutEffect(() => {
    if (!focusRequest) return;
    const card = scroller?.querySelector<HTMLElement>('[data-card-id="' + focusRequest + '"]');
    const button = card?.matches('.task-card-open') ? card : card?.querySelector<HTMLButtonElement>('.task-card-open');
    if (button) { button.focus({ preventScroll: true }); setFocusRequest(null); }
  }, [items, focusRequest, scroller]);
  return <div className="card-list-scroll" ref={setScroller} role="list" aria-label={label}
    onFocusCapture={event => setFocused((event.target as HTMLElement).closest<HTMLElement>('[data-card-id]')?.dataset.cardId ?? null)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(null); }}
    onKeyDown={event => {
      if (!(event.target as HTMLElement).closest('.task-card-open') || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const id = (event.target as HTMLElement).closest<HTMLElement>('[data-card-id]')?.dataset.cardId;
      const current = tasks.findIndex(task => task.id === id);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tasks.length - 1 : current + (event.key === 'ArrowDown' ? 1 : -1);
      const index = Math.max(0, Math.min(tasks.length - 1, next));
      if (!tasks[index]) return;
      setFocused(tasks[index].id); setFocusRequest(tasks[index].id);
      virtualizer.scrollToIndex(index, { align: 'auto' });
    }}>
    <div className="card-list-inner" style={{ height: virtualizer.getTotalSize() }}>
      {items.map(item => <div key={item.key} className="card-list-item" role="listitem" aria-posinset={item.index + 1} aria-setsize={tasks.length}
        style={{ height: itemHeight, transform: 'translateY(' + item.start + 'px)' }}>{renderTask(tasks[item.index])}</div>)}
    </div>
  </div>;
}
