import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  exportBackup,
  importBackup,
  inspectBackup,
  readLibrarySnapshot,
  type LibrarySnapshot,
} from '../src/backup';
import { getFile, putFile, listStoredFiles } from '../src/files';
import { getStorageUsage, requestPersistentStorage } from '../src/storage-manager';
import type { Track } from '../src/model';

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  failOnceKey = '';
  get length() {
    return this.data.size;
  }
  key(n: number) {
    return [...this.data.keys()][n] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failOnceKey === k) {
      this.failOnceKey = '';
      throw new Error('Quota exceeded');
    }
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}
const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
Object.defineProperty(globalThis, 'indexedDB', { value: indexedDB, configurable: true });
const empty = (): LibrarySnapshot => ({ likes: [], playlists: [], local: [], history: [] });
const local = (id = 'local:test', title = 'Моя песня'): Track => ({
  id,
  title,
  artist: 'Исполнитель',
  duration: 120,
  source: 'local',
  url: 'blob:temporary-must-not-leak',
  artwork: '',
  available: true,
  fileName: 'song.mp3',
});
const remote: Track = {
  id: 'ov:one',
  title: 'Open song',
  artist: 'Artist',
  duration: 180,
  source: 'openverse' as Track['source'],
  url: 'https://example.com/audio.mp3',
  artwork: 'https://example.com/cover.jpg',
  available: true,
  ...{
    license: 'by',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Artist — Open song',
  },
};
function save(library: LibrarySnapshot) {
  for (const [key, value] of Object.entries(library))
    localStorage.setItem('volna.' + key, JSON.stringify(value));
}
async function reset() {
  storage.clear();
  storage.failOnceKey = '';
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase('volna-files');
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}
beforeEach(reset);
async function archiveWithSong() {
  const song = local();
  const bytes = new Uint8Array([73, 68, 51, 0, 255, 1, 99, 23]);
  await putFile(song.id, new File([bytes], 'song.mp3', { type: 'audio/mpeg', lastModified: 1234 }));
  const snapshot = {
    likes: [song, remote],
    playlists: [{ id: 'night', name: 'Ночной город', tracks: [song, remote] }],
    local: [song],
    history: [song],
  };
  return { archive: await exportBackup(snapshot), song, bytes, snapshot };
}
async function modifyArchive(
  blob: Blob,
  change: (files: Record<string, Uint8Array>, manifest: any) => void,
) {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  change(files, manifest);
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  return new Blob([zipSync(files).buffer], { type: 'application/zip' });
}

