import React from 'react';
import { CheckCircle2, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PauseConfirmDialogProps {
  open: boolean;
  error?: string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  onComplete: () => void;
  onContinue: () => void;
}

export function PauseConfirmDialog({
  open,
  error,
  busy,
  onOpenChange,
  taskTitle,
  onComplete,
  onContinue,
}: PauseConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>暂停番茄钟</DialogTitle>
          <DialogDescription>
            您正在专注于：<span className="font-medium text-foreground">{taskTitle}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            您是否已完成这个任务？
          </p>
        </div>
        {error && <p role="alert" className="inline-error">{error}</p>}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={onContinue}
            className="flex-1"
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            继续专注
          </Button>
          <Button
            disabled={busy}
            onClick={onComplete}
            className="flex-1"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            完成任务
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
