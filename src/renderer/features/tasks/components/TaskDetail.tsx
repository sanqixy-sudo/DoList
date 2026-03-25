import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  ExternalLink,
  Flag,
  FolderOpen,
  ImageIcon,
  Paperclip,
  Plus,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { addDays, format, isToday, isTomorrow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useListStore } from '@/features/navigation/listStore';
import { useUIStore } from '@/features/settings/uiStore';
import { TimePicker, type TimeValue } from '@/components/ui/time-picker';
import { useTaskStore } from '../store';
import { formatFileSize, isImageMimeType } from '@/features/tasks/attachment-utils';
import { AttachmentPreviewImage } from './AttachmentPreviewImage';
import type { Task, Priority } from '../../../../../types/models';

const UNGROUPED_ID = '__ungrouped__';
const DEFAULT_REMINDER_TIME: TimeValue = { hour: 9, minute: 0 };

type TaskDetailMode = 'inline' | 'drawer' | 'modal';

interface TaskDetailProps {
  mode?: TaskDetailMode;
}

export function TaskDetail({ mode = 'inline' }: TaskDetailProps) {
  const { tasks, updateTask, deleteTask, setTask } = useTaskStore();
  const { lists, projectGroups } = useListStore();
  const { activeTaskId, closeDetailPanel, isDetailPanelOpen } = useUIStore();

  const storeTask = useMemo(
    () => tasks.find((item) => item.id === activeTaskId) ?? null,
    [activeTaskId, tasks]
  );
  const [fallbackTask, setFallbackTask] = useState<Task | null>(null);
  const task = fallbackTask ?? storeTask;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [reminderDate, setReminderDate] = useState<Date | undefined>(undefined);
  const [reminderTime, setReminderTime] = useState<TimeValue | null>(DEFAULT_REMINDER_TIME);
  const [isReminderDatePopoverOpen, setIsReminderDatePopoverOpen] = useState(false);

  const groupedProjects = useMemo(() => {
    const projectLists = lists.filter((list) => list.id !== 'inbox');
    const groups = projectGroups.map((group) => ({
      id: group.id,
      name: group.name,
      projects: projectLists.filter((list) => list.groupId === group.id),
    }));
    const ungrouped = projectLists.filter((list) => !list.groupId);
    if (ungrouped.length > 0) {
      groups.push({
        id: UNGROUPED_ID,
        name: '未分组',
        projects: ungrouped,
      });
    }
    return groups;
  }, [lists, projectGroups]);

  useEffect(() => {
    let cancelled = false;

    if (!activeTaskId || !isDetailPanelOpen) {
      setFallbackTask(null);
      return;
    }

    if (storeTask) {
      setFallbackTask(storeTask);
      return;
    }

    window.electronAPI.tasks
      .get(activeTaskId)
      .then((result) => {
        if (!cancelled) {
          setFallbackTask(result);
        }
      })
      .catch((error) => {
        console.error('Failed to load task detail:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTaskId, isDetailPanelOpen, storeTask]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes || '');
      setReminderDate(undefined);
      setReminderTime(DEFAULT_REMINDER_TIME);
      setIsReminderDatePopoverOpen(false);
    }
  }, [task]);

  if (!task || !isDetailPanelOpen) return null;

  const currentList = lists.find((list) => list.id === task.listId) ?? null;

  const updateCurrentTask = async (data: Parameters<typeof updateTask>[1]) => {
    const updated = await updateTask(task.id, data);
    setFallbackTask(updated);
    return updated;
  };

  const refreshTask = async () => {
    const updated = await window.electronAPI.tasks.get(task.id);
    if (updated) {
      setFallbackTask(updated);
      setTask(updated);
    }
  };

  const handleTitleBlur = () => {
    if (title !== task.title && title.trim()) {
      void updateCurrentTask({ title: title.trim() });
    }
  };

  const handleNotesBlur = () => {
    if (notes !== (task.notes || '')) {
      void updateCurrentTask({ notes: notes || null });
    }
  };

  const handlePickAttachments = async () => {
    try {
      const picked = await window.electronAPI.tasks.pickAttachments();
      for (const attachment of picked) {
        await window.electronAPI.tasks.addAttachment(task.id, attachment);
      }
      await refreshTask();
    } catch (error) {
      console.error('Failed to add attachments:', error);
    }
  };

  const handlePasteAttachment = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const hasImage = Array.from(event.clipboardData.items).some((item) => item.type.startsWith('image/'));
    if (!hasImage) return;

    event.preventDefault();

    try {
      const attachment = await window.electronAPI.tasks.pasteClipboardImage();
      if (!attachment) return;

      await window.electronAPI.tasks.addAttachment(task.id, attachment);
      await refreshTask();
    } catch (error) {
      console.error('Failed to paste clipboard image:', error);
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    try {
      await window.electronAPI.tasks.removeAttachment(attachmentId);
      await refreshTask();
    } catch (error) {
      console.error('Failed to remove attachment:', error);
    }
  };

  const handleOpenAttachment = async (filePath: string) => {
    try {
      await window.electronAPI.tasks.openAttachment(filePath);
    } catch (error) {
      console.error('Failed to open attachment:', error);
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;

    try {
      await window.electronAPI.subtasks.create({
        taskId: task.id,
        title: newSubtask.trim(),
      });
      setNewSubtask('');
      await refreshTask();
    } catch (error) {
      console.error('Failed to add subtask:', error);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    try {
      await window.electronAPI.subtasks.toggle(subtaskId);
      await refreshTask();
    } catch (error) {
      console.error('Failed to toggle subtask:', error);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      await window.electronAPI.subtasks.delete(subtaskId);
      await refreshTask();
    } catch (error) {
      console.error('Failed to delete subtask:', error);
    }
  };

  const handleAddReminder = async () => {
    if (!reminderDate) return;

    const remindAt = new Date(reminderDate);
    const nextReminderTime = reminderTime ?? DEFAULT_REMINDER_TIME;
    remindAt.setHours(nextReminderTime.hour, nextReminderTime.minute, 0, 0);

    try {
      await window.electronAPI.reminders.create({
        taskId: task.id,
        remindAt: remindAt.toISOString(),
      });
      setReminderDate(undefined);
      setReminderTime(DEFAULT_REMINDER_TIME);
      await refreshTask();
    } catch (error) {
      console.error('Failed to add reminder:', error);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await window.electronAPI.reminders.delete(reminderId);
      await refreshTask();
    } catch (error) {
      console.error('Failed to delete reminder:', error);
    }
  };

  const handleDelete = async () => {
    await deleteTask(task.id);
    closeDetailPanel();
  };

  const priorityLabels: Record<Priority, string> = {
    0: '无优先级',
    1: '低优先级',
    2: '中优先级',
    3: '高优先级',
  };

  const priorityColors: Record<Priority, string> = {
    0: 'text-muted-foreground',
    1: 'text-priority-low',
    2: 'text-priority-medium',
    3: 'text-priority-high',
  };

  return (
    <AnimatePresence>
      <>
        {mode !== 'inline' && (
          <motion.button
            type="button"
            aria-label="关闭任务详情"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-20 bg-black/12 backdrop-blur-[1px]"
            onClick={closeDetailPanel}
          />
        )}

        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onPasteCapture={(event) => void handlePasteAttachment(event)}
          className={cn(
            'flex flex-col bg-background',
            mode === 'inline' && 'h-full w-[380px] border-l',
            mode === 'drawer' && 'absolute inset-y-0 right-0 z-30 h-full w-[380px] border-l shadow-2xl',
            mode === 'modal' &&
              'fixed inset-x-4 bottom-4 top-16 z-30 h-auto w-auto rounded-2xl border shadow-2xl sm:left-auto sm:right-6 sm:top-20 sm:w-[min(720px,calc(100vw-3rem))]'
          )}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-medium">任务详情</h3>
            <Button variant="ghost" size="icon" onClick={closeDetailPanel}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              <div>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={handleTitleBlur}
                  className="h-auto border-0 p-0 text-lg font-medium focus-visible:ring-0"
                  placeholder="任务标题"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <FolderOpen className="mr-1 h-4 w-4" />
                      {currentList?.id === 'inbox' ? '收件箱' : currentList?.name || '选择项目'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuItem onClick={() => void updateCurrentTask({ listId: 'inbox' })}>
                      <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                      收件箱
                    </DropdownMenuItem>
                    {groupedProjects.map((group) => (
                      <DropdownMenuSub key={group.id}>
                        <DropdownMenuSubTrigger>{group.name}</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-56">
                          {group.projects.map((project) => (
                            <DropdownMenuItem
                              key={project.id}
                              onClick={() => void updateCurrentTask({ listId: project.id })}
                            >
                              <span
                                className="mr-2 h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: project.color || '#64748b' }}
                              />
                              {project.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn('h-8', task.dueDate && 'border-primary text-primary')}
                    >
                      <CalendarIcon className="mr-1 h-4 w-4" />
                      {task.dueDate
                        ? format(new Date(task.dueDate), 'M月d日', { locale: zhCN })
                        : '设置日期'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start">
                    <div className="mb-3 flex gap-2">
                      <Button
                        type="button"
                        variant={task.dueDate && isToday(new Date(task.dueDate)) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const date = new Date();
                          date.setHours(23, 59, 59, 999);
                          void updateCurrentTask({ dueDate: date.toISOString() });
                        }}
                      >
                        今天
                      </Button>
                      <Button
                        type="button"
                        variant={task.dueDate && isTomorrow(new Date(task.dueDate)) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const date = addDays(new Date(), 1);
                          date.setHours(23, 59, 59, 999);
                          void updateCurrentTask({ dueDate: date.toISOString() });
                        }}
                      >
                        明天
                      </Button>
                    </div>

                    <Calendar
                      mode="single"
                      selected={task.dueDate ? new Date(task.dueDate) : undefined}
                      onSelect={(date) => {
                        if (!date) {
                          void updateCurrentTask({ dueDate: null });
                          return;
                        }
                        const value = new Date(date);
                        value.setHours(23, 59, 59, 999);
                        void updateCurrentTask({ dueDate: value.toISOString() });
                      }}
                      initialFocus
                    />

                    {task.dueDate && (
                      <>
                        <Separator className="my-3" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full text-destructive hover:text-destructive"
                          onClick={() => void updateCurrentTask({ dueDate: null })}
                        >
                          <X className="mr-1 h-4 w-4" />
                          清除日期
                        </Button>
                      </>
                    )}
                  </PopoverContent>
                </Popover>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('h-8', priorityColors[task.priority])}>
                      <Flag className="mr-1 h-4 w-4" />
                      {priorityLabels[task.priority]}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => void updateCurrentTask({ priority: 3 })}>
                      <Flag className="mr-2 h-4 w-4 text-priority-high" />
                      高优先级
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void updateCurrentTask({ priority: 2 })}>
                      <Flag className="mr-2 h-4 w-4 text-priority-medium" />
                      中优先级
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void updateCurrentTask({ priority: 1 })}>
                      <Flag className="mr-2 h-4 w-4 text-priority-low" />
                      低优先级
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void updateCurrentTask({ priority: 0 })}>
                      <Flag className="mr-2 h-4 w-4 text-muted-foreground" />
                      无优先级
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Separator />

              <div>
                <label className="mb-2 block text-sm font-medium text-muted-foreground">备注</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  onBlur={handleNotesBlur}
                  placeholder="添加备注..."
                  className="min-h-[100px] w-full resize-none rounded-md border bg-transparent p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <Separator />

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-muted-foreground">提醒</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => void handleAddReminder()}
                    disabled={!reminderDate}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    添加提醒
                  </Button>
                </div>

                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex flex-wrap gap-2">
                    <Popover open={isReminderDatePopoverOpen} onOpenChange={setIsReminderDatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn('h-8', reminderDate && 'border-primary text-primary')}
                        >
                          <CalendarIcon className="mr-1 h-4 w-4" />
                          {reminderDate
                            ? format(reminderDate, 'M月d日', { locale: zhCN })
                            : '选择提醒日期'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" align="start">
                        <div className="mb-3 flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReminderDate(new Date());
                              setIsReminderDatePopoverOpen(false);
                            }}
                          >
                            今天
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReminderDate(addDays(new Date(), 1));
                              setIsReminderDatePopoverOpen(false);
                            }}
                          >
                            明天
                          </Button>
                        </div>

                        <Calendar
                          mode="single"
                          selected={reminderDate}
                          onSelect={(date) => {
                            setReminderDate(date ?? undefined);
                            if (date) {
                              setIsReminderDatePopoverOpen(false);
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    {reminderDate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground"
                        onClick={() => {
                          setReminderDate(undefined);
                          setReminderTime(DEFAULT_REMINDER_TIME);
                        }}
                      >
                        清除
                      </Button>
                    )}
                  </div>

                  <TimePicker value={reminderTime} onChange={setReminderTime} className="mt-3" />
                </div>

                {task.reminders && task.reminders.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {task.reminders.map((reminder) => (
                      <div
                        key={reminder.id}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {format(new Date(reminder.remindAt), 'M月d日 HH:mm', { locale: zhCN })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {reminder.isSent ? '已发送' : '待提醒'}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => void handleDeleteReminder(reminder.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
                    还没有提醒
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-muted-foreground">附件</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => void handlePickAttachments()}
                  >
                    <Paperclip className="mr-2 h-4 w-4" />
                    添加附件
                  </Button>
                </div>
                <div className="mb-3 text-[11px] text-muted-foreground">Support file picker and Ctrl+V image paste.</div>

                {task.attachments && task.attachments.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {task.attachments.map((attachment) => (
                      <div key={attachment.id} className="overflow-hidden rounded-xl border bg-card">
                        {isImageMimeType(attachment.mimeType) ? (
                          <div className="bg-muted/30 p-2">
                            <AttachmentPreviewImage
                              filePath={attachment.filePath}
                              alt={attachment.name}
                              className="h-36 w-full rounded-lg object-cover"
                              fallbackClassName="h-36 w-full rounded-lg"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="flex h-36 w-full items-center justify-center bg-muted/30"
                            onClick={() => void handleOpenAttachment(attachment.filePath)}
                          >
                            <ImageIcon className="h-10 w-10 text-muted-foreground" />
                          </button>
                        )}
                        <div className="p-3">
                          <div className="truncate text-sm font-medium">{attachment.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatFileSize(attachment.fileSize)}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 flex-1"
                              onClick={() => void handleOpenAttachment(attachment.filePath)}
                            >
                              <ExternalLink className="mr-2 h-3.5 w-3.5" />
                              打开
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => void handleRemoveAttachment(attachment.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                    还没有附件，可以添加图片或文件。
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <label className="mb-2 block text-sm font-medium text-muted-foreground">子任务</label>

                <div className="space-y-2">
                  {task.subtasks?.map((subtask) => (
                    <div key={subtask.id} className="group flex items-center gap-2">
                      <Checkbox checked={subtask.isDone} onCheckedChange={() => handleToggleSubtask(subtask.id)} />
                      <span className={cn('flex-1 text-sm', subtask.isDone && 'text-muted-foreground line-through')}>
                        {subtask.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => handleDeleteSubtask(subtask.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={newSubtask}
                      onChange={(event) => setNewSubtask(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleAddSubtask();
                        }
                      }}
                      placeholder="添加子任务..."
                      className="h-8 border-0 p-0 focus-visible:ring-0"
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="border-t p-4">
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除任务
            </Button>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}
