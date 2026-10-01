// Threads: threads.com's own GraphQL API (signed out: profiles, posts, replies and people search work without an
// account). People you follow here are kept on this phone and make your Home feed, newest first. Liking, replying and
// reposting open the post on threads.com in a sheet, signed in.
const $ = s => document.querySelector(s);
const TH = 'https://www.threads.com';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = n => !n ? '' : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
// The query IDs threads.com used when this was written (they change every few weeks; see NOTES.md) and the feature
// flags its queries send.
const DOCS = {
  profile: ['27771741022498740', 'BarcelonaProfilePageDirectQuery'],
  posts: ['29307336712207960', 'BarcelonaProfileThreadsTabDirectQuery'],
  target: ['28483134274683819', 'BarcelonaPostPageTargetQuery'],
  replies: ['28290267110643663', 'BarcelonaPostPageDownwardQuery'],
  people: ['27899326536411969', 'useBarcelonaAccountSearchGraphQLDataSourceQuery'],
};
const FLAGS = {"__relay_internal__pv__BarcelonaHasBestOfThreadsrelayprovider":false,"__relay_internal__pv__BarcelonaHasDearAlgoConsumptionrelayprovider":true,"__relay_internal__pv__BarcelonaHasMetaAiContentAttachmentsrelayprovider":false,"__relay_internal__pv__BarcelonaShouldFetchPostAuthorFullNamerelayprovider":false,"__relay_internal__pv__BarcelonaIsLoggedInrelayprovider":false,"__relay_internal__pv__BarcelonaMessagesHasLiveChatMessagingrelayprovider":false,"__relay_internal__pv__BarcelonaHasEventBadgerelayprovider":false,"__relay_internal__pv__BarcelonaMessagingHasMetaAIBotrelayprovider":false,"__relay_internal__pv__BarcelonaGenAIRepliesEnabledrelayprovider":false,"__relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider":false,"__relay_internal__pv__BarcelonaHasCommunitiesrelayprovider":true,"__relay_internal__pv__BarcelonaHasGameScoreSharerelayprovider":true,"__relay_internal__pv__BarcelonaHasPublicViewCountCardrelayprovider":true,"__relay_internal__pv__BarcelonaHasCommunityEmojiUpdateCardrelayprovider":true,"__relay_internal__pv__BarcelonaHasCommunityEntityCardrelayprovider":false,"__relay_internal__pv__BarcelonaHasScorecardCommunityrelayprovider":false,"__relay_internal__pv__BarcelonaHasSportTeamAllegianceCardrelayprovider":false,"__relay_internal__pv__BarcelonaHasMusicrelayprovider":true,"__relay_internal__pv__BarcelonaHasNewspaperLinkStylerelayprovider":false,"__relay_internal__pv__BarcelonaHasMessagingrelayprovider":false,"__relay_internal__pv__BarcelonaHasPodcastV2Consumptionrelayprovider":true,"__relay_internal__pv__BarcelonaHasPodcastTranscriptConsumptionrelayprovider":true,"__relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider":true,"__relay_internal__pv__BarcelonaShouldFulfillLightboxQueryrelayprovider":true,"__relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider":false,"__relay_internal__pv__BarcelonaHasWebFaviconsrelayprovider":false,"__relay_internal__pv__BarcelonaIsCrawlerrelayprovider":false,"__relay_internal__pv__BarcelonaHasDearAlgoWebProductionrelayprovider":false,"__relay_internal__pv__BarcelonaHasCommunityTopContributorsrelayprovider":false,"__relay_internal__pv__BarcelonaHasViewerRepliedrelayprovider":true,"__relay_internal__pv__BarcelonaHasPrivateRepliesDeprecationrelayprovider":false,"__relay_internal__pv__BarcelonaHasGhostPostEmojiActivationrelayprovider":false,"__relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider":false,"__relay_internal__pv__BarcelonaIsInternalUserrelayprovider":false,"__relay_internal__pv__BarcelonaHasPermalinkIndentationrelayprovider":false,"__relay_internal__pv__BarcelonaHasCommunityPermalinkPivotsrelayprovider":false,"__relay_internal__pv__BarcelonaHasPodcastV2Productionrelayprovider":false,"__relay_internal__pv__BarcelonaHasInsightsPermalinkUFIrelayprovider":true,"__relay_internal__pv__BarcelonaShouldShowFediverseM1Featuresrelayprovider":false,"__relay_internal__pv__BarcelonaHasPostAuthorNotifControlsrelayprovider":true,"__relay_internal__pv__BarcelonaHasCommunityNoteWriteEntrypointrelayprovider":false,"__relay_internal__pv__BarcelonaIsLoggedOutrelayprovider":true,"__relay_internal__pv__BarcelonaHasInsightsProfileM2relayprovider":true,"__relay_internal__pv__BarcelonaHasCommunitiesOrLoggedOutrelayprovider":true,"__relay_internal__pv__BarcelonaHasProfileSelfReplyContextrelayprovider":false};

