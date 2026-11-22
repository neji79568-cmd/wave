export type Track = { id: string; title: string; artist: string; artwork: string; duration: number; source: 'audius' | 'itunes' | 'local'; url: string; link?: string; uploader?: string; available: boolean; };
export type Playlist = { id: string; name: string; tracks: Track[] };
export const fmt = (n: number) => Number.isFinite(n) && n >= 0 ? `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}` : '0:00';
export function readStore<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem('volna.'+key)||'null') ?? fallback; } catch { return fallback; } }
export function writeStore(key: string, value: unknown) { try { localStorage.setItem('volna.'+key, JSON.stringify(value)); return true; } catch { return false; } }
export const cleanTrack = (t: Track) => ({...t,url:t.source==='local'?'':t.url});
