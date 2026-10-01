// Instagram's own web API (what instagram.com uses), signed in with your Instagram cookies, plus the pieces every
// page draws. Unofficial: Instagram can change it, and flags accounts that act like bots, so requests are paced.
// Every request here is written up in NOTES.md (how it was found, its inputs and response).
const IG = 'https://www.instagram.com';
const WEB_APP_ID = '936619743392459';  // instagram.com's public app ID

let last = 0;
async function pace() {
  const wait = last + 350 - Date.now();  // ponytail: one global pace; per-endpoint limits if Instagram complains
  last = Date.now() + Math.max(wait, 0);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
}

async function api(path, { method = 'GET', form } = {}) {
  await pace();
  if (!await fruitfox.cookie('sessionid', 'www.instagram.com')) throw new SignedOut();
  const csrf = await fruitfox.cookie('csrftoken', 'www.instagram.com');
  const r = await fruitfox.fetch(IG + '/api/v1/' + path, {
    method,
    headers: {
      'X-IG-App-ID': WEB_APP_ID, 'X-CSRFToken': csrf || '', 'X-Requested-With': 'XMLHttpRequest', 'X-ASBD-ID': '129477',
      'Referer': IG + '/', 'Origin': IG, 'Accept': '*/*',
      ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : null,
  });
  if (r.status === 401 || r.status === 403 || /login_required|checkpoint_required/.test(r.body)) throw new SignedOut();
  if (r.status === 429) throw new Error('Instagram asked Fruitfox to slow down. Try again in a few minutes.');
  if (!r.ok) fruitfox.log(`${method} ${path} → ${r.status} ${r.body.slice(0, 300)}`);
  if (!r.ok) throw new Error(`Instagram said ${r.status}` + (r.body.startsWith('{') ? ': ' + (r.json().message || '') : ''));
  if (!r.body.trimStart().startsWith('{')) throw new SignedOut();  // a web page (the login page) instead of data
  return r.json();
}

// GraphQL: what instagram.com itself uses for most things now. It needs two tokens from instagram.com's page, and the
// site's query IDs, which Instagram changes every few weeks: when a query stops working, the new doc_id is in
// instagram.com's scripts as __d("<name>_instagramRelayOperation",…exports="<id>").
// ponytail: hard-coded IDs; read them from the site's scripts at runtime when they start changing often.
const DOCS = {
  profile: ['/api/graphql', '28036671149327607', 'PolarisProfilePageContentQuery'],
  profilePosts: ['/graphql/query', '28570182382647478', 'PolarisProfilePostsQuery'],
  reelsTab: ['/graphql/query', '29628758406714645', 'PolarisProfileReelsTabContentQuery'],
  tagged: ['/graphql/query', '39772566182330372', 'PolarisProfileTaggedTabContentQuery'],
  taggedMore: ['/graphql/query', '28751062417852963', 'PolarisProfileTaggedTabContentQuery_connection'],
  highlights: ['/api/graphql', '26970053832668570', 'PolarisProfileStoryHighlightsTrayContentQuery'],
  keyword: ['/api/graphql', '28656899673911396', 'PolarisKeywordSearchExplorePageRelayPaginationQuery'],
  reels: ['/graphql/query', '28230813126620480', 'PolarisClipsTabDesktopPaginationQuery'],
  activity: ['/graphql/query', '28990670510517370', 'PolarisActivityFeedStoriesViewQuery'],
  inbox: ['/api/graphql', '28988285840768396', 'PolarisDirectInboxQuery'],
  thread: ['/api/graphql', '28288012930891325', 'IGDThreadDetailQuery'],
  like: ['/api/graphql', '27182485238052618', 'usePolarisLikeMediaXIGLikeMutation'],
  unlike: ['/api/graphql', '27345296031770102', 'usePolarisLikeMediaXIGUnlikeMutation'],
  save: ['/api/graphql', '27365486596441074', 'usePolarisSaveMediaSaveMutation'],
  unsave: ['/api/graphql', '27371251859134880', 'usePolarisSaveMediaUnsaveMutation'],
  likeComment: ['/api/graphql', '27184292767848867', 'PolarisCommentActionsLikeMutation'],
  unlikeComment: ['/api/graphql', '27318337671093716', 'PolarisCommentActionsUnlikeMutation'],
  likeStory: ['/api/graphql', '26938887309082050', 'usePolarisStoriesV4LikeMutationLikeMutation'],
  unlikeStory: ['/api/graphql', '26510485515280697', 'usePolarisStoriesV4LikeMutationUnlikeMutation'],
  follow: ['/api/graphql', '26508036048874888', 'usePolarisFollowMutation'],
  unfollow: ['/api/graphql', '27789106940691111', 'usePolarisUnfollowMutation'],
};
let tokens;
async function webTokens(fresh) {
  if (!fresh && (tokens ||= await fruitfox.storage.get('tokens')) && Date.now() - tokens.at < 3600e3) return tokens;
  const html = (await fruitfox.fetch(IG + '/', { headers: { Accept: 'text/html' } })).body;
  const lsd = html.match(/"LSD",\[\],\{"token":"([^"]+)"/)?.[1], dtsg = html.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/)?.[1];
  if (!lsd || !dtsg) throw new SignedOut();
  tokens = { lsd, dtsg, at: Date.now() };
  fruitfox.storage.set('tokens', tokens);
  return tokens;
}
let docCache = null;
async function getDoc(key) {
  if (docCache && docCache[key]) return docCache[key];
  const stored = await fruitfox.storage.get('doc_ids');
  if (stored && stored[key]) {
    docCache = stored;
    return stored[key];
  }
  return DOCS[key][1];
}

async function updateDocs() {
  const lastScan = await fruitfox.storage.get('doc_ids_last_scan');
  if (lastScan && Date.now() - lastScan < 24 * 60 * 60 * 1000) return;
  fruitfox.log('Updating Instagram GraphQL Query IDs...');
  const html1 = (await fruitfox.fetch(IG + '/', { headers: { Accept: 'text/html' } })).body;
  const html2 = (await fruitfox.fetch(IG + '/instagram/', { headers: { Accept: 'text/html' } })).body;
  const scripts = [...html1.matchAll(/(?:href|src)="([^"]+\.js)"/g), ...html2.matchAll(/(?:href|src)="([^"]+\.js)"/g)].map(m => m[1]);
  const newDocs = { ...docCache, ...(await fruitfox.storage.get('doc_ids')) };
  const namesToFind = new Set(Object.keys(DOCS).map(k => DOCS[k][2]));
  const regex = /__d\("([^"]+)_instagramRelayOperation",\[\],\(function\([^)]*\)\{.*?exports="(\d+)"/g;

  for (const s of [...new Set(scripts)]) {
    if (namesToFind.size === 0) break;
    const url = s.startsWith('/') ? IG + s : s;
    try {
      const js = (await fruitfox.fetch(url)).body;
      for (const m of js.matchAll(regex)) {
        const name = m[1], doc = m[2];
        const key = Object.keys(DOCS).find(k => DOCS[k][2] === name);
        if (key) {
          newDocs[key] = doc;
          namesToFind.delete(name);
        }
      }
    } catch (e) { }
  }
  docCache = newDocs;
  await fruitfox.storage.set('doc_ids', newDocs);
  await fruitfox.storage.set('doc_ids_last_scan', Date.now());
  fruitfox.log('Updated Instagram GraphQL Query IDs');
}