// ---------- Settings (a native screen).
const SETTINGS = [
  { header: 'Home', rows: [
    { id: 'replies', title: 'Show Replies', type: 'toggle', default: false },
    { id: 'reposts', title: 'Show Reposts', type: 'toggle', default: true },
    { id: 'perPerson', title: 'Posts per Person', type: 'picker', default: '10', options: ['5', '10', '20'], labels: ['5', '10', '20'] },
    { id: 'muted', title: 'Muted Words', type: 'input', default: '', placeholder: 'politics, …' },
  ], footer: 'Home shows the newest posts from people you follow in this app (Following).' },
  { header: 'Posts', rows: [
    { id: 'counts', title: 'Like and Reply Counts', type: 'toggle', default: true },
    { id: 'blurSpoilers', title: 'Blur Spoilers', type: 'toggle', default: true },
    { id: 'autoplay', title: 'Autoplay Videos', type: 'toggle', default: true },
    { id: 'linksIn', title: 'Links Open In', type: 'picker', default: 'sheet', options: ['sheet', 'browser'], labels: ['A Sheet', 'Fruitfox Tab'] },
  ] },
  { header: 'General', rows: [{ id: 'haptics', title: 'Haptics', type: 'toggle', default: true }], footer: 'Pull down on a page to see a change.' },
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
  const { id, value } = JSON.parse(j), r = ROWS.find(r => r.id === id); if (!r) return;
  const s = await settings(); s[id] = r.type === 'toggle' ? value === 'true' : value;
  await fruitfox.storage.set('settings', s); await settings();
});
const haptic = k => S?.haptics && fruitfox.ui.haptic(k);

// ---------- GraphQL, as threads.com sends it signed out (its page's LSD token; no cookies).
let lsd;
async function token(fresh) {
  if (!fresh && (lsd ||= await fruitfox.storage.get('lsd')) && Date.now() - lsd.at < 3600e3) return lsd.v;
  const html = (await fruitfox.fetch(TH + '/', { cookies: false, headers: { Accept: 'text/html' } })).body;
  const v = html.match(/"LSD",\[\],\{"token":"([^"]+)"/)?.[1];
  if (!v) throw new Error('Threads didn’t answer as expected');
  lsd = { v, at: Date.now() }; fruitfox.storage.set('lsd', lsd);
  return v;
}
async function gql(which, vars, retried) {
  const [doc, name] = DOCS[which], t = await token(retried);
  const r = await fruitfox.fetch(TH + '/api/graphql', { method: 'POST', cookies: false,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-FB-LSD': t, 'X-IG-App-ID': '238260118697367', 'X-FB-Friendly-Name': name, Origin: TH, Referer: TH + '/' },
    body: new URLSearchParams({ lsd: t, doc_id: doc, variables: JSON.stringify({ ...vars, ...FLAGS }), fb_api_req_friendly_name: name }).toString() });
  const j = r.body.startsWith('{') ? r.json() : null;
  if (!j?.data) {
    fruitfox.log(`${which} → ${r.status} ${r.body.slice(0, 200)}`);
    if (!retried) return gql(which, vars, true);
    throw new Error(j?.errors?.[0]?.summary || 'Threads changed how this works; the app needs an update');
  }
  return j.data;
}
function find(o, key, out = []) {
  if (Array.isArray(o)) for (const x of o) find(x, key, out);
  else if (o && typeof o === 'object') for (const k in o) { if (k === key) out.push(o[k]); find(o[k], key, out); }
  return out;
}
/// Every thread (a chain of posts) in a response.
const threadsOf = d => find(d, 'thread_items').map(items => items.map(i => i.post).filter(p => p?.pk));
/// A post page's replies: direct_replies.edges, each node a reply thread (posts.edges of posts).
const repliesOf = d => find(d, 'direct_replies').flatMap(r => r.edges || []).map(e => e.node)
  .map(n => n?.posts?.edges ? n.posts.edges.map(e => e.node) : n?.thread_items ? n.thread_items.map(i => i.post) : [n?.post || n]).map(c => c.filter(p => p?.pk)).filter(c => c.length);
