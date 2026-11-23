import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Script, runInNewContext } from 'node:vm';

// No private manifests, hosting credentials, or audio are required to test this
// noindex, metadata-only, public GitHub preview. This runs for every publish.
const hub = readFileSync('pwr-music/index.html','utf8');
const finder = readFileSync('pwr-music/find.html','utf8');
assert.match(hub, /noindex,nofollow,noarchive/);
assert.match(finder, /noindex,nofollow,noarchive/);
assert.match(hub, /Search all 297 \/ Buscar todo \(297\)/);
assert.match(hub, /https:\/\/music\.amazon\.com\/albums\/B0HJFBDZ8Z/);
assert.doesNotMatch(hub, /drive\.google\.com|artist\.amuse\.io|raw_master|_master\.wav|<audio[\s>]/i);

const payload = finder.match(/<script type="application\/json" id="public-catalog">([^<]+)<\/script>/)?.[1];
assert.ok(payload,'Published metadata search data is missing');
const rows = JSON.parse(payload);
assert.equal(rows.length,297,'The published finder must include exactly 297 search entries');
assert.equal(rows.filter(x=>x.type==='song').length,81);
assert.equal(rows.filter(x=>x.type==='release').length,203);
assert.equal(rows.filter(x=>x.type==='spotlight').length,13);
assert.equal(rows.filter(x=>x.type==='song' && x.spotify).length,71);
assert.equal(rows.filter(x=>x.type==='release' && x.matched).length,7);

const sourcePicks = [...finder.matchAll(/<article class="first-pick" role="listitem" data-static-first-listen="([A-Z0-9]{12})">([\s\S]*?)<\/article>/g)]
  .map(m=>({isrc:m[1],url:m[2].match(/href="(https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]{22})"/)?.[1]}));
const landingPicks = [...hub.matchAll(/<div class="listen-tile" data-first-listen-isrc="([A-Z0-9]{12})">([\s\S]*?)<\/div><\/div>/g)]
  .map(m=>({isrc:m[1],url:m[2].match(/href="(https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]{22})"/)?.[1],id:m[2].match(/data-play-spotify="([A-Za-z0-9]{22})"/)?.[1]}));
assert.equal(sourcePicks.length,7,'The published finder must contain seven exact recording picks');
assert.equal(landingPicks.length,7,'The front page must expose the same seven first listens');
assert.equal(new Set(landingPicks.map(x=>x.isrc)).size,7);
assert.deepEqual(landingPicks.map(({isrc,url})=>({isrc,url})),sourcePicks,
  'Landing songs must reproduce the seven exact links already in the published finder');
for (const pick of landingPicks) {
  assert.equal(pick.url, 'https://open.spotify.com/track/'+pick.id);
  assert.ok(rows.some(x=>x.type==='song' && x.isrc===pick.isrc && x.spotify===pick.url),
    'Every homepage Spotify button must be backed by identified published song metadata');
}
assert.equal(landingPicks.filter(x=>x.isrc==='SE6132618973').length,1,
  'Include the separately verified single exactly once');

const js = hub.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'Landing navigation/player script is missing');
new Script(js,{filename:'pwr-music/index.html'});
const fn = js.match(/function quickSearchUrl\(file, query\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(fn,'Landing search URL builder is missing');
function searchUrl(hostname,query) {
  return runInNewContext(fn+';quickSearchUrl("find.html",'+JSON.stringify(query)+')',{
    previewRoot:'https://htmlpreview.github.io/?https://github.com/hbue4587/hbue4587/blob/main/pwr-music/',
    location:{hostname}, URLSearchParams
  });
}
const query='VIBRA CONTIGO';
const proxyUrl=searchUrl('htmlpreview.github.io',query);
const localUrl=searchUrl('hbue4587.github.io',query);
assert.ok(proxyUrl.startsWith('https://htmlpreview.github.io/?https://github.com/hbue4587/hbue4587/blob/main/pwr-music/find.html#'));
assert.ok(localUrl.startsWith('./find.html#'));
assert.equal(new URLSearchParams(proxyUrl.split('#')[1]).get('q'),query);
assert.equal(new URLSearchParams(localUrl.split('#')[1]).get('q'),query);
console.log('PWR public preview validated: 7 official Spotify recordings, 297 searchable records, direct combined search, proxy/Pages navigation and safe noindex markup.');