async function gql(which, variables, retried) {
  const [path, _fallbackDoc, name] = DOCS[which];
  const doc = await getDoc(which);
  const t = await webTokens(retried);
  await pace();
  const r = await fruitfox.fetch(IG + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRFToken': await fruitfox.cookie('csrftoken', 'www.instagram.com') || '',
               'X-IG-App-ID': WEB_APP_ID, 'X-FB-LSD': t.lsd, 'X-FB-Friendly-Name': name, 'Referer': IG + '/', 'Origin': IG },
    body: new URLSearchParams({ doc_id: doc, variables: JSON.stringify(variables), lsd: t.lsd, fb_dtsg: t.dtsg, fb_api_req_friendly_name: name, fb_api_caller_class: 'RelayModern', server_timestamps: 'true' }).toString(),
  });
  if (r.status === 429) throw new Error('Instagram asked Fruitfox to slow down. Try again in a few minutes.');
  const j = r.body.trimStart().startsWith('{') ? r.json() : null;
  if (!j?.data || Object.values(j.data).every(v => v == null)) {
    fruitfox.log(`${which} → ${r.status} ${r.body.slice(0, 300)}`);
    if (!retried) return gql(which, variables, 1);  // tokens expired: fetch new ones once
    if (retried === 1) {
      await updateDocs();
      return gql(which, variables, 2); // IDs might have changed, try one last time with new IDs
    }
    throw new Error(j?.errors?.[0]?.message || 'Instagram changed how this works; Fruitfox needs an update');
  }
  return j.data;
}
const RELAY = { __relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider: true, __relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider: false,
  __relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider: false, __relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider: true,
  __relay_internal__pv__PolarisShortDramaEnabledrelayprovider: false, __relay_internal__pv__PolarisMultiCaptionCarouselEnabledrelayprovider: true,
  __relay_internal__pv__PolarisReelsRecoDebugOverlayEnabledrelayprovider: false, __relay_internal__pv__PolarisIsLoggedInrelayprovider: true,
  __relay_internal__pv__IGDEnableOffMsysChatThemesQErelayprovider: false, __relay_internal__pv__IGDInitialMessagePageCountrelayprovider: 20,
  __relay_internal__pv__IGDIsProfessionalAccountGKrelayprovider: false, __relay_internal__pv__IGDPinnedThreadsRenderEnabledGKrelayprovider: true,
  __relay_internal__pv__IGDMaxUnreadMessagesCountrelayprovider: 5 };

