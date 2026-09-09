import { useState } from 'react';
import { formatFileSize } from '@/features/tasks/attachment-utils';
export function MaintenanceSettings({ onBusy }: { onBusy: (busy: boolean) => void }) {
  const [scan, setScan] = useState<{ files: number; bytes: number } | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const run = async (clean: boolean) => {
    if (busy) return; setBusy(true); onBusy(true); setMessage('');
    try {
      const result = clean ? await window.electronAPI.app.cleanupAttachments() : await window.electronAPI.app.scanAttachments();
      if (clean) {
        setMessage('已清理 ' + result.files + ' 个文件，释放 ' + formatFileSize(result.bytes) + (result.failed ? '；' + result.failed + ' 个文件被占用或无权限，可稍后重新扫描并重试。' : '。'));
        setScan(null);
      } else setScan(result);
    } catch { setMessage('检查未完成，请等待备份结束或检查文件权限后重试。'); }
    finally { setBusy(false); onBusy(false); }
  };
  return <section aria-label="附件空间清理" className="mt-5 rounded-lg border p-4">
    <h3 className="text-sm font-medium">附件空间</h3>
    <p className="my-2 text-xs text-muted-foreground">扫描删除任务和恢复备份后留下的未引用文件。正在使用的附件和完整备份会保留。</p>
    <button className="text-sm text-primary" disabled={busy} onClick={() => void run(false)}>{busy ? '处理中…' : '扫描未引用文件'}</button>
    {scan && <div className="mt-2 text-sm"><p>可清理 {scan.files} 个文件 · {formatFileSize(scan.bytes)}</p>
      <button disabled={busy || !scan.files} className="mt-2 text-primary" onClick={() => void run(true)}>清理未引用文件</button></div>}
    {message && <p role="status" className="mt-2 text-xs">{message}</p>}
  </section>;
}
