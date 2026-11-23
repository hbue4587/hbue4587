import assert from 'node:assert/strict';
import { cp, copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// Build two distinct, locally openable read-only preview bundles from the
// exact public HTML already validated elsewhere. This does NOT deploy to
// pwrmusic.net/hmiguel.com or replace WordPress and WooCommerce.
const sourceRoot = resolve(process.argv[2] ?? 'pwr-music');
const outputRoot = resolve(process.argv[3] ?? '.tmp/public-site-previews');
const expected = [
  'index.html', 'label.html', 'henry-miguel.html', 'find.html',
  'albums.html', 'songs.html', 'discography.html', 'verified-songs.csv',
  'verified-releases.csv'
];
for (const name of expected) {
  assert.ok((await stat(join(sourceRoot, name))).size > 100,
    'Missing public preview input: ' + name);
}
const sourceLabel = await readFile(join(sourceRoot, 'label.html'), 'utf8');
const sourceHenry = await readFile(join(sourceRoot, 'henry-miguel.html'), 'utf8');
const publishedFinder = await readFile(join(sourceRoot, 'find.html'), 'utf8');
assert.match(sourceLabel, /<title>PWR Music — Public Released Music Preview<\/title>/);
assert.match(sourceHenry, /<title>Henry Miguel — Public Artist Music Preview<\/title>/);
assert.match(publishedFinder, /<script type="application\/json" id="public-catalog">/);
for (const html of [sourceLabel, sourceHenry, publishedFinder]) {
  assert.match(html, /noindex,nofollow,noarchive/,
    'These packages must be non-indexable previews');
  assert.doesNotMatch(html, /https:\/\/(?:drive|docs)\.google\.com|artist\.amuse\.io|_master\.wav|raw_master|<audio[\s>]/i,
    'Never package private or unlicensed audio');
}
const catalogMatch = publishedFinder.match(/<script type="application\/json" id="public-catalog">([^<]+)<\/script>/);
const catalog = JSON.parse(catalogMatch?.[1] ?? '[]');
assert.equal(catalog.filter(item => item.type === 'release').length, 203);
assert.equal(catalog.filter(item => item.type === 'song').length, 81);
assert.equal(catalog.filter(item => item.type === 'song' && item.spotify).length, 71);
await rm(outputRoot, { recursive: true, force: true });
for (const site of [
  { folder: 'pwrmusic', entry: 'label.html', title: 'PWR Music label' },
  { folder: 'hmiguel', entry: 'henry-miguel.html', title: 'Henry Miguel artist' }
]) {
  const dest = join(outputRoot, site.folder);
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(sourceRoot, { withFileTypes: true })) {
    if (entry.isFile() && (entry.name.endsWith('.html') || entry.name.endsWith('.csv'))) {
      await copyFile(join(sourceRoot, entry.name), join(dest, entry.name));
    }
  }
  // Distinct homepages; all shared cross-links and verified catalog pages remain intact.
  await copyFile(join(sourceRoot, site.entry), join(dest, 'index.html'));
  await writeFile(join(dest, 'READ-ME-FIRST.txt'),
    site.title + ' — review-only released-metadata preview\n\n' +
    'Open index.html in your browser. The accompanying search, album, song and\n' +
    'discography pages are included alongside it. Spotify links need internet.\n\n' +
    'This is not a live site or production-ready commerce replacement. Existing\n' +
    'WordPress stores, checkout, logins, downloads, DNS and 86 old URLs remain\n' +
    'untouched. No private Drive audio or unreleased songs are included.\n',
    'utf8');
  assert.equal(await readFile(join(dest, 'index.html'), 'utf8'),
    site.folder === 'pwrmusic' ? sourceLabel : sourceHenry);
  for (const name of expected) {
    assert.ok((await stat(join(dest, name))).size > 100,
      site.folder + ': packaged page missing: ' + name);
  }
}
console.log('Prepared two distinct non-indexable public previews, ' +
  '203 published releases, 81 ISRC songs, 71 exact Spotify song links; no hosting or commerce changes.');