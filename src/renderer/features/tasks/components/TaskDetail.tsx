import { createDraftMap } from '../draft-storage';
import { useEffect, useRef, useState } from 'react';
import { X, Check, Plus, Trash2, Paperclip, ExternalLink, Sun, Timer } from 'lucide-react';
import { useTaskStore } from '../store';
import { useUIStore } from '@/features/settings/uiStore';
import { useListStore } from '@/features/navigation/listStore';
import { Button } from '@/components/ui/button';
import { AttachmentPreviewImage } from './AttachmentPreviewImage';
import { formatFileSize, isImageMimeType } from '../attachment-utils';
import { localDay } from '../task-selectors';
import type { UpdateTaskDto } from '../../../../../types/models';

// Retain unsaved drafts while navigating between tasks, including failed saves.
const drafts = createDraftMap<{ title: string; notes: string }>('dolist-text-drafts-v1', value => typeof value.title === 'string' && typeof value.notes === 'string');
const fieldDrafts = createDraftMap<UpdateTaskDto>('dolist-field-drafts-v1');
export function TaskDetail({ mode: _mode }: { mode?: 'inline' | 'drawer' | 'modal' }) {
  const id = useUIStore(s => s.activeTaskId);
  const task = useTaskStore(s => s.tasks.find(t => t.id === id));
  const lists = useListStore(s => s.lists);
  const updateTask = useTaskStore(s => s.updateTask);
  const setTask = useTaskStore(s => s.setTask);
  const initial = drafts.get(id ?? '') ?? { title: task?.title ?? '', notes: task?.notes ?? '' };
  const [title, setTitle] = useState(initial.title);
  const [notes, setNotes] = useState(initial.notes);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState('');
  const [fieldDraft, setFieldDraft] = useState<UpdateTaskDto>(() => fieldDrafts.get(id ?? '') ?? {});
  const fieldDraftRef = useRef<UpdateTaskDto>(fieldDraft);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [reminder, setReminder] = useState('');
  const submitting = useRef(false);
  useEffect(() => {
    if (task && !drafts.has(task.id)) { setTitle(task.title); setNotes(task.notes ?? ''); }
  }, [task?.id, task?.title, task?.notes, busy]);
  if (!task) return <div className="p-6 text-sm text-muted-foreground">任务已不存在。<Button variant="ghost" onClick={() => useUIStore.getState().closeDetailPanel()}>关闭</Button></div>;
  const displayed = { ...task, ...fieldDraft };
  const writeDraft = (value: Partial<{ title: string; notes: string }>) => {
    const next = { title, notes, ...value };
    drafts.set(task.id, next); setTitle(next.title); setNotes(next.notes);
  };
  const run = async (action: () => Promise<unknown>) => {
    setBusy(n => n + 1); setError('');
    try { await action(); } catch { setError('修改未能保存。输入已保留，可用下方按钮重试。'); }
    finally { setBusy(n => n - 1); }
  };
  const update = (data: UpdateTaskDto) => {
    fieldDraftRef.current = { ...fieldDraftRef.current, ...data }; setFieldDraft(fieldDraftRef.current); fieldDrafts.set(task.id, fieldDraftRef.current);
    return run(async () => {
      await updateTask(task.id, data);
      const remaining = { ...fieldDraftRef.current };
      for (const key of Object.keys(data) as (keyof UpdateTaskDto)[]) { if (remaining[key] === data[key]) delete remaining[key]; }
      fieldDraftRef.current = remaining; setFieldDraft(remaining);
      if (Object.keys(remaining).length) fieldDrafts.set(task.id, remaining); else fieldDrafts.delete(task.id);
    });
  };
  const saveDraft = () => {
    const snapshot = drafts.get(task.id);
    if (!snapshot) return;
    if (!snapshot.title.trim()) { setError('任务标题不能为空。'); return; }
    void run(async () => {
      await updateTask(task.id, { title: snapshot.title.trim(), notes: snapshot.notes || null });
      if (drafts.get(task.id) === snapshot) drafts.delete(task.id);
    });
  };
  const refresh = async () => { const fresh = await window.electronAPI.tasks.get(task.id); if (fresh) setTask(fresh); };
  const addSubtask = async (event: React.FormEvent) => {
    event.preventDefault(); if (submitting.current || !subtaskTitle.trim()) return;
    submitting.current = true;
    await run(async () => { await window.electronAPI.subtasks.create({ taskId: task.id, title: subtaskTitle.trim() }); setSubtaskTitle(''); await refresh(); });
    submitting.current = false;
  };
  const attach = () => run(async () => {
    const picked = await window.electronAPI.tasks.pickAttachments();
    try { for (const file of picked) await window.electronAPI.tasks.addAttachment(task.id, file); }
    finally { await refresh(); }
  });
  const paste = async (event: React.ClipboardEvent) => {
    if (!Array.from(event.clipboardData.items).some(item => item.type.startsWith('image/'))) return;
    event.preventDefault();
    await run(async () => { const image = await window.electronAPI.tasks.pasteClipboardImage(); if (image) await window.electronAPI.tasks.addAttachment(task.id, image); await refresh(); });
  };
  const remove = async () => {
    await run(async () => { await useTaskStore.getState().deleteTask(task.id); drafts.delete(task.id); fieldDrafts.delete(task.id); useUIStore.getState().closeDetailPanel(); });
  };
  return <div className="detail-panel" onPasteCapture={event => void paste(event)}>
    <div className="detail-top">
      <button type="button" className="flex items-center gap-2 text-xs text-muted-foreground" disabled={busy > 0} onClick={() => void update({ status: task.status === 'done' ? 'todo' : 'done' })}><span className={'task-check ' + (task.status === 'done' ? 'is-done' : '')}>{task.status === 'done' && <Check size={12} />}</span>{task.status === 'done' ? '已完成' : '标记完成'}</button>
      <Button size="icon" variant="ghost" aria-label="关闭任务详情" onClick={() => { saveDraft(); useUIStore.getState().closeDetailPanel(); }}><X size={16} /></Button>
    </div>
    <div className="detail-scroll">
      <textarea rows={2} aria-label="任务标题" className="detail-title" value={title} onChange={e => writeDraft({ title: e.target.value })} onBlur={saveDraft} />
      <div role="status" className="mt-1 mb-5 text-[10px] text-muted-foreground">{busy ? '正在保存…' : (drafts.has(task.id) || Object.keys(fieldDraft).length > 0) ? '有未保存的编辑' : '已保存'}</div>
      {(drafts.persistenceError || fieldDrafts.persistenceError) && <div role="alert" className="inline-error">{drafts.persistenceError || fieldDrafts.persistenceError}</div>}
      {error && <div role="alert" className="inline-error">{error}{Object.keys(fieldDraft).length > 0 && <button disabled={busy > 0} onClick={() => void update(fieldDraft)}>重试保存字段</button>}{drafts.has(task.id) && <button onClick={saveDraft}>重试保存</button>}</div>}
      {!error && !busy && Object.keys(fieldDraft).length > 0 && <div role="status" className="inline-error">有尚未保存的字段修改。<button onClick={() => void update(fieldDraft)}>重试保存字段</button></div>}
      <label className="detail-field"><span>计划日期</span><input type="date" value={displayed.plannedDate ?? ''} onChange={e => void update({ plannedDate: e.target.value || null })} /></label>
      <div className="flex justify-end"><button type="button" className="flex items-center gap-1 text-[11px] text-primary" onClick={() => void update({ plannedDate: localDay() })}><Sun size={12} />安排到今天</button></div>
      <label className="detail-field"><span>截止时间</span><input type="datetime-local" value={displayed.dueDate ? toLocalInput(displayed.dueDate!) : ''} onChange={e => void update({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
      <label className="detail-field"><span>所属项目</span><select value={displayed.listId} onChange={e => void update({ listId: e.target.value })}>{lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
      <label className="detail-field"><span>优先级</span><select value={displayed.priority} onChange={e => void update({ priority: Number(e.target.value) as 0 | 1 | 2 | 3 })}><option value={0}>无优先级</option><option value={1}>低优先级</option><option value={2}>中优先级</option><option value={3}>高优先级</option></select></label>
      <label className="detail-field"><span>任务状态</span><select value={displayed.status} onChange={e => void update({ status: e.target.value as 'todo' | 'done' | 'canceled' })}><option value="todo">待办</option><option value="done">已完成</option><option value="canceled">已取消</option></select></label>
      {!!task.tags?.length && <div className="flex flex-wrap gap-2 mt-4">{task.tags.map(tag => <span key={tag.id} className="rounded bg-muted px-2 py-1 text-[11px]">#{tag.name}</span>)}</div>}
      <section className="detail-block"><h3>备注</h3><textarea className="detail-notes" aria-label="任务备注" value={notes} onChange={e => writeDraft({ notes: e.target.value })} onBlur={saveDraft} placeholder="补充想法、链接或需要记住的事…" /></section>
      <section className="detail-block"><h3>子任务 <span className="ml-2 font-normal text-muted-foreground">{task.subtasks?.filter(s => s.isDone).length ?? 0}/{task.subtasks?.length ?? 0}</span></h3>
        {task.subtasks?.map(sub => <div key={sub.id} className="flex items-center gap-2 py-2 text-xs"><input type="checkbox" aria-label={'完成子任务：' + sub.title} checked={sub.isDone} disabled={busy > 0} onChange={() => void run(async () => { await window.electronAPI.subtasks.toggle(sub.id); await refresh(); })} /><span className={'min-w-0 flex-1 break-words ' + (sub.isDone ? 'line-through text-muted-foreground' : '')}>{sub.title}</span><button aria-label={'删除子任务：' + sub.title} onClick={() => { if (window.confirm('删除子任务“' + sub.title + '”？')) void run(async () => { await window.electronAPI.subtasks.delete(sub.id); await refresh(); }); }}><X size={12} /></button></div>)}
        <form onSubmit={addSubtask} className="flex gap-2 mt-2"><input className="detail-small-input flex-1" aria-label="新子任务" placeholder="添加一个小步骤" value={subtaskTitle} disabled={busy > 0} onChange={e => setSubtaskTitle(e.target.value)} onKeyDown={e => { if (e.nativeEvent.isComposing && e.key === 'Enter') e.preventDefault(); }} /><Button type="submit" variant="ghost" size="icon" aria-label="添加子任务" disabled={busy > 0 || !subtaskTitle.trim()}><Plus size={16} /></Button></form>
      </section>
      <details className="detail-block"><summary>提醒 <span className="ml-2 font-normal text-muted-foreground">{task.reminders?.length || ''}</span></summary>
        {task.reminders?.map(rem => <div key={rem.id} className="flex items-center gap-2 py-2 text-xs"><span className="flex-1">{new Date(rem.remindAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {rem.isSent ? '已提醒' : '待提醒'}</span><button aria-label="删除提醒" onClick={() => void run(async () => { await window.electronAPI.reminders.delete(rem.id); await refresh(); })}><X size={13} /></button></div>)}
        <div className="flex gap-2"><input aria-label="提醒时间" type="datetime-local" className="detail-small-input flex-1" value={reminder} onChange={e => setReminder(e.target.value)} /><Button variant="ghost" size="icon" aria-label="添加提醒" disabled={!reminder || busy > 0} onClick={() => void run(async () => { const date = new Date(reminder); if (date.getTime() <= Date.now()) { setError('请选择未来的提醒时间。'); return; } await window.electronAPI.reminders.create({ taskId: task.id, remindAt: date.toISOString() }); setReminder(''); await refresh(); })}><Plus size={16} /></Button></div>
      </details>
      <details className="detail-block" open={!!task.attachments?.length}><summary>附件 <span className="ml-2 font-normal text-muted-foreground">{task.attachments?.length || ''}</span></summary>
        {task.attachments?.map(file => <div key={file.id} className="my-2 flex items-center gap-2 rounded-lg bg-muted/50 p-2">{isImageMimeType(file.mimeType) ? <AttachmentPreviewImage filePath={file.filePath} alt={file.name} className="h-10 w-10 rounded object-cover" fallbackClassName="h-10 w-10" /> : <Paperclip size={18} />}<button className="min-w-0 flex-1 text-left" onClick={() => void run(() => window.electronAPI.tasks.openAttachment(file.filePath))}><span className="block truncate text-xs">{file.name}</span><span className="text-[10px] text-muted-foreground">{formatFileSize(file.fileSize)} <ExternalLink className="inline" size={10} /></span></button><button aria-label={'删除附件：' + file.name} onClick={() => { if (window.confirm('永久删除附件“' + file.name + '”？')) void run(async () => { await window.electronAPI.tasks.removeAttachment(file.id); await refresh(); }); }}><X size={13} /></button></div>)}
        <Button variant="ghost" size="sm" disabled={busy > 0} onClick={() => void attach()}><Paperclip size={14} className="mr-2" />添加附件</Button><p className="mt-2 text-[10px] text-muted-foreground">也可以直接粘贴图片。</p>
      </details>
      <div className="detail-block flex items-center justify-between"><Button size="sm" variant="ghost" onClick={() => useUIStore.getState().startPomodoroForTask(task.id)}><Timer size={14} className="mr-2" />开始专注</Button><Button size="icon" variant="ghost" aria-label="移入回收站" title="移入回收站，可以恢复" disabled={busy > 0} onClick={() => void remove()}><Trash2 size={14} className="text-muted-foreground" /></Button></div>
    </div>
  </div>;
}
function toLocalInput(value: string): string {
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}
