import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
for(const k of ['window','document','navigator','HTMLElement','HTMLMediaElement','HTMLInputElement','Event','KeyboardEvent','localStorage','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,k,{value:(dom.window as any)[k],configurable:true,writable:true});
Object.defineProperty(globalThis,'indexedDB',{value:indexedDB});
Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,writable:true});
dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}} as any);globalThis.matchMedia=dom.window.matchMedia;
globalThis.IntersectionObserver=class{observe(el:any){el.classList.add('is-revealed');}disconnect(){}unobserve(){}} as any;
globalThis.ResizeObserver=class{observe(){}disconnect(){}} as any;
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
Object.defineProperty(dom.window.HTMLCanvasElement.prototype,'getContext',{value:()=>null});
let online=true,audioPlays=0;
const paused=new WeakMap<HTMLMediaElement,boolean>(),errors=new WeakMap<HTMLMediaElement,{code:number}|null>();
Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>online});
Object.defineProperty(HTMLMediaElement.prototype,'paused',{configurable:true,get(){return paused.get(this)??true;}});
Object.defineProperty(HTMLMediaElement.prototype,'duration',{configurable:true,get(){return 180;}});
Object.defineProperty(HTMLMediaElement.prototype,'readyState',{configurable:true,get(){return 3;}});
Object.defineProperty(HTMLMediaElement.prototype,'error',{configurable:true,get(){return errors.get(this)??null;}});
HTMLMediaElement.prototype.load=function(){errors.set(this,null);this.currentTime=0;this.dispatchEvent(new Event('loadedmetadata'));};
HTMLMediaElement.prototype.play=async function(){if(this.tagName==='AUDIO')audioPlays++;paused.set(this,false);this.dispatchEvent(new Event('playing'));};
HTMLMediaElement.prototype.pause=function(){paused.set(this,true);this.dispatchEvent(new Event('pause'));};
globalThis.fetch=async(input:any)=>new Response(JSON.stringify(String(input).includes('itunes')?{results:[]}:{data:[]}),{status:200});
const {render,cleanup,waitFor,act,fireEvent}=await import('@testing-library/react');
const {default:App}=await import('../src/App');
const {normalizePlaybackSession,readPlaybackSession,savePlaybackSession}=await import('../src/playback-session');
const track={id:'au:resume',title:'Resume song',artist:'Saved artist',artwork:'',duration:180,source:'audius' as const,url:'https://example.com/resume.mp3',available:true};
const second={...track,id:'au:second',title:'Second song',url:'https://example.com/second.mp3'};
const saved={version:1 as const,current:track,queue:[track,second],position:42,duration:180,shuffle:true,repeat:false,volume:.25};
const audio=()=>document.querySelector('audio')!;
const clickPlay=()=>fireEvent.click(document.querySelector('.player .main-play')!);
function reset(){cleanup();localStorage.clear();online=true;audioPlays=0;}
test('rapid next clicks advance through the latest queue without replaying the same song',async()=>{reset();const third={...track,id:'au:third',title:'Third song',url:'https://example.com/third.mp3'};savePlaybackSession({...saved,shuffle:false,position:0,queue:[track,second,third]});render(<App/>);await act(async()=>{const next=document.querySelector('.player button[aria-label="Следующий трек"]')!;fireEvent.click(next);fireEvent.click(next);});await waitFor(()=>assert.equal(document.querySelector('.now-playing strong')?.textContent,'Third song'));reset();});

test('session validation rejects unsafe sources and preserves archive tracks and finite preferences',()=>{
 reset();
 const normalized=normalizePlaybackSession({...saved,position:999,volume:5,queue:[track,track,{...second,url:'javascript:alert(1)'}]});
 assert.equal(normalized.queue.length,1);assert.equal(normalized.position,179.95);assert.equal(normalized.volume,1);
 assert.equal(normalizePlaybackSession({...saved,current:{...track,url:'javascript:alert(1)'}}).current,null);
 const archived={...track,id:'archive:one',source:'archive' as const,license:'CC0'};
 assert.equal(normalizePlaybackSession({...saved,current:archived,queue:[archived]}).current?.source,'archive');
 assert.equal(normalizePlaybackSession({version:42,current:track}).current,null);
});

