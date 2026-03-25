import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUIStore } from './uiStore';

export function SettingsDialog() {
  const { isSettingsOpen, toggleSettings, theme, setTheme } = useUIStore();
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    let isMounted = true;

    window.electronAPI.app.getVersion().then((version) => {
      if (isMounted) {
        setAppVersion(version);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Dialog open={isSettingsOpen} onOpenChange={toggleSettings}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-4">
            <div>
              <h4 className="mb-3 text-sm font-medium">主题</h4>
              <div className="flex gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('light')}
                  className="flex-1"
                >
                  <Sun className="mr-2 h-4 w-4" />
                  浅色
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                  className="flex-1"
                >
                  <Moon className="mr-2 h-4 w-4" />
                  深色
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('system')}
                  className="flex-1"
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  跟随系统
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
              <div className="text-sm font-medium">版本号</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {appVersion ? `v${appVersion}` : 'Loading...'}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
