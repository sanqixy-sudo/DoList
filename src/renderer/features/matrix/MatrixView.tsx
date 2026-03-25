import React, { useMemo, useState } from 'react';
import { ArrowRight, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/features/tasks/store';
import { useUIStore } from '@/features/settings/uiStore';
import { TaskContextMenu } from '@/features/tasks/components';
import { formatMatrixTaskMeta, getMatrixQuadrantUpdates, matrixQuadrants } from './matrix-utils';

export function MatrixView() {
  const { tasks, updateTask } = useTaskStore();
  const { selectTask, setCurrentView } = useUIStore();
  const [pickerQuadrantId, setPickerQuadrantId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [applyingTaskId, setApplyingTaskId] = useState<string | null>(null);

  const activeTasks = useMemo(() => tasks.filter((task) => task.status === 'todo'), [tasks]);

  const tasksByQuadrant = useMemo(() => {
    const map = new Map<string, typeof activeTasks>();
    matrixQuadrants.forEach((quadrant) => {
      map.set(quadrant.id, activeTasks.filter(quadrant.filter));
    });
    return map;
  }, [activeTasks]);

  const openPicker = (quadrantId: string) => {
    setPickerQuadrantId(quadrantId);
    setSearchQuery('');
  };

  const closePicker = () => {
    setPickerQuadrantId(null);
    setSearchQuery('');
    setApplyingTaskId(null);
  };

  const getCandidateTasks = (quadrantId: string) => {
    const quadrant = matrixQuadrants.find((item) => item.id === quadrantId);
    const keyword = searchQuery.trim().toLowerCase();

    if (!quadrant) return [];

    return activeTasks
      .filter((task) => !quadrant.filter(task))
      .filter((task) => {
        if (!keyword) return true;
        return (
          task.title.toLowerCase().includes(keyword) ||
          (task.notes || '').toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => {
        const aHasKeyword = keyword && a.title.toLowerCase().includes(keyword) ? 1 : 0;
        const bHasKeyword = keyword && b.title.toLowerCase().includes(keyword) ? 1 : 0;
        return bHasKeyword - aHasKeyword || a.sortOrder - b.sortOrder;
      });
  };

  const applyTaskToQuadrant = async (taskId: string, quadrantId: string) => {
    if (applyingTaskId) return;

    setApplyingTaskId(taskId);
    try {
      await updateTask(taskId, getMatrixQuadrantUpdates(quadrantId as never));
      closePicker();
    } catch (error) {
      console.error('Failed to move task into matrix quadrant:', error);
      setApplyingTaskId(null);
    }
  };

  const handleDragStart = (event: React.DragEvent, taskId: string) => {
    event.dataTransfer.setData('taskId', taskId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (event: React.DragEvent, quadrantId: string) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('taskId');
    if (!taskId) return;

    await updateTask(taskId, getMatrixQuadrantUpdates(quadrantId as never));
  };

  const hasAnyTodo = activeTasks.length > 0;

  return (
    <div className="flex h-full w-full flex-1 flex-col p-4">
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        {matrixQuadrants.map((quadrant) => {
          const quadrantTasks = tasksByQuadrant.get(quadrant.id) || [];
          const candidateTasks = getCandidateTasks(quadrant.id);
          const isPickerOpen = pickerQuadrantId === quadrant.id;
          const Icon = quadrant.icon;

          return (
            <div
              key={quadrant.id}
              className={cn('flex flex-col overflow-hidden rounded-lg border', quadrant.bgColor)}
              onDragOver={handleDragOver}
              onDrop={(event) => void handleDrop(event, quadrant.id)}
            >
              <div className="flex items-center gap-2 border-b bg-background/60 p-3 backdrop-blur-sm">
                <Icon className={cn('h-5 w-5', quadrant.color)} />
                <div>
                  <h3 className={cn('font-semibold', quadrant.color)}>{quadrant.title}</h3>
                  <p className="text-xs text-muted-foreground">{quadrant.subtitle}</p>
                </div>
                <span className="ml-auto text-sm text-muted-foreground">{quadrantTasks.length}</span>
                <Button
                  type="button"
                  size="sm"
                  variant={isPickerOpen ? 'secondary' : 'outline'}
                  className="h-8 gap-1.5"
                  onClick={() => (isPickerOpen ? closePicker() : openPicker(quadrant.id))}
                >
                  {isPickerOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {isPickerOpen ? '收起' : '添加待办'}
                </Button>
              </div>

              {isPickerOpen && (
                <div className="border-b bg-background/80 p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="搜索已有待办"
                      className="pl-9"
                    />
                  </div>

                  <div className="mt-3 max-h-52 overflow-y-auto rounded-md border bg-background">
                    {candidateTasks.length > 0 ? (
                      candidateTasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          className="flex w-full items-center gap-3 border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-accent/50"
                          onClick={() => void applyTaskToQuadrant(task.id, quadrant.id)}
                          disabled={applyingTaskId === task.id}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{task.title}</div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {formatMatrixTaskMeta(task) || '未设置优先级和日期'}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      ))
                    ) : hasAnyTodo ? (
                      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                        没有可添加到这个象限的待办了
                      </div>
                    ) : (
                      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                        当前没有待办任务
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    选择一个已有待办后，会自动按该象限规则更新优先级和截止日期。
                  </p>
                </div>
              )}

              <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                  {quadrantTasks.map((task) => (
                    <TaskContextMenu key={task.id} task={task}>
                      <div
                        draggable
                        onDragStart={(event) => handleDragStart(event, task.id)}
                        onClick={() => selectTask(task.id)}
                        className={cn(
                          'cursor-pointer rounded-md border bg-background p-3 shadow-sm transition-all',
                          'hover:-translate-y-0.5 hover:shadow-md'
                        )}
                      >
                        <h4 className="truncate text-sm font-medium">{task.title}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatMatrixTaskMeta(task) || '未设置优先级和日期'}
                        </p>
                      </div>
                    </TaskContextMenu>
                  ))}

                  {quadrantTasks.length === 0 && (
                    <div
                      className={cn(
                        'flex min-h-[160px] flex-col items-center justify-center rounded-md border border-dashed',
                        'bg-background/50 px-4 text-center'
                      )}
                    >
                      {hasAnyTodo ? (
                        <>
                          <span className="text-sm text-muted-foreground">这个象限还没有待办</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3 gap-1.5"
                            onClick={() => openPicker(quadrant.id)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            从已有待办添加
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-muted-foreground">还没有任何待办任务</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => setCurrentView('inbox')}
                          >
                            去收件箱创建待办
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
