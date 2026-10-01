// Bluesky: the AT Protocol's open API. Signed out, Bluesky's public AppView (public.api.bsky.app); signed in with an
// app password, your PDS (bsky.social or your *.bsky.network host), which also lets you post, like, repost and follow.
const $ = s => document.querySelector(s);
const PUB = 'https://public.api.bsky.app/xrpc';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = n => !n ? '' : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);

// ---------- Settings (a native screen), saved as 'settings'.
const SETTINGS = [
  { header: 'Following Feed', rows: [
    { id: 'reposts', title: 'Show Reposts', type: 'toggle', default: true },
    { id: 'replies', title: 'Show Replies', type: 'toggle', default: true },
    { id: 'quotes', title: 'Show Quote Posts', type: 'toggle', default: true },
    { id: 'startFeed', title: 'Open To', type: 'picker', default: 'following', options: ['following', 'discover'], labels: ['Following', 'Discover'] },
  ] },
  { header: 'Content', rows: [
    { id: 'adult', title: 'Adult Content', type: 'picker', default: 'blur', options: ['hide', 'blur', 'show'], labels: ['Hide', 'Blur', 'Show'] },
    { id: 'autoplay', title: 'Autoplay Videos', type: 'toggle', default: true },
    { id: 'muteVideos', title: 'Start Videos Muted', type: 'toggle', default: true },
    { id: 'muted', title: 'Muted Words', type: 'input', default: '', placeholder: 'spoilers, …' },
  ], footer: 'Muted words hide posts that contain them (separate with commas). Your account’s own mutes and blocks apply too.' },
  { header: 'Posts', rows: [
    { id: 'counts', title: 'Like and Repost Counts', type: 'toggle', default: true },
    { id: 'time', title: 'Times', type: 'picker', default: 'relative', options: ['relative', 'absolute'], labels: ['3h Ago', 'Date and Time'] },
    { id: 'linksIn', title: 'Links Open In', type: 'picker', default: 'sheet', options: ['sheet', 'browser'], labels: ['A Sheet', 'Fruitfox Tab'] },
  ] },
  { header: 'General', rows: [
    { id: 'haptics', title: 'Haptics', type: 'toggle', default: true },
  ], footer: 'Pull down on a page to see a change.' },
];
const ROWS = SETTINGS.flatMap(s => s.rows);
let S = null;
async function settings() { return S = { ...Object.fromEntries(ROWS.map(r => [r.id, r.default])), ...(await fruitfox.storage.get('settings')) }; }
async function openSettings() {
  const s = await settings();
  fruitfox.ui.sheet({ title: 'Settings', sections: SETTINGS.map(sec => ({ header: sec.header, footer: sec.footer, rows: sec.rows.map(r =>
    ({ ...r, boolValue: r.type === 'toggle' ? !!s[r.id] : undefined, value: r.type === 'toggle' ? undefined : String(s[r.id] ?? '') })) })) }, 'Settings');
}
fruitfox.on('screen', async j => {
  const { id, value } = JSON.parse(j), r = ROWS.find(r => r.id === id);
  if (!r) return;
  const s = await settings(); s[id] = r.type === 'toggle' ? value === 'true' : value;
  await fruitfox.storage.set('settings', s); await settings();
});
const haptic = k => S?.haptics && fruitfox.ui.haptic(k);

