export function isImageMimeType(mimeType: string | null | undefined): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

export function toFileUrl(filePath: string): string {
  return encodeURI(`file:///${filePath.replace(/\\/g, '/')}`);
}

export function formatFileSize(fileSize: number): string {
  if (fileSize < 1024) return `${fileSize} B`;
  if (fileSize < 1024 * 1024) return `${(fileSize / 1024).toFixed(1)} KB`;
  return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
}
