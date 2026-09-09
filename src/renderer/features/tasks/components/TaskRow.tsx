import { useBatchSelection } from './BatchSelection';
import { memo, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, Sun, Timer, CalendarDays } from 'lucide-react';
import { useTaskStore } from '../store';
import { useUIStore } from '@/features/settings/uiStore';
import { useListStore } from '@/features/navigation/listStore';
import { dateDay } from '../task-selectors';
import { TaskContextMenu } from './TaskContextMenu';
import { cn } from '@/lib/utils';
import type { Task } from '../../../../../types/models';

export const TaskRow = memo(function TaskRow({ task, today, canReorder = true }: { task: Task; today: string; canReorder?: boolean }) {
  const batch = useBatchSelection();
  canReorder = canReorder && !batch.enabled;
  const selected = useUIStore(s => s.activeTaskId === task.id);
  const selectTask = useUIStore(s => s.selectTask);
  const update = useTaskStore(s => s.updateTask);
  const toggle = useTaskStore(s => s.toggleTask);
  const startFocus = useUIStore(s => s.startPomodoroForTask);
  const listName = useListStore(s => s.lists.find(l => l.id === task.listId)?.name);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !canReorder || task.status !== 'todo' });
  const due = dateDay(task.dueDate);
  const overdue = task.status === 'todo' && due && due < today;
  const run = async (action: () => Promise<unknown>) => { if (pendingRef.current) return; pendingRef.current = true; setPending(true); try { await action(); } catch {} finally { pendingRef.current = false; setPending(false); } };
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('task-row', (selected || batch.selected.has(task.id)) && 'is-selected', isDragging && 'is-dragging')} data-task-id={task.id}>
    {canReorder && task.status === 'todo' ? <button type="button" className="task-drag" title="拖动排序，或按 Alt + ↑ / ↓ 调整顺序" aria-label={'拖动排序：' + task.title} {...attributes} {...listeners}><GripVertical size={14} /></button> : <span className="w-[14px] shrink-0" />}
    {batch.enabled ? <label className="task-selection" title="选择任务用于批量操作">
      <input className="batch-checkbox" type="checkbox" aria-label={'选择任务：' + task.title} checked={batch.selected.has(task.id)} disabled={batch.busy} onChange={() => batch.toggle(task.id)} />
      <Check size={12} strokeWidth={3} aria-hidden="true" />
    </label> : <button type="button" role="checkbox" aria-checked={task.status === 'done'} aria-label={'完成任务：' + task.title} disabled={pending} onClick={() => void run(() => toggle(task.id))} className={cn('task-check', task.status === 'done' && 'is-done', 'priority-' + task.priority)}>{task.status === 'done' && <Check size={12} strokeWidth={3} />}</button>}
    <TaskContextMenu task={task} disabled={batch.enabled}>
      <button type="button" className="task-body" onClick={() => batch.enabled ? batch.toggle(task.id) : selectTask(task.id)} disabled={batch.busy} aria-label={(batch.enabled ? '选择任务正文：' : '打开任务：') + task.title}>
        <span className={cn('task-title', task.status === 'done' && 'line-through text-muted-foreground')}>{task.title}</span>
        <span className="task-meta">
          {batch.enabled && task.status !== 'todo' && <span>{task.status === 'done' ? '已完成' : '已取消'}</span>}
          {task.listId !== 'inbox' && <span>{listName}</span>}
          {due && <span className={cn('inline-flex items-center gap-1', overdue && 'text-destructive')}><CalendarDays size={12} />{overdue ? '已过期 · ' : ''}{due === today ? '今天截止' : due.slice(5).replace('-', '/')}</span>}
          {task.plannedDate && <span className="inline-flex items-center gap-1"><Sun size={12} />{task.plannedDate === today ? '今日计划' : task.plannedDate.slice(5).replace('-', '/')}</span>}
          {!!task.subtasks?.length && <span>{task.subtasks.filter(s => s.isDone).length}/{task.subtasks.length} 子任务</span>}
        </span>
      </button>
    </TaskContextMenu>
    {!batch.enabled && <div className="task-actions">
      {task.status === 'todo' && task.plannedDate !== today && <button type="button" title="加入今天，不改变截止日期" aria-label={'加入今天：' + task.title} disabled={pending || batch.enabled} onClick={() => void run(() => update(task.id, { plannedDate: today }))}><Sun size={16} /></button>}
      {task.status === 'todo' && <button type="button" title="开始专注" aria-label={'开始专注：' + task.title} onClick={() => startFocus(task.id)}><Timer size={16} /></button>}
    </div>}
  </div>;
});
