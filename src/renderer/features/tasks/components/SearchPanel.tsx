import { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTaskStore } from '@/features/tasks/store';
import { useUIStore } from '@/features/settings/uiStore';
import type { Task } from '../../../../../types/models';

export function SearchPanel() {
  const { searchTasks } = useTaskStore();
  const { isSearchOpen, toggleSearch, searchQuery, setSearchQuery, selectTask } = useUIStore();
  const [results, setResults] = useState<Task[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const tasks = await searchTasks(query);
      setResults(tasks);
    } finally {
      setIsSearching(false);
    }
  }, [searchTasks]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleSelectTask = (taskId: string) => {
    selectTask(taskId);
    toggleSearch();
  };

  if (!isSearchOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={toggleSearch}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed left-1/2 top-20 -translate-x-1/2 w-full max-w-lg bg-background border rounded-lg shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2 p-4 border-b">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索任务..."
              className="border-0 p-0 h-auto text-base focus-visible:ring-0"
              autoFocus
            />
            <Button variant="ghost" size="icon" onClick={toggleSearch}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="max-h-[400px]">
            {isSearching ? (
              <div className="p-4 text-center text-muted-foreground">
                搜索中...
              </div>
            ) : results.length > 0 ? (
              <div className="p-2">
                {results.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleSelectTask(task.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors',
                      task.status === 'done' && 'opacity-60'
                    )}
                  >
                    <p
                      className={cn(
                        'text-sm font-medium',
                        task.status === 'done' && 'line-through'
                      )}
                    >
                      {task.title}
                    </p>
                    {task.notes && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {task.notes}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="p-4 text-center text-muted-foreground">
                未找到匹配的任务
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                输入关键词搜索任务
              </div>
            )}
          </ScrollArea>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
