import { cleanTrack, readStore, writeStore, type Track } from './model';

export type PlaybackSession = {
  version: 1;
  current: Track | null;
  queue: Track[];
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: boolean;
  volume: number;
};
export const EMPTY_SESSION: PlaybackSession = {
  version: 1,
  current: null,
  queue: [],
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: false,
  volume: 0.8,
};
const finite = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function track(value: unknown): Track | null {
  if (!value || typeof value !== 'object') return null;
  const t = value as Track;
  if (
    typeof t.id !== 'string' ||
    !t.id ||
    typeof t.title !== 'string' ||
    typeof t.artist !== 'string' ||
    !['audius', 'itunes', 'local', 'archive'].includes(t.source) ||
    t.available === false
  )
    return null;
  if (t.source !== 'local') {
    if (typeof t.url !== 'string' || t.url.length > 8192) return null;
    try {
      if (!['http:', 'https:'].includes(new URL(t.url).protocol)) return null;
    } catch {
      return null;
    }
  }
  return cleanTrack({
    ...t,
    title: t.title.slice(0, 500),
    artist: t.artist.slice(0, 500),
    artwork: typeof t.artwork === 'string' ? t.artwork : '',
    duration: Math.max(0, finite(t.duration)),
    url: t.source === 'local' ? '' : t.url,
    available: true,
  });
}

export function normalizePlaybackSession(value: unknown): PlaybackSession {
  if (!value || typeof value !== 'object') return { ...EMPTY_SESSION, queue: [] };
  const s = value as Partial<PlaybackSession>;
  if (s.version !== 1) return { ...EMPTY_SESSION, queue: [] };
  const current = track(s.current);
  const seen = new Set<string>();
  const queue = (Array.isArray(s.queue) ? s.queue : [])
    .slice(0, 500)
    .map(track)
    .filter((t): t is Track => {
      if (!t || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    })
    .slice(0, 200);
  if (current && !queue.some((t) => t.id === current.id)) queue.unshift(current);
  const duration = Math.max(0, finite(s.duration, current?.duration || 0));
  return {
    version: 1,
    current,
    queue: queue.slice(0, 200),
    position: current ? positionWithinDuration(finite(s.position), duration) : 0,
    duration,
    shuffle: s.shuffle === true,
    repeat: s.repeat === true,
    volume: Math.min(1, Math.max(0, finite(s.volume, 0.8))),
  };
}

export function positionWithinDuration(position: number, duration: number) {
  const safe = Math.max(0, finite(position));
  return duration > 0 && Number.isFinite(duration)
    ? Math.min(safe, Math.max(0, duration - 0.05))
    : safe;
}

export function readPlaybackSession() {
  return normalizePlaybackSession(readStore('player', null));
}
export function savePlaybackSession(session: PlaybackSession) {
  return writeStore('player', normalizePlaybackSession(session));
}
