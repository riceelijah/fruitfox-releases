// Reddit: reads the same page pieces reddit.com's own mobile site loads (/svc/shreddit/…: posts and comments as HTML
// with everything in attributes), since Reddit blocks its JSON API outside its apps. Voting, joining and your
// subscriptions use your signed-in reddit.com session.
const $ = s => document.querySelector(s);
const RD = 'https://www.reddit.com';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ago = t => { const s = (Date.now() - new Date(t)) / 1000; return s < 3600 ? `${Math.max(1, s / 60 | 0)}m` : s < 86400 ? `${s / 3600 | 0}h` : s < 2592000 ? `${s / 86400 | 0}d` : s < 31536000 ? `${s / 2592000 | 0}mo` : `${s / 31536000 | 0}y`; };
const num = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'm' : n >= 1e4 ? (n / 1e3 | 0) + 'k' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
async function page(path) {
  const r = await fruitfox.fetch(path.startsWith('http') ? path : RD + path, { headers: { Accept: 'text/html' } });
  if (!r.ok) throw new Error(r.status === 403 ? 'Reddit blocked this. Open reddit.com in Fruitfox once, then try again.' : `Reddit answered ${r.status}`);
  return new DOMParser().parseFromString(r.body, 'text/html');
}

// ---------- Settings (a native screen), saved as 'settings'.
const SETTINGS = [
  { header: 'Feed', rows: [
    { id: 'feed', title: 'Open To', type: 'picker', default: 'home', options: ['home', 'popular'], labels: ['Home', 'Popular'] },
    { id: 'sort', title: 'Sort Posts By', type: 'picker', default: 'best', options: ['best', 'hot', 'new', 'top', 'rising'], labels: ['Best', 'Hot', 'New', 'Top', 'Rising'] },
    { id: 'time', title: 'Top Posts From', type: 'picker', default: 'day', options: ['hour', 'day', 'week', 'month', 'year', 'all'], labels: ['Past Hour', 'Today', 'This Week', 'This Month', 'This Year', 'All Time'] },
    { id: 'view', title: 'View', type: 'picker', default: 'card', options: ['card', 'compact'], labels: ['Card', 'Compact'] },
    { id: 'thumbSide', title: 'Compact Thumbnails', type: 'picker', default: 'right', options: ['right', 'left'], labels: ['Right', 'Left'] },
    { id: 'previews', title: 'Text Previews', type: 'toggle', default: true },
    { id: 'flair', title: 'Flair', type: 'toggle', default: true },
    { id: 'joinButtons', title: 'Join Buttons', type: 'toggle', default: true },
  ] },
  { header: 'Filters', rows: [
    { id: 'hideAds', title: 'Hide Ads', type: 'toggle', default: true },
    { id: 'hideNSFW', title: 'Hide NSFW Posts', type: 'toggle', default: false },
    { id: 'blurNSFW', title: 'Blur NSFW Media', type: 'toggle', default: true },
    { id: 'blurSpoilers', title: 'Blur Spoilers', type: 'toggle', default: true },
    { id: 'hideRead', title: 'Hide Posts You’ve Opened', type: 'toggle', default: false },
    { id: 'dimRead', title: 'Dim Posts You’ve Opened', type: 'toggle', default: false },
    { id: 'mutedSubs', title: 'Muted Communities', type: 'input', default: '', placeholder: 'funny, …' },
    { id: 'muted', title: 'Muted Words', type: 'input', default: '', placeholder: 'spoilers, …' },
  ], footer: 'Separate muted communities and words with commas.' },
  { header: 'Media', rows: [
    { id: 'autoplay', title: 'Autoplay Videos', type: 'toggle', default: true },
    { id: 'muteVideos', title: 'Start Videos Muted', type: 'toggle', default: true },
    { id: 'linksIn', title: 'Links Open In', type: 'picker', default: 'sheet', options: ['sheet', 'browser'], labels: ['A Sheet', 'Fruitfox Tab'] },
  ] },
  { header: 'Comments', rows: [
    { id: 'csort', title: 'Sort Comments By', type: 'picker', default: 'confidence', options: ['confidence', 'top', 'new', 'controversial', 'old', 'qa'], labels: ['Best', 'Top', 'New', 'Controversial', 'Old', 'Q&A'] },
    { id: 'collapseBots', title: 'Collapse AutoModerator', type: 'toggle', default: true },
    { id: 'collapseReplies', title: 'Collapse Replies', type: 'toggle', default: false },
    { id: 'avatars', title: 'Avatars', type: 'toggle', default: true },
    { id: 'colorLines', title: 'Colored Thread Lines', type: 'toggle', default: false },
    { id: 'textSize', title: 'Text Size', type: 'picker', default: 'm', options: ['s', 'm', 'l'], labels: ['Small', 'Medium', 'Large'] },
  ] },
  { header: 'General', rows: [
    { id: 'haptics', title: 'Haptics', type: 'toggle', default: true },
  ], footer: 'Pull down on a page to see a change.' },
];
const ROWS = SETTINGS.flatMap(s => s.rows);
let S = null;
async function settings() {
  S = { ...Object.fromEntries(ROWS.map(r => [r.id, r.default])), ...(await fruitfox.storage.get('settings')) };
  const root = document.documentElement;
  root.classList.toggle('compact', S.view === 'compact');
  root.classList.toggle('card', S.view !== 'compact');
  root.classList.toggle('thumb-left', S.thumbSide === 'left');
  root.classList.toggle('lines-color', !!S.colorLines);
  root.classList.remove('text-s', 'text-l'); root.classList.add('text-' + S.textSize);
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
const list = v => String(v || '').split(',').map(x => x.trim().toLowerCase().replace(/^r\//, '')).filter(Boolean);

// ---------- Posts from a page piece.
const attr = (el, a) => el.getAttribute(a);
function parsePosts(doc) {
  const posts = [...doc.querySelectorAll('shreddit-post')].map(p => {
    const imgOf = el => el && (attr(el, 'src') || attr(el, 'data-lazy-src'));
    const gallery = [...new Set([...p.querySelectorAll('[slot^="page-"] img')].map(imgOf).filter(Boolean))];
    const mediaImgs = [...p.querySelectorAll('[slot="post-media-container"] img')].map(imgOf).filter(u => u && /redd\.it|redditmedia/.test(u));
    const player = p.querySelector('shreddit-player, shreddit-player-2');
    let video = player && (attr(player, 'src') || '');
    if (player && !video) try { video = JSON.parse(attr(player, 'packaged-media-json')).playbackMp4s?.permutations?.at(-1)?.source?.url; } catch {}
    const body = p.querySelector('[slot="text-body"]');
    const icon = [...p.querySelectorAll('img')].map(imgOf).find(u => /communityIcon|styles\.redditmedia\.com/.test(u || ''));
    return {
      id: attr(p, 'id'), sub: attr(p, 'subreddit-name') || attr(p, 'subreddit-prefixed-name')?.slice(2), title: attr(p, 'post-title'),
      author: attr(p, 'author'), score: +attr(p, 'score') || 0, comments: +attr(p, 'comment-count') || 0, created: attr(p, 'created-timestamp'),
      permalink: attr(p, 'permalink'), url: attr(p, 'content-href'), domain: attr(p, 'domain'), type: attr(p, 'post-type'),
      nsfw: p.hasAttribute('nsfw'), spoiler: p.hasAttribute('spoiler'), icon,
      flair: p.querySelector('[slot="post-flair"]')?.textContent.trim().replace(/\s+/g, ' ') || '',
      body: body?.innerHTML || '', gallery, image: mediaImgs.at(-1), video: video?.replaceAll('&amp;', '&'),
      poster: attr(player || p, 'poster') || p.querySelector('[slot="poster"] img')?.getAttribute('src'),
      thumb: imgOf(p.querySelector('[slot="thumbnail"] img')),
    };
  });
  const next = [...doc.querySelectorAll('faceplate-partial[src]')].map(e => attr(e, 'src')).find(s => /after=/.test(s));
  return { posts, next, ads: doc.querySelectorAll('shreddit-ad-post').length };
}

const memo = {};
async function idSet(key) { return memo[key] ||= new Set((await fruitfox.storage.get(key)) || []); }
async function mark(key, id, on = true) { const s = await idSet(key); on ? s.add(id) : s.delete(id); fruitfox.storage.set(key, [...s].slice(-3000)); }
const votes = {};  // this session's votes: id → 1 / -1 / 0
async function voteOf(id) { return votes[id] ?? ((await fruitfox.storage.get('votes')) || {})[id] ?? 0; }

function filtered(p, read) {
  if (S.hideNSFW && p.nsfw) return true;
  if (S.hideRead && read.has(p.id)) return true;
  if (list(S.mutedSubs).includes((p.sub || '').toLowerCase())) return true;
  const t = (p.title || '').toLowerCase();
  return list(S.muted).some(w => t.includes(w));
}

const IC = {
  up: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2.5 2.6 10.6c-.4.5 0 1.2.6 1.2H7v5.4c0 .4.4.8.8.8h4.4c.4 0 .8-.4.8-.8v-5.4h3.8c.6 0 1-.7.6-1.2L10 2.5Zm0 2.3 5.4 5.9h-3.1c-.4 0-.7.3-.7.7v5.4H8.4v-5.4c0-.4-.3-.7-.7-.7H4.6L10 4.8Z"/></svg>',
  down: '<svg viewBox="0 0 20 20" fill="currentColor" style="transform:rotate(180deg)"><path d="M10 2.5 2.6 10.6c-.4.5 0 1.2.6 1.2H7v5.4c0 .4.4.8.8.8h4.4c.4 0 .8-.4.8-.8v-5.4h3.8c.6 0 1-.7.6-1.2L10 2.5Zm0 2.3 5.4 5.9h-3.1c-.4 0-.7.3-.7.7v5.4H8.4v-5.4c0-.4-.3-.7-.7-.7H4.6L10 4.8Z"/></svg>',
  comment: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.5c-4.8 0-8.5 3.4-8.5 7.7 0 2 .9 3.9 2.4 5.3l-.8 3.2c-.1.5.4.9.8.6l3.6-1.8c.8.2 1.6.3 2.5.3 4.8 0 8.5-3.4 8.5-7.6S14.8 1.5 10 1.5Zm0 13.9c-.8 0-1.6-.1-2.3-.3l-.5-.1-2.4 1.2.5-2.1-.4-.4C3.6 12.6 2.9 11 2.9 9.2 2.9 5.7 6 2.9 10 2.9s7.1 2.8 7.1 6.3-3.1 6.2-7.1 6.2Z"/></svg>',
  share: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.8 5.6 6.2l1 1 2.7-2.7v8.7h1.4V4.5l2.7 2.7 1-1L10 1.8ZM4 9v8.2c0 .4.3.7.7.7h10.6c.4 0 .7-.3.7-.7V9h-1.4v7.5H5.4V9H4Z"/></svg>',
};

/// A post as a card (or a compact row): community header, title, flair, media or link card, and the action bar.
async function postHTML(p, { read = false, joined = false, full = false } = {}) {
  const v = await voteOf(p.id), score = p.score + v;
  const why = (S.blurNSFW && p.nsfw) ? 'NSFW' : (S.blurSpoilers && p.spoiler) ? 'Spoiler' : '';
  let media = '';
  if (p.video) media = `<div class="media ${why ? 'blur' : ''}" data-why="${why}"><video playsinline controls preload="none" ${S.autoplay && !why ? 'autoplay' : ''} ${S.muteVideos ? 'muted' : ''} loop
      poster="${esc(p.poster || p.image || '')}" src="${esc(p.video)}"></video></div>`;
  else if (p.gallery.length > 1) media = `<div class="media ${why ? 'blur' : ''}" data-why="${why}"><div class="carousel">${p.gallery.map(u => `<img alt="" loading="lazy" src="${esc(u)}">`).join('')}</div><span class="count">1/${p.gallery.length}</span></div>`;
  else if (p.image || p.gallery[0]) media = `<div class="media ${why ? 'blur' : ''}" data-why="${why}"><img alt="" loading="lazy" src="${esc(p.image || p.gallery[0])}"></div>`;
  else if (p.type === 'link' && p.url) media = `<div class="linkcard tappable" data-link="${esc(p.url)}"><span class="d">${esc(p.domain || p.url)}</span>${p.thumb ? `<img alt="" src="${esc(p.thumb)}">` : ''}</div>`;
  const thumb = p.image || p.gallery[0] || p.poster || p.thumb;
  return `<article class="post tappable ${read ? 'read' : ''} ${S.dimRead ? 'dim' : ''}" data-id="${p.id}">
    ${thumb ? `<img alt="" class="thumb" src="${esc(thumb)}">` : ''}
    <div class="phead"><img alt="" class="sicon" src="${esc(p.icon || 'https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png')}">
      <span><b data-sub="${esc(p.sub)}">r/${esc(p.sub)}</b> · ${ago(p.created)}${full ? ` · <span data-user="${esc(p.author)}">u/${esc(p.author)}</span>` : ''}</span>
      ${S.joinButtons && !joined && !full ? `<button class="join" data-join="${esc(p.sub)}">Join</button>` : ''}<button class="dots" data-more>⋯</button></div>
    <div class="ptitle">${p.nsfw ? '<span class="tag nsfw">NSFW</span>' : ''}${p.spoiler ? '<span class="tag spoiler">SPOILER</span>' : ''}${esc(p.title)}</div>
    ${S.flair && p.flair ? `<span class="flair">${esc(p.flair)}</span>` : ''}
    ${p.body && (full || S.previews) ? `<div class="${full ? 'md' : 'preview'}">${full ? clean(p.body) : esc(new DOMParser().parseFromString(p.body, 'text/html').body.textContent.trim())}</div>` : ''}
    ${media}
    <div class="bar">
      <span class="pill vote ${v > 0 ? 'up' : v < 0 ? 'down' : ''}"><button data-vote="1" aria-label="Upvote">${IC.up}</button>${num(score)}<button data-vote="-1" aria-label="Downvote">${IC.down}</button></span>
      <span class="pill" data-comments>${IC.comment}${num(p.comments)}</span>
      <span class="pill" data-share>${IC.share}Share</span>
    </div></article>`;
}

/// Someone else's HTML (post bodies, comments): no scripts, frames or handlers.
function clean(html) {
  const d = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  d.querySelectorAll('script,style,iframe,object,embed,form,link,meta,base').forEach(n => n.remove());
  d.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => { if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value) || a.name === 'class' || a.name === 'style') n.removeAttribute(a.name); }));
  return d.body.firstChild.innerHTML;
}

