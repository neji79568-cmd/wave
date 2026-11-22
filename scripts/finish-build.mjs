import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const assets = (await readdir('dist/assets'))
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => './assets/' + f);
const shell = [
  './',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest',
  './wave-loop.mp4',
  './vj-poster.svg',
  ...assets,
];
let sw = await readFile('public/sw.js', 'utf8');
sw = sw.replace(
  "'volna-shell-v1'",
  JSON.stringify(
    'volna-' +
      createHash('sha256')
        .update(assets.join() + sw)
        .digest('hex')
        .slice(0, 12),
  ),
);
// Match the declaration, not its whitespace: formatting must not break offline builds.
const precacheDeclaration = /const PRECACHE_ASSETS = \[[\s\S]*?\];/;
if (!precacheDeclaration.test(sw)) {
  throw new Error('Service worker is missing the PRECACHE_ASSETS declaration');
}
sw = sw.replace(precacheDeclaration, `const PRECACHE_ASSETS = ${JSON.stringify(shell)};`);
await writeFile('dist/sw.js', sw);
console.log('Offline shell: ' + shell.length + ' assets precached');
