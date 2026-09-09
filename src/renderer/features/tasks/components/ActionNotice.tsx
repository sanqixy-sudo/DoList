import { useEffect, useRef, useState } from 'react';
import { useTaskStore } from '../store';
export function ActionNotice() {
  const ids = useTaskStore(s => s.lastTrashedIds);
  const info = useTaskStore(s => s.undoInfo);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => { setError(''); }, [ids, info]);
  if (!ids.length && !info) return null;
  const undo = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (ids.length) await useTaskStore.getState().restoreTasks(ids);
      else await useTaskStore.getState().undoChange();
    } catch { setError('未能撤销：任务可能已再次修改。新内容已保留，可重试或打开详情调整。'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <div className={'action-notice ' + (ids.length ? 'trash-notice' : '')} role="status">
    <span>{error || (ids.length ? ids.length + ' 项任务已移入回收站' : info!.count + ' 项任务已' + info!.label)}</span>
    <button disabled={busy} onClick={() => void undo()}>{busy ? '正在恢复…' : ids.length ? '撤销移入' : '撤销'}</button>
    <button disabled={busy} aria-label="关闭操作提示" onClick={() => { useTaskStore.getState().dismissTrashNotice(); useTaskStore.getState().dismissUndo(); }}>关闭提示</button>
  </div>;
}
