// Hacker News: stories from HN's official API (hacker-news.firebaseio.com), comments and search from Algolia's HN API
// (hn.algolia.com, whole threads in one request), and voting on news.ycombinator.com while you're signed in there.
const $ = s => document.querySelector(s);
const FB = 'https://hacker-news.firebaseio.com/v0', AL = 'https://hn.algolia.com/api/v1', HN = 'https://news.ycombinator.com';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const json = async u => { const r = await fruitfox.fetch(u); if (!r.ok) throw new Error(`HN answered ${r.status}`); return r.json(); };
const domain = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const ago = t => { const s = Date.now() / 1000 - t; return s < 3600 ? `${Math.max(1, s / 60 | 0)}m` : s < 86400 ? `${s / 3600 | 0}h` : s < 2592000 ? `${s / 86400 | 0}d` : new Date(t * 1000).toLocaleDateString(); };

// ---------- Settings: a native screen of switches and pickers (fruitfox.ui.sheet with a screen), saved as 'settings'.
const SETTINGS = [
  { header: 'Stories', rows: [
    { id: 'feed', title: 'Open To', type: 'picker', default: 'top', options: ['top', 'new', 'best', 'ask', 'show', 'job'], labels: ['Top', 'New', 'Best', 'Ask HN', 'Show HN', 'Jobs'] },
    { id: 'minPoints', title: 'Hide Stories Under', type: 'picker', default: '0', options: ['0', '10', '50', '100', '250'], labels: ['Off', '10 points', '50 points', '100 points', '250 points'] },
    { id: 'hideRead', title: 'Hide Stories You’ve Read', type: 'toggle', default: false },
    { id: 'dimRead', title: 'Dim Stories You’ve Read', type: 'toggle', default: true },
    { id: 'muted', title: 'Muted Words', type: 'input', default: '', placeholder: 'crypto, AI, …' },
    { id: 'mutedSites', title: 'Muted Sites', type: 'input', default: '', placeholder: 'example.com, …' },
  ], footer: 'Muted words and sites hide stories whose title or link contains them (separate with commas).' },
  { header: 'Story Rows', rows: [
    { id: 'rank', title: 'Rank Numbers', type: 'toggle', default: true },
    { id: 'icons', title: 'Site Icons', type: 'toggle', default: true },
    { id: 'showDomain', title: 'Site', type: 'toggle', default: true },
    { id: 'showPoints', title: 'Points', type: 'toggle', default: true },
    { id: 'showAuthor', title: 'Author', type: 'toggle', default: true },
    { id: 'showTime', title: 'Time', type: 'toggle', default: true },
    { id: 'compact', title: 'Compact Rows', type: 'toggle', default: false },
  ] },
  { header: 'Opening', rows: [
    { id: 'tapOpens', title: 'Tapping a Story Opens', type: 'picker', default: 'link', options: ['link', 'comments'], labels: ['The Link', 'Comments'] },
    { id: 'linksIn', title: 'Links Open In', type: 'picker', default: 'sheet', options: ['sheet', 'browser'], labels: ['A Sheet', 'Fruitfox Tab'] },
  ] },
  { header: 'Comments', rows: [
    { id: 'order', title: 'Order', type: 'picker', default: 'hn', options: ['hn', 'new', 'old'], labels: ['Hacker News', 'Newest', 'Oldest'] },
    { id: 'collapse', title: 'Collapse Replies', type: 'toggle', default: false },
    { id: 'bars', title: 'Depth Colors', type: 'toggle', default: true },
    { id: 'op', title: 'Highlight the Poster', type: 'toggle', default: true },
    { id: 'textSize', title: 'Text Size', type: 'picker', default: 'm', options: ['s', 'm', 'l'], labels: ['Small', 'Medium', 'Large'] },
  ] },
  { header: 'Look', rows: [
    { id: 'orange', title: 'Hacker News Orange', type: 'toggle', default: true },
    { id: 'haptics', title: 'Haptics', type: 'toggle', default: true },
  ], footer: 'Pull down on a page to see a change.' },
];
const ROWS = SETTINGS.flatMap(s => s.rows);
let S = null;
async function settings() {
  S = { ...Object.fromEntries(ROWS.map(r => [r.id, r.default])), ...(await fruitfox.storage.get('settings')) };
  // Fruitfox sets --accent inline on the page (your accent color), so HN orange goes there too.
  const root = document.documentElement;
  root.dataset.accent ||= root.style.getPropertyValue('--accent');
  root.style.setProperty('--accent', S.orange ? '#ff6600' : root.dataset.accent);
  root.classList.toggle('compact', !!S.compact);
  root.classList.remove('text-s', 'text-l'); root.classList.add('text-' + S.textSize);
  return S;
}
const settingsReady = settings();
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