test('reload and StrictMode restore paused track, queue, position and settings without playing or erasing the snapshot',async()=>{
 reset();savePlaybackSession(saved);
 render(<React.StrictMode><App/></React.StrictMode>);
 await waitFor(()=>assert.equal(document.querySelector('.now-playing strong')?.textContent,'Resume song'));
 assert.equal(audioPlays,0);assert.equal(audio().getAttribute('src'),null);assert.equal(audio().volume,.25);
 assert.equal(readPlaybackSession().position,42);assert.equal(readPlaybackSession().queue.length,2);
 await act(async()=>clickPlay());
 await waitFor(()=>assert.equal(audio().currentTime,42));assert.equal(audioPlays,1);
 await act(async()=>{audio().currentTime=73;audio().dispatchEvent(new Event('timeupdate'));});
 await act(async()=>fireEvent.click(document.querySelector('.player .main-play')!));
 assert.equal(readPlaybackSession().position,73);
 cleanup();audioPlays=0;render(<App/>);
 assert.equal(audioPlays,0);assert.equal(readPlaybackSession().position,73);
 await act(async()=>clickPlay());await waitFor(()=>assert.equal(audio().currentTime,73));
 cleanup();
});

test('missing local file is removed from restored playback without losing queue settings or attempting playback',async()=>{
 reset();const missing={...track,id:'local:missing',source:'local' as const,url:''};savePlaybackSession({...saved,current:missing,queue:[missing,second]});
 render(<React.StrictMode><App/></React.StrictMode>);
 await waitFor(()=>assert.equal(readPlaybackSession().current,null));
 assert.equal(audioPlays,0);assert.deepEqual(readPlaybackSession().queue.map(t=>t.id),[second.id]);
 assert.equal(readPlaybackSession().volume,.25);assert.equal(readPlaybackSession().shuffle,true);
 cleanup();
});

test('a valid saved local file is checked before restore and starts only after a user gesture at the saved position',async()=>{
 reset();const {putFile,deleteFile}=await import('../src/files');
 const local={...track,id:'local:valid-resume',source:'local' as const,url:'',duration:0};
 await putFile(local.id,new File(['test audio data'],'resume.mp3',{type:'audio/mpeg'}));
 savePlaybackSession({...saved,current:local,queue:[local],position:61,duration:180});
 render(<React.StrictMode><App/></React.StrictMode>);
 await waitFor(()=>assert.equal(document.querySelector('.now-playing strong')?.textContent,'Resume song'));
 assert.equal(audioPlays,0);assert.equal(audio().getAttribute('src'),null);assert.equal(readPlaybackSession().position,61);
 await act(async()=>clickPlay());await waitFor(()=>assert.equal(audioPlays,1));
 assert.equal(audio().currentTime,61);assert.match(audio().src,/^blob:/);
 cleanup();await deleteFile(local.id);
});

test('selecting the next song resets its position and update requests flush the current position',async()=>{
 reset();savePlaybackSession({...saved,shuffle:false});render(<App/>);await act(async()=>clickPlay());
 await act(async()=>{audio().currentTime=89;audio().dispatchEvent(new Event('timeupdate'));window.dispatchEvent(new Event('wave-before-update'));});
 assert.equal(readPlaybackSession().position,89);
 await act(async()=>fireEvent.click(document.querySelector('button[aria-label="Следующий трек"]')!));
 await waitFor(()=>assert.equal(document.querySelector('.now-playing strong')?.textContent,'Second song'));
 assert.equal(audio().currentTime,0);assert.equal(readPlaybackSession().position,0);
 cleanup();
});

test('temporary network interruption resumes at the same position after connectivity returns, while user pause prevents automatic resume',async()=>{
 reset();savePlaybackSession({...saved,shuffle:false});render(<App/>);await act(async()=>clickPlay());
 await act(async()=>{audio().currentTime=66;audio().dispatchEvent(new Event('timeupdate'));online=false;window.dispatchEvent(new Event('offline'));paused.set(audio(),true);errors.set(audio(),{code:2});audio().dispatchEvent(new Event('error'));});
 assert.equal(audioPlays,1);
 await act(async()=>{online=true;window.dispatchEvent(new Event('online'));});
 await waitFor(()=>assert.equal(audioPlays,2));assert.equal(audio().currentTime,66);
 await act(async()=>fireEvent.click(document.querySelector('.player .main-play')!));
 await act(async()=>{online=false;window.dispatchEvent(new Event('offline'));online=true;window.dispatchEvent(new Event('online'));});
 assert.equal(audioPlays,2);assert.equal(audio().paused,true);
 cleanup();
});
