import type {Track} from './model';
import {request} from './source-http';
import {searchOpenverse,openverseArtist,openverseAlbum} from './openverse-api';
import {searchArchive,archiveAlbum} from './archive-api';
export {request} from './source-http';
export {fromOpenverse} from './openverse-api';
const API='https://api.audius.co/v1';
export type CatalogSource='audius'|'itunes'|'openverse'|'archive';
export const SEARCH_PAGE_SIZE:Record<CatalogSource,number>={audius:60,itunes:60,openverse:20,archive:60};
const normalize=(value:string)=>value.toLowerCase().replaceAll('ё','е').trim();
export function fromAudius(t:any):Track { return {id:'au:'+t.id,title:t.title,artist:t.user?.name||'Неизвестный исполнитель',uploader:t.user?.handle,artwork:t.artwork?.['480x480']||'',duration:t.duration||0,source:'audius',url:`${API}/tracks/${t.id}/stream?app_name=wave`,link:t.permalink?'https://audius.co'+t.permalink:undefined,available:t.is_streamable!==false&&!t.is_stream_gated&&t.access?.stream!==false,artistId:t.user?.id,artistUrl:t.user?.handle?'https://audius.co/'+t.user.handle:undefined,album:t.album_backlink?.playlist_name,albumId:t.album_backlink?.playlist_id?String(t.album_backlink.playlist_id):undefined,albumUrl:t.album_backlink?.permalink?'https://audius.co'+t.album_backlink.permalink:undefined,year:/^\d{4}/.test(t.release_date||'')?Number(t.release_date.slice(0,4)):undefined}; }
export function fromApple(t:any):Track { return {id:'it:'+t.trackId,title:t.trackName||'Без названия',artist:t.artistName||'Неизвестный исполнитель',artwork:t.artworkUrl100?.replace('100x100bb','600x600bb')||'',duration:0,source:'itunes',url:t.previewUrl||'',link:t.trackViewUrl,available:!!t.previewUrl,artistId:t.artistId?String(t.artistId):undefined,artistUrl:t.artistViewUrl,album:t.collectionName,albumId:t.collectionId?String(t.collectionId):undefined,albumUrl:t.collectionViewUrl,year:/^\d{4}/.test(t.releaseDate||'')?Number(t.releaseDate.slice(0,4)):undefined}; }
export async function trending(signal?:AbortSignal,genre?:string,offset=0):Promise<Track[]> { const j=await request(`${API}/tracks/trending?limit=60&offset=${offset}&app_name=wave${genre?'&genre='+encodeURIComponent(genre):''}`,signal); return unique((j.data||[]).map(fromAudius).filter((t:Track)=>t.available)); }
export async function search(query:string,source:CatalogSource,signal?:AbortSignal,offset=0):Promise<Track[]> {
 if(source==='openverse')return searchOpenverse(query,signal,offset);
 if(source==='archive')return searchArchive(query,signal,offset);
 const q=encodeURIComponent(query.trim().slice(0,200));
 const j=await request(source==='audius'?`${API}/tracks/search?query=${q}&limit=60&offset=${Math.max(0,offset)}&app_name=wave`:`https://itunes.apple.com/search?term=${q}&entity=song&limit=60&offset=${Math.max(0,offset)}&country=us`,signal);
 return unique(source==='audius'?(j.data||[]).map(fromAudius).filter((t:Track)=>t.available):(j.results||[]).map(fromApple).filter((t:Track)=>t.available));
}
export function unique(tracks:Track[]):Track[]{const seen=new Set<string>();return tracks.filter(t=>{const key=t.source==='itunes'?normalize(t.artist)+'|'+normalize(t.title):t.id;if(seen.has(key))return false;seen.add(key);return true;});}
export type Discovery={id:string;title:string;subtitle:string;genre:string;tracks:Track[]};
export const artists=[{id:'dragni',name:'Драгни',query:'Драгни',handle:'@dragni86',match:/драгни|dragni/i},{id:'batrip23',name:'batrip23',query:'batrip23',handle:'',match:/batrip\s?23|батрип/i},{id:'miyagi',name:'Miyagi',query:'Miyagi',handle:'',match:/miyagi/i}];
export async function artistTracks(signal?:AbortSignal):Promise<Discovery[]>{const settled=await Promise.allSettled(artists.slice(0,2).map(async artist=>{const j=await request(`https://itunes.apple.com/search?term=${encodeURIComponent(artist.query)}&entity=song&attribute=artistTerm&limit=100&country=us`,signal);return {id:artist.id,title:artist.name,subtitle:artist.handle||'Твои исполнители',genre:'artist',tracks:unique((j.results||[]).map(fromApple).filter((t:Track)=>t.available&&artist.match.test(t.artist)))};}));return settled.flatMap(s=>s.status==='fulfilled'?[s.value]:[]);}
export async function discovery(signal?:AbortSignal):Promise<Discovery[]>{const genres=[['hiphop','Ритм города','Хип-хоп и рэп','Hip-Hop/Rap'],['electronic','После полуночи','Электроника и новые имена','Electronic'],['ambient','Медленная волна','Спокойный звук для твоего вечера','Ambient']];const settled=await Promise.allSettled(genres.map(async([id,title,subtitle,genre])=>({id,title,subtitle,genre,tracks:await trending(signal,genre)})));return settled.flatMap(s=>s.status==='fulfilled'?[s.value]:[]);}
export async function openverseDiscovery(signal?:AbortSignal):Promise<Discovery[]>{const tracks=await searchOpenverse('ambient',signal);return tracks.length?[{id:'openverse',title:'Открытый звук',subtitle:'Полные записи с открытой лицензией · Openverse',genre:'openverse',tracks}]:[];}
export async function archiveDiscovery(signal?:AbortSignal):Promise<Discovery[]>{const tracks=await searchArchive('',signal);return tracks.length?[{id:'netlabels',title:'Независимые релизы',subtitle:'Открытые лицензии · Internet Archive',genre:'archive',tracks}]:[];}