// ---------- Read, saved and voted stories (kept on this phone).
const memo = {};
async function idSet(key) { return memo[key] ||= new Set((await fruitfox.storage.get(key)) || []); }
async function mark(key, id, on = true) {
  const s = await idSet(key);
  on ? s.add(id) : s.delete(id);
  fruitfox.storage.set(key, [...s].slice(-3000));
}

// ---------- Stories
const FEEDS = { top: 'topstories', new: 'newstories', best: 'beststories', ask: 'askstories', show: 'showstories', job: 'jobstories' };
const item = id => json(`${FB}/item/${id}.json`);
const ids = feed => json(`${FB}/${FEEDS[feed]}.json`);

function hidden(st) {
  if (!st || st.deleted || st.dead) return true;
  if (+S.minPoints && (st.score || 0) < +S.minPoints && st.type !== 'job') return true;
  const words = String(S.muted).split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  const sites = String(S.mutedSites).split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  const t = (st.title || '').toLowerCase(), d = domain(st.url);
  return words.some(w => t.includes(w)) || sites.some(x => d === x || d.endsWith('.' + x));
}

/// One story row. `data-id` opens it; the comments column opens its thread.
function storyRow(st, rank, read) {
  const d = domain(st.url), n = st.descendants ?? 0;
  const meta = [S.showDomain && d && `<span>${esc(d)}</span>`, S.showPoints && st.score != null && st.type !== 'job' && `<span class="pts">${st.score}</span>`,
    S.showAuthor && st.by && `<span data-user="${esc(st.by)}">${esc(st.by)}</span>`, S.showTime && st.time && `<span>${ago(st.time)}</span>`].filter(Boolean).join('<span>·</span>');
  return `<div class="story tappable ${read ? 'read' : ''} ${S.dimRead ? 'dim' : ''}" data-id="${st.id}">
    ${S.rank && rank ? `<span class="rank small">${rank}</span>` : ''}
    ${S.icons ? `<img alt="" class="fav" src="${d ? `https://icons.duckduckgo.com/ip3/${esc(d)}.ico` : 'https://news.ycombinator.com/favicon.ico'}">` : ''}
    <div class="grow"><div class="title">${esc(st.title)}</div><div class="meta">${meta}</div></div>
    ${st.type === 'job' ? '' : `<div class="cbtn" data-thread="${st.id}"><b>${n}</b>${n === 1 ? 'comment' : 'comments'}</div>`}</div>`;
}

async function openLink(url) {
  if (S.linksIn === 'browser') return fruitfox.ui.open(url);
  await fruitfox.ui.web(url);
}

/// Taps and long presses on story rows anywhere (lists, saved, search).
function wireStories(el, find) {
  el.addEventListener('click', async e => {
    const u = e.target.closest('[data-user]');
    if (u) { e.stopPropagation(); return fruitfox.ui.push('user.html?id=' + encodeURIComponent(u.dataset.user), u.dataset.user); }
    const thread = e.target.closest('[data-thread]'), row = e.target.closest('[data-id]');
    if (!row) return;
    const st = find(+row.dataset.id);
    row.classList.add('read'); mark('read', st.id); haptic('light');
    if (thread || S.tapOpens === 'comments' || !st.url) return fruitfox.ui.push('item.html?id=' + st.id, st.type === 'ask' || !st.url ? 'Ask HN' : 'Comments');
    openLink(st.url);
  });
  el.addEventListener('contextmenu', async e => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    e.preventDefault();
    storyMenu(find(+row.dataset.id), row);
  });
}

async function storyMenu(st, row) {
  const saved = (await idSet('saved')).has(st.id), d = domain(st.url);
  const pick = await fruitfox.ui.menu([
    { id: 'comments', title: 'Comments' }, { id: 'vote', title: 'Upvote' },
    { id: 'save', title: saved ? 'Remove from Saved' : 'Save' }, { id: 'share', title: 'Share' },
    ...(d ? [{ id: 'mute', title: `Mute ${d}`, destructive: true }] : []), { id: 'hide', title: 'Hide Story', destructive: true },
  ], st.title);
  if (pick === 'comments') fruitfox.ui.push('item.html?id=' + st.id, 'Comments');
  if (pick === 'vote') vote(st.id);
  if (pick === 'save') { await saveStory(st, !saved); fruitfox.ui.toast(saved ? 'Removed' : 'Saved'); }
  if (pick === 'share') fruitfox.ui.share(st.url || `${HN}/item?id=${st.id}`);
  if (pick === 'hide') { mark('hiddenStories', st.id); row?.remove(); }
  if (pick === 'mute') { S.mutedSites = [S.mutedSites, d].filter(Boolean).join(', '); await fruitfox.storage.set('settings', S); row?.remove(); fruitfox.ui.toast(`Muted ${d}`); }
}

