import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { GripVertical, Plus, Search, X } from 'lucide-react';
import { useWorkspaceTasks } from '@/features/tasks/use-workspace-tasks';
import { useTaskStore } from '@/features/tasks/store';
import { useUIStore } from '@/features/settings/uiStore';
import { TaskContextMenu } from '@/features/tasks/components/TaskContextMenu';
import { TaskCard, statusNames } from '@/features/tasks/components/TaskCard';
import { VirtualCardList } from '@/features/tasks/components/VirtualCardList';
import { TaskViewFeedback } from '@/features/tasks/components/TaskViewFeedback';
import { groupBoardTasks } from './kanban-model';
import type { Task, TaskStatus } from '../../../../types/models';

const statuses: TaskStatus[] = ['todo', 'done', 'canceled'];


function BoardCard({ task, busy, onMove }: { task: Task; busy: boolean; onMove: (id: string, status: TaskStatus) => void }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: task.id, disabled: busy });
  const select = useUIStore(s => s.selectTask);
  return <div ref={setNodeRef} className={isDragging ? 'board-card-dragging' : undefined}>
    <TaskContextMenu task={task}><div>
      <TaskCard task={task} onOpen={() => select(task.id)} actions={<>
        <select aria-label={'更改状态：' + task.title} value={task.status} disabled={busy}
          onChange={event => onMove(task.id, event.target.value as TaskStatus)}>
          {statuses.map(status => <option key={status} value={status}>{statusNames[status]}</option>)}
        </select>
        <button type="button" className="board-drag-handle" aria-label={'拖动任务：' + task.title} disabled={busy} {...attributes} {...listeners}><GripVertical size={15} /></button>
      </>} />
    </div></TaskContextMenu>
  </div>;
}
function BoardColumn({ status, tasks, activeId, pending, onMove, searching }: {
  status: TaskStatus; tasks: Task[]; activeId: string | null; pending: Set<string>;
  onMove: (id: string, status: TaskStatus) => void; searching: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return <section ref={setNodeRef} className={'board-column status-' + status + (isOver ? ' is-over' : '')} data-board-column={status} aria-label={statusNames[status]}>
    <header className="board-column-header"><span className="board-status-dot" /><h2>{statusNames[status]}</h2><span className="board-count">{tasks.length}</span>
      {status === 'todo' && <button type="button" aria-label="添加待办任务" onClick={() => useUIStore.getState().openQuickAdd()}><Plus size={17} /></button>}
    </header>
    {tasks.length ? <VirtualCardList tasks={tasks} activeId={activeId} label={statusNames[status] + '任务'}
      renderTask={task => <BoardCard task={task} busy={pending.has(task.id)} onMove={onMove} />} />
      : <div className="board-empty"><span>{searching ? '没有匹配的任务' : status === 'todo' ? '从一件小事开始' : status === 'done' ? '完成的任务会留在这里' : '已取消的任务会留在这里'}</span>
        {status === 'todo' && !searching && <button onClick={() => useUIStore.getState().openQuickAdd()}><Plus size={14} />添加任务</button>}</div>}
  </section>;
}
export function KanbanView() {
  const tasks = useWorkspaceTasks();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const groups = useMemo(() => groupBoardTasks(tasks, deferredQuery), [tasks, deferredQuery]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState(new Set<string>());
  const pendingRef = useRef(new Set<string>());
  const [message, setMessage] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const move = useCallback(async (id: string, status: TaskStatus, restoreCompletedAt?: string) => {
    const task = useTaskStore.getState().tasks.find(task => task.id === id);
    if (!task || task.status === status || pendingRef.current.has(id)) return;
    pendingRef.current.add(id); setPending(new Set(pendingRef.current)); setMessage('');
    try {
      await useTaskStore.getState().updateTask(id, { status, restoreCompletedAt });


    } catch { setMessage('状态未能更新，任务已保留，请重试。'); }
    finally { pendingRef.current.delete(id); setPending(new Set(pendingRef.current)); }
  }, []);
  const activeTask = tasks.find(task => task.id === activeId);
  return <div className="board-view">
    <div className="view-toolbar"><p>按状态整理，一步步推进。</p><label className="view-search"><Search size={15} /><input aria-label="筛选当前看板任务" placeholder="筛选当前看板…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="清除看板筛选" onClick={() => setQuery('')}><X size={14} /></button>}</label></div>
    <TaskViewFeedback />
    {message && <div role="status" className="board-feedback"><span>{message}</span><button aria-label="关闭状态提示" onClick={() => { setMessage(''); }}><X size={14} /></button></div>}
    <DndContext sensors={sensors} onDragStart={event => setActiveId(String(event.active.id))} onDragCancel={() => setActiveId(null)}
      onDragEnd={event => { setActiveId(null); if (event.over && statuses.includes(event.over.id as TaskStatus)) void move(String(event.active.id), event.over.id as TaskStatus); }}>
      <div className="board-columns">{statuses.map(status => <BoardColumn key={status} status={status} tasks={groups[status]} activeId={activeId} pending={pending} onMove={(id, next) => void move(id, next)} searching={!!deferredQuery.trim()} />)}</div>
      <DragOverlay dropAnimation={null}>{activeTask && <div className="board-drag-preview"><TaskCard task={activeTask} onOpen={() => {}} /></div>}</DragOverlay>
    </DndContext>
  </div>;
}