export async function fetchArtist(track:Track,signal?:AbortSignal):Promise<Track[]>{
 if(track.source==='openverse')return openverseArtist(track,signal);
 if(track.source==='archive'){const found=await searchArchive(track.artist,signal);return found.filter(t=>normalize(t.artist)===normalize(track.artist));}
 if(track.source==='local')return [];
 if(track.source==='itunes'){
  const url=track.artistId&&/^\d+$/.test(track.artistId)?`https://itunes.apple.com/lookup?id=${track.artistId}&entity=song&limit=200&country=us`:`https://itunes.apple.com/search?term=${encodeURIComponent(track.artist)}&entity=song&attribute=artistTerm&limit=100&country=us`;
  const data=await request(url,signal);return unique((data.results||[]).filter((t:any)=>!!t.trackId&&(track.artistId?String(t.artistId)===track.artistId:normalize(t.artistName||'')===normalize(track.artist))).map(fromApple).filter((t:Track)=>t.available));
 }
 if(track.artistId){const data=await request(`${API}/users/${encodeURIComponent(track.artistId)}/tracks?limit=100&app_name=wave`,signal);return unique((data.data||[]).map(fromAudius).filter((t:Track)=>t.available));}
 return (await search(track.artist,'audius',signal)).filter(t=>normalize(t.artist)===normalize(track.artist));
}
export async function fetchAlbum(track:Track,signal?:AbortSignal):Promise<Track[]>{
 if(track.source==='openverse')return openverseAlbum(track,signal);
 if(track.source==='archive')return track.albumId?archiveAlbum(track.albumId,signal):[track];
 if(track.source==='local')return [track];
 if(track.source==='itunes'){
  if(!track.albumId||!/^\d+$/.test(track.albumId))return [track];
  const data=await request(`https://itunes.apple.com/lookup?id=${track.albumId}&entity=song&limit=200&country=us`,signal);
  return unique((data.results||[]).filter((t:any)=>!!t.trackId&&String(t.collectionId)===track.albumId).map(fromApple).filter((t:Track)=>t.available));
 }
 let id=track.albumId;
 if(!id&&track.id.startsWith('au:')){const data=await request(`${API}/tracks/${encodeURIComponent(track.id.slice(3))}?app_name=wave`,signal);id=data.data?.[0]?.album_backlink?.playlist_id?String(data.data[0].album_backlink.playlist_id):undefined;}
 if(!id)return [track];
 const data=await request(`${API}/playlists/${encodeURIComponent(id)}/tracks?app_name=wave`,signal);return unique((data.data||[]).map(fromAudius).filter((t:Track)=>t.available));
}

function distance(a:string,b:string):number{let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}return row[b.length];}
export function suggestQuery(query:string):string[]{
 const key=normalize(query).replace(/[^\p{L}\p{N}]/gu,'');if(key.length<3)return [];
 const choices=[{name:'Miyagi',aliases:['miyagi','мияги','миягии','miyaги']},{name:'Miyagi & Эндшпиль',aliases:['miyagiэндшпиль','миягиэндшпиль','miyagiandypanda']},{name:'Драгни',aliases:['драгни','dragni','dragni86','драгони']},{name:'batrip23',aliases:['batrip23','батрип23']},{name:'Electronic',aliases:['electronic','электроника']},{name:'Ambient',aliases:['ambient','эмбиент']},{name:'Hip-Hop',aliases:['hiphop','хипхоп']},{name:'Jazz',aliases:['jazz','джаз']},{name:'Rock',aliases:['rock','рок']}];
 const exact=choices.find(c=>c.aliases.some(a=>normalize(a)===key));
 if(exact)return normalize(exact.name).replace(/[^\p{L}\p{N}]/gu,'')===key?[]:[exact.name];
 return choices.map(c=>({name:c.name,score:Math.min(...c.aliases.map(a=>distance(key,normalize(a))))})).filter(c=>c.score<=Math.max(1,Math.floor(key.length*.22))).sort((a,b)=>a.score-b.score).slice(0,3).map(c=>c.name);
}
