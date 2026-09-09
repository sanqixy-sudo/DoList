export interface BackupSummary {
  fileName: string; createdAt: string; tasks: number; trashed: number; projects: number; attachments: number; bytes: number;
}
export interface BackupPreview extends BackupSummary { token: string }
export interface BackupResult { path: string; summary: BackupSummary }

export interface BackupProgress { phase: string; percent: number; canCancel: boolean }
