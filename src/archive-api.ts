import type {Track} from './model';
import {request} from './source-http';

const ROOT='https://archive.org';
const text=(value:unknown):string=>Array.isArray(value)?text(value[0]):typeof value==='string'?value.trim():'';
export function allowedArchiveLicense(value:unknown):string|undefined{
 for(const raw of Array.isArray(value)?value:[value])try{
  const url=new URL(String(raw));
  if(!['http:','https:'].includes(url.protocol)||!['creativecommons.org','www.creativecommons.org'].includes(url.hostname))continue;
  if(/^\/licenses\/(by|by-sa)\/\d/i.test(url.pathname)||/^\/publicdomain\/(zero|mark)\//i.test(url.pathname)){url.protocol='https:';return url.href;}
 }catch{}
 return undefined;
}
export function parseArchiveDuration(raw:unknown):number{
 if(typeof raw==='number')return Number.isFinite(raw)&&raw>0?raw:0;
 const value=text(raw);if(!value)return 0;
 const parts=value.split(':').map(Number);if(parts.some(n=>!Number.isFinite(n)||n<0)||parts.length>3)return 0;
 return parts.reduce((total,n)=>total*60+n,0);
}
const truthy=(v:unknown)=>v===true||v===1||v==='true'||v==='1';
export function tracksFromArchive(identifier:string,record:any):Track[]{
 const metadata=record?.metadata||{},licenseUrl=allowedArchiveLicense(metadata.licenseurl);
 if(!licenseUrl||metadata.mediatype!=='audio'||truthy(metadata['access-restricted-item'])||truthy(metadata['is_dark'])||truthy(record.is_dark)||!Array.isArray(record.files))return [];
 const album=text(metadata.title)||identifier,artist=text(metadata.creator)||'Неизвестный исполнитель';
 const candidates=new Map<string,any>();
 for(const file of record.files){
  const name=text(file.name);if(!/\.mp3$/i.test(name)||truthy(file.private)||name.split('/').some(p=>p==='..')||!Number.isFinite(Number(file.size))||Number(file.size)<=0)continue;
  const key=text(file.original)||name,prior=candidates.get(key);
  if(!prior||file.source==='original'&&prior.source!=='original')candidates.set(key,file);
 }
 return [...candidates.values()].slice(0,60).map(file=>{
  const name=text(file.name),title=text(file.title)||name.replace(/^.*\//,'').replace(/\.mp3$/i,'').replace(/^\d+[\s._-]+/,'').replaceAll('_',' ');
  return {id:'ia:'+encodeURIComponent(identifier)+':'+encodeURIComponent(name),title,artist:text(file.creator)||artist,source:'archive',duration:parseArchiveDuration(file.length),artwork:ROOT+'/services/img/'+encodeURIComponent(identifier),url:ROOT+'/download/'+encodeURIComponent(identifier)+'/'+name.split('/').map(encodeURIComponent).join('/'),link:ROOT+'/details/'+encodeURIComponent(identifier),available:true,album,albumId:'ia:'+identifier,albumUrl:ROOT+'/details/'+encodeURIComponent(identifier),sizeBytes:Number(file.size),fileName:name,year:/^\d{4}/.test(text(metadata.date))?Number(text(metadata.date).slice(0,4)):undefined,license:licenseUrl.includes('/publicdomain/')?'Public Domain':licenseUrl.includes('/by-sa/')?'CC BY-SA':'CC BY',licenseUrl};
 });
}

export function archiveSearchUrl(query:string,offset=0):string{
 const cleaned=query.replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g,' ').trim().slice(0,150);
 let q='mediatype:audio AND collection:netlabels AND licenseurl:* AND NOT access-restricted-item:true';
 if(cleaned)q+=` AND (title:("${cleaned}") OR creator:("${cleaned}") OR subject:("${cleaned}"))`;
 const p=new URLSearchParams({q,output:'json',rows:'5',page:String(Math.floor(Math.max(0,offset)/60)+1),'sort[]':'downloads desc'});p.append('fl[]','identifier');
 return ROOT+'/advancedsearch.php?'+p;
}
export async function archiveAlbum(identifier:string,signal?:AbortSignal):Promise<Track[]>{
 const id=identifier.replace(/^ia:/,'');if(!/^[\w.()\-]+$/.test(id))throw new Error('Некорректный идентификатор альбома');
 return tracksFromArchive(id,await request(ROOT+'/metadata/'+encodeURIComponent(id),signal));
}
export async function searchArchive(query:string,signal?:AbortSignal,offset=0):Promise<Track[]>{
 const result=await request(archiveSearchUrl(query,offset),signal);const docs=result.response?.docs;
 if(!Array.isArray(docs))return [];
 const settled=await Promise.allSettled(docs.slice(0,5).map((d:any)=>archiveAlbum(text(d.identifier),signal)));
 if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');
 if(settled.length&&settled.every(r=>r.status==='rejected'))throw (settled[0] as PromiseRejectedResult).reason;
 return settled.flatMap(r=>r.status==='fulfilled'?r.value:[]).slice(0,60);
}
