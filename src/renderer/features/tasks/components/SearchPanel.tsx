import { useEffect, useRef, useState } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTaskStore } from '../store';
import { useUIStore } from '@/features/settings/uiStore';
import type { Task } from '../../../../../types/models';
export function SearchPanel() {
  const open = useUIStore(s => s.isSearchOpen), query = useUIStore(s => s.searchQuery), setQuery = useUIStore(s => s.setSearchQuery);
  const search = useTaskStore(s => s.searchTasks);
  const [results, setResults] = useState<Task[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [index, setIndex] = useState(0), [retry, setRetry] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let canceled = false;
    setError(''); setIndex(0); setResults([]);
    if (!open || !query.trim()) { setBusy(false); return; }
    setBusy(true);
    const timer = setTimeout(() => { search(query.trim()).then(tasks => {
      if (!canceled) { setResults(tasks); setBusy(false); }
    }).catch(() => { if (!canceled) { setBusy(false); setError('搜索未完成，关键词已保留。'); } }); }, 80);
    return () => { canceled = true; clearTimeout(timer); };
  }, [open, query, search, retry]);
  useEffect(() => { list.current?.querySelector('[data-search-index="' + index + '"]')?.scrollIntoView({ block: 'nearest' }); }, [index]);
  const select = async (task: Task) => {
    try {
      const fresh = await window.electronAPI.tasks.get(task.id);
      if (!fresh) { setError('这项任务已被删除，请重新搜索。'); return; }
      useTaskStore.getState().setTask(fresh); useUIStore.getState().toggleSearch(); useUIStore.getState().selectTask(fresh.id);
    } catch { setError('任务未能打开，请重试。'); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!value) useUIStore.getState().toggleSearch(); }}><DialogContent aria-describedby={undefined} className="max-w-xl gap-0 p-0 overflow-hidden"><DialogTitle className="sr-only">搜索任务</DialogTitle>
    <div className="flex items-center gap-3 border-b px-5 py-4 pr-12"><Search size={18} className="text-muted-foreground" /><input autoFocus aria-label="搜索任务" aria-controls="task-search-results" aria-activedescendant={results[index] ? 'search-result-' + index : undefined} role="combobox" aria-expanded={results.length > 0} aria-autocomplete="list" className="w-full bg-transparent text-sm outline-none" placeholder="搜索标题或备注…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.max(0, Math.min(i + 1, results.length - 1))); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[index]) { e.preventDefault(); void select(results[index]); }
    }} /></div>
    <div ref={list} className="max-h-[360px] overflow-y-auto p-2">
      <p role="status" className="px-3 py-2 text-xs text-muted-foreground">{busy ? '正在搜索…' : error || (query.trim() ? results.length === 50 ? '显示前 50 个结果，输入更多关键词可缩小范围。' : results.length ? results.length + ' 个结果' : '没有找到任务，换个关键词试试。' : '输入关键词，找到你的任务。')}</p>
      {error && <button className="mx-3 mb-2 text-sm text-primary" onClick={() => setRetry(n => n + 1)}>重试搜索</button>}
      <div id="task-search-results" role="listbox" aria-label="搜索结果">{!busy && !error && results.map((task, i) => <button type="button" id={'search-result-' + i} role="option" aria-selected={index === i} data-search-index={i} key={task.id} className={'flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left text-sm ' + (index === i ? 'bg-accent' : 'hover:bg-muted')} onMouseEnter={() => setIndex(i)} onClick={() => void select(task)}><span className="min-w-0 truncate">{task.title}</span><ArrowUpRight size={14} className="shrink-0 text-muted-foreground" /></button>)}</div>
    </div><div className="border-t px-5 py-3 text-[10px] text-muted-foreground">↑ ↓ 选择 · Enter 打开 · Esc 关闭</div>
  </DialogContent></Dialog>;
}