// ---------- Session: createSession with an app password; tokens kept in storage and refreshed when they expire.
let session;
async function sess() { return session ??= await fruitfox.storage.get('session'); }
async function call(method, params = {}, body) {
  const s = await sess();
  const base = s ? `${s.pds}/xrpc` : PUB;
  const q = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => Array.isArray(v) ? v.map(x => [k, x]) : v == null ? [] : [[k, v]])).toString();
  const go = () => fruitfox.fetch(`${base}/${method}${q ? '?' + q : ''}`, { method: body ? 'POST' : 'GET', cookies: false,
    headers: { ...(session ? { Authorization: `Bearer ${session.accessJwt}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : null });
  let r = await go();
  if (r.status === 400 && session && /ExpiredToken/.test(r.body)) {
    const rr = await fruitfox.fetch(`${session.pds}/xrpc/com.atproto.server.refreshSession`, { method: 'POST', cookies: false, headers: { Authorization: `Bearer ${session.refreshJwt}` } });
    if (rr.ok) { Object.assign(session, rr.json()); await fruitfox.storage.set('session', session); r = await go(); }
    else { await signOut(); throw new Error('Signed out. Sign in again in Profile.'); }
  }
  if (!r.ok) { let m; try { m = r.json().message; } catch {} throw new Error(m || `Bluesky answered ${r.status}`); }
  return r.body ? r.json() : {};
}
/// Signs in on the account's own PDS (found from its handle's DID document).
async function signIn(identifier, password) {
  let pds = 'https://bsky.social';
  try {
    const did = identifier.startsWith('did:') ? identifier : (await (await fruitfox.fetch(`${PUB}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(identifier)}`)).json()).did;
    const doc = (await fruitfox.fetch(`https://plc.directory/${did}`)).json();
    pds = doc.service?.find(s => s.type === 'AtprotoPersonalDataServer')?.serviceEndpoint || pds;
  } catch {}
  const r = await fruitfox.fetch(`${pds}/xrpc/com.atproto.server.createSession`, { method: 'POST', cookies: false, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }) });
  if (!r.ok) { let m; try { m = r.json().message; } catch {} throw new Error(m || `Couldn’t sign in (${r.status}). ${/bsky\.(social|network)/.test(pds) ? '' : 'Only accounts hosted by Bluesky work here.'}`); }
  session = { ...r.json(), pds };
  await fruitfox.storage.set('session', session);
}
async function signOut() { session = null; await fruitfox.storage.set('session', null); }