const openLink = url => S.linksIn === 'browser' ? fruitfox.ui.open(url) : fruitfox.ui.web(url);

// ---------- Signed in: Reddit's classic API with your session (modhash), for votes, joining and subscriptions.
let meCache;
async function me() {
  if (meCache !== undefined) return meCache;
  try { const r = await fruitfox.fetch(RD + '/api/me.json'); meCache = r.ok ? r.json().data || null : null; } catch { meCache = null; }
  return meCache;
}
async function api(path, form) {
  const u = await me();
  if (!u?.name) { await fruitfox.ui.signIn(RD + '/login'); meCache = undefined; if (!(await me())?.name) throw new Error('Sign in to Reddit first'); }
  const r = await fruitfox.fetch(RD + path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Modhash': (await me()).modhash || '' },
    body: new URLSearchParams(form).toString() });
  if (!r.ok) { fruitfox.log(`${path} → ${r.status} ${r.body.slice(0, 200)}`); throw new Error(`Reddit answered ${r.status}`); }
  return r;
}
async function vote(id, dir) {
  const cur = await voteOf(id), next = cur === dir ? 0 : dir;
  await api('/api/vote', { id, dir: String(next), rank: '2' });
  votes[id] = next;
  const all = (await fruitfox.storage.get('votes')) || {}; all[id] = next; fruitfox.storage.set('votes', all);
  haptic(next ? 'success' : 'light');
  return next;
}
async function joinSub(sub, on = true) { await api('/api/subscribe', { action: on ? 'sub' : 'unsub', sr_name: sub, skip_initial_defaults: 'true' }); haptic('success'); }
async function subscriptions() {
  try {
    const out = []; let after = '';
    do {
      const r = await fruitfox.fetch(`${RD}/subreddits/mine/subscriber.json?limit=100&after=${after}`);
      if (!r.ok || !r.body.startsWith('{')) break;
      const j = r.json().data; out.push(...j.children.map(c => c.data)); after = j.after || '';
    } while (after);
    return out;
  } catch { return []; }
}

