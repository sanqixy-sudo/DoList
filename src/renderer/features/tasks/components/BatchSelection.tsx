import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTaskStore } from '../store';
import { useListStore } from '@/features/navigation/listStore';
import { useUIStore } from '@/features/settings/uiStore';
import type { BulkTaskUpdateDto, Task } from '../../../../../types/models';

const SelectionContext = createContext<{ enabled: boolean; selected: Set<string>; busy: boolean; toggle: (id: string) => void }>({ enabled: false, selected: new Set(), busy: false, toggle: () => {} });
export const useBatchSelection = () => useContext(SelectionContext);

export function BatchSelection({ tasks, today, children }: { tasks: Task[]; today: string; children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState(today);
  const [project, setProject] = useState('');
  const pending = useRef(false);
  const lists = useListStore(s => s.lists);
  const selected = useMemo(() => new Set(tasks.filter(t => selection.has(t.id)).map(t => t.id)), [tasks, selection]);
  const toggle = (id: string) => { if (!pending.current) setSelection(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const run = async (data?: BulkTaskUpdateDto) => {
    if (pending.current || !selected.size) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (data) await useTaskStore.getState().bulkUpdateTasks([...selected], data);
      else await useTaskStore.getState().trashTasks([...selected]);
      setSelection(new Set());
    } catch { setError('操作未完成，选择和输入已保留，请重试。'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <SelectionContext.Provider value={{ enabled, selected, toggle, busy }}>
    <div className={'batch-toolbar ' + (enabled ? 'is-selecting' : 'is-idle')}>
      {!enabled ? <button type="button" disabled={!tasks.length} onClick={() => { useUIStore.getState().closeDetailPanel(); setEnabled(true); }}>批量整理</button> : <>
        <div className="batch-heading"><strong role="status">已选 {selected.size} 项</strong><span>当前页面共 {tasks.length} 项（含已完成和折叠分组）</span>
          <button disabled={busy} onClick={() => setSelection(new Set(tasks.map(t => t.id)))}>全选当前页面</button>
          <button disabled={busy || !selected.size} onClick={() => setSelection(new Set())}>清空选择</button>
          <button disabled={busy} onClick={() => { setEnabled(false); setSelection(new Set()); setError(''); }}>退出多选</button></div>
        <fieldset disabled={busy || !selected.size} className="batch-actions" aria-label="批量任务操作">
          <div className="batch-action-group" aria-label="安排计划"><button onClick={() => void run({ plannedDate: today })}>加入今天</button>
          <label>计划日期<input aria-label="批量计划日期" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <button disabled={!date} onClick={() => void run({ plannedDate: date })}>应用计划</button>
          <button onClick={() => void run({ plannedDate: null })}>清除计划</button>
          </div><div className="batch-action-group" aria-label="移动归属"><select aria-label="批量目标项目" value={project} onChange={e => setProject(e.target.value)}><option value="">选择项目</option>{lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}</select>
          <button disabled={!project} onClick={() => void run({ listId: project })}>移动项目</button>
          </div><div className="batch-action-group" aria-label="完成与清理"><button onClick={() => void run({ status: 'done' })}>标记完成</button>
          <button className="text-destructive" onClick={() => void run()}>移入回收站</button>
          </div>
        </fieldset>
        <p className="batch-hint">{busy ? '正在保存…' : '勾选仅选择任务，不会标记完成。计划日期独立于截止时间。'}</p>
        {error && <p role="alert" className="text-destructive text-xs">{error}</p>}
      </>}
    </div>
    {children}
  </SelectionContext.Provider>;
}