async function userId(username) {
  const r = await gql('people', { query: username, first: 10, should_fetch_ig_inactive_on_text_app: null, should_fetch_friendship_status: false,
    should_fetch_fediverse_profiles: false, should_fetch_mention_restriction: false, hide_unconnected_private: false, is_internal_user: false });
  return people(r).find(u => u.username.toLowerCase() === username.toLowerCase());
}
const people = d => { const seen = new Set(); return find(d, 'username').length ? findUsers(d).filter(u => !seen.has(u.pk) && seen.add(u.pk)) : []; };
function findUsers(o, out = []) {
  if (Array.isArray(o)) for (const x of o) findUsers(x, out);
  else if (o && typeof o === 'object') { if (o.username && o.pk && 'profile_pic_url' in o) out.push(o); for (const k in o) findUsers(o[k], out); }
  return out;
}
async function userPosts(id, after) {
  const d = await gql('posts', { allow_page_info_for_lox_user: true, first: 10, userID: id, ...(after ? { after } : {}) });
  return { threads: threadsOf(d), next: d.mediaData?.page_info?.has_next_page ? d.mediaData.page_info.end_cursor : null };
}

// ---------- Posts.
const IC = {
  like: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>',
  reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.1A8 8 0 1 1 20 11.5Z"/></svg>',
  repost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z"/></svg>',
};
const ago = t => { const s = Date.now() / 1000 - t; return s < 3600 ? `${Math.max(1, s / 60 | 0)}m` : s < 86400 ? `${s / 3600 | 0}h` : s < 604800 ? `${s / 86400 | 0}d` : new Date(t * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' }); };
const linkify = t => esc(t).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}">${u}</a>`).replace(/(^|\s)@([\w.]+)/g, '$1<a data-user="$2">@$2</a>');
const media = p => {
  const items = p.carousel_media || (p.image_versions2?.candidates?.length || p.video_versions?.length ? [p] : []);
  if (!items.length) return '';
  const spoiler = S.blurSpoilers && p.text_post_app_info?.is_spoiler_media;
  return `<div class="media ${items.length === 1 ? 'one' : ''} ${spoiler ? 'blur' : ''}">${items.map(m => m.video_versions?.length
    ? `<video playsinline muted loop ${S.autoplay ? 'autoplay' : ''} controls preload="none" poster="${esc(fruitfox.media(m.image_versions2?.candidates?.[0]?.url))}" src="${esc(fruitfox.media(m.video_versions[0].url))}"></video>`
    : `<img alt="${esc(m.accessibility_caption || '')}" loading="lazy" src="${esc(fruitfox.media(m.image_versions2?.candidates?.[0]?.url))}">`).join('')}</div>`;
};
const posts = new Map();
function postHTML(p, { chain = false, line = false } = {}) {
  posts.set(p.pk, p);
  const u = p.user || {}, i = p.text_post_app_info || {}, q = i.share_info?.quoted_post;
  return `<div class="t tappable ${chain ? 'chain' : ''}" data-pk="${esc(p.pk)}" data-code="${esc(p.code)}"><div class="l"><img alt="" class="av" data-user="${esc(u.username)}" src="${esc(fruitfox.media(u.profile_pic_url))}">${line ? '<div class="line"></div>' : ''}</div>
    <div class="body"><div class="by"><b data-user="${esc(u.username)}">${esc(u.username)}</b>${u.is_verified ? '<span class="verified">✔︎</span>' : ''}<span class="ago">${ago(p.taken_at)}</span><span class="more" data-a="more">···</span></div>
      <div class="tx">${linkify(p.caption?.text || '')}</div>${media(p)}
      ${q?.pk ? `<div class="quote" data-pk="${esc(q.pk)}" data-code="${esc(q.code)}"><b>${esc(q.user?.username)}</b><div class="tx">${linkify(q.caption?.text || '')}</div></div>` : ''}
      <div class="icons"><span data-a="like">${IC.like}${S.counts ? num(p.like_count) : ''}</span><span data-a="reply">${IC.reply}${S.counts ? num(i.direct_reply_count) : ''}</span>
        <span data-a="repost">${IC.repost}${S.counts ? num(i.repost_count) : ''}</span><span data-a="share">${IC.share}</span></div></div></div>`;
}
function threadHTML(chain) {
  const muted = String(S.muted).split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  if (chain.some(p => muted.some(w => (p.caption?.text || '').toLowerCase().includes(w)))) return '';
  return chain.map((p, i) => postHTML(p, { chain: i > 0, line: i < chain.length - 1 })).join('');
}
const postURL = p => `${TH}/@${p.user?.username}/post/${p.code}`;
const openLink = url => S.linksIn === 'browser' ? fruitfox.ui.open(url) : fruitfox.ui.web(url);
function wirePosts(el) {
  el.addEventListener('click', async e => {
    const t = e.target, a = t.closest('a');
    const user = t.closest('[data-user]');
    if (user) { e.preventDefault(); return fruitfox.ui.push('profile.html?u=' + encodeURIComponent(user.dataset.user), '@' + user.dataset.user); }
    if (a?.href) { e.preventDefault(); return openLink(a.href); }
    if (t.closest('.blur')) { t.closest('.blur').classList.remove('blur'); return; }
    if (t.closest('video')) return;
    const row = t.closest('[data-pk]'); if (!row) return;
    const p = posts.get(row.dataset.pk) || { code: row.dataset.code, pk: row.dataset.pk, user: {} };
    const act = t.closest('[data-a]')?.dataset.a;
    if (act === 'share') return fruitfox.ui.share(postURL(p));
    if (['like', 'reply', 'repost'].includes(act)) return fruitfox.ui.web(postURL(p));
    if (act === 'more') { const pick = await fruitfox.ui.menu([{ id: 'web', title: 'Open on threads.com' }, { id: 'share', title: 'Share' }]); if (pick === 'web') fruitfox.ui.web(postURL(p)); if (pick === 'share') fruitfox.ui.share(postURL(p)); return; }
    haptic('light');
    await fruitfox.storage.set('post', p);
    fruitfox.ui.push('post.html?pk=' + p.pk, 'Thread');
  });
}

// ---------- Following, on this phone.
async function follows() { return (await fruitfox.storage.get('follows')) || []; }
async function setFollow(u, on) {
  const l = (await follows()).filter(x => x.pk !== u.pk);
  if (on) l.push({ pk: u.pk, username: u.username, pic: u.profile_pic_url, name: u.full_name });
  await fruitfox.storage.set('follows', l.sort((a, b) => a.username.localeCompare(b.username)));
  haptic(on ? 'success' : 'light');
}
function userRow(u, followed) {
  return `<div class="urow tappable" data-user="${esc(u.username)}"><img alt="" src="${esc(fruitfox.media(u.profile_pic_url || u.pic))}"><div class="grow"><b>${esc(u.username)}${u.is_verified ? ' <span class="verified">✔︎</span>' : ''}</b><span>${esc(u.full_name || u.name || '')}</span></div>
    <button class="${followed ? '' : 'dark'}" data-follow="${esc(u.pk)}">${followed ? 'Following' : 'Follow'}</button></div>`;
}
function onNearEnd(f) { let busy = false; addEventListener('scroll', async () => { if (busy || innerHeight + scrollY < document.body.scrollHeight - 1500) return; busy = true; try { await f(); } finally { busy = false; } }, { passive: true }); }
const errorHTML = e => `<div class="center"><div class="headline">Couldn’t load Threads</div><div class="secondary">${esc(e.message)}</div></div>`;
fruitfox.on('button', id => { if (id === 'settings') openSettings(); if (id === 'new') fruitfox.ui.web(TH + '/'); });
const BUTTONS = [{ id: 'new', symbol: 'square.and.pencil', title: 'New Thread' }, { id: 'settings', symbol: 'slider.horizontal.3', title: 'Settings' }];
