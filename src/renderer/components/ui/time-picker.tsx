import * as React from 'react';
import { Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TimeValue {
  hour: number;
  minute: number;
}

interface TimePickerProps {
  value?: TimeValue | null;
  onChange: (time: TimeValue | null) => void;
  className?: string;
}

const QUICK_TIMES: TimeValue[] = [
  { hour: 9, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 18, minute: 0 },
  { hour: 21, minute: 0 },
];

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [hourStr, setHourStr] = React.useState(value ? value.hour.toString().padStart(2, '0') : '');
  const [minuteStr, setMinuteStr] = React.useState(
    value ? value.minute.toString().padStart(2, '0') : ''
  );

  React.useEffect(() => {
    if (value) {
      setHourStr(value.hour.toString().padStart(2, '0'));
      setMinuteStr(value.minute.toString().padStart(2, '0'));
    } else {
      setHourStr('');
      setMinuteStr('');
    }
  }, [value]);

  const updateTime = (hourValue: string, minuteValue: string) => {
    if (hourValue === '' && minuteValue === '') {
      onChange(null);
      return;
    }

    const hour = Math.min(23, Math.max(0, parseInt(hourValue) || 0));
    const minute = Math.min(59, Math.max(0, parseInt(minuteValue) || 0));
    onChange({ hour, minute });
  };

  const handleHourChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.replace(/\D/g, '').slice(0, 2);
    setHourStr(next);
    updateTime(next, minuteStr);
  };

  const handleMinuteChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.replace(/\D/g, '').slice(0, 2);
    setMinuteStr(next);
    updateTime(hourStr, next);
  };

  const handleHourBlur = () => {
    if (!hourStr) return;
    const hour = Math.min(23, Math.max(0, parseInt(hourStr) || 0));
    setHourStr(hour.toString().padStart(2, '0'));
  };

  const handleMinuteBlur = () => {
    if (!minuteStr) return;
    const minute = Math.min(59, Math.max(0, parseInt(minuteStr) || 0));
    setMinuteStr(minute.toString().padStart(2, '0'));
  };

  const handleQuickTime = (time: TimeValue) => {
    setHourStr(time.hour.toString().padStart(2, '0'));
    setMinuteStr(time.minute.toString().padStart(2, '0'));
    onChange(time);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">时间</span>
        <div className="flex items-center gap-1">
          <Input
            value={hourStr}
            onChange={handleHourChange}
            onBlur={handleHourBlur}
            placeholder="00"
            className="h-8 w-12 p-1 text-center"
            maxLength={2}
            aria-label="小时"
          />
          <span className="text-muted-foreground">:</span>
          <Input
            value={minuteStr}
            onChange={handleMinuteChange}
            onBlur={handleMinuteBlur}
            placeholder="00"
            className="h-8 w-12 p-1 text-center"
            maxLength={2}
            aria-label="分钟"
          />
        </div>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={() => onChange(null)}
          >
            清除
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {QUICK_TIMES.map((time) => {
          const label = `${time.hour.toString().padStart(2, '0')}:${time.minute
            .toString()
            .padStart(2, '0')}`;
          return (
            <Button
              key={label}
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'h-7 px-2 text-xs',
                value?.hour === time.hour && value?.minute === time.minute && 'bg-accent'
              )}
              onClick={() => handleQuickTime(time)}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