class SignedOut extends Error { constructor() { super('Signed out'); } }

const me = async () => await fruitfox.cookie('ds_user_id', 'www.instagram.com');

/// Your account's Facebook-style id (fbid_v2), which likes and saves are made as.
async function actor() {
  let a = await fruitfox.storage.get('actor');
  if (!a || a.user !== await me()) { a = { user: await me(), id: (await ig.profile(await me())).fbid_v2 }; fruitfox.storage.set('actor', a); }
  return a.id;
}
let mutations = 0;
const mediaInput = async id => ({ input: { actor_id: await actor(), client_mutation_id: String(++mutations), media_id: String(id), container_module: 'feed_timeline' } });
const connection = (c, map = e => e.node) => ({ items: (c?.edges || []).map(map).filter(Boolean), next: c?.page_info?.has_next_page ? c.page_info.end_cursor : null });

const ig = {
  timeline: maxId => api('feed/timeline/', { method: 'POST', form: { reason: maxId ? 'pagination' : 'cold_start_fetch', is_pull_to_refresh: '0', ...(maxId ? { max_id: maxId } : {}) } }),
  tray: () => api('feed/reels_tray/'),
  stories: id => api('feed/reels_media/?reel_ids=' + encodeURIComponent(id)),
  explore: maxId => api('discover/web/explore_grid/?include_fixed_destinations=true&is_nonpersonalized_explore=false&is_prefetch=false&module=explore_popular' + (maxId ? '&max_id=' + encodeURIComponent(maxId) : '')),
  profile: async id => (await gql('profile', { ...RELAY, id: String(id), enable_integrity_filters: true })).user,
  /// A profile's posts, 12 at a time: { items, next (cursor), user (the owner, when there are posts) }.
  profilePosts: async (username, after) => {
    const c = (await gql('profilePosts', { ...RELAY, username, data: { count: 12, include_reel_media_seen_timestamp: true, include_relationship_info: true,
      latest_besties_reel_media: true, latest_reel_media: true }, ...(after ? { after, first: 12, before: null, last: null } : {}) })).xdt_api__v1__feed__user_timeline_graphql_connection;
    const r = connection(c);
    return { ...r, user: r.items[0]?.user };
  },
  profileReels: async id => connection((await gql('reelsTab', { ...RELAY, data: { include_feed_video: true, page_size: 12, target_user_id: String(id) }, user_id: String(id) }))
    .fetch__XDTUserDict?.clips_connection, e => e.node.media),
  tagged: async (id, after) => connection((await (after ? gql('taggedMore', { ...RELAY, after, before: null, first: 12, last: null, count: 12, user_id: String(id) })
    : gql('tagged', { ...RELAY, count: 12, user_id: String(id) }))).xdt_api__v1__usertags__user_id__feed_connection),
  highlights: async id => ((await gql('highlights', { user_id: String(id) })).highlights?.edges || []).map(e => e.node),
  /// Hashtag or keyword results ("#cats"): posts.
  keyword: async (query, after) => {
    const sid = (keywordSession ||= crypto.randomUUID());
    const c = (await gql('keyword', { query, first: 24, search_session_id: sid, serp_session_id: sid, ...(after ? { after } : {}) })).xdt_fbsearch__top_serp_graphql;
    return { items: findMedia(c?.edges || []), next: c?.page_info?.has_next_page ? c.page_info.end_cursor : null };
  },
  reels: async after => connection((await gql('reels', { ...RELAY, after: after || null, before: null, first: 10, last: null,
    data: { container_module: 'clips_tab_desktop_page', seen_reels: '[]' } })).xdt_api__v1__clips__home__connection_v2, e => e.node.media),
  saved: maxId => api('feed/saved/posts/' + (maxId ? '?max_id=' + encodeURIComponent(maxId) : '')),
  follows: (id, kind, maxId) => api(`friendships/${id}/${kind}/?count=24&search_surface=follow_list_page` + (maxId ? '&max_id=' + encodeURIComponent(maxId) : '')),
  activity: () => gql('activity', { inbox_request_data: {}, pending_request_data: {} }),
  inbox: async () => (await gql('inbox', { ...RELAY, device_id_for_iris_subscription: await deviceId() })).get_slide_mailbox_for_iris_subscription,
  thread: async fbid => (await gql('thread', { ...RELAY, min_uq_seq_id: null, thread_fbid: String(fbid) })).get_slide_thread_nullable?.as_ig_direct_thread,
  media: id => api(`media/${id}/info/`),
  comments: (id, minId) => api(`media/${id}/comments/?can_support_threading=true&permalink_enabled=false` + (minId ? '&min_id=' + encodeURIComponent(minId) : '')),
  replies: (id, commentId) => api(`media/${id}/comments/${commentId}/child_comments/`),
  like: async (id, on) => gql(on ? 'like' : 'unlike', await mediaInput(id)),
  save: async (id, on) => gql(on ? 'save' : 'unsave', await mediaInput(id)),
  likeComment: async (id, on) => gql(on ? 'likeComment' : 'unlikeComment', { input: { comment_id: String(id), actor_id: await actor(), client_mutation_id: String(++mutations) } }),
  likeStory: async (id, on) => gql(on ? 'likeStory' : 'unlikeStory', { input: { actor_id: await actor(), client_mutation_id: String(++mutations), media_id: String(id) } }),
  comment: (id, text, replyTo) => api(`web/comments/${id}/add/`, { method: 'POST', form: { comment_text: text, ...(replyTo ? { replied_to_comment_id: replyTo } : {}) } }),
  follow: (id, on) => gql(on ? 'follow' : 'unfollow', { target_user_id: String(id), container_module: 'profile' }),
  search: q => api('web/search/topsearch/?context=blended&query=' + encodeURIComponent(q)),
};
let keywordSession;
async function deviceId() {
  let d = await fruitfox.storage.get('device');
  if (!d) { d = crypto.randomUUID(); fruitfox.storage.set('device', d); }
  return d;
}

