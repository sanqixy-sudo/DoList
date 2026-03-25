import { Minus, Square, X } from 'lucide-react';

export function WindowControls() {
  return (
    <div className="no-drag flex h-full items-stretch self-stretch">
      <button
        type="button"
        aria-label="Minimize window"
        className="flex h-full w-12 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={() => void window.electronAPI.app.minimizeWindow()}
      >
        <Minus className="h-4 w-4" />
      </button>

      <button
        type="button"
        aria-label="Toggle maximize window"
        className="flex h-full w-12 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={() => void window.electronAPI.app.toggleMaximizeWindow()}
      >
        <Square className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        aria-label="Close window"
        className="flex h-full w-12 items-center justify-center text-muted-foreground transition-colors hover:bg-red-500 hover:text-white"
        onClick={() => void window.electronAPI.app.closeWindow()}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