/// Wires taps on post cards: open, vote, join, share, links, communities, galleries.
function wirePosts(el, find, { full = false } = {}) {
  el.addEventListener('click', async e => {
    const card = e.target.closest('[data-id]'); if (!card) return;
    const p = find(card.dataset.id);
    const t = e.target;
    try {
      const v = t.closest('[data-vote]');
      if (v) { e.stopPropagation(); const n = await vote(p.id, +v.dataset.vote); const pill = card.querySelector('.vote'); pill.classList.toggle('up', n > 0); pill.classList.toggle('down', n < 0); pill.childNodes[1].textContent = num(p.score + n); return; }
      const j = t.closest('[data-join]'); if (j) { await joinSub(j.dataset.join); j.remove(); fruitfox.ui.toast(`Joined r/${j.dataset.join}`); return; }
    } catch (err) { return fruitfox.ui.toast(err.message); }
    if (t.closest('[data-share]')) return fruitfox.ui.share(RD + p.permalink);
    if (t.closest('[data-more]')) return postMenu(p, card);
    const sub = t.closest('[data-sub]'); if (sub) return fruitfox.ui.push('sub.html?name=' + encodeURIComponent(sub.dataset.sub), 'r/' + sub.dataset.sub);
    const user = t.closest('[data-user]'); if (user) return fruitfox.ui.web(`${RD}/user/${user.dataset.user}/`);
    const blur = t.closest('.media.blur'); if (blur) { blur.classList.remove('blur'); return; }
    if (t.closest('video')) return;
    const link = t.closest('[data-link]'); if (link) return openLink(link.dataset.link);
    const a = t.closest('.md a'); if (a) { e.preventDefault(); return openLink(a.href); }
    if (full) { if (t.closest('.media img')) fruitfox.ui.web(p.image || p.gallery[0]); return; }
    card.classList.add('read'); mark('read', p.id); haptic('light');
    await fruitfox.storage.set('post', p);
    fruitfox.ui.push('post.html?id=' + p.id, 'r/' + p.sub);
  });
  el.addEventListener('scroll', e => {
    const c = e.target.closest?.('.carousel'); if (!c) return;
    const n = c.parentElement.querySelector('.count'); if (n) n.textContent = `${Math.round(c.scrollLeft / c.clientWidth) + 1}/${c.children.length}`;
  }, true);
}

