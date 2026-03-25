import {
  CheckCircle,
  Circle,
  Edit,
  Flag,
  FolderKanban,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { matrixQuadrants, getMatrixQuadrantUpdates, getTaskQuadrantId } from '@/features/matrix/matrix-utils';
import { useUIStore } from '@/features/settings/uiStore';
import { useTaskStore } from '../store';
import type { Priority, Task, TaskStatus } from '../../../../../types/models';

interface TaskContextMenuProps {
  task: Task;
  children: React.ReactNode;
}

export function TaskContextMenu({ task, children }: TaskContextMenuProps) {
  const { updateTask, deleteTask } = useTaskStore();
  const { selectTask } = useUIStore();
  const currentQuadrantId = getTaskQuadrantId(task);

  const handleEdit = () => {
    selectTask(task.id);
  };

  const handleDelete = () => {
    void deleteTask(task.id);
  };

  const handleStatusChange = (status: TaskStatus) => {
    void updateTask(task.id, { status });
  };

  const handlePriorityChange = (priority: Priority) => {
    void updateTask(task.id, { priority });
  };

  const handleMoveToQuadrant = (quadrantId: (typeof matrixQuadrants)[number]['id']) => {
    void updateTask(task.id, getMatrixQuadrantUpdates(quadrantId));
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleEdit}>
          <Edit className="mr-2 h-4 w-4" />
          编辑
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderKanban className="mr-2 h-4 w-4" />
            移动到四象限
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-52">
            {matrixQuadrants.map((quadrant) => {
              const Icon = quadrant.icon;
              const isCurrent = currentQuadrantId === quadrant.id;

              return (
                <ContextMenuItem key={quadrant.id} onClick={() => handleMoveToQuadrant(quadrant.id)}>
                  <Icon className={`mr-2 h-4 w-4 ${quadrant.color}`} />
                  {quadrant.title}
                  {isCurrent && <span className="ml-auto text-xs text-muted-foreground">当前</span>}
                </ContextMenuItem>
              );
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Flag className="mr-2 h-4 w-4" />
            优先级
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-40">
            <ContextMenuItem onClick={() => handlePriorityChange(3)}>
              <Flag className="mr-2 h-4 w-4 text-red-500" />
              高优先级
              {task.priority === 3 && <span className="ml-auto">✓</span>}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handlePriorityChange(2)}>
              <Flag className="mr-2 h-4 w-4 text-yellow-500" />
              中优先级
              {task.priority === 2 && <span className="ml-auto">✓</span>}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handlePriorityChange(1)}>
              <Flag className="mr-2 h-4 w-4 text-blue-500" />
              低优先级
              {task.priority === 1 && <span className="ml-auto">✓</span>}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => handlePriorityChange(0)}>
              <Flag className="mr-2 h-4 w-4 text-muted-foreground" />
              无优先级
              {task.priority === 0 && <span className="ml-auto">✓</span>}
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Circle className="mr-2 h-4 w-4" />
            状态
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-40">
            <ContextMenuItem onClick={() => handleStatusChange('todo')}>
              <Circle className="mr-2 h-4 w-4" />
              待办
              {task.status === 'todo' && <span className="ml-auto">✓</span>}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleStatusChange('done')}>
              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
              已完成
              {task.status === 'done' && <span className="ml-auto">✓</span>}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleStatusChange('canceled')}>
              <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
              已取消
              {task.status === 'canceled' && <span className="ml-auto">✓</span>}
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