test('ZIP round trip restores exact local audio bytes, collections and attribution without object URLs', async () => {
  const { archive, bytes } = await archiveWithSong();
  const preview = await inspectBackup(archive);
  assert.equal(preview.files, 1);
  assert.equal(preview.totalBytes, bytes.length);
  assert.equal(preview.likes, 2);
  const files = unzipSync(new Uint8Array(await archive.arrayBuffer()));
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  assert.equal(manifest.library.local[0].url, '');
  await reset();
  const result = await importBackup(archive);
  assert.equal(result.importedFiles, 1);
  assert.deepEqual(new Uint8Array(await (await getFile('local:test'))!.arrayBuffer()), bytes);
  assert.equal(result.library.playlists[0].name, 'Ночной город');
  assert.equal(
    (result.library.likes.find((t) => t.id === 'ov:one') as any).attribution,
    'Artist — Open song',
  );
  assert.deepEqual(readLibrarySnapshot(), result.library);
});
test('import merges collections and preserves an existing conflicting file and playlist name', async () => {
  const { archive, bytes } = await archiveWithSong();
  await reset();
  const existing = local('local:test', 'Существующая песня');
  const original = new Uint8Array([9, 8, 7]);
  await putFile(existing.id, new File([original], 'old.mp3', { type: 'audio/mpeg' }));
  save({
    likes: [existing],
    playlists: [{ id: 'night', name: 'Моё название', tracks: [existing] }],
    local: [existing],
    history: [],
  });
  const result = await importBackup(archive);
  assert.equal(result.remappedFiles, 1);
  assert.equal(result.library.playlists[0].name, 'Моё название');
  assert.equal(result.library.local[0].title, 'Существующая песня');
  assert.deepEqual(new Uint8Array(await (await getFile(existing.id))!.arrayBuffer()), original);
  const imported = result.library.local.find((t) => t.id !== existing.id)!;
  assert.ok(imported.id.startsWith('local:import-'));
  assert.deepEqual(new Uint8Array(await (await getFile(imported.id))!.arrayBuffer()), bytes);
  assert.ok(result.library.playlists[0].tracks.some((t) => t.id === imported.id));
  assert.ok(result.warnings.length);
});
test('identical local bytes are reused and existing metadata wins', async () => {
  const { archive, bytes } = await archiveWithSong();
  await reset();
  const existing = local('local:test', 'Моё название');
  await putFile(existing.id, new File([bytes], 'my-file.mp3', { type: 'audio/mpeg' }));
  save({ ...empty(), likes: [existing], local: [existing] });
  const result = await importBackup(archive);
  assert.equal(result.importedFiles, 0);
  assert.equal(result.reusedFiles, 1);
  assert.equal(result.library.local[0].title, 'Моё название');
  assert.equal((await listStoredFiles()).length, 1);
});
test('export includes orphan local audio when its collection record was lost', async () => {
  const bytes = new Uint8Array([3, 4, 5, 6]);
  await putFile('local:orphan', new File([bytes], 'orphan.mp3', { type: 'audio/mpeg' }));
  const archive = await exportBackup(empty());
  assert.equal((await inspectBackup(archive)).files, 1);
  await reset();
  const result = await importBackup(archive);
  assert.equal(result.library.local.length, 1);
  assert.deepEqual(new Uint8Array(await (await getFile('local:orphan'))!.arrayBuffer()), bytes);
});
test('corrupt audio, missing payload and unsafe ZIP paths are rejected before any writes', async () => {
  const { archive } = await archiveWithSong();
  await reset();
  const corrupted = await modifyArchive(archive, (files) => {
    files['audio/000001.bin'][2] ^= 255;
  });
  await assert.rejects(() => importBackup(corrupted), /контрольная сумма/);
  assert.equal((await listStoredFiles()).length, 0);
  assert.equal(localStorage.length, 0);
  const missing = await modifyArchive(archive, (files) => {
    delete files['audio/000001.bin'];
  });
  await assert.rejects(() => importBackup(missing), /отсутствует/);
  const unsafe = await modifyArchive(archive, (files) => {
    files['../evil.js'] = strToU8('not executed');
  });
  await assert.rejects(() => importBackup(unsafe), /небезопасный путь/);
  assert.equal((await listStoredFiles()).length, 0);
  assert.equal(localStorage.length, 0);
});
test('unsafe metadata URLs and unsupported versions are rejected without changing the library', async () => {
  const { archive } = await archiveWithSong();
  await reset();
  const original = { ...empty(), likes: [remote] };
  save(original);
  const badURL = await modifyArchive(archive, (_files, m) => {
    m.library.likes[1].url = 'javascript:alert(1)';
  });
  await assert.rejects(() => importBackup(badURL), /ссылка/);
  assert.deepEqual(readLibrarySnapshot(), original);
  const badVersion = await modifyArchive(archive, (_files, m) => {
    m.version = 2;
  });
  await assert.rejects(() => importBackup(badVersion), /версия/);
  assert.deepEqual(readLibrarySnapshot(), original);
});
test('oversized ZIP declarations are rejected before decompression', async () => {
  const { archive } = await archiveWithSong();
  const bytes = new Uint8Array(await archive.arrayBuffer());
  const view = new DataView(bytes.buffer);
  let changed = false;
  for (let i = 0; i < bytes.length - 46; i++)
    if (view.getUint32(i, true) === 0x02014b50) {
      view.setUint32(i + 24, 200 * 1024 * 1024, true);
      changed = true;
      break;
    }
  assert.ok(changed);
  await assert.rejects(() => inspectBackup(bytes), /размер/);
});
test('metadata storage failure rolls back all new Blob records and restores previous metadata', async () => {
  const { archive } = await archiveWithSong();
  await reset();
  const original = { ...empty(), likes: [remote] };
  save(original);
  storage.failOnceKey = 'volna.playlists';
  await assert.rejects(() => importBackup(archive), /Импорт отменён/);
  assert.deepEqual(readLibrarySnapshot(), original);
  assert.equal((await listStoredFiles()).length, 0);
});
test('export reports missing local files explicitly and storage usage uses real Blob sizes', async () => {
  const song = local();
  await assert.rejects(
    () => exportBackup({ ...empty(), local: [song] }),
    /отсутствует на устройстве/,
  );
  await putFile(song.id, new File([new Uint8Array(27)], 'test.mp3', { type: 'audio/mpeg' }));
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      storage: {
        estimate: async () => ({ usage: 100, quota: 1000 }),
        persisted: async () => false,
        persist: async () => true,
      },
    },
    configurable: true,
  });
  const usage = await getStorageUsage([song, local('local:missing')]);
  assert.equal(usage.audioBytes, 27);
  assert.equal(usage.audioFiles, 1);
  assert.equal(usage.usageBytes, 100);
  assert.equal(usage.quotaBytes, 1000);
  assert.deepEqual(usage.missingFileIds, ['local:missing']);
  assert.equal(await requestPersistentStorage(), true);
});
