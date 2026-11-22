import type {Track} from './model';
import {request} from './source-http';

const API='https://api.openverse.org/v1/audio/';
export const OPENVERSE_PAGE_SIZE=20;
const allowed=new Set(['by','by-sa','cc0','pdm']);
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const https=(value:unknown)=>{try{const u=new URL(text(value));return u.protocol==='https:'?u.href:'';}catch{return '';}};
const positive=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:undefined;};

export function fromOpenverse(record:any):Track{
 const license=text(record.license).toLowerCase();
 const url=https(record.url);
 const licenseUrl=https(record.license_url);
 const duration=(positive(record.duration)||0)/1000;
 return {
  id:'ov:'+text(record.id),title:text(record.title)||'Без названия',artist:text(record.creator)||'Неизвестный исполнитель',
  source:'openverse',url,duration,artwork:https(record.thumbnail),link:https(record.foreign_landing_url),
  available:!!url&&!!licenseUrl&&allowed.has(license)&&record.category==='music'&&record.mature!==true&&duration>=30,
  album:text(record.audio_set?.title)||undefined,albumId:https(record.audio_set?.foreign_landing_url)||undefined,
  albumUrl:https(record.audio_set?.foreign_landing_url)||undefined,artistId:https(record.creator_url)||undefined,
  artistUrl:https(record.creator_url)||undefined,sizeBytes:positive(record.filesize),
  license:license==='pdm'?'Public Domain':`${license==='cc0'?'CC0':'CC '+license.toUpperCase()}${record.license_version?' '+text(record.license_version):''}`,
  licenseUrl:licenseUrl||undefined,attribution:text(record.attribution)||undefined
 };
}

export function openverseSearchUrl(query:string,offset=0):string{
 const params=new URLSearchParams({q:query.trim().slice(0,200)||'ambient',category:'music',license_type:'commercial',page_size:String(OPENVERSE_PAGE_SIZE),page:String(Math.floor(Math.max(0,offset)/OPENVERSE_PAGE_SIZE)+1)});
 return API+'?'+params;
}

const cache=new Map<string,{time:number;tracks:Track[]}>();
export async function searchOpenverse(query:string,signal?:AbortSignal,offset=0):Promise<Track[]>{
 const url=openverseSearchUrl(query,offset),hit=cache.get(url);
 if(hit&&Date.now()-hit.time<10*60*1000)return hit.tracks;
 const data=await request(url,signal);
 const seen=new Set<string>();const tracks=(Array.isArray(data.results)?data.results:[]).map(fromOpenverse).filter((t:Track)=>{if(!t.available||seen.has(t.id))return false;seen.add(t.id);return true;});
 cache.set(url,{time:Date.now(),tracks});
 if(cache.size>25)cache.delete(cache.keys().next().value!);
 return tracks;
}

const normalize=(s:string)=>s.toLowerCase().replaceAll('ё','е').trim();
export async function openverseArtist(track:Track,signal?:AbortSignal):Promise<Track[]>{
 const result=await searchOpenverse(track.artist,signal);
 return result.filter(t=>normalize(t.artist)===normalize(track.artist));
}
export async function openverseAlbum(track:Track,signal?:AbortSignal):Promise<Track[]>{
 if(!track.album&&!track.albumUrl)return [track];
 const result=await searchOpenverse(track.artist,signal);
 const match=result.filter(t=>track.albumUrl?t.albumUrl===track.albumUrl:normalize(t.album||'')===normalize(track.album||''));
 return match.length?match:[track];
}
