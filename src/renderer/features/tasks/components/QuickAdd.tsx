import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  FileImage,
  Flag,
  FolderOpen,
  Paperclip,
  Plus,
  X,
} from 'lucide-react';
import { addDays, format, isToday, isTomorrow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useListStore } from '@/features/navigation/listStore';
import { useUIStore } from '@/features/settings/uiStore';
import { TagSelector } from '@/features/tags';
import { TimePicker, type TimeValue } from '@/components/ui/time-picker';
import { formatFileSize, isImageMimeType } from '@/features/tasks/attachment-utils';
import { AttachmentPreviewImage } from './AttachmentPreviewImage';
import { useTaskStore } from '../store';
import type { CreateTaskAttachmentDto, List, Priority } from '../../../../../types/models';

interface QuickAddProps {
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const UNGROUPED_ID = '__ungrouped__';

export function QuickAdd({ className, isOpen, onOpenChange }: QuickAddProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>(0);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [dueTime, setDueTime] = useState<TimeValue | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<CreateTaskAttachmentDto[]>([]);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [isProjectPopoverOpen, setIsProjectPopoverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { createTask } = useTaskStore();
  const { lists, projectGroups, activeListId, activeProjectGroupId } = useListStore();
  const { currentView } = useUIStore();

  const isControlled = isOpen !== undefined;
  const expanded = isControlled ? isOpen : uncontrolledOpen;

  const projectLists = useMemo(() => lists.filter((list) => list.id !== 'inbox'), [lists]);

  const defaultListId = useMemo(() => {
    if (currentView === 'list' && activeListId) return activeListId;
    if (activeListId && activeListId !== 'inbox') return activeListId;

    if (activeProjectGroupId && activeProjectGroupId !== '__all_groups__') {
      const firstProject = projectLists.find((list) => list.groupId === activeProjectGroupId);
      if (firstProject) return firstProject.id;
    }

    return 'inbox';
  }, [activeListId, activeProjectGroupId, currentView, projectLists]);

  const [selectedListId, setSelectedListId] = useState(defaultListId);

  useEffect(() => {
    setSelectedListId(defaultListId);
  }, [defaultListId]);

  const groupedProjects = useMemo(() => {
    const groups = projectGroups.map((group) => ({
      id: group.id,
      name: group.name,
      color: group.color,
      projects: projectLists.filter((list) => list.groupId === group.id),
    }));

    const ungroupedProjects = projectLists.filter((list) => !list.groupId);
    if (ungroupedProjects.length > 0) {
      groups.push({
        id: UNGROUPED_ID,
        name: '未分组',
        color: '#64748b',
        projects: ungroupedProjects,
      });
    }

    return groups;
  }, [projectGroups, projectLists]);

  const selectedList = useMemo<List | null>(
    () => lists.find((list) => list.id === selectedListId) ?? null,
    [lists, selectedListId]
  );

  const setExpanded = (open: boolean) => {
    onOpenChange?.(open);
    if (!isControlled) {
      setUncontrolledOpen(open);
    }
  };

  const resetForm = () => {
    setTitle('');
    setPriority(0);
    setDueDate(undefined);
    setDueTime(null);
    setSelectedTags([]);
    setAttachments([]);
    setIsDatePopoverOpen(false);
    setIsProjectPopoverOpen(false);
    setSelectedListId(defaultListId);
  };

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  const combinedDueDate = useMemo(() => {
    if (!dueDate) return undefined;

    const date = new Date(dueDate);
    if (dueTime) {
      date.setHours(dueTime.hour, dueTime.minute, 0, 0);
    } else {
      date.setHours(23, 59, 59, 999);
    }
    return date.toISOString();
  }, [dueDate, dueTime]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    try {
      await createTask({
        listId: selectedListId,
        title: title.trim(),
        priority,
        dueDate: combinedDueDate,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      resetForm();
      setExpanded(false);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleClose = () => {
    resetForm();
    setExpanded(false);
  };

  const handleQuickDate = (date: Date) => {
    setDueDate(date);
  };

  const handleClearDate = () => {
    setDueDate(undefined);
    setDueTime(null);
    setIsDatePopoverOpen(false);
  };

  const handlePickAttachments = async () => {
    try {
      const picked = await window.electronAPI.tasks.pickAttachments();
      if (picked.length === 0) return;

      appendAttachments(picked);
    } catch (error) {
      console.error('Failed to pick attachments:', error);
    }
  };

  const appendAttachments = (items: CreateTaskAttachmentDto[]) => {
    setAttachments((current) => {
      const merged = [...current];
      items.forEach((item) => {
        if (!merged.some((entry) => entry.sourcePath === item.sourcePath)) {
          merged.push(item);
        }
      });
      return merged;
    });
  };

  const handlePasteAttachment = async (event: React.ClipboardEvent<HTMLFormElement>) => {
    const hasImage = Array.from(event.clipboardData.items).some((item) => item.type.startsWith('image/'));
    if (!hasImage) return;

    event.preventDefault();

    try {
      const attachment = await window.electronAPI.tasks.pasteClipboardImage();
      if (attachment) {
        appendAttachments([attachment]);
      }
    } catch (error) {
      console.error('Failed to paste clipboard image:', error);
    }
  };

  const handleRemoveAttachment = (sourcePath: string) => {
    setAttachments((current) => current.filter((item) => item.sourcePath !== sourcePath));
  };

  const formatDisplayDate = () => {
    if (!dueDate) return '日期';

    let dateText = '';
    if (isToday(dueDate)) {
      dateText = '今天';
    } else if (isTomorrow(dueDate)) {
      dateText = '明天';
    } else {
      dateText = format(dueDate, 'M月d日', { locale: zhCN });
    }

    if (dueTime) {
      dateText += ` ${dueTime.hour.toString().padStart(2, '0')}:${dueTime.minute
        .toString()
        .padStart(2, '0')}`;
    }

    return dateText;
  };

  const priorityColors: Record<Priority, string> = {
    0: 'text-muted-foreground',
    1: 'text-priority-low',
    2: 'text-priority-medium',
    3: 'text-priority-high',
  };

  if (!expanded) {
    return (
      <button
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-4 py-3 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground',
          className
        )}
        onClick={() => setExpanded(true)}
      >
        <Plus className="h-5 w-5" />
        <span>添加任务</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onPasteCapture={(event) => void handlePasteAttachment(event)}
      className={cn('rounded-lg border bg-background p-3 shadow-sm', className)}
    >
      <Input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            handleClose();
          }
        }}
        placeholder="输入任务标题..."
        className="h-auto border-0 p-0 text-base focus-visible:ring-0"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Popover open={isProjectPopoverOpen} onOpenChange={setIsProjectPopoverOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8">
              <FolderOpen className="mr-1 h-4 w-4" />
              {selectedList?.id === 'inbox' ? '收件箱' : selectedList?.name || '选择项目'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <div className="rounded-md border">
              <button
                type="button"
                className={cn(
                  'flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50',
                  selectedListId === 'inbox' && 'bg-accent/60'
                )}
                onClick={() => {
                  setSelectedListId('inbox');
                  setIsProjectPopoverOpen(false);
                }}
              >
                <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                收件箱
              </button>

              {groupedProjects.map((group) => (
                <div key={group.id}>
                  <Separator />
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground">{group.name}</div>
                  {group.projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50',
                        selectedListId === project.id && 'bg-accent/60'
                      )}
                      onClick={() => {
                        setSelectedListId(project.id);
                        setIsProjectPopoverOpen(false);
                      }}
                    >
                      <span
                        className="mr-2 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: project.color || group.color || '#64748b' }}
                      />
                      {project.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className={cn('h-8', dueDate && 'text-primary')}>
              <CalendarIcon className="mr-1 h-4 w-4" />
              {formatDisplayDate()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="mb-3 flex gap-2">
              <Button
                type="button"
                variant={dueDate && isToday(dueDate) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickDate(new Date())}
              >
                今天
              </Button>
              <Button
                type="button"
                variant={dueDate && isTomorrow(dueDate) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickDate(addDays(new Date(), 1))}
              >
                明天
              </Button>
            </div>

            <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />

            {dueDate && (
              <>
                <Separator className="my-3" />
                <TimePicker value={dueTime} onChange={setDueTime} />
                <Separator className="my-3" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={handleClearDate}
                >
                  <X className="mr-1 h-4 w-4" />
                  清除日期
                </Button>
              </>
            )}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className={cn('h-8', priorityColors[priority])}>
              <Flag className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="space-y-1">
              {([3, 2, 1, 0] as Priority[]).map((value) => {
                const priorityLabel =
                  value === 3
                    ? '高优先级'
                    : value === 2
                      ? '中优先级'
                      : value === 1
                        ? '低优先级'
                        : '无优先级';

                return (
                  <Button
                    key={value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn('w-full justify-start', priorityColors[value])}
                    onClick={() => setPriority(value)}
                  >
                    <Flag className="mr-2 h-4 w-4" />
                    {priorityLabel}
                  </Button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <TagSelector selectedTagIds={selectedTags} onChange={setSelectedTags} />
        <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => void handlePickAttachments()}>
          <Paperclip className="mr-1 h-4 w-4" />
          附件
          {attachments.length > 0 && (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{attachments.length}</span>
          )}
        </Button>
      </div>

      {attachments.length > 0 && (
        <div className="mt-3 rounded-lg border bg-muted/20 p-2.5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            已添加附件
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.sourcePath}
                className="flex items-center gap-3 rounded-lg border bg-background px-2.5 py-2"
              >
                {isImageMimeType(attachment.mimeType) ? (
                  <AttachmentPreviewImage
                    filePath={attachment.sourcePath}
                    alt={attachment.name}
                    className="h-12 w-12 rounded-md object-cover"
                    fallbackClassName="h-12 w-12 rounded-md"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                    <FileImage className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{attachment.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatFileSize(attachment.fileSize ?? 0)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleRemoveAttachment(attachment.sourcePath)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 text-[11px] text-muted-foreground">Support file picker and Ctrl+V image paste.</div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {selectedList?.id === 'inbox'
            ? '任务会先进入收件箱'
            : `归属到项目：${selectedList?.name || '未选择'}`}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
            取消
          </Button>
          <Button type="submit" size="sm" disabled={!title.trim()}>
            添加
          </Button>
        </div>
      </div>
    </form>
  );
}
