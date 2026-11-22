export type Track = { id: string; title: string; artist: string; artwork: string; duration: number; source: 'audius' | 'itunes' | 'archive' | 'openverse' | 'local'; url: string; link?: string; uploader?: string; available: boolean; album?: string; albumId?: string; artistId?: string; year?: number; sizeBytes?: number; fileName?: string; license?: string; licenseUrl?: string; attribution?: string; artistUrl?: string; albumUrl?: string; };
export type Playlist = { id: string; name: string; tracks: Track[] };
export const fmt = (n: number) => Number.isFinite(n) && n >= 0 ? `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}` : '0:00';
export function readStore<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem('volna.'+key)||'null') ?? fallback; } catch { return fallback; } }
export function writeStore(key: string, value: unknown) { try { localStorage.setItem('volna.'+key, JSON.stringify(value)); return true; } catch { return false; } }
export const cleanTrack = (t: Track) => ({...t,url:t.source==='local'?'':t.url});
export const trackCount=(n:number)=>`${n} ${n%10===1&&n%100!==11?'трек':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'трека':'треков'}`;
export function bytes(n:number){if(!Number.isFinite(n)||n<=0)return '0 Б';const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),3);return `${(n/1024**i).toLocaleString('ru-RU',{maximumFractionDigits:i?1:0})} ${['Б','КБ','МБ','ГБ'][i]}`;}
