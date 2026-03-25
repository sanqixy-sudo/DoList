import React, { useState, useEffect } from 'react';
import { Hash, Plus, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTagStore } from '../tagStore';

interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  className?: string;
}

const TAG_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
];

export function TagSelector({ selectedTagIds, onChange, className }: TagSelectorProps) {
  const { tags, fetchTags, createTag, deleteTag } = useTagStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen && tags.length === 0) {
      fetchTags();
    }
  }, [isOpen, tags.length, fetchTags]);

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const showCreateOption =
    searchValue.trim() &&
    !tags.some((tag) => tag.name.toLowerCase() === searchValue.toLowerCase());

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!searchValue.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
      const newTag = await createTag(searchValue.trim(), randomColor);
      onChange([...selectedTagIds, newTag.id]);
      setSearchValue('');
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveTag = (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedTagIds.filter((id) => id !== tagId));
  };

  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('h-8', selectedTagIds.length > 0 && 'text-primary', className)}
        >
          <Hash className="h-4 w-4 mr-1" />
          {selectedTagIds.length > 0 ? (
            <span className="text-xs">{selectedTagIds.length} 个标签</span>
          ) : (
            '标签'
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {/* Search / Create Input */}
        <div className="mb-2">
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="搜索或创建标签..."
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && showCreateOption) {
                e.preventDefault();
                handleCreateTag();
              }
            }}
          />
        </div>

        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b">
            {selectedTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: tag.color ? `${tag.color}20` : 'hsl(var(--accent))',
                  color: tag.color || 'inherit',
                }}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={(e) => handleRemoveTag(tag.id, e)}
                  className="hover:opacity-70"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Tag List */}
        <ScrollArea className="max-h-48">
          <div className="space-y-1">
            {filteredTags.map((tag) => (
              <div
                key={tag.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                onClick={() => handleToggleTag(tag.id)}
              >
                <Checkbox
                  checked={selectedTagIds.includes(tag.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tag.color || '#888' }}
                />
                <span className="text-sm flex-1 truncate">{tag.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Optional: Add custom dialog instead of window.confirm if preferred, but confirm is safe here
                    if (window.confirm(`确定要删除标签 "${tag.name}" 吗？`)) {
                      deleteTag(tag.id);
                      // Also remove from selection if selected
                      if (selectedTagIds.includes(tag.id)) {
                        onChange(selectedTagIds.filter((id) => id !== tag.id));
                      }
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}

            {/* Create New Tag Option */}
            {showCreateOption && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-primary"
                onClick={handleCreateTag}
                disabled={isCreating}
              >
                <Plus className="h-4 w-4 mr-2" />
                创建 "{searchValue}"
              </Button>
            )}

            {/* Empty State */}
            {filteredTags.length === 0 && !showCreateOption && (
              <div className="text-center text-sm text-muted-foreground py-4">
                暂无标签
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