// MARK: Settings (settings.html)

const defaults = { newestFirst: true, hideReels: true, hideSuggested: true, hideLikes: false, igColors: false, limit: 0 };
async function settings() { return { ...defaults, ...(await fruitfox.storage.get('settings')) }; }

/// Instagram Colors: Instagram's blue, red hearts and gradient story rings instead of your Fruitfox accent color.
/// Fruitfox sets --accent on the page itself, so it's replaced the same way (a stylesheet rule can't win).
const fruitfoxAccent = document.documentElement.style.getPropertyValue('--accent');
async function applyColors() {
  const on = (await settings()).igColors, root = document.documentElement;
  root.classList.toggle('ig-colors', on);
  root.style.setProperty('--accent', on ? '#0095f6' : fruitfoxAccent);
}
applyColors();
fruitfox.on('refresh', applyColors);

// Daily time limit: time you're actively using the app (touches and scrolling, up to 30 s after each), per day.
// Past the limit, a screen asks you to stop (or allows 15 more minutes).
(() => {
  let lastActive = 0, pending = 0;
  const day = () => new Date().toDateString();
  const active = () => { const now = Date.now(); pending += Math.min(now - lastActive, 30e3); lastActive = now; };
  addEventListener('pointerdown', active, { passive: true });
  addEventListener('scroll', active, { passive: true });
  setInterval(async () => {
    if (pending < 5e3) return;
    const add = pending; pending = 0;
    const u = await fruitfox.storage.get('usage') || {};
    const used = (u.day === day() ? u.secs : 0) + add / 1000;
    fruitfox.storage.set('usage', { day: day(), secs: used, extra: u.day === day() ? u.extra || 0 : 0 });
    const s = await settings();
    if (s.limit && used > (s.limit + (u.day === day() ? u.extra || 0 : 0)) * 60 && !document.querySelector('.limit')) {
      document.body.insertAdjacentHTML('beforeend', `<div class="limit"><div class="title">Time’s up for today</div>
        <div class="secondary">You’ve used Instagram for ${s.limit} minutes today, your limit in Settings.</div>
        <button class="button" data-limit="close">Close Instagram</button><button class="button plain" data-limit="more">15 More Minutes</button></div>`);
      document.querySelector('.limit').addEventListener('click', async e => {
        const a = e.target.dataset.limit;
        if (a === 'close') fruitfox.ui.exit();
        if (a === 'more') { const v = await fruitfox.storage.get('usage'); v.extra = (v.extra || 0) + 15; await fruitfox.storage.set('usage', v); document.querySelector('.limit').remove(); }
      });
    }
  }, 15e3);
})();

