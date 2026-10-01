// YouTube: youtube.com's own API (InnerTube, /youtubei/v1/…) as its website calls it, signed in with your account
// when you are (and Use Your YouTube Account is on); otherwise subscriptions, likes, history and Watch Later live on
// this phone. SponsorBlock, Return YouTube Dislike and DeArrow are optional.
const $ = s => document.querySelector(s);
const YT = 'https://www.youtube.com';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const WEB = { clientName: 'WEB', clientVersion: '2.20250925.01.00', hl: 'en', gl: 'US' };
const IOS = { clientName: 'IOS', clientVersion: '20.10.4', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82', hl: 'en', gl: 'US' };

// ---------- Settings (a native screen), saved as 'settings'.
const SETTINGS = [
  { header: 'Account', rows: [
    { id: 'useAccount', title: 'Use Your YouTube Account', type: 'toggle', default: true },
  ], footer: 'On: Home, Subscriptions, likes and subscribing use your YouTube account when you’re signed in. Off (or signed out): they stay on this phone, and YouTube doesn’t see them.' },
  { header: 'Feeds', rows: [
    { id: 'layout', title: 'Layout', type: 'picker', default: 'large', options: ['large', 'compact', 'grid'], labels: ['Large', 'Compact', 'Grid'] },
    { id: 'hideShorts', title: 'Hide Shorts', type: 'toggle', default: false },
    { id: 'hideLive', title: 'Hide Live Streams', type: 'toggle', default: false },
    { id: 'hideWatched', title: 'Hide Watched Videos', type: 'toggle', default: false },
    { id: 'dimWatched', title: 'Dim Watched Videos', type: 'toggle', default: true },
    { id: 'progress', title: 'Progress Bars', type: 'toggle', default: true },
    { id: 'thumbs', title: 'Thumbnails', type: 'toggle', default: true },
    { id: 'avatars', title: 'Channel Pictures', type: 'toggle', default: true },
    { id: 'minLength', title: 'Hide Videos Shorter Than', type: 'picker', default: '0', options: ['0', '60', '180', '600'], labels: ['Off', '1 minute', '3 minutes', '10 minutes'] },
    { id: 'mutedChannels', title: 'Muted Channels', type: 'input', default: '', placeholder: 'Channel names, …' },
    { id: 'muted', title: 'Muted Words', type: 'input', default: '', placeholder: 'reaction, …' },
  ], footer: 'Muted channels and words hide videos everywhere (separate with commas).' },
  { header: 'Playback', rows: [
    { id: 'autoplay', title: 'Autoplay', type: 'toggle', default: true },
    { id: 'autoNext', title: 'Play Next Video Automatically', type: 'toggle', default: false },
    { id: 'speed', title: 'Speed', type: 'picker', default: '1', options: ['0.5', '0.75', '1', '1.25', '1.5', '1.75', '2'], labels: ['0.5×', '0.75×', 'Normal', '1.25×', '1.5×', '1.75×', '2×'] },
    { id: 'resume', title: 'Resume Where You Left Off', type: 'toggle', default: true },
    { id: 'loop', title: 'Loop', type: 'toggle', default: false },
    { id: 'captions', title: 'Captions', type: 'toggle', default: false },
  ] },
  { header: 'SponsorBlock', rows: [
    { id: 'sb', title: 'Skip Segments', type: 'toggle', default: true },
    { id: 'sb_sponsor', title: 'Sponsors', type: 'toggle', default: true },
    { id: 'sb_selfpromo', title: 'Self-Promotion', type: 'toggle', default: true },
    { id: 'sb_interaction', title: 'Like and Subscribe Reminders', type: 'toggle', default: true },
    { id: 'sb_intro', title: 'Intros', type: 'toggle', default: false },
    { id: 'sb_outro', title: 'Endcards and Credits', type: 'toggle', default: false },
    { id: 'sb_preview', title: 'Previews and Recaps', type: 'toggle', default: false },
    { id: 'sb_filler', title: 'Tangents and Filler', type: 'toggle', default: false },
    { id: 'sb_music_offtopic', title: 'Non-Music in Music Videos', type: 'toggle', default: false },
    { id: 'sbAuto', title: 'Skip Automatically', type: 'toggle', default: true },
  ], footer: 'Segments come from SponsorBlock (sponsor.ajay.app), marked by viewers. Off automatic skipping, a Skip button shows instead.' },
  { header: 'Community Add-ons', rows: [
    { id: 'ryd', title: 'Show Dislikes', type: 'toggle', default: true },
    { id: 'dearrow', title: 'DeArrow Titles', type: 'toggle', default: false },
    { id: 'dearrowThumbs', title: 'DeArrow Thumbnails', type: 'toggle', default: false },
  ], footer: 'Dislikes are estimates from Return YouTube Dislike. DeArrow replaces clickbait titles and thumbnails with ones viewers submitted.' },
  { header: 'Watch Page', rows: [
    { id: 'comments', title: 'Comments', type: 'toggle', default: true },
    { id: 'related', title: 'Related Videos', type: 'toggle', default: true },
    { id: 'chapters', title: 'Chapters', type: 'toggle', default: true },
    { id: 'expandDesc', title: 'Expand Descriptions', type: 'toggle', default: false },
  ] },
  { header: 'Privacy', rows: [
    { id: 'history', title: 'Keep Watch History', type: 'toggle', default: true },
  ], footer: 'Watch history is kept on this phone (for progress bars and You › History).' },
  { header: 'Look', rows: [
    { id: 'haptics', title: 'Haptics', type: 'toggle', default: true },
  ], footer: 'Pull down on a page to see a change.' },
];
const ROWS = SETTINGS.flatMap(s => s.rows);
let S = null;
async function settings() {
  S = { ...Object.fromEntries(ROWS.map(r => [r.id, r.default])), ...(await fruitfox.storage.get('settings')) };
  const root = document.documentElement;
  root.classList.toggle('compact', S.layout === 'compact');
  root.classList.toggle('grid2', S.layout === 'grid');
  root.classList.toggle('noThumbs', !S.thumbs);
  root.classList.toggle('dimWatched', !!S.dimWatched);
  return S;
}
async function openSettings() {
  const s = await settings();
  fruitfox.ui.sheet({ title: 'Settings', sections: SETTINGS.map(sec => ({ header: sec.header, footer: sec.footer, rows: sec.rows.map(r =>
    ({ ...r, boolValue: r.type === 'toggle' ? !!s[r.id] : undefined, value: r.type === 'toggle' ? undefined : String(s[r.id] ?? '') })) })) }, 'Settings');
}
fruitfox.on('screen', async j => {
  const { id, value } = JSON.parse(j), r = ROWS.find(r => r.id === id);
  if (!r) return;
  const s = await settings();
  s[id] = r.type === 'toggle' ? value === 'true' : value;
  await fruitfox.storage.set('settings', s);
  await settings();
});
const haptic = k => S?.haptics && fruitfox.ui.haptic(k);
const list = v => String(v || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);

// ---------- Signed in: InnerTube wants a SAPISIDHASH (SHA-1 of time, the SAPISID cookie and the origin).
function sha1(str) {
  const b = new TextEncoder().encode(str), l = b.length, w = new Uint32Array(((l + 8 >> 6) + 1) * 16);
  for (let i = 0; i < l; i++) w[i >> 2] |= b[i] << (24 - (i % 4) * 8);
  w[l >> 2] |= 0x80 << (24 - (l % 4) * 8); w[w.length - 1] = l * 8;
  let [a, bb, c, d, e] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const x = new Uint32Array(80), rol = (n, s) => (n << s) | (n >>> (32 - s));
  for (let i = 0; i < w.length; i += 16) {
    for (let t = 0; t < 80; t++) x[t] = t < 16 ? w[i + t] : rol(x[t - 3] ^ x[t - 8] ^ x[t - 14] ^ x[t - 16], 1);
    let [A, B, C, D, E] = [a, bb, c, d, e];
    for (let t = 0; t < 80; t++) {
      const f = t < 20 ? (B & C) | (~B & D) : t < 40 ? B ^ C ^ D : t < 60 ? (B & C) | (B & D) | (C & D) : B ^ C ^ D;
      const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const tmp = (rol(A, 5) + f + E + k + x[t]) >>> 0; E = D; D = C; C = rol(B, 30) >>> 0; B = A; A = tmp;
    }
    a = (a + A) >>> 0; bb = (bb + B) >>> 0; c = (c + C) >>> 0; d = (d + D) >>> 0; e = (e + E) >>> 0;
  }
  return [a, bb, c, d, e].map(n => n.toString(16).padStart(8, '0')).join('');
}
async function sapisid() { return (await fruitfox.cookie('SAPISID', 'www.youtube.com')) || (await fruitfox.cookie('__Secure-3PAPISID', 'www.youtube.com')); }
async function signedIn() { return !!(await sapisid()); }
async function account() { return S.useAccount && await signedIn(); }
async function api(endpoint, body, client = WEB, ua) {
  const app = client !== WEB;  // the iOS app's client: signed out, as that app would send it
  const headers = { 'Content-Type': 'application/json', ...(app ? {} : { 'X-Origin': YT }) };
  if (ua) headers['User-Agent'] = ua;
  const sap = client === WEB && S?.useAccount !== false && await sapisid();
  if (sap) { const ts = Math.floor(Date.now() / 1000); headers.Authorization = `SAPISIDHASH ${ts}_${sha1(`${ts} ${sap} ${YT}`)}`; headers['X-Goog-AuthUser'] = '0'; }
  const r = await fruitfox.fetch(`${YT}/youtubei/v1/${endpoint}?prettyPrint=false`, { method: 'POST', headers, cookies: !app, body: JSON.stringify({ context: { client }, ...body }) });
  if (!r.ok) { fruitfox.log(`${endpoint} → ${r.status} ${r.body.slice(0, 200)}`); throw new Error(`YouTube answered ${r.status}`); }
  return r.json();
}

// ---------- Reading InnerTube responses.
function find(o, key, out = []) {
  if (Array.isArray(o)) for (const x of o) find(x, key, out);
  else if (o && typeof o === 'object') for (const k in o) { if (k === key) out.push(o[k]); find(o[k], key, out); }
  return out;
}
const text = t => t == null ? '' : typeof t === 'string' ? t : t.simpleText ?? t.content ?? t.runs?.map(r => r.text).join('') ?? '';
const big = thumbs => (thumbs || []).reduce((a, b) => (b.width || 0) >= (a?.width || 0) ? b : a, null)?.url?.replace(/^\/\//, 'https://');
const secs = d => String(d || '').split(':').reduce((n, x) => n * 60 + (+x || 0), 0);

/// Every video in a response, whatever shape YouTube used (videoRenderer, the newer lockupViewModel, Shorts).
function videos(o, out = []) {
  if (Array.isArray(o)) { for (const x of o) videos(x, out); return out; }
  if (!o || typeof o !== 'object') return out;
  for (const k in o) {
    const v = o[k];
    if (['videoRenderer', 'compactVideoRenderer', 'gridVideoRenderer', 'playlistVideoRenderer', 'playlistPanelVideoRenderer'].includes(k) && v.videoId) {
      const owner = v.ownerText || v.shortBylineText || v.longBylineText, badges = JSON.stringify(v.badges || v.thumbnailOverlays || '');
      out.push({ id: v.videoId, title: text(v.title), channel: text(owner), channelId: owner?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId,
        avatar: big(v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails || v.channelThumbnail?.thumbnails),
        thumb: big(v.thumbnail?.thumbnails), duration: text(v.lengthText), views: text(v.shortViewCountText || v.viewCountText), published: text(v.publishedTimeText),
        short: !!v.navigationEndpoint?.reelWatchEndpoint, live: /LIVE/.test(badges) || /watching/.test(text(v.viewCountText)), upcoming: !!v.upcomingEventData });
    } else if (k === 'lockupViewModel' && /VIDEO/.test(v.contentType || '')) {
      const m = v.metadata?.lockupMetadataViewModel, rows = m?.metadata?.contentMetadataViewModel?.metadataRows || [];
      const parts = rows.map(r => (r.metadataParts || []).map(p => text(p.text)).filter(Boolean));
      const badge = find(v.contentImage, 'thumbnailBadgeViewModel').map(b => b.text).find(Boolean) || '';
      out.push({ id: v.contentId, title: text(m?.title), channel: parts[0]?.[0] || '', channelId: find(m, 'browseId').find(b => /^UC/.test(b)),
        avatar: find(m?.image, 'sources')[0]?.[0]?.url, thumb: big(v.contentImage?.thumbnailViewModel?.image?.sources), duration: /:/.test(badge) ? badge : '',
        views: parts[1]?.[0] || '', published: parts[1]?.[1] || '', live: badge === 'LIVE', short: false });
    } else if (k === 'shortsLockupViewModel') {
      const id = find(v, 'reelWatchEndpoint')[0]?.videoId || v.entityId?.replace('shorts-shelf-item-', '');
      if (id) out.push({ id, title: text(v.overlayMetadata?.primaryText), views: text(v.overlayMetadata?.secondaryText), thumb: v.thumbnail?.sources?.[0]?.url, short: true });
    } else if (k === 'reelItemRenderer') {
      out.push({ id: v.videoId, title: text(v.headline), views: text(v.viewCountText), thumb: big(v.thumbnail?.thumbnails), short: true });
    } else videos(v, out);
  }
  return out;
}
function channels(o) {
  return find(o, 'channelRenderer').map(c => ({ id: c.channelId, name: text(c.title), avatar: big(c.thumbnail?.thumbnails),
    subs: text(c.videoCountText) || text(c.subscriberCountText), handle: text(c.subscriberCountText) }));
}
/// The token for the next page (a continuationItemRenderer at the end of a list).
const nextToken = o => find(o, 'continuationItemRenderer').map(c => find(c, 'token')[0]).filter(Boolean).at(-1);

// ---------- Kept on this phone.
async function local(key, fallback) { return (await fruitfox.storage.get(key)) ?? fallback; }
async function positions() { return local('positions', {}); }
async function savePosition(id, t, d) {
  const p = await positions(); p[id] = [Math.floor(t), Math.floor(d)];
  const keys = Object.keys(p); if (keys.length > 800) keys.slice(0, keys.length - 800).forEach(k => delete p[k]);
  fruitfox.storage.set('positions', p);
}
async function addToList(key, v, on = true, cap = 500) {
  const l = (await local(key, [])).filter(x => x.id !== v.id);
  if (on) l.unshift(slim(v));
  await fruitfox.storage.set(key, l.slice(0, cap));
}
const slim = v => ({ id: v.id, title: v.title, channel: v.channel, channelId: v.channelId, avatar: v.avatar, thumb: v.thumb, duration: v.duration, views: v.views, published: v.published, short: v.short });
async function localSubs() { return local('subs', []); }

// ---------- DeArrow (crowdsourced titles and thumbnails) and filters.
const branding = {};
async function dearrow(vs) {
  if (!S.dearrow && !S.dearrowThumbs) return;
  await Promise.all(vs.filter(v => !(v.id in branding)).slice(0, 40).map(async v => {
    try { branding[v.id] = (await fruitfox.fetch(`https://sponsor.ajay.app/api/branding?videoID=${v.id}`)).json(); } catch { branding[v.id] = null; }
  }));
  for (const v of vs) {
    const b = branding[v.id]; if (!b) continue;
    const t = b.titles?.find(t => !t.original && (t.locked || t.votes >= 0))?.title;
    if (S.dearrow && t) v.title = t.replace(/(^|\s)>(\S)/g, '$1$2');
    const th = b.thumbnails?.find(t => !t.original && (t.locked || t.votes >= 0));
    if (S.dearrowThumbs && th?.timestamp != null) v.thumb = `https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=${v.id}&time=${th.timestamp}`;
  }
}
async function filter(vs) {
  const pos = await positions(), mc = list(S.mutedChannels), mw = list(S.muted), seen = new Set();
  return vs.filter(v => {
    if (!v.id || seen.has(v.id)) return false; seen.add(v.id);
    if (S.hideShorts && v.short) return false;
    if (S.hideLive && (v.live || v.upcoming)) return false;
    if (+S.minLength && v.duration && secs(v.duration) < +S.minLength) return false;
    if (S.hideWatched && pos[v.id] && pos[v.id][0] > pos[v.id][1] * 0.9) return false;
    if (mc.includes((v.channel || '').toLowerCase())) return false;
    const t = (v.title || '').toLowerCase();
    return !mw.some(w => t.includes(w));
  });
}

// ---------- Video cards, like YouTube's.
async function cards(vs, { row = false } = {}) {
  const pos = await positions();
  return vs.map(v => {
    if (v.short) return '';
    const p = pos[v.id], pct = p && p[1] ? Math.min(100, p[0] / p[1] * 100) : 0;
    const meta = [v.channel, v.views, v.published].filter(Boolean).join(' · ');
    return `<div class="v tappable ${row ? 'row-v' : ''} ${pct > 90 ? 'watched' : ''}" data-v="${esc(v.id)}">
      <div class="thumbw"><img alt="" loading="lazy" src="${esc(v.thumb || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`)}">
        ${v.live ? '<span class="dur live">LIVE</span>' : v.duration ? `<span class="dur">${esc(v.duration)}</span>` : ''}
        ${S.progress && pct > 2 ? `<span class="prog" style="width:${pct}%"></span>` : ''}</div>
      <div class="vmeta">${S.avatars && v.avatar ? `<img alt="" class="av" data-ch="${esc(v.channelId || '')}" src="${esc(v.avatar)}">` : ''}
        <div class="grow"><div class="vt">${esc(v.title)}</div><div class="vs">${esc(meta)}</div></div>
        <button class="vmore" data-menu>⋮</button></div></div>`;
  }).join('');
}
function shortsShelf(vs) {
  const s = vs.filter(v => v.short);
  if (!s.length || S.hideShorts) return '';
  return `<div class="shelf-title">Shorts</div><div class="shelf">${s.map(v => `<div class="short tappable" data-short="${esc(v.id)}">
    <div class="st"><img alt="" loading="lazy" src="${esc(v.thumb || `https://i.ytimg.com/vi/${v.id}/oar2.jpg`)}"><div class="sc">${esc(v.title)}</div></div></div>`).join('')}</div>`;
}
/// Renders `vs` into `el` (appending), remembering them for taps.
const known = new Map();
async function show(el, vs, { append = false, row = false } = {}) {
  vs = await filter(vs);
  await dearrow(vs);
  vs.forEach(v => known.set(v.id, v));
  const html = (append ? '' : shortsShelf(vs)) + await cards(vs, { row });
  if (append) el.insertAdjacentHTML('beforeend', html); else el.innerHTML = html || '<div class="center secondary">No videos here.</div>';
}
function wireVideos(el) {
  el.addEventListener('click', async e => {
    const sh = e.target.closest('[data-short]');
    if (sh) return openShort(sh.dataset.short);
    const card = e.target.closest('[data-v]'); if (!card) return;
    const v = known.get(card.dataset.v);
    if (e.target.closest('[data-menu]')) return videoMenu(v);
    const ch = e.target.closest('[data-ch]');
    if (ch?.dataset.ch) return fruitfox.ui.push('channel.html?id=' + ch.dataset.ch, v.channel);
    haptic('light'); watch(v);
  });
}
async function watch(v) { await fruitfox.storage.set('video', v); fruitfox.ui.push('watch.html?v=' + v.id, ''); }
async function videoMenu(v) {
  const wl = (await local('watchLater', [])).some(x => x.id === v.id);
  const pick = await fruitfox.ui.menu([
    { id: 'wl', title: wl ? 'Remove from Watch Later' : 'Save to Watch Later' }, { id: 'share', title: 'Share' },
    ...(v.channelId ? [{ id: 'ch', title: `Go to ${v.channel}` }] : []),
    { id: 'mute', title: `Don’t Show ${v.channel || 'This Channel'}`, destructive: true },
  ], v.title);
  if (pick === 'wl') { await addToList('watchLater', v, !wl); fruitfox.ui.toast(wl ? 'Removed from Watch Later' : 'Saved to Watch Later'); }
  if (pick === 'share') fruitfox.ui.share(`https://youtu.be/${v.id}`);
  if (pick === 'ch') fruitfox.ui.push('channel.html?id=' + v.channelId, v.channel);
  if (pick === 'mute' && v.channel) { S.mutedChannels = [S.mutedChannels, v.channel].filter(Boolean).join(', '); await fruitfox.storage.set('settings', S); fruitfox.ui.toast(`Won’t show ${v.channel}`); }
}

// ---------- Subscriptions on this phone: each channel's feed (/feeds/videos.xml, the newest 15) merged, newest first.
async function localFeed() {
  const subs = await localSubs();
  const feeds = await Promise.all(subs.map(async c => {
    try {
      const x = new DOMParser().parseFromString((await fruitfox.fetch(`${YT}/feeds/videos.xml?channel_id=${c.id}`)).body, 'text/xml');
      return [...x.querySelectorAll('entry')].map(e => {
        const id = e.querySelector('videoId')?.textContent, link = e.querySelector('link')?.getAttribute('href') || '';
        const when = new Date(e.querySelector('published')?.textContent);
        return { id, title: e.querySelector('title')?.textContent, channel: c.name, channelId: c.id, avatar: c.avatar, short: link.includes('/shorts/'),
          thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, views: (+e.querySelector('statistics')?.getAttribute('views') || 0).toLocaleString() + ' views',
          published: ago(when), at: +when };
      });
    } catch { return []; }
  }));
  return feeds.flat().sort((a, b) => b.at - a.at);
}
const ago = d => { const s = (Date.now() - d) / 1000; const u = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']].find(([n]) => s >= n) || [1, 'second']; const n = Math.max(1, Math.floor(s / u[0])); return `${n} ${u[1]}${n > 1 ? 's' : ''} ago`; };
async function subscribe(c, on) {
  if (await account()) {
    await api(on ? 'subscription/subscribe' : 'subscription/unsubscribe', { channelIds: [c.id] });
  } else {
    const l = (await localSubs()).filter(x => x.id !== c.id);
    if (on) l.push({ id: c.id, name: c.name, avatar: c.avatar });
    await fruitfox.storage.set('subs', l.sort((a, b) => a.name.localeCompare(b.name)));
  }
  haptic(on ? 'success' : 'light');
}

/// Loads more when the end of the page comes near.
function onNearEnd(f) { let busy = false; addEventListener('scroll', async () => { if (busy || innerHeight + scrollY < document.body.scrollHeight - 1500) return; busy = true; try { await f(); } finally { busy = false; } }, { passive: true }); }
function errorHTML(e) { return `<div class="center"><div class="headline">Couldn’t load YouTube</div><div class="secondary">${esc(e.message)}</div></div>`; }

fruitfox.on('button', id => {
  if (id === 'settings') openSettings();
  if (id === 'search') fruitfox.ui.push('search.html', 'Search');
});
const BUTTONS = [{ id: 'search', symbol: 'magnifyingglass', title: 'Search' }, { id: 'settings', symbol: 'slider.horizontal.3', title: 'Settings' }];

// ---------- Playing. Some videos still get an HLS stream from the iOS app's client (up to 4K): those play right in the
// page, with resume, speed and SponsorBlock. YouTube now guards most streams with a token only its own player can get,
// so the rest play in YouTube's embedded player in a sheet (it only plays inside a web page's frame: ui.web's embedFrom).
const streamCache = {};
async function streams(id) {
  if (id in streamCache) return streamCache[id];
  let r;
  try { r = await api('player', { videoId: id, contentCheckOk: true, racyCheckOk: true }, IOS, 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)'); } catch {}
  const src = r?.streamingData?.hlsManifestUrl;
  return streamCache[id] = { src, details: r?.videoDetails || {}, captions: r?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [] };
}
async function playInYouTube(id, start = 0) {
  await fruitfox.ui.web(`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&start=${Math.floor(start)}${S.captions ? '&cc_load_policy=1' : ''}`, { embedFrom: 'https://riceelijah.github.io/fruitfox/' });
}
const openShort = id => fruitfox.ui.web(`https://m.youtube.com/shorts/${id}`);

/// Captions as a <track>: YouTube's WebVTT, fetched here and handed over as a blob (it doesn't allow other pages to load it).
async function captionTrack(video, tracks) {
  const t = tracks.find(t => t.languageCode?.startsWith('en') && t.kind !== 'asr') || tracks.find(t => t.languageCode?.startsWith('en')) || tracks[0];
  if (!t) return;
  const vtt = (await fruitfox.fetch(t.baseUrl.replace(/&fmt=[^&]*/, '') + '&fmt=vtt')).body;
  const el = Object.assign(document.createElement('track'), { kind: 'subtitles', label: text(t.name), srclang: t.languageCode, default: true,
    src: URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' })) });
  video.append(el);
  el.track.mode = 'showing';
}

async function like(id, on, dislike = false) {
  if (await account()) await api(on ? (dislike ? 'like/dislike' : 'like/like') : 'like/removelike', { target: { videoId: id } });
  if (!dislike) await addToList('liked', known.get(id) || { id, title: '' }, on);
  haptic(on ? 'success' : 'light');
}
