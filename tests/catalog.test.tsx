import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fromApple,
  fromAudius,
  fetchArtist,
  fetchAlbum,
  search,
  suggestQuery,
  SEARCH_PAGE_SIZE,
} from '../src/api';
import { fromOpenverse, openverseSearchUrl } from '../src/openverse-api';
import {
  tracksFromArchive,
  allowedArchiveLicense,
  parseArchiveDuration,
  archiveSearchUrl,
} from '../src/archive-api';
import { request } from '../src/source-http';

const open = {
  id: 'open-test',
  title: 'Open song',
  creator: 'Artist',
  url: 'https://audio.example/song.mp3',
  thumbnail: 'https://audio.example/art.jpg',
  foreign_landing_url: 'https://audio.example/song',
  creator_url: 'https://audio.example/artist',
  license: 'by',
  license_version: '4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  category: 'music',
  duration: 210000,
  mature: false,
  audio_set: { title: 'Album', foreign_landing_url: 'https://audio.example/album' },
  attribution: 'Open song by Artist, CC BY 4.0',
};
const apple = {
  trackId: 11,
  trackName: 'Preview song',
  artistName: 'Artist',
  artistId: 12,
  collectionId: 13,
  collectionName: 'Album',
  previewUrl: 'https://audio.example/preview.m4a',
  releaseDate: '2025-06-01T12:00:00Z',
};
test('catalog metadata distinguishes full licensed tracks from previews before playback', () => {
  const preview = fromApple(apple);
  assert.equal(preview.source, 'itunes');
  assert.equal(preview.duration, 0);
  assert.equal(preview.albumId, '13');
  assert.equal(preview.artistId, '12');
  assert.equal(preview.year, 2025);
  const full = fromOpenverse(open);
  assert.equal(full.source, 'openverse');
  assert.equal(full.available, true);
  assert.equal(full.duration, 210);
  assert.equal(full.license, 'CC BY 4.0');
  assert.equal(full.attribution, open.attribution);
  assert.equal(full.albumUrl, 'https://audio.example/album');
  for (const patch of [
    { license: 'by-nc' },
    { url: 'http://audio.example/song.mp3' },
    { url: 'javascript:alert(1)' },
    { license_url: '' },
    { category: 'sound_effect' },
    { mature: true },
    { duration: 1000 },
  ])
    assert.equal(fromOpenverse({ ...open, ...patch }).available, false);
  assert.equal(fromAudius({ id: 'a', title: 'Locked', is_stream_gated: true }).available, false);
});
test('anonymous Openverse requests stay within supported page size and correctly paginate', () => {
  assert.equal(SEARCH_PAGE_SIZE.openverse, 20);
  const url = new URL(openverseSearchUrl('ambient', 40));
  assert.equal(url.searchParams.get('page_size'), '20');
  assert.equal(url.searchParams.get('page'), '3');
  assert.equal(url.searchParams.get('license_type'), 'commercial');
  assert.equal(url.searchParams.get('category'), 'music');
});
test('artist and album lookup keep catalog identity and never substitute a different artist', async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input: any) => {
    const url = String(input);
    urls.push(url);
    return new Response(
      JSON.stringify({
        results: [
          apple,
          { ...apple, trackId: 21, artistId: 22, artistName: 'Different artist', collectionId: 23 },
        ],
      }),
      { status: 200 },
    );
  };
  try {
    const track = fromApple(apple);
    assert.deepEqual(
      (await fetchArtist(track)).map((t) => t.id),
      ['it:11'],
    );
    assert.deepEqual(
      (await fetchAlbum(track)).map((t) => t.id),
      ['it:11'],
    );
    assert.ok(urls.some((u) => u.includes('lookup?id=12')));
    assert.ok(urls.some((u) => u.includes('lookup?id=13')));
  } finally {
    globalThis.fetch = original;
  }
});
test('Openverse results preserve licensing and skip non-music records', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ results: [open, { ...open, id: 'bad', license: 'by-nc' }, open] }),
      { status: 200 },
    );
  try {
    const tracks = await search('unique-unit-openverse-query', 'openverse');
    assert.equal(tracks.length, 1);
    assert.equal(tracks[0].licenseUrl, open.license_url);
    assert.equal(tracks[0].duration, 210);
  } finally {
    globalThis.fetch = original;
  }
});
test('Archive adapter only accepts explicit open licenses and public audio files', () => {
  const metadata = {
    title: 'Open album',
    creator: 'Netlabel artist',
    mediatype: 'audio',
    licenseurl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    date: '2024-10-12',
  };
  const files = [
    { name: '01 - First.mp3', title: 'First', size: '1024', length: '3:05', source: 'original' },
    {
      name: 'First_128kb.mp3',
      original: '01 - First.mp3',
      size: '512',
      length: '3:05',
      source: 'derivative',
    },
    { name: 'secret.mp3', size: '20', private: 'true' },
    { name: '../outside.mp3', size: '20' },
    { name: 'art.jpg', size: '20' },
  ];
  const tracks = tracksFromArchive('open_album', { metadata, files });
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].duration, 185);
  assert.equal(tracks[0].sizeBytes, 1024);
  assert.equal(tracks[0].source, 'archive');
  assert.equal(tracks[0].year, 2024);
  assert.match(tracks[0].url, /archive\.org\/download\/open_album\/01%20-%20First\.mp3$/);
  assert.deepEqual(
    tracksFromArchive('open_album', {
      metadata: { ...metadata, 'access-restricted-item': 'true' },
      files,
    }),
    [],
  );
  assert.deepEqual(
    tracksFromArchive('open_album', {
      metadata: { ...metadata, licenseurl: 'https://example.com/no-rights' },
      files,
    }),
    [],
  );
  assert.equal(
    allowedArchiveLicense('https://creativecommons.org.evil.example/licenses/by/4.0/'),
    undefined,
  );
  assert.equal(parseArchiveDuration('1:02:03'), 3723);
  assert.equal(parseArchiveDuration(125.5), 125.5);
  assert.equal(parseArchiveDuration('not duration'), 0);
  const q = new URL(archiveSearchUrl('test") OR *:*', 60));
  assert.match(q.searchParams.get('q')!, /collection:netlabels/);
  assert.equal(q.searchParams.get('page'), '2');
});
test('suggestions correct known names without guessing unrelated music', () => {
  assert.ok(suggestQuery('miyag').includes('Miyagi'));
  assert.deepEqual(suggestQuery('dragni86'), ['Драгни']);
  assert.deepEqual(suggestQuery('Мияги'), ['Miyagi']);
  assert.deepEqual(suggestQuery('Miyagi'), []);
  assert.deepEqual(suggestQuery('unknown totally unrelated song'), []);
});
test('source request respects cancellation and reports rate limits', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 429 });
  try {
    await assert.rejects(request('https://unit.example/'), /ограничил запросы/);
    globalThis.fetch = async (_input: any, options: any) =>
      new Promise((_resolve, reject) => {
        if (options.signal.aborted) reject(options.signal.reason);
        else options.signal.addEventListener('abort', () => reject(options.signal.reason));
      });
    const controller = new AbortController(),
      promise = request('https://unit.example/abort', controller.signal);
    controller.abort();
    await assert.rejects(promise, (e) => (e as Error).name === 'AbortError');
  } finally {
    globalThis.fetch = original;
  }
});
