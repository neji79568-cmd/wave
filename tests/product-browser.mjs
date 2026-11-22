import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const b = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
try {
  const context = await b.newContext({ viewport: { width: 393, height: 852 } });
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await p.locator('.mobile-nav button').last().click();
  await p.getByRole('button', { name: 'Мои файлы', exact: true }).filter({ visible: true }).click();
  const rate = 8000;
  const n = rate * 60;
  const wav = Buffer.alloc(44 + n * 2);
  wav.write('RIFF');
  wav.writeUInt32LE(36 + n * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) wav.writeInt16LE(Math.sin(i * 0.3) * 500, 44 + i * 2);
  await p
    .locator('input[type=file]')
    .first()
    .setInputFiles({ name: 'Saved test.wav', mimeType: 'audio/wav', buffer: wav });
  await p.getByRole('button', { name: 'Слушать Saved test', exact: true }).click();
  await p.waitForFunction(() => document.querySelector('audio').currentTime > 0);
  await p.evaluate(() => {
    const a = document.querySelector('audio');
    a.currentTime = 20;
    a.pause();
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() =>
    document.querySelector('.now-playing').textContent.includes('Saved test'),
  );
  assert.equal(await p.locator('audio').evaluate((a) => a.paused), true);
  await p.locator('.main-play').click();
  await p.waitForFunction(() => document.querySelector('audio').currentTime >= 20);
  await p.locator('.main-play').click();
  await p.getByRole('button', { name: 'Настройки wave' }).click();
  await p.getByRole('checkbox', { name: 'Экономия энергии' }).check();
  assert.equal(await p.locator('html').getAttribute('data-energy'), 'true');
  await p.getByRole('button', { name: 'Резервная копия', exact: true }).click();
  const download = p.waitForEvent('download');
  await p.getByRole('button', { name: 'Скачать резервную копию' }).click();
  const saved = await download;
  await mkdir('qa', { recursive: true });
  await saved.saveAs('qa/product-backup.zip');
  await p.locator('.product-modal input[type=file]').setInputFiles('qa/product-backup.zip');
  await p.getByRole('button', { name: 'Объединить с библиотекой' }).click();
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('volna.local')).length === 1);
  await p.getByRole('button', { name: 'Память', exact: true }).click();
  assert.ok(await p.locator('.storage-summary').innerText());
  await p.getByRole('checkbox', { name: 'Выбрать все офлайн-файлы' }).check();
  await p.getByRole('button', { name: /Освободить/ }).click();
  await p.getByRole('button', { name: 'Удалить файлы', exact: true }).click();
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('volna.local')).length === 0);
  await p.getByRole('button', { name: 'Резервная копия', exact: true }).click();
  await p.locator('.product-modal input[type=file]').setInputFiles('qa/product-backup.zip');
  await p.getByRole('button', { name: 'Объединить с библиотекой' }).click();
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('volna.local')).length === 1);
  await p.screenshot({ path: 'qa/settings-pro.png', fullPage: false });
  await p.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await p.locator('.mobile-nav button').last().click();
  await p.getByRole('button', { name: 'Мои файлы', exact: true }).filter({ visible: true }).click();
  await p.getByRole('button', { name: 'Слушать Saved test', exact: true }).click();
  await p.waitForFunction(() => !document.querySelector('audio').paused);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await p.screenshot({ path: 'qa/product-mobile.png', fullPage: false });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      playbackRestore: true,
      noAutoplay: true,
      energy: true,
      backupExportImport: true,
      storageDelete: true,
      restoredAudioPlays: true,
      mobileOverflow: false,
      errors,
    }),
  );
} finally {
  await b.close();
}