// MARK: Drawing

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const $ = s => document.querySelector(s);
const count = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : (n ?? 0).toLocaleString();
function ago(t) {
  const s = Date.now() / 1000 - t;
  return s < 3600 ? Math.max(1, Math.round(s / 60)) + 'm' : s < 86400 ? Math.round(s / 3600) + 'h' : s < 604800 ? Math.round(s / 86400) + 'd'
    : new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
const best = m => m?.image_versions2?.candidates?.[0]?.url || m?.display_uri || m?.thumbnail_url;
// Profile pictures only load on instagram.com's own pages (Cross-Origin-Resource-Policy), so Fruitfox fetches them.
const pic = u => fruitfox.media(u?.profile_pic_url || u?.hd_profile_pic_url_info?.url);
// Pictures that fail to load (expired links) fade to a plain circle instead of a broken-image icon.
addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.removeAttribute('src'); }, true);
const isAd = m => m.ad_id || m.injected || m.ad_metadata || m.is_paid_partnership && m.injected;
const isReel = m => m.product_type === 'clips';
const verified = u => u?.is_verified ? ' <span class="verified">✓</span>' : '';

/// SF Symbols-like icons, drawn in the text color (and filled when on).
const ICON = {
  heart: '<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.8 3.6 4.5 7 4.5c2.1 0 3.7 1.2 5 3 1.3-1.8 2.9-3 5-3 3.4 0 5.6 3.3 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>',
  bubble: '<path d="M12 3.5c4.9 0 8.5 3.4 8.5 7.8s-3.6 7.8-8.5 7.8c-1.2 0-2.4-.2-3.4-.6L4 20l1.1-3.9C4 14.8 3.5 13.2 3.5 11.3c0-4.4 3.6-7.8 8.5-7.8z"/>',
  send: '<path d="M21 3.5 3 10.5l7.2 2.8L21 3.5zM10.2 13.3 13 20.5l8-17"/>',
  bookmark: '<path d="M6.5 3.5h11v17L12 16l-5.5 4.5z"/>',
};
const icon = (name, on) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">${ICON[name]}</svg>`;

