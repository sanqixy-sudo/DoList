import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Sun, Inbox, CalendarDays, Folder, Plus, Search, Settings, Timer, Grid2X2, BarChart3, MoreHorizontal, Trash2 } from 'lucide-react';
import { useUIStore } from '@/features/settings/uiStore';
import { useTaskStore } from '@/features/tasks/store';
import { isTodayTask } from '@/features/tasks/task-selectors';
import { useLocalDay } from '@/features/tasks/use-workspace-tasks';
import { useListStore } from './listStore';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const open = useUIStore(s => s.isSidebarOpen);
  const view = useUIStore(s => s.currentView);
  const navigate = useUIStore(s => s.setCurrentView);
  const lists = useListStore(s => s.lists);
  const listError = useListStore(s => s.error);
  const groups = useListStore(s => s.projectGroups);
  const active = useListStore(s => s.activeListId);
  const tasks = useTaskStore(s => s.tasks);
  const today = useLocalDay();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [more, setMore] = useState(false);
  const [creating, setCreating] = useState<{ kind: 'group' | 'project'; groupId?: string } | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const counts = useMemo(() => ({ today: tasks.filter(t => isTodayTask(t, today)).length, inbox: tasks.filter(t => t.listId === 'inbox' && t.status === 'todo').length }), [tasks, today]);
  const sections = [...groups.map(g => ({ ...g, projects: lists.filter(l => l.id !== 'inbox' && l.groupId === g.id) })), { id: '__ungrouped__', name: '未分组', color: null, projects: lists.filter(l => l.id !== 'inbox' && !l.groupId) }].filter(g => g.id !== '__ungrouped__' || g.projects.length);
  const beginCreate = (kind: 'group' | 'project', groupId?: string) => { setCreating({ kind, groupId }); setName(''); setError(''); };
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); if (!creating || busy || !name.trim()) return; setBusy(true); setError('');
    try {
      if (creating.kind === 'group') { const group = await useListStore.getState().createProjectGroup({ name: name.trim() }); setExpanded(s => ({ ...s, [group.id]: true })); }
      else { const list = await useListStore.getState().createList({ name: name.trim(), groupId: creating.groupId ?? 'default-group' }); useListStore.getState().setActiveList(list.id); navigate('list'); }
      setCreating(null); setName('');
    } catch { setError('未能创建，请重试。'); } finally { setBusy(false); }
  };
  const remove = async (kind: 'project' | 'group', id: string, label: string) => {
    if (!window.confirm(kind === 'project' ? '删除项目“' + label + '”？项目本身无法恢复，其中任务移入回收站，恢复后归入收件箱。' : '删除项目组“' + label + '”？其中项目将移到默认项目组。')) return;
    try {
      if (kind === 'project') { await useListStore.getState().deleteList(id); await useTaskStore.getState().fetchTasks(); if (active === id) navigate('today'); }
      else await useListStore.getState().deleteProjectGroup(id);
    } catch { setError('删除失败，请重试。'); }
  };
  if (!open) return null;
  return <aside className="app-sidebar" aria-label="主导航">
    <div className="sidebar-brand drag-region"><span className="brand-mark"><Check size={18} strokeWidth={3} /></span><span>DoList</span><span className="brand-caption">个人空间</span></div>
    <button type="button" className="sidebar-search" onClick={() => useUIStore.getState().toggleSearch()}><Search size={16} /><span>搜索任务</span><kbd>Ctrl F</kbd></button>
    <nav className="sidebar-scroll">
      <div className="nav-section-caption">日常</div>
      {([{ id: 'today', label: '今天', icon: Sun }, { id: 'inbox', label: '收件箱', icon: Inbox }, { id: 'upcoming', label: '计划', icon: CalendarDays }] as const).map(item => <button key={item.id} type="button" className={cn('nav-item', view === item.id && 'is-active')} aria-current={view === item.id ? 'page' : undefined} onClick={() => { useListStore.getState().setActiveList(null); navigate(item.id); }}><item.icon size={17} /><span>{item.label}</span>{item.id !== 'upcoming' && counts[item.id] > 0 && <span className="nav-count">{counts[item.id]}</span>}</button>)}
      <div className="nav-section-caption mt-7"><span>项目</span><DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="新建项目或项目组"><Plus size={15} /></button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onClick={() => beginCreate('project')}>新建项目</DropdownMenuItem><DropdownMenuItem onClick={() => beginCreate('group')}>新建项目组</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
      {listError && <p role="alert" className="p-2 text-xs text-destructive">{listError}<button className="ml-1 underline" onClick={() => void useListStore.getState().fetchLists()}>重新加载项目</button></p>}
      {sections.map(group => <div key={group.id} className="project-group">
        <div className="project-group-heading">
          <button type="button" aria-expanded={expanded[group.id] !== false} onClick={() => setExpanded(s => ({ ...s, [group.id]: s[group.id] === false }))}>{expanded[group.id] === false ? <ChevronRight size={13} /> : <ChevronDown size={13} />}<span>{group.name}</span></button>
          <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label={'管理项目组：' + group.name}><MoreHorizontal size={15} /></button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => beginCreate('project', group.id === '__ungrouped__' ? undefined : group.id)}>新建项目</DropdownMenuItem>{!['default-group', '__ungrouped__'].includes(group.id) && <DropdownMenuItem onClick={() => void remove('group', group.id, group.name)}>删除项目组</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
        </div>
        {expanded[group.id] !== false && group.projects.map(project => <div key={project.id} className="project-nav-row"><button type="button" className={cn('nav-item', view === 'list' && active === project.id && 'is-active')} onClick={() => { useListStore.getState().setActiveList(project.id); navigate('list'); }}><Folder size={16} style={{ color: project.color ?? undefined }} /><span>{project.name}</span></button><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="project-menu" aria-label={'管理项目：' + project.name}><MoreHorizontal size={14} /></button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem className="text-destructive" onClick={() => void remove('project', project.id, project.name)}><Trash2 size={14} className="mr-2" />删除项目</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>)}
        {expanded[group.id] !== false && !group.projects.length && <button type="button" className="project-empty" onClick={() => beginCreate('project', group.id)}><Plus size={13} />添加一个项目</button>}
      </div>)}
      {creating && <form onSubmit={create} className="sidebar-create"><label className="text-xs">{creating.kind === 'group' ? '项目组名称' : '项目名称'}<input autoFocus value={name} disabled={busy} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.nativeEvent.isComposing && e.key === 'Enter') e.preventDefault(); }} /></label><div className="flex gap-2 mt-2"><Button size="sm" type="submit" disabled={busy || !name.trim()}>创建</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setCreating(null)}>取消</Button></div></form>}
      {error && <p role="alert" className="p-2 text-xs text-destructive">{error}</p>}
      <button type="button" className="nav-section-caption mt-7 w-full" aria-expanded={more} onClick={() => setMore(!more)}><span>更多工具</span>{more ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
      {(more || ['matrix', 'project-report'].includes(view)) && <>{([{ id: 'matrix', label: '四象限', icon: Grid2X2 }, { id: 'project-report', label: '回顾', icon: BarChart3 }] as const).map(item => <button key={item.id} className={cn('nav-item', view === item.id && 'is-active')} onClick={() => navigate(item.id)}><item.icon size={16} /><span>{item.label}</span></button>)}</>}
    </nav>
    <div className="sidebar-footer"><button type="button" className={cn('nav-item', view === 'trash' && 'is-active')} aria-current={view === 'trash' ? 'page' : undefined} onClick={() => { useUIStore.getState().closeDetailPanel(); navigate('trash'); }}><Trash2 size={17} /><span>回收站</span></button><button type="button" className="nav-item" onClick={() => useUIStore.getState().togglePomodoro()}><Timer size={17} /><span>专注时刻</span><kbd>P</kbd></button><button type="button" className="nav-item" onClick={() => useUIStore.getState().toggleSettings()}><Settings size={17} /><span>设置</span></button><p className="sidebar-local"><span />本地保存 · 属于你的空间</p></div>
  </aside>;
}
