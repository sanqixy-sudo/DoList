import { useEffect, useState } from 'react';
import type { SaveStatus } from '../../../types/ipc';
export function SaveNotice() {
  const [status, setStatus] = useState<SaveStatus>({ pending: false, error: null });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true, received = false;
    const unsubscribe = window.electronAPI.app.onSaveStatus(value => { received = true; setStatus(value); });
    void window.electronAPI.app.getSaveStatus().then(value => { if (active && !received) setStatus(value); }).catch(() => {
      if (active) setStatus({ pending: true, error: '无法确认磁盘保存状态，请重试保存。' });
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  if (!status.error) return null;
  return <div role="alert" className="save-notice inline-error flex items-center justify-between gap-3 mx-6 my-2">
    <span>{status.error} 暂时不要退出应用，也可以到设置导出备份。</span>
    <button className="shrink-0 underline" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await window.electronAPI.app.flushDatabase(); setStatus(await window.electronAPI.app.getSaveStatus()); }
      catch { /* The main process retains data and sends the failure status. */ }
      finally { setBusy(false); }
    }}>{busy ? '保存中…' : '重试保存'}</button>
  </div>;
}