async function saveStory(st, on) {
  const list = ((await fruitfox.storage.get('savedStories')) || []).filter(x => x.id !== st.id);
  if (on) list.unshift({ id: st.id, title: st.title, url: st.url, by: st.by, time: st.time, score: st.score, descendants: st.descendants, type: st.type });
  await fruitfox.storage.set('savedStories', list);
  mark('saved', st.id, on);
}

// ---------- Signed in on news.ycombinator.com: voting needs the per-item auth token from the item's page.
const me = async () => (await fruitfox.cookie('user', 'news.ycombinator.com'))?.split('&')[0] || null;
async function vote(id, how = 'up') {
  if (!await me()) { await fruitfox.ui.signIn(`${HN}/login?goto=news`); if (!await me()) return; }
  const page = (await fruitfox.fetch(`${HN}/item?id=${id}`)).body;
  const href = page.match(new RegExp(`href=['"](vote\\?id=${id}&(?:amp;)?how=${how}[^'"]*)['"]`))?.[1]?.replaceAll('&amp;', '&');
  if (!href) return fruitfox.ui.toast(how === 'up' ? 'Already voted (or can’t vote on this)' : 'Can’t do that');
  await fruitfox.fetch(`${HN}/${href}`);
  mark('voted', id, how === 'up'); haptic('success');
  fruitfox.ui.toast(how === 'up' ? 'Upvoted' : 'Vote removed');
}

// ---------- Comments (Algolia: the whole tree at once).
const BARS = ['#ff6600', '#34c759', '#0a84ff', '#af52de', '#ff2d55', '#ffcc00', '#5ac8fa'];
/// HN's comment HTML is already limited (<p>, <i>, <a>, <pre>), but it's someone else's: strip anything active.
function clean(html) {
  const d = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  d.querySelectorAll('script,style,iframe,object,embed,form,img,link,meta,base').forEach(n => n.remove());
  d.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => { if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name); }));
  return d.body.firstChild.innerHTML;
}
function sortKids(kids, order, rank) {
  const k = (kids || []).filter(c => c.text || c.children?.length);
  if (order === 'new') return k.sort((a, b) => b.created_at_i - a.created_at_i);
  if (order === 'old') return k.sort((a, b) => a.created_at_i - b.created_at_i);
  return rank ? k.sort((a, b) => (rank.indexOf(a.id) + 1 || 1e9) - (rank.indexOf(b.id) + 1 || 1e9)) : k;
}
function countAll(c) { return (c.children || []).reduce((n, k) => n + 1 + countAll(k), 0); }
function commentHTML(c, depth, op) {
  const kids = sortKids(c.children, S.order);
  const n = countAll(c), folded = S.collapse && depth > 0;
  return `<div class="c ${folded ? 'folded' : ''} ${c.text ? '' : 'dead'}" data-c="${c.id}" style="--bar:${BARS[depth % BARS.length]}">
    <div class="body"><div class="by"><b data-user="${esc(c.author)}" class="${S.op && c.author === op ? 'op' : ''}">${esc(c.author || '[deleted]')}</b><span>${ago(c.created_at_i)}</span>
      ${n ? `<span class="n">${folded ? `+${n}` : ''}</span>` : ''}</div>
    <div class="text">${c.text ? clean(c.text) : '[deleted]'}</div></div>
    ${kids.length ? `<div class="kids">${kids.map(k => commentHTML(k, depth + 1, op)).join('')}</div>` : ''}</div>`;
}

// ---------- Paging: calls `more` when the end of the page comes near.
function onNearEnd(more) {
  let busy = false;
  addEventListener('scroll', async () => {
    if (busy || innerHeight + scrollY < document.body.scrollHeight - 1200) return;
    busy = true; try { await more(); } finally { busy = false; }
  }, { passive: true });
}

fruitfox.on('button', id => { if (id === 'settings') openSettings(); });