// ---------- Posts.
const when = iso => {
  const d = new Date(iso);
  if (S.time === 'absolute') return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const s = (Date.now() - d) / 1000;
  return s < 60 ? 'now' : s < 3600 ? `${s / 60 | 0}m` : s < 86400 ? `${s / 3600 | 0}h` : s < 604800 ? `${s / 86400 | 0}d` : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
/// Post text with its links, mentions and tags (facets are byte ranges in UTF-8).
function richText(rec) {
  const text = rec?.text || '', bytes = new TextEncoder().encode(text), dec = new TextDecoder();
  const facets = [...(rec?.facets || [])].sort((a, b) => a.index.byteStart - b.index.byteStart);
  let out = '', at = 0;
  for (const f of facets) {
    const { byteStart: s, byteEnd: e } = f.index; if (s < at) continue;
    out += esc(dec.decode(bytes.slice(at, s)));
    const seg = esc(dec.decode(bytes.slice(s, e))), feat = f.features?.[0] || {};
    out += feat.uri ? `<a href="${esc(feat.uri)}">${seg}</a>` : feat.did ? `<a data-actor="${esc(feat.did)}">${seg}</a>` : feat.tag ? `<a data-tag="${esc(feat.tag)}">${seg}</a>` : seg;
    at = e;
  }
  return out + esc(dec.decode(bytes.slice(at)));
}
const adultLabels = ['porn', 'sexual', 'nudity', 'graphic-media'];
function embedHTML(e, labels) {
  if (!e) return '';
  const adult = (labels || []).some(l => adultLabels.includes(l.val));
  const blur = adult && S.adult === 'blur' ? 'blurred' : '';
  const t = e.$type || '';
  if (t.includes('recordWithMedia')) return embedHTML(e.media, labels) + embedHTML(e.record, labels);
  if (t.includes('images')) return `<div class="imgs n${Math.min(e.images.length, 4)} ${blur}">${e.images.slice(0, 4).map(i => `<img alt="${esc(i.alt)}" loading="lazy" src="${esc(i.thumb)}" data-full="${esc(i.fullsize)}">`).join('')}</div>`;
  if (t.includes('video')) return `<div class="vid ${blur}"><video playsinline controls preload="none" ${S.autoplay && !blur ? 'autoplay' : ''} ${S.muteVideos ? 'muted' : ''} loop poster="${esc(e.thumbnail || '')}" src="${esc(e.playlist)}"></video></div>`;
  if (t.includes('external')) { const x = e.external; return `<a class="ext" href="${esc(x.uri)}">${x.thumb ? `<img alt="" loading="lazy" src="${esc(x.thumb)}">` : ''}<div class="t"><b>${esc(x.title)}</b><span>${esc((() => { try { return new URL(x.uri).hostname.replace(/^www\./, ''); } catch { return ''; } })())}</span></div></a>`; }
  if (t.includes('record')) {
    const r = e.record?.record ? e.record.record : e.record;
    if (!r?.author) return '';
    if (!S.quotes) return '';
    return `<div class="quote tappable" data-uri="${esc(r.uri)}"><div class="by"><img alt="" src="${esc(r.author.avatar || '')}"><b>${esc(r.author.displayName || r.author.handle)}</b> <span class="secondary">@${esc(r.author.handle)}</span></div>
      <div class="tx">${richText(r.value)}</div>${(r.embeds || []).map(x => embedHTML(x, r.labels)).join('')}</div>`;
  }
  return '';
}
const posts = new Map();
function postHTML(item, { main = false } = {}) {
  const p = item.post || item, a = p.author, rec = p.record || {};
  const muted = String(S.muted).split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  if (muted.some(w => (rec.text || '').toLowerCase().includes(w))) return '';
  if (S.adult === 'hide' && [...(p.labels || []), ...(a.labels || [])].some(l => adultLabels.includes(l.val))) return '';
  posts.set(p.uri, p);
  const ctx = item.reason?.$type?.includes('Repost') ? `<div class="ctx">↻ Reposted by ${esc(item.reason.by.displayName || item.reason.by.handle)}</div>`
    : item.reply?.parent?.author ? `<div class="ctx">↪ Reply to ${esc(item.reply.parent.author.displayName || item.reply.parent.author.handle)}</div>` : '';
  const v = p.viewer || {};
  return `<div class="p tappable ${main ? 'thread-main' : ''}" data-uri="${esc(p.uri)}"><img alt="" class="av" data-actor="${esc(a.did)}" src="${esc(a.avatar || '')}">
    <div class="body">${ctx}<div class="by"><b data-actor="${esc(a.did)}">${esc(a.displayName || a.handle)}</b><span>@${esc(a.handle)} · ${when(p.indexedAt)}</span></div>
      <div class="tx">${richText(rec)}</div>${embedHTML(p.embed, p.labels)}
      <div class="acts"><button data-a="reply">💬 ${S.counts ? num(p.replyCount) : ''}</button><button data-a="repost" class="${v.repost ? 'reposted' : ''}">↻ ${S.counts ? num(p.repostCount) : ''}</button>
        <button data-a="like" class="${v.like ? 'liked' : ''}">${v.like ? '♥' : '♡'} ${S.counts ? num(p.likeCount) : ''}</button><button data-a="more">···</button></div></div></div>`;
}
function feedFilter(items) {
  return items.filter(i => (S.reposts || !i.reason) && (S.replies || !i.reply) && (S.quotes || !(i.post.embed?.$type || '').includes('record')));
}

const openLink = url => S.linksIn === 'browser' ? fruitfox.ui.open(url) : fruitfox.ui.web(url);
async function needAccount() {
  if (await sess()) return true;
  fruitfox.ui.toast('Sign in to Bluesky in Profile first');
  return false;
}
/// Taps on posts: open the thread, profiles, links, tags, images, and the action row.
function wirePosts(el) {
  el.addEventListener('click', async e => {
    const t = e.target, a = t.closest('a');
    if (a?.dataset.actor || t.closest('[data-actor]')) { e.preventDefault(); const d = (a || t.closest('[data-actor]')).dataset.actor; return fruitfox.ui.push('profile.html?actor=' + encodeURIComponent(d), ''); }
    if (a?.dataset.tag) { e.preventDefault(); return fruitfox.ui.push('search.html?q=' + encodeURIComponent('#' + a.dataset.tag), '#' + a.dataset.tag); }
    if (a?.href) { e.preventDefault(); return openLink(a.href); }
    const img = t.closest('img[data-full]'); if (img) { if (img.closest('.blurred')) { img.closest('.blurred').classList.remove('blurred'); return; } return fruitfox.ui.web(img.dataset.full); }
    if (t.closest('.blurred')) { t.closest('.blurred').classList.remove('blurred'); return; }
    if (t.closest('video')) return;
    const row = t.closest('[data-uri]'); if (!row) return;
    const p = posts.get(row.dataset.uri), act = t.closest('[data-a]')?.dataset.a;
    try {
      if (act === 'like' && p && await needAccount()) {
        const b = t.closest('[data-a]');
        if (p.viewer?.like) { await deleteRecord(p.viewer.like); p.viewer.like = null; p.likeCount--; } else { p.viewer = { ...p.viewer, like: (await createRecord('app.bsky.feed.like', { subject: { uri: p.uri, cid: p.cid } })).uri }; p.likeCount++; }
        b.classList.toggle('liked', !!p.viewer.like); b.textContent = `${p.viewer.like ? '♥' : '♡'} ${S.counts ? num(p.likeCount) : ''}`; haptic('success'); return;
      }
      if (act === 'repost' && p && await needAccount()) {
        const pick = await fruitfox.ui.menu([{ id: 'repost', title: p.viewer?.repost ? 'Undo Repost' : 'Repost' }, { id: 'quote', title: 'Quote Post' }]);
        if (pick === 'quote') return compose({ quote: p });
        if (pick !== 'repost') return;
        const b = t.closest('[data-a]');
        if (p.viewer?.repost) { await deleteRecord(p.viewer.repost); p.viewer.repost = null; p.repostCount--; } else { p.viewer = { ...p.viewer, repost: (await createRecord('app.bsky.feed.repost', { subject: { uri: p.uri, cid: p.cid } })).uri }; p.repostCount++; }
        b.classList.toggle('reposted', !!p.viewer.repost); b.textContent = `↻ ${S.counts ? num(p.repostCount) : ''}`; haptic('success'); return;
      }
      if (act === 'reply' && p) { if (await needAccount()) compose({ reply: p }); return; }
      if (act === 'more' && p) {
        const pick = await fruitfox.ui.menu([{ id: 'share', title: 'Share' }, { id: 'copy', title: 'Open on bsky.app' }]);
        const url = `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split('/').pop()}`;
        if (pick === 'share') fruitfox.ui.share(url); if (pick === 'copy') fruitfox.ui.web(url);
        return;
      }
    } catch (err) { return fruitfox.ui.toast(err.message); }
    if (!row.classList.contains('thread-main')) { haptic('light'); fruitfox.ui.push('thread.html?uri=' + encodeURIComponent(row.dataset.uri), 'Post'); }
  });
}
async function createRecord(collection, record) {
  const s = await sess();
  return call('com.atproto.repo.createRecord', {}, { repo: s.did, collection, record: { $type: collection, createdAt: new Date().toISOString(), ...record } });
}
async function deleteRecord(uri) {
  const [, , repo, collection, rkey] = uri.split('/');
  return call('com.atproto.repo.deleteRecord', {}, { repo, collection, rkey });
}
async function compose(o = {}) { await fruitfox.storage.set('compose', o); fruitfox.ui.sheet('compose.html', o.reply ? 'Reply' : 'New Post'); }

function onNearEnd(f) { let busy = false; addEventListener('scroll', async () => { if (busy || innerHeight + scrollY < document.body.scrollHeight - 1500) return; busy = true; try { await f(); } finally { busy = false; } }, { passive: true }); }
const errorHTML = e => `<div class="center"><div class="headline">Couldn’t load Bluesky</div><div class="secondary">${esc(e.message)}</div></div>`;
fruitfox.on('button', id => { if (id === 'settings') openSettings(); if (id === 'compose') needAccount().then(ok => ok && compose()); });
const BUTTONS = [{ id: 'compose', symbol: 'square.and.pencil', title: 'New Post' }, { id: 'settings', symbol: 'slider.horizontal.3', title: 'Settings' }];
const DISCOVER = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';
