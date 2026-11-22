import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const endpoint =
  'https://api.openverse.org/v1/audio/?q=ambient&category=music&license_type=commercial&page_size=3';
const response = await fetch(endpoint, { headers: { Origin: 'http://localhost:4173' } });
assert.equal(response.status, 200);
assert.equal(response.headers.get('access-control-allow-origin'), '*');
const json = await response.json();
const track = json.results.find(
  (t) => t.url?.startsWith('https:') && t.duration >= 30000 && t.license === 'by',
);
assert.ok(track);
const probe = await fetch(track.url, { headers: { Range: 'bytes=0-1023' } });
assert.equal(probe.status, 206);
assert.match(probe.headers.get('content-type') || '', /^audio\//);
assert.equal((await probe.arrayBuffer()).byteLength, 1024);
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.setContent('<button>Play</button><audio preload="metadata"></audio>');
  await page.evaluate((url) => {
    const audio = document.querySelector('audio');
    audio.src = url;
    document.querySelector('button').onclick = () => audio.play();
  }, track.url);
  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForFunction(
    () => {
      const a = document.querySelector('audio');
      return a.currentTime > 0 && !a.paused;
    },
    undefined,
    { timeout: 20000 },
  );
  const media = await page
    .locator('audio')
    .evaluate((a) => ({ duration: a.duration, currentTime: a.currentTime, paused: a.paused }));
  assert.ok(media.duration > 30);
  console.log(
    JSON.stringify({
      source: 'Openverse',
      title: track.title,
      creator: track.creator,
      license: track.license_url,
      apiCors: '*',
      rangeStatus: probe.status,
      mediaType: probe.headers.get('content-type'),
      browserPlayback: media,
    }),
  );
} finally {
  await browser.close();
}
