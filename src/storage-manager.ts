import { listStoredFiles, type StoredFileInfo } from './files';
import type { Track } from './model';
export { listStoredFiles };
export type StorageUsage = {
  supported: boolean;
  usageBytes: number;
  quotaBytes: number | null;
  audioBytes: number;
  audioFiles: number;
  persisted: boolean | null;
  files: StoredFileInfo[];
  missingFileIds: string[];
};
export async function getStorageUsage(localTracks: Track[] = []): Promise<StorageUsage> {
  const files = await listStoredFiles();
  const audioBytes = files.reduce((sum, f) => sum + f.size, 0);
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  let estimate: StorageEstimate = {};
  let persisted: boolean | null = null;
  try {
    if (storage?.estimate) estimate = await storage.estimate();
  } catch {}
  try {
    if (storage?.persisted) persisted = await storage.persisted();
  } catch {}
  const ids = new Set(files.map((f) => f.id));
  return {
    supported: !!storage?.estimate,
    usageBytes: Math.max(audioBytes, estimate.usage || 0),
    quotaBytes: typeof estimate.quota === 'number' ? estimate.quota : null,
    audioBytes,
    audioFiles: files.length,
    persisted,
    files: files.sort((a, b) => b.size - a.size),
    missingFileIds: localTracks
      .filter((t) => t.source === 'local' && !ids.has(t.id))
      .map((t) => t.id),
  };
}
export const getUsage = getStorageUsage;
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.storage?.persist &&
      (await navigator.storage.persist())
    );
  } catch {
    return false;
  }
}
