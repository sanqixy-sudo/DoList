import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTaskStore } from '../store';
import { useListStore } from '@/features/navigation/listStore';
import { VirtualCardList } from './VirtualCardList';
export function TrashView() {
  const tasks = useTaskStore(s => s.trashedTasks);
  const loading = useTaskStore(s => s.trashLoading);
  const error = useTaskStore(s => s.trashError);
  const fetchTrash = useTaskStore(s => s.fetchTrash);
  const lists = useListStore(s => s.lists);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const pending = useRef(false);
  useEffect(() => { void fetchTrash(); }, [fetchTrash]);
  const filtered = useMemo(() => tasks.filter(t => (t.title + ' ' + (t.notes ?? '')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [tasks, query]);
  const selected = filtered.filter(t => selection.has(t.id)).map(t => t.id);
  const run = async (ids: string[], purge: boolean) => {
    if (pending.current || !ids.length) return;
    if (purge && !window.confirm('永久删除所选 ' + ids.length + ' 项任务及其子任务、提醒和附件？此操作无法撤销。')) return;
    pending.current = true; setBusy(true); setActionError('');
    try {
      if (purge) await useTaskStore.getState().purgeTasks(ids);
      else await useTaskStore.getState().restoreTasks(ids);
      setSelection(previous => new Set([...previous].filter(id => !ids.includes(id))));
    } catch { setActionError('操作未完成，所选任务仍保留，请重试。'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <div className="trash-view">
    <p className="text-sm text-muted-foreground">任务会一直保留，直到你永久删除。恢复时保留原状态和日期；原项目已删除的任务恢复到收件箱。</p>
    <div className="batch-toolbar">
      <input className="trash-search" aria-label="搜索回收站" placeholder="搜索已删除任务…" value={query} disabled={busy} onChange={e => { setQuery(e.target.value); setSelection(new Set()); }} />
      <div className="batch-heading"><span role="status">已选 {selected.length} / {filtered.length} 项</span>
        <button disabled={busy || loading || !filtered.length} onClick={() => setSelection(new Set(filtered.map(t => t.id)))}>全选搜索结果</button>
        <button disabled={busy || !selected.length} onClick={() => setSelection(new Set())}>清空选择</button>
        <button disabled={busy || !selected.length} onClick={() => void run(selected, false)}>恢复所选</button>
        <button className="text-destructive" disabled={busy || !selected.length} onClick={() => void run(selected, true)}>永久删除所选</button>
      </div>
    </div>
    {(error || actionError) && <div className="inline-error" role="alert">{actionError || error}{error && <button disabled={busy} onClick={() => void fetchTrash()}>重试加载回收站</button>}</div>}
    {loading && <p role="status">正在读取回收站…</p>}
    {!loading && !error && !filtered.length && <div className="today-empty"><Trash2 size={30} /><h2>{query ? '没有匹配的任务' : '回收站是空的'}</h2><p>移入回收站的任务可以在这里恢复。</p>{query && <button onClick={() => setQuery('')}>清除搜索</button>}</div>}
    <VirtualCardList itemHeight={112} tasks={filtered} label="回收站任务" renderTask={task => <article className="trash-card" data-card-id={task.id}>
      <div className="flex items-start gap-3"><input type="checkbox" aria-label={'选择已删除任务：' + task.title} checked={selection.has(task.id)} disabled={busy} onChange={() => setSelection(previous => { const next = new Set(previous); if (next.has(task.id)) next.delete(task.id); else next.add(task.id); return next; })} /><div className="min-w-0 flex-1"><button className="task-card-open trash-title" title={task.title} aria-label={'选择已删除任务正文：' + task.title} disabled={busy} onClick={() => setSelection(previous => { const next = new Set(previous); if (next.has(task.id)) next.delete(task.id); else next.add(task.id); return next; })}>{task.title}</button>
        <p className="trash-meta">{lists.find(l => l.id === task.listId)?.name ?? '收件箱'} · {task.status === 'done' ? '已完成' : task.status === 'canceled' ? '已取消' : '待办'} · {task.deletedAt ? new Date(task.deletedAt).toLocaleDateString('zh-CN') : ''} 移入</p>
        <p className="trash-notes">{task.notes || '无备注'} · {task.subtasks?.length ?? 0} 个子任务 · {task.attachments?.length ?? 0} 个附件</p>
      </div></div>
      <div className="trash-card-actions"><button disabled={busy} aria-label={'恢复任务：' + task.title} onClick={() => void run([task.id], false)}>恢复任务</button><button className="text-destructive" disabled={busy} aria-label={'永久删除任务：' + task.title} onClick={() => void run([task.id], true)}>永久删除</button></div>
    </article>} />
  </div>;
}
