import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  {
    category: '通用',
    items: [
      { keys: ['N'], description: '新建任务' },
      { keys: ['Ctrl', 'F'], description: '搜索' },
      { keys: ['P'], description: '打开/关闭番茄钟' },
      { keys: ['?'], description: '显示快捷键帮助' },
      { keys: ['Esc'], description: '关闭面板' },
    ],
  },
  {
    category: '任务操作',
    items: [
      { keys: ['Enter'], description: '打开任务详情' },
      { keys: ['Space'], description: '完成/取消完成任务' },
      { keys: ['Delete'], description: '删除任务' },
      { keys: ['1'], description: '设置高优先级' },
      { keys: ['2'], description: '设置中优先级' },
      { keys: ['3'], description: '设置低优先级' },
      { keys: ['0'], description: '清除优先级' },
    ],
  },
  {
    category: '导航',
    items: [
      { keys: ['G', 'I'], description: '转到收件箱' },
      { keys: ['G', 'T'], description: '转到今天' },
      { keys: ['G', 'U'], description: '转到即将到来' },
      { keys: ['G', 'C'], description: '转到日历' },
      { keys: ['G', 'K'], description: '转到看板' },
      { keys: ['G', 'L'], description: '转到时间线' },
      { keys: ['G', 'M'], description: '转到四象限' },
      { keys: ['↑', '↓'], description: '上下选择任务' },
    ],
  },
  {
    category: '视图',
    items: [
      { keys: ['['], description: '折叠侧边栏' },
      { keys: [']'], description: '展开侧边栏' },
    ],
  },
];

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-[500px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">键盘快捷键</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm">{item.description}</span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            {keyIndex > 0 && (
                              <span className="text-xs text-muted-foreground">+</span>
                            )}
                            <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
                              {key}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
