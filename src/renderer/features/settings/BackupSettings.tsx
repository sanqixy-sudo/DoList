import { useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, ShieldCheck } from 'lucide-react';
import { useTaskStore } from '@/features/tasks/store';
import type { BackupPreview, BackupProgress } from '../../../../types/backup';

export function BackupSettings({ onBusy }: { onBusy: (value: boolean) => void }) {
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [accepted, setAccepted] = useState(false);
  const pending = useRef(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [canceling, setCanceling] = useState(false);
  useEffect(() => window.electronAPI.backup.onProgress(setProgress), []);
  const run = async (action: () => Promise<void>, failure: string) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setCanceling(false); onBusy(true); setError(''); setMessage('');
    try { await useTaskStore.getState().drainWrites(); await action(); }
    catch (error) { setError(String(error).includes('已取消') ? '操作已取消，当前任务数据没有替换。' : failure); }
    finally { pending.current = false; setBusy(false); onBusy(false); }
  };
  return <section className="backup-settings" aria-label="备份与恢复">
    <h3><ShieldCheck size={17} />备份与恢复</h3>
    <p>完整备份包含任务、项目、回收站及附件。界面偏好和专注统计保留在当前设备。</p>
    <div className="backup-actions">
      <button disabled={busy} onClick={() => void run(async () => { const result = await window.electronAPI.backup.export(); if (result) setMessage('已导出完整备份：' + result.path); }, '备份未能导出，请检查附件是否仍存在、目标目录是否可写，然后重试。')}><Download size={15} />导出完整备份</button>
      <button disabled={busy} onClick={() => void run(async () => { setPreview(null); setAccepted(false); setPreview(await window.electronAPI.backup.preview()); }, '无法读取这份备份：文件可能损坏、附件不完整或版本不兼容。请选择其他备份。')}><RotateCcw size={15} />选择恢复备份</button>
    </div>
    {busy && <div className="backup-progress" role="status">
      <p>{progress ? progress.phase + ' · ' + progress.percent + '%' : '正在准备备份…'}</p>
      <progress className="w-full" max={100} value={progress?.percent ?? 0} aria-label="备份进度" />
      <button disabled={!progress?.canCancel || canceling} onClick={() => { setCanceling(true); void window.electronAPI.backup.cancel(); }}>{canceling ? '正在取消…' : '取消当前操作'}</button>
    </div>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    {message && <p role="status" className="backup-result">{message}</p>}
    {preview && <div className="backup-preview">
      <h4>恢复前预览</h4><p className="break-all">{preview.fileName}</p>
      <p>{new Date(preview.createdAt).toLocaleString('zh-CN')}</p>
      <dl><div><dt>任务</dt><dd>{preview.tasks}</dd></div><div><dt>回收站</dt><dd>{preview.trashed}</dd></div><div><dt>项目</dt><dd>{preview.projects}</dd></div><div><dt>附件</dt><dd>{preview.attachments}</dd></div></dl>
      <p>恢复将用这份备份替换当前任务数据，并重新打开应用页面。替换前会自动创建当前数据的完整备份；自动备份失败时不会继续恢复。</p>
      <label className="backup-accept"><input type="checkbox" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} />我已核对内容，同意替换当前任务数据</label>
      <div className="backup-actions"><button disabled={busy || !accepted} onClick={() => void run(async () => {
        const result = await window.electronAPI.backup.restore(preview.token);
        sessionStorage.setItem('dolist-restored-backup', result.safetyBackupPath);
        window.location.reload();
      }, '恢复未完成，当前数据保持不变。请重新选择备份，或检查磁盘空间和写入权限。')}>恢复并替换任务数据</button>
      <button disabled={busy} onClick={() => { setPreview(null); setAccepted(false); setError(''); }}>取消恢复</button></div>
    </div>}
  </section>;
}
