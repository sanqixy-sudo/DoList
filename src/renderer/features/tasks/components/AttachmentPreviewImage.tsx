import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttachmentPreviewImageProps {
  filePath: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export function AttachmentPreviewImage({
  filePath,
  alt,
  className,
  fallbackClassName,
}: AttachmentPreviewImageProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setPreviewUrl(null);
    setHasError(false);

    window.electronAPI.tasks
      .getAttachmentPreviewUrl(filePath)
      .then((url) => {
        if (!cancelled) {
          setPreviewUrl(url);
        }
      })
      .catch((error) => {
        console.error('Failed to load attachment preview:', error);
        if (!cancelled) {
          setHasError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  if (!previewUrl || hasError) {
    return (
      <div className={cn('flex items-center justify-center bg-muted/50 text-muted-foreground', fallbackClassName)}>
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }

  return <img src={previewUrl} alt={alt} className={className} />;
}