async function postMenu(p, card) {
  const saved = (await idSet('saved')).has(p.id);
  const pick = await fruitfox.ui.menu([
    { id: 'save', title: saved ? 'Unsave' : 'Save' }, { id: 'sub', title: `Go to r/${p.sub}` }, { id: 'web', title: 'Open on Reddit' },
    { id: 'hide', title: 'Hide', destructive: true }, { id: 'mute', title: `Mute r/${p.sub}`, destructive: true },
  ], p.title);
  if (pick === 'save') { const l = ((await fruitfox.storage.get('savedPosts')) || []).filter(x => x.id !== p.id); if (!saved) l.unshift(p); await fruitfox.storage.set('savedPosts', l); mark('saved', p.id, !saved); fruitfox.ui.toast(saved ? 'Unsaved' : 'Saved'); }
  if (pick === 'sub') fruitfox.ui.push('sub.html?name=' + encodeURIComponent(p.sub), 'r/' + p.sub);
  if (pick === 'web') fruitfox.ui.web(RD + p.permalink);
  if (pick === 'hide') { mark('hiddenPosts', p.id); card?.remove(); }
  if (pick === 'mute') { S.mutedSubs = [S.mutedSubs, p.sub].filter(Boolean).join(', '); await fruitfox.storage.set('settings', S); card?.remove(); fruitfox.ui.toast(`Muted r/${p.sub}`); }
}

