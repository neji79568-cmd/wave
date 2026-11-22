const DB = 'volna-files';
export type StoredFileInfo = {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number | null;
};
async function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('audio');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Хранилище занято другой вкладкой. Закрой её и повтори.'));
  });
}
export async function putFile(id: string, file: Blob) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('audio', 'readwrite');
      tx.objectStore('audio').put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Запись файла отменена'));
    });
  } finally {
    db.close();
  }
}
export async function getFile(id: string): Promise<Blob | undefined> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction('audio').objectStore('audio').get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function deleteFile(id: string) {
  return deleteFiles([id]);
}
export async function deleteFiles(ids: string[]) {
  if (!ids.length) return;
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('audio', 'readwrite');
      const store = tx.objectStore('audio');
      for (const id of ids) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Удаление отменено'));
    });
  } finally {
    db.close();
  }
}
/** Add-only transaction: an ID collision aborts the complete import instead of overwriting user audio. */
export async function addFilesAtomically(entries: { id: string; file: Blob }[]) {
  if (!entries.length) return;
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('audio', 'readwrite');
      const store = tx.objectStore('audio');
      for (const entry of entries) store.add(entry.file, entry.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Импорт файлов отменён'));
    });
  } finally {
    db.close();
  }
}
export async function listStoredFiles(): Promise<StoredFileInfo[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const files: StoredFileInfo[] = [];
      const tx = db.transaction('audio');
      const r = tx.objectStore('audio').openCursor();
      r.onsuccess = () => {
        const cursor = r.result;
        if (!cursor) return;
        const file = cursor.value as Blob & { name?: string; lastModified?: number };
        if (file && typeof file.size === 'number' && typeof file.arrayBuffer === 'function')
          files.push({
            id: String(cursor.key),
            name: typeof file.name === 'string' ? file.name : 'Аудиофайл',
            type: file.type || 'application/octet-stream',
            size: file.size,
            lastModified: Number.isFinite(file.lastModified) ? file.lastModified! : null,
          });
        cursor.continue();
      };
      tx.oncomplete = () => resolve(files);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
