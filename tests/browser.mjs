import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('qa',{recursive:true});
const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://localhost:4173/',{waitUntil:'networkidle',timeout:45000});
 await page.getByRole('button',{name:/Слушать /}).first().waitFor({timeout:25000});
 await page.screenshot({path:'qa/desktop.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:/Слушать /}).first().click();
 let realPlayback=false;try{await page.waitForFunction(()=>{const a=document.querySelector('audio');return a&&!a.paused&&a.currentTime>0;},{timeout:20000});realPlayback=true;}catch{}
 await page.getByRole('button',{name:'Избранное',exact:true}).click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('volna.likes')).length),1);
 await page.setViewportSize({width:393,height:852});
 await page.screenshot({path:'qa/iphone-home.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('.now-playing').click();
 await page.screenshot({path:'qa/iphone-player.png',fullPage:true});
 await page.getByRole('button',{name:'Свернуть плеер'}).click();
 await page.locator('.mobile-nav').getByRole('button',{name:'Библиотека'}).click();
 await page.getByRole('button',{name:/Мои файлы/}).filter({visible:true}).click();
 const rate=8000,n=rate*3,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.sin(i*440*2*Math.PI/rate)*1000,44+i*2);
 await page.locator('input[type=file]').setInputFiles({name:'Offline test.wav',mimeType:'audio/wav',buffer:b});
 await page.locator('.track-name').filter({hasText:'Offline test'}).waitFor({timeout:10000});
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 console.log('Offline shell ready:',await page.evaluate(async()=>{const names=await caches.keys();return Promise.all(names.map(async name=>({name,urls:(await (await caches.open(name)).keys()).map(r=>r.url)})));}));
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.mobile-nav').getByRole('button',{name:'Библиотека'}).click();
 await page.getByRole('button',{name:/Мои файлы/}).filter({visible:true}).click();
 await page.locator('.track-name').filter({hasText:'Offline test'}).click();
 await page.waitForFunction(()=>{const a=document.querySelector('audio');return a&&!a.paused&&a.currentTime>0;},{timeout:10000});
 assert.equal(errors.length,0,errors.join('\n'));
 const report={desktop:1440,iphone:393,realAudiusPlayback:realPlayback,offlineReload:true,offlineFilePlayback:true,overflow:false,pageErrors:errors};console.log(JSON.stringify(report));await writeFile('qa/report.json',JSON.stringify(report,null,2));
}catch(e){console.log('Browser failure state:',await page.content());console.log('Page errors:',errors);await page.screenshot({path:'qa/failure.png',fullPage:true});throw e;}finally{await browser.close();}
