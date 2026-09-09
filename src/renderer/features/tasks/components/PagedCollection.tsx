import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
export function PagedCollection<T>({ items, label, renderItem, pageSize = 40 }: {
  items: T[]; label: string; renderItem: (item: T, index: number) => ReactNode; pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const total = Math.max(1, Math.ceil(items.length / pageSize)), current = Math.min(page, total - 1);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { if (page !== current) setPage(current); }, [page, current]);
  const change = (value: number) => { setPage(value); if (scroller.current) scroller.current.scrollTop = 0; };
  return <div className="paged-collection flex min-h-0 flex-1 flex-col" aria-label={label}>
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto p-4" role="list" aria-label={label + '记录'}>
      {items.length ? items.slice(current * pageSize, (current + 1) * pageSize).map((item, index) => <div role="listitem" key={current * pageSize + index} className="mb-3" aria-posinset={current * pageSize + index + 1} aria-setsize={items.length}>{renderItem(item, current * pageSize + index)}</div>)
        : <p className="py-8 text-center text-sm text-muted-foreground">当前范围没有记录。</p>}
    </div>
    <nav aria-label={label + '分页'} className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t p-2">
      <Button size="sm" variant="ghost" aria-label={label + '第一页'} disabled={current === 0} onClick={() => change(0)}>首页</Button>
      <Button size="sm" variant="outline" aria-label={label + '上一页'} disabled={current === 0} onClick={() => change(current - 1)}>上一页</Button>
      <span role="status" className="text-xs text-muted-foreground">{current + 1} / {total} 页 · {items.length} 条</span>
      <Button size="sm" variant="outline" aria-label={label + '下一页'} disabled={current + 1 === total} onClick={() => change(current + 1)}>下一页</Button>
      <Button size="sm" variant="ghost" aria-label={label + '最后一页'} disabled={current + 1 === total} onClick={() => change(total - 1)}>末页</Button>
    </nav>
  </div>;
}
