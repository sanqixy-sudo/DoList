import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useUIStore } from '@/features/settings/uiStore';
import { TaskCard } from '../tasks/components/TaskCard';
import { VirtualCardList } from '../tasks/components/VirtualCardList';
import type { Task } from '../../../../types/models';

export function CalendarDayDialog({ day, tasks, onClose }: { day: string | null; tasks: Task[]; onClose: () => void }) {
  const navigating = useRef(false);
  return <Dialog open={!!day} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="calendar-agenda-dialog" onCloseAutoFocus={event => { if (navigating.current) { event.preventDefault(); navigating.current = false; } }}>
      <DialogTitle>{day ? new Date(day + 'T12:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }) : '当日任务'}</DialogTitle>
      <DialogDescription>{tasks.length ? tasks.length + ' 项任务，点击卡片查看详情。' : '这一天还没有安排。'}</DialogDescription>
      {tasks.length ? <VirtualCardList key={day} tasks={tasks} label="当日全部任务" renderTask={task => <TaskCard task={task} onOpen={() => { navigating.current = true; onClose(); useUIStore.getState().selectTask(task.id); }} />} />
        : <div className="calendar-agenda-empty">为重要的事留一点时间。</div>}
      <button type="button" className="calendar-agenda-add" onClick={() => { if (day) { navigating.current = true; onClose(); useUIStore.getState().openQuickAddForDate(day); } }}><Plus size={16} />添加到这一天</button>
    </DialogContent>
  </Dialog>;
}
