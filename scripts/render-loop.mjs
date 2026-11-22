import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.setContent('<canvas width="960" height="540"></canvas>');
  const base64 = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(24);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/mp4;codecs=avc1.42001E',
      videoBitsPerSecond: 650000,
    });
    const chunks = [];
    const done = new Promise((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = resolve;
    });
    const started = performance.now();
    let frame;
    function draw(now) {
      const elapsed = now - started;
      const t = (elapsed / 8000) * Math.PI * 2;
      ctx.fillStyle = '#100719';
      ctx.fillRect(0, 0, 960, 540);
      const glow = ctx.createRadialGradient(610 + Math.sin(t) * 50, 280, 0, 620, 280, 550);
      glow.addColorStop(0, '#742f9655');
      glow.addColorStop(0.5, '#36134d44');
      glow.addColorStop(1, '#0d0618');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 960, 540);
      ctx.globalCompositeOperation = 'screen';
      for (let j = 0; j < 32; j++) {
        ctx.beginPath();
        for (let x = 0; x <= 960; x += 4) {
          const y =
            280 +
            Math.sin((x / 960) * 7 + t + j * 0.08) * 90 * Math.sin((x / 960) * Math.PI) +
            Math.cos((x / 960) * 11 - t + j * 0.11) * 35 +
            (j - 16) * 3;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${265 + j * 0.6},90%,${48 + j * 0.7}%,${0.15 + Math.sin((j / 32) * Math.PI) * 0.3})`;
        ctx.lineWidth = j === 16 ? 2 : 1;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (elapsed < 8000) frame = requestAnimationFrame(draw);
      else recorder.stop();
    }
    draw(started);
    recorder.start();
    frame = requestAnimationFrame(draw);
    await done;
    cancelAnimationFrame(frame);
    stream.getTracks().forEach((t) => t.stop());
    const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/mp4' }).arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192)
      s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(s);
  });
  const bytes = Buffer.from(base64, 'base64');
  await writeFile('public/wave-loop.mp4', bytes);
  console.log(`Rendered 8-second H.264 VJ loop: ${bytes.length} bytes`);
} finally {
  await browser.close();
}
