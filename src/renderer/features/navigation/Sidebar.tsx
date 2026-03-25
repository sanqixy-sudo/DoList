import { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Columns,
  FolderOpen,
  FolderTree,
  GanttChart,
  Grid3X3,
  Inbox,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sun,
  Timer,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/features/settings/uiStore';
import { useListStore } from './listStore';

interface SidebarProps {
  className?: string;
}

const UNGROUPED_ID = '__ungrouped__';

export function Sidebar({ className }: SidebarProps) {
  const {
    currentView,
    setCurrentView,
    isSidebarOpen,
    toggleSearch,
    togglePomodoro,
    toggleSettings,
  } = useUIStore();
  const {
    lists,
    projectGroups,
    activeListId,
    activeProjectGroupId,
    setActiveList,
    setActiveProjectGroup,
    createList,
    deleteList,
    createProjectGroup,
    deleteProjectGroup,
  } = useListStore();

  const [isProjectGroupsExpanded, setIsProjectGroupsExpanded] = useState(true);
  const [isViewsExpanded, setIsViewsExpanded] = useState(true);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingProjectForGroupId, setCreatingProjectForGroupId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'default-group': true,
    [UNGROUPED_ID]: true,
  });

  const projectGroupsWithProjects = useMemo(() => {
    const nonInboxLists = lists.filter((list) => list.id !== 'inbox');
    const grouped = projectGroups.map((group) => ({
      id: group.id,
      name: group.name,
      color: group.color,
      isBuiltIn: group.id === 'default-group',
      projects: nonInboxLists.filter((list) => list.groupId === group.id),
    }));

    const ungroupedProjects = nonInboxLists.filter((list) => !list.groupId);
    if (ungroupedProjects.length > 0) {
      grouped.push({
        id: UNGROUPED_ID,
        name: '未分组',
        color: '#64748b',
        isBuiltIn: true,
        projects: ungroupedProjects,
      });
    }

    return grouped;
  }, [lists, projectGroups]);

  const smartLists = [
    { id: 'inbox', icon: Inbox, label: '收件箱', view: 'inbox' as const },
    { id: 'today', icon: Sun, label: '今天', view: 'today' as const },
    { id: 'upcoming', icon: CalendarDays, label: '即将到来', view: 'upcoming' as const },
    { id: 'calendar', icon: Calendar, label: '日历', view: 'calendar' as const },
  ];

  const viewModes = [
    { id: 'kanban', icon: Columns, label: '看板', view: 'kanban' as const },
    { id: 'timeline', icon: GanttChart, label: '时间线', view: 'timeline' as const },
    { id: 'matrix', icon: Grid3X3, label: '四象限', view: 'matrix' as const },
    { id: 'project-report', icon: BarChart3, label: '项目报告', view: 'project-report' as const },
  ];

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setIsCreatingGroup(false);
      setNewGroupName('');
      return;
    }

    const created = await createProjectGroup({ name: newGroupName.trim() });
    setExpandedGroups((state) => ({ ...state, [created.id]: true }));
    setNewGroupName('');
    setIsCreatingGroup(false);
  };

  const handleCreateProject = async () => {
    const targetGroupId =
      creatingProjectForGroupId && creatingProjectForGroupId !== UNGROUPED_ID
        ? creatingProjectForGroupId
        : null;

    if (!newProjectName.trim()) {
      setCreatingProjectForGroupId(null);
      setNewProjectName('');
      return;
    }

    const created = await createList({
      name: newProjectName.trim(),
      groupId: targetGroupId ?? activeProjectGroupId ?? 'default-group',
    });

    setActiveList(created.id);
    setCurrentView('list');
    setCreatingProjectForGroupId(null);
    setNewProjectName('');
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((state) => ({
      ...state,
      [groupId]: state[groupId] === undefined ? false : !state[groupId],
    }));
  };

  if (!isSidebarOpen) return null;

  return (
    <div className={cn('flex h-full w-72 flex-col border-r bg-background/95 backdrop-blur', className)}>
      <div className="drag-region p-4">
        <h1 className="no-drag text-xl font-bold">DoList</h1>
      </div>

      <div className="px-3 pb-2">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={toggleSearch}>
          <Search className="mr-2 h-4 w-4" />
          搜索
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-2">
          <div className="space-y-1">
            {smartLists.map((item) => (
              <Button
                key={item.id}
                variant={currentView === item.view ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => {
                  setCurrentView(item.view);
                  setActiveList(item.id === 'inbox' ? 'inbox' : null);
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </div>

          <Separator className="my-4" />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setIsProjectGroupsExpanded((open) => !open)}
              >
                {isProjectGroupsExpanded ? (
                  <ChevronDown className="mr-1 h-4 w-4" />
                ) : (
                  <ChevronRight className="mr-1 h-4 w-4" />
                )}
                <span className="text-sm font-medium">项目组</span>
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsCreatingGroup(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {isProjectGroupsExpanded && (
              <div className="ml-1 space-y-2">
                {projectGroupsWithProjects.map((group) => {
                  const isExpanded = expandedGroups[group.id] ?? true;
                  const isActiveGroup = currentView === 'project-report' && activeProjectGroupId === group.id;

                  return (
                    <div key={group.id} className="rounded-xl border border-transparent bg-muted/20 p-1">
                      <div className="group flex items-center gap-1">
                        <Button
                          variant={isActiveGroup ? 'secondary' : 'ghost'}
                          className="h-8 flex-1 justify-start px-2"
                          onClick={() => {
                            setActiveProjectGroup(group.id === UNGROUPED_ID ? null : group.id);
                            setCurrentView('project-report');
                          }}
                        >
                          <span
                            className="mr-2 h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: group.color || '#64748b' }}
                          />
                          <FolderTree className="mr-2 h-4 w-4" />
                          <span className="truncate">{group.name}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => toggleGroupExpanded(group.id)}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => {
                            setExpandedGroups((state) => ({ ...state, [group.id]: true }));
                            setCreatingProjectForGroupId(group.id);
                            setNewProjectName('');
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>

                        {!group.isBuiltIn && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => void deleteProjectGroup(group.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除项目组
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="ml-4 mt-1 space-y-1 border-l border-border/60 pl-3">
                          {group.projects.map((project) => (
                            <div key={project.id} className="group/project flex items-center gap-1">
                              <Button
                                variant={activeListId === project.id && currentView === 'list' ? 'secondary' : 'ghost'}
                                className="h-8 flex-1 justify-start px-2"
                                onClick={() => {
                                  setActiveProjectGroup(project.groupId);
                                  setActiveList(project.id);
                                  setCurrentView('list');
                                }}
                              >
                                <FolderOpen className="mr-2 h-4 w-4" style={{ color: project.color || undefined }} />
                                <span className="truncate">{project.name}</span>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 transition-opacity group-hover/project:opacity-100"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => void deleteList(project.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    删除项目
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}

                          {creatingProjectForGroupId === group.id && (
                            <div className="flex items-center gap-2 py-1">
                              <FolderOpen className="h-4 w-4 text-muted-foreground" />
                              <Input
                                value={newProjectName}
                                onChange={(event) => setNewProjectName(event.target.value)}
                                onBlur={() => void handleCreateProject()}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') void handleCreateProject();
                                  if (event.key === 'Escape') {
                                    setCreatingProjectForGroupId(null);
                                    setNewProjectName('');
                                  }
                                }}
                                placeholder="项目名称"
                                className="h-8"
                                autoFocus
                              />
                            </div>
                          )}

                          {group.projects.length === 0 && creatingProjectForGroupId !== group.id && (
                            <button
                              type="button"
                              className="h-8 w-full rounded-md px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                              onClick={() => {
                                setCreatingProjectForGroupId(group.id);
                                setNewProjectName('');
                              }}
                            >
                              + 在这个项目组里创建项目
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {isCreatingGroup && (
                  <div className="flex items-center gap-2 rounded-lg border bg-card px-2 py-2">
                    <FolderTree className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={newGroupName}
                      onChange={(event) => setNewGroupName(event.target.value)}
                      onBlur={() => void handleCreateGroup()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void handleCreateGroup();
                        if (event.key === 'Escape') {
                          setIsCreatingGroup(false);
                          setNewGroupName('');
                        }
                      }}
                      placeholder="项目组名称"
                      className="h-8"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setIsViewsExpanded((open) => !open)}
              >
                {isViewsExpanded ? (
                  <ChevronDown className="mr-1 h-4 w-4" />
                ) : (
                  <ChevronRight className="mr-1 h-4 w-4" />
                )}
                <span className="text-sm font-medium">视图</span>
              </Button>
            </div>

            {isViewsExpanded && (
              <div className="ml-2 space-y-1">
                {viewModes.map((item) => (
                  <Button
                    key={item.id}
                    variant={currentView === item.view ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setCurrentView(item.view)}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="space-y-1 border-t p-3">
        <Button variant="ghost" className="w-full justify-start" onClick={togglePomodoro}>
          <Timer className="mr-2 h-4 w-4" />
          番茄钟
        </Button>
        <Button variant="ghost" className="w-full justify-start" onClick={toggleSettings}>
          <Settings className="mr-2 h-4 w-4" />
          设置
        </Button>
      </div>
    </div>
  );
}
