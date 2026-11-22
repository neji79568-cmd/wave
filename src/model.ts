export type Track = {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  duration: number;
  source: 'audius' | 'itunes' | 'archive' | 'openverse' | 'local';
  url: string;
  link?: string;
  uploader?: string;
  available: boolean;
  album?: string;
  albumId?: string;
  artistId?: string;
  year?: number;
  sizeBytes?: number;
  fileName?: string;
  license?: string;
  licenseUrl?: string;
  attribution?: string;
  artistUrl?: string;
  albumUrl?: string;
};
export type Playlist = { id: string; name: string; tracks: Track[] };
export const fmt = (n: number) =>
  Number.isFinite(n) && n >= 0
    ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`
    : '0:00';
export function readStore<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem('volna.' + key);
    const value = JSON.parse(raw || 'null');
    if (value === null) return fallback;
    if (
      (Array.isArray(fallback) && !Array.isArray(value)) ||
      (typeof fallback === 'boolean' && typeof value !== 'boolean')
    )
      throw new Error('Invalid stored shape');
    const validTrack = (t: any) =>
      t &&
      typeof t.id === 'string' &&
      typeof t.title === 'string' &&
      typeof t.artist === 'string' &&
      typeof t.artwork === 'string' &&
      typeof t.url === 'string' &&
      Number.isFinite(t.duration) &&
      ['audius', 'itunes', 'archive', 'openverse', 'local'].includes(t.source);
    if (['likes', 'local', 'history', 'trending', 'picks'].includes(key))
      return value.filter(validTrack) as T;
    if (['playlists', 'discovery', 'artists', 'open-music'].includes(key))
      return value
        .filter(
          (x: any) =>
            x &&
            typeof x.id === 'string' &&
            Array.isArray(x.tracks) &&
            (key === 'playlists' ? typeof x.name === 'string' : typeof x.title === 'string'),
        )
        .map((x: any) => ({ ...x, tracks: x.tracks.filter(validTrack) })) as T;
    return value;
  } catch {
    if (raw)
      try {
        if (!localStorage.getItem('volna.recovery.' + key))
          localStorage.setItem('volna.recovery.' + key, raw);
      } catch {}
    return fallback;
  }
}
export function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem('volna.' + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export const cleanTrack = (t: Track) => ({ ...t, url: t.source === 'local' ? '' : t.url });
export const trackCount = (n: number) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'трек' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'трека' : 'треков'}`;
export function bytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '0 Б';
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 3);
  return `${(n / 1024 ** i).toLocaleString('ru-RU', { maximumFractionDigits: i ? 1 : 0 })} ${['Б', 'КБ', 'МБ', 'ГБ'][i]}`;
}