/// Caption and comment text: @mentions and #hashtags are tappable; web links open in Fruitfox.
function rich(text) {
  return esc(text)
    .replace(/(^|[\s(])@([\w.]{1,30})/g, '$1<a data-user="$2">@$2</a>')
    .replace(/(^|[\s(])#([\p{L}\p{N}_]+)/gu, '$1<a data-tag="$2">#$2</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2">$2</a>');
}

function mediaView(m) {
  const items = m.carousel_media || [m];
  const ratio = (m.original_height && m.original_width) ? Math.min(m.original_height / m.original_width, 1.25) : 1;
  const one = (x, i) => x.video_versions
    ? `<video playsinline muted loop preload="none" data-i="${i}" poster="${esc(best(x))}" src="${esc(x.video_versions[0].url)}" style="aspect-ratio:${1 / ratio}"></video>`
    : `<img alt="" loading="lazy" data-i="${i}" src="${esc(best(x))}" style="aspect-ratio:${1 / ratio}">`;
  return `<div class="media"><div class="carousel">${items.map(one).join('')}</div><div class="burst">${icon('heart', true)}</div></div>`
    + (items.length > 1 ? `<div class="dots">${items.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : '');
}

function postView(m, s) {
  const u = m.user || m.owner || {};
  const cap = m.caption?.text || '';
  return `<article class="post fade-in" data-id="${esc(m.id)}" data-pk="${esc(m.pk)}">
    <div class="row pad">
      <img alt="" class="avatar tappable" data-user="${esc(u.username)}" data-uid="${esc(u.pk || u.id)}" src="${esc(pic(u))}">
      <div class="grow"><div class="headline ellipsis tappable" data-user="${esc(u.username)}" data-uid="${esc(u.pk || u.id)}">${esc(u.username)}${verified(u)}</div>
        ${m.location?.name ? `<div class="caption secondary ellipsis">${esc(m.location.name)}</div>` : ''}</div>
      <span class="small secondary">${ago(m.taken_at)}</span>
    </div>
    ${mediaView(m)}
    <div class="row actions">
      <button class="icon-button like ${m.has_liked ? 'on' : ''}" aria-label="${m.has_liked ? 'Unlike' : 'Like'}">${icon('heart', m.has_liked)}</button>
      <button class="icon-button comments" aria-label="Comments">${icon('bubble')}</button>
      <button class="icon-button share" aria-label="Share">${icon('send')}</button>
      <div class="grow"></div>
      <button class="icon-button save ${m.has_viewer_saved ? 'on' : ''}" aria-label="${m.has_viewer_saved ? 'Remove from Saved' : 'Save'}">${icon('bookmark', m.has_viewer_saved)}</button>
    </div>
    ${s.hideLikes || m.like_and_view_counts_disabled ? '' : `<div class="pad0 headline likes">${count(m.like_count)} ${m.like_count === 1 ? 'like' : 'likes'}</div>`}
    ${cap ? `<div class="pad0 caption-text ${cap.length > 140 || cap.split('\n').length > 3 ? 'clamped' : ''}"><b data-user="${esc(u.username)}">${esc(u.username)}</b> ${rich(cap)}</div>` : ''}
    ${m.comment_count ? `<div class="pad0 secondary comments tappable">View ${m.comment_count === 1 ? '1 comment' : 'all ' + count(m.comment_count) + ' comments'}</div>` : ''}
  </article>`;
}

// One handler for every post on the page (taps are delegated).
/// `render`: how a post draws again after a like or save (postView unless given).
function wirePosts(root, find, render) {
  let lastTap = 0, tapTimer;
  const like = async (post, m, on) => {
    if (m.has_liked === on) return;
    m.has_liked = on; m.like_count += on ? 1 : -1;
    fruitfox.ui.haptic(on ? 'success' : 'light');
    await redraw(post, m, render);
    ig.like(m.pk, on).catch(err => { m.has_liked = !on; m.like_count += on ? -1 : 1; redraw(post, m, render); fruitfox.ui.toast(err.message); });
  };
  root.addEventListener('click', async e => {
    const post = e.target.closest('.post'), m = post && find(post.dataset.id);
    if (openLink(e)) return;
    if (!m) return;
    const media = e.target.closest('.media');
    if (media) {
      // Double tap likes (with a heart); a single tap opens the photo full screen, or mutes/unmutes a video.
      if (Date.now() - lastTap < 300) {
        clearTimeout(tapTimer); lastTap = 0;
        const burst = media.querySelector('.burst'); burst.classList.remove('show'); void burst.offsetWidth; burst.classList.add('show');
        setTimeout(() => like(post, m, true), 450);
        return;
      }
      lastTap = Date.now();
      const el = e.target.closest('img, video');
      tapTimer = setTimeout(() => {
        if (el?.tagName === 'VIDEO') { el.muted = !el.muted; return; }
        if (el) openViewer(m, +el.dataset.i);
      }, 300);
    } else if (e.target.closest('.like')) {
      like(post, m, !m.has_liked);
    } else if (e.target.closest('.save')) {
      m.has_viewer_saved = !m.has_viewer_saved; fruitfox.ui.haptic('select'); redraw(post, m, render);
      ig.save(m.pk, m.has_viewer_saved).then(() => fruitfox.ui.toast(m.has_viewer_saved ? 'Saved' : 'Removed from Saved'))
        .catch(err => { m.has_viewer_saved = !m.has_viewer_saved; redraw(post, m, render); fruitfox.ui.toast(err.message); });
    } else if (e.target.closest('.comments')) {
      if (window.showComments) showComments(m);  // pages with their own comments panel (Reels)
      else fruitfox.ui.sheet(`comments.html?id=${m.pk}&owner=${m.user?.pk || ''}`, 'Comments');
    } else if (e.target.closest('.share')) {
      fruitfox.ui.share(`${IG}/p/${m.code}/`);
    } else if (e.target.closest('.clamped')) {
      e.target.closest('.clamped').classList.remove('clamped');
    }
  });
  // Swiping a carousel moves its dots; videos play while on screen.
  root.addEventListener('scroll', e => {
    const c = e.target; if (!c.classList?.contains('carousel')) return;
    const i = Math.round(c.scrollLeft / c.clientWidth);
    c.closest('.post')?.querySelectorAll('.dots i').forEach((d, j) => d.classList.toggle('on', j === i));
  }, true);
  const seen = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause()), { threshold: .6 });
  new MutationObserver(() => root.querySelectorAll('video:not([data-seen])').forEach(v => { v.dataset.seen = 1; seen.observe(v); }))
    .observe(root, { childList: true, subtree: true });
}

/// Full-screen photos and videos (viewer.html): pinch to zoom, swipe down to close.
async function openViewer(m, i = 0) {
  await fruitfox.storage.set('viewer', { items: (m.carousel_media || [m]).map(x => ({ img: best(x), video: x.video_versions?.[0]?.url })), i });
  fruitfox.ui.cover('viewer.html');
}

/// Taps on @people (data-user, with data-uid when known) and #hashtags (data-tag).
function openLink(e) {
  const u = e.target.closest('[data-user]'), t = e.target.closest('[data-tag]');
  if (u) fruitfox.ui.push(`profile.html?username=${encodeURIComponent(u.dataset.user)}` + (u.dataset.uid ? '&id=' + u.dataset.uid : ''), u.dataset.user);
  else if (t) fruitfox.ui.push('tag.html?q=' + encodeURIComponent('#' + t.dataset.tag), '#' + t.dataset.tag);
  return !!(u || t);
}
const openProfile = openLink;

/// A post's media id from its shortcode (instagram.com/p/<code>): base 64 in Instagram's alphabet.
const shortcodeId = code => [...code.slice(0, 11)].reduce((n, c) => n * 64n + BigInt('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.indexOf(c)), 0n).toString();

/// The instagram.com link the app was opened from (Open Links in App, a notification): shows that post, profile or hashtag.
async function openInitialURL() {
  const u = await fruitfox.initialURL().catch(() => null);
  if (!u) return;
  const [a, b, c] = new URL(u).pathname.split('/').filter(Boolean);
  if (['p', 'reel', 'reels', 'tv'].includes(a) && b) fruitfox.ui.push('post.html?id=' + shortcodeId(b), 'Post');
  else if (a === 'explore' && b === 'tags' && c) fruitfox.ui.push('tag.html?q=' + encodeURIComponent('#' + c), '#' + c);
  else if (a === 'stories' && b && b !== 'highlights') fruitfox.ui.push('profile.html?username=' + encodeURIComponent(b), b);
  else if (a && !b && !['explore', 'direct', 'accounts', 'reels'].includes(a)) fruitfox.ui.push('profile.html?username=' + encodeURIComponent(a), a);
}

/// Every post object anywhere in a response (Explore and search nest them in several layouts).
function findMedia(x, out = [], seen = new Set()) {
  if (!x || typeof x !== 'object') return out;
  if (x.pk && (x.image_versions2 || x.carousel_media) && !seen.has(x.pk)) { seen.add(x.pk); out.push(x); return out; }
  for (const v of Object.values(x)) findMedia(v, out, seen);
  return out;
}
const tile = m => `<div class="tile" data-post="${esc(m.pk)}"><img alt="" loading="lazy" src="${esc(best(m.carousel_media?.[0] || m))}">${
  m.carousel_media ? '<span class="badge">❐</span>' : m.video_versions || isReel(m) ? '<span class="badge">▶︎</span>' : ''}</div>`;

/// A grid (Explore, a profile, a hashtag) opens as a scrolling feed from the tapped post, like Instagram's, which keeps
/// loading more from the same place (`source`, see posts.html) as you scroll.
async function openFeed(e, items, source, next, title) {
  const pk = e.target.closest('[data-post]')?.dataset.post;
  if (!pk) return;
  const start = items.findIndex(m => String(m.pk) === pk);
  await fruitfox.storage.set('feed', { items: items.slice(Math.max(start, 0)), source, next });
  fruitfox.ui.push('posts.html', title);
}

async function redraw(el, m, render) {
  const scroll = el.querySelector('.carousel')?.scrollLeft;
  if (render) {  // pages with their own layout (Reels): update the buttons in place
    for (const [c, on, name] of [['.like', m.has_liked, 'heart'], ['.save', m.has_viewer_saved, 'bookmark']]) {
      const b = el.querySelector(c); if (b) { b.classList.toggle('on', !!on); b.innerHTML = icon(name, on); }
    }
    return;
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = postView(m, await settings());
  const fresh = tmp.firstElementChild;
  fresh.classList.remove('fade-in');
  el.replaceWith(fresh);
  if (scroll) fresh.querySelector('.carousel').scrollLeft = scroll;
}

// Infinite scroll: calls `more` when the end is near, one page at a time.
function onNearEnd(more) {
  let busy = false;
  addEventListener('scroll', async () => {
    if (busy || innerHeight + scrollY < document.body.scrollHeight - 1500) return;
    busy = true; try { await more(); } catch (e) { fruitfox.ui.toast(e.message); } finally { busy = false; }
  }, { passive: true });
}

/// Comments for a post, drawn into `root` (a sheet page, or the panel over a reel): comments with replies and the
/// author's hearts, reply, an emoji row and the box to add one. `owner`: the post owner's id, for "Author" labels.
function commentsView(root, id, owner) {
  root.innerHTML = `<div class="clist list"><div class="spinner"></div></div>
    <form class="compose"><div class="replying small secondary row" hidden><span class="grow"></span><a class="cancel">Cancel</a></div>
      <div class="emoji">${['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'].map(e => `<button type="button">${e}</button>`).join('')}</div>
      <div class="row"><input class="field grow" placeholder="Add a comment…" enterkeyhint="send"><button class="button">Post</button></div></form>`;
  const list = root.querySelector('.clist'), input = root.querySelector('input'), replying = root.querySelector('.replying');
  let next = null, replyTo = null, busy = false;
  const view = (c, reply) => `<div class="comment row" style="${reply ? 'padding-left:58px' : ''}" data-comment="${esc(c.pk)}" data-author="${esc(c.user.username)}">
    <img alt="" class="avatar" style="${reply ? 'width:28px;height:28px' : ''}" src="${esc(pic(c.user))}" data-user="${esc(c.user.username)}" data-uid="${esc(c.user.pk)}">
    <div class="grow"><div class="small"><b data-user="${esc(c.user.username)}" data-uid="${esc(c.user.pk)}">${esc(c.user.username)}</b>
      <span class="secondary">${ago(c.created_at)}${String(c.user.pk) === String(owner) ? ' · Author' : ''}${c.is_liked_by_media_owner ? ' · <span style="color:var(--like)">♥</span> by author' : ''}</span></div>
      <div class="caption-text">${rich(c.text)}</div>
      <a class="reply small secondary">Reply</a>
      ${!reply && c.child_comment_count ? `<a class="small secondary replies">— View ${c.child_comment_count} ${c.child_comment_count === 1 ? 'reply' : 'replies'}</a>` : ''}
    </div>
    <button type="button" class="clikes secondary ${c.has_liked_comment ? 'on' : ''}" data-likes="${c.comment_like_count || 0}" aria-label="Like comment">${icon('heart', c.has_liked_comment)}<div class="caption">${c.comment_like_count ? count(c.comment_like_count) : ''}</div></button></div>`;
  async function page(min) {
    const r = await ig.comments(id, min);
    next = r.has_more_headload_comments || r.has_more_comments ? r.next_min_id : null;
    return (r.comments || []).map(c => view(c)).join('');
  }
  guard(list, async () => { list.innerHTML = await page() || '<div class="center secondary">No comments yet</div>'; });
  list.addEventListener('scroll', async () => {
    if (busy || !next || list.scrollTop + list.clientHeight < list.scrollHeight - 600) return;
    busy = true; try { list.insertAdjacentHTML('beforeend', await page(next)); } finally { busy = false; }
  });
  list.addEventListener('click', async e => {
    if (openLink(e)) return;
    const c = e.target.closest('[data-comment]');
    const heart = e.target.closest('.clikes');
    if (heart) {
      const on = !heart.classList.contains('on'), n = +heart.dataset.likes + (on ? 1 : -1);
      const draw = (on, n) => { heart.classList.toggle('on', on); heart.dataset.likes = n; heart.innerHTML = icon('heart', on) + `<div class="caption">${n ? count(n) : ''}</div>`; };
      draw(on, n); fruitfox.ui.haptic(on ? 'success' : 'light');
      ig.likeComment(c.dataset.comment, on).catch(err => { draw(!on, n + (on ? -1 : 1)); fruitfox.ui.toast(err.message); });
    } else if (e.target.closest('.replies')) {
      const a = e.target.closest('.replies'); a.textContent = 'Loading…';
      try { const r = await ig.replies(id, c.dataset.comment); a.remove(); c.insertAdjacentHTML('afterend', (r.child_comments || []).map(x => view(x, true)).join('')); }
      catch (err) { a.textContent = err.message; }
    } else if (e.target.closest('.reply')) {
      replyTo = c.dataset.comment;
      replying.hidden = false; replying.querySelector('span').textContent = 'Replying to ' + c.dataset.author;
      input.value = '@' + c.dataset.author + ' '; input.focus();
    }
  });
  const cancel = () => { replyTo = null; replying.hidden = true; input.value = ''; };
  root.querySelector('.cancel').onclick = cancel;
  root.querySelector('.emoji').addEventListener('click', e => { if (e.target.tagName === 'BUTTON') { input.value += e.target.textContent; input.focus(); } });
  root.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const t = input.value.trim(); if (!t) return;
    try {
      const r = await ig.comment(id, t, replyTo);
      fruitfox.ui.haptic('success');
      const mine = view({ pk: r.id || r.pk || '', user: r.from || r.user || { username: 'you' }, created_at: Date.now() / 1000, text: t }, !!replyTo);
      if (replyTo) list.querySelector(`[data-comment="${replyTo}"]`)?.insertAdjacentHTML('afterend', mine);
      else { list.querySelector('.center')?.remove(); list.insertAdjacentHTML('afterbegin', mine); }
      cancel(); input.blur();
    } catch (err) { fruitfox.ui.toast(err.message); }
  };
}

function signedOut(root) {
  root.innerHTML = `<div class="center"><div class="title">Sign in to Instagram</div>
    <div class="secondary">You sign in on Instagram's own page, in Fruitfox. Fruitfox never sees your password.</div>
    <button class="button" id="signin">Sign In</button></div>`;
  $('#signin').onclick = async () => { await fruitfox.ui.signIn(IG + '/accounts/login/'); location.reload(); };
}

// Runs a page's loader, showing sign in or the error instead of a blank page.
async function guard(root, f) {
  try { await f(); } catch (e) {
    if (e instanceof SignedOut) signedOut(root);
    else root.innerHTML = `<div class="center"><div class="headline">Couldn’t load this</div><div class="secondary small">${esc(e.message)}</div></div>`;
  }
}