/// A feed: renders pages of posts from `first` (a /svc/shreddit path), loading more near the end.
async function feed(el, first) {
  const posts = new Map(), read = await idSet('read'), hidden = await idSet('hiddenPosts');
  let next = first, busy = false;
  async function more() {
    if (!next || busy) return; busy = true;
    try {
      const r = parsePosts(await page(next));
      next = r.next && r.next !== next ? r.next : null;
      const html = [];
      for (const p of r.posts) { if (!p.id || posts.has(p.id) || hidden.has(p.id) || filtered(p, read)) continue; posts.set(p.id, p); html.push(await postHTML(p, { read: read.has(p.id) })); }
      el.querySelector('.spinner')?.remove();
      el.insertAdjacentHTML('beforeend', html.join(''));
      if (!posts.size && !next) el.innerHTML = '<div class="center secondary">Nothing here.</div>';
      else if (!html.length && next) { busy = false; return more(); }
    } catch (e) {
      el.innerHTML = posts.size ? el.innerHTML : `<div class="center"><div class="headline">Couldn’t load Reddit</div><div class="secondary">${esc(e.message)}</div></div>`;
    }
    busy = false;
  }
  el.innerHTML = '<div class="spinner"></div>';
  // Reddit's pages can be short (a few posts): fill the screen before waiting for scrolling.
  do await more(); while (next && document.body.scrollHeight < innerHeight * 2);
  return { posts, more };
}
function onNearEnd(f) { addEventListener('scroll', () => { if (innerHeight + scrollY > document.body.scrollHeight - 1500) f(); }, { passive: true }); }

fruitfox.on('button', id => { if (id === 'settings') openSettings(); });
