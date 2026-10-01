# Fruitfox Apps: how to make one

A Fruitfox App is a web service's own app inside Fruitfox (like Apollo was for Reddit): your own pages, signed in with the user's account, inside a native frame Fruitfox draws. These notes are written for people and for AI models (Fruitfox links them here when you edit an app with an AI site, and gives its on-device model a short version, `Apps.guide` in Fruitfox's `Apps.swift`). Everything here is confirmed working; keep it that way (only add what you've seen work).

## Files

```
Apps/<id>/app.json      name, icon, sites, tabs, version (catalog apps)
Apps/<id>/icon.png      180×180
Apps/<id>/*.html|js|css the pages
_kit/kit.css            Liquid Glass look (lists, cells, avatars, buttons, grids, switches)
_kit/bridge.js          window.fruitfox (injected into every page; don't include it)
```

`_kit/` is built into Fruitfox (`Fruitfox/Apps/_kit` in its repo); apps install to Documents/Apps. Published apps live here, in `apps/` of riceelijah/fruitfox-releases.

`app.json`:
```json
{ "name": "Instagram", "icon": "icon.png",
  "sites": ["instagram.com", "cdninstagram.com", "fbcdn.net"],
  "tabs": [{ "title": "Home", "symbol": "house", "page": "feed.html" }] }
```
- `sites`: every host the app talks to or loads media from (subdomains included). `fruitfox.fetch` and `fruitfox.media` refuse anything else.
- `tabs`: native tab bar (SF Symbol names). One tab = no tab bar.
- Pages are served from `fruitfox-app://<id>/`. Start each with:
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/_kit/kit.css">`
- Fruitfox draws the frame (navigation bar with the title and back button, tab bar, sheets); pages draw only their content.

## Starting from a template

Settings › Apps › New App from Template makes an app without AI, to use as is or as a start:
- **Feed** and **List from JSON** (`list/`): `index.html` lists items from the link in `config.json` (`{"url", "type": "rss" | "json", "items", "title", "subtitle", "image", "link"}`; JSON fields are dotted paths like `data.children` or `images.0.url`). Feed items open `article.html`, which shows the item's HTML with scripts, frames and event handlers removed.
- **Blank** (`blank/`): one page to write yourself.

The templates live in Fruitfox's repo under `Fruitfox/Apps/_templates/`.

## The bridge (`fruitfox.*`)

| Call | What it does |
|---|---|
| `fetch(url, {method, headers, body, cookies})` | Request to one of `sites` with the user's cookies (from the app's data store; a container's when opened in one), no CORS. Resolves `{status, ok, headers, body, json()}`; cookies it sets are saved. Sends the web view's User-Agent. `cookies: false` sends it signed out (some APIs refuse an app client with web cookies). |
| `cookie(name, site)` | A cookie's value (CSRF tokens, the user id). |
| `media(url)` | A URL for `<img src>`/`<video src>` that works even when the site only lets its own pages show a file (`Cross-Origin-Resource-Policy: same-origin`, e.g. Instagram profile pictures). |
| `storage.get(key)` / `set(key, value)` | Per app (and per container), JSON. |
| `params` | The page's query (`post.html?id=1` → `{id: "1"}`). |
| `ui.title`, `ui.buttons([{id, symbol, title}])` | Navigation bar; taps fire `on('button', id)`. |
| `ui.push(page, title)` | Push a page (native back swipe). From a sheet or cover it opens in the app behind. |
| `ui.sheet(page, title)` | Page in a sheet with Done. |
| `ui.cover(page)` | Full screen, no bars (stories, viewers); close with `ui.back()`. |
| `ui.back()`, `ui.exit()` | Pop / close sheet or cover; close the app. |
| `ui.menu([{id, title, destructive}], title)` | Native action sheet → chosen id or null. |
| `ui.toast`, `ui.haptic('light'|'select'|'success'|'error')`, `ui.share(urlOrText)` | |
| `ui.open(url)` | Closes the app and opens the URL in a browser tab. Web links clicked in a page do this too. |
| `ui.web(url, {embedFrom})` | Any https page in a sheet (the app's sites signed in); resolves on Done. With `embedFrom: 'https://some.site/'` it's shown in a frame on a page from that origin, for players that only play embedded (YouTube's). |
| `ui.signIn(url)` | Shows the site's own login page in a sheet (the user types their password; the app never sees it); resolves on Done. |
| `ui.push(screen)`, `ui.sheet(screen)` | A native SwiftUI list (`type: 'feed'` for a plain, edge-to-edge one). Rows: `row`, `toggle`, `button`, `input` (with `placeholder`, labeled), `picker` (`options`, `labels`), `post` (`avatar`, `images`, `aspect`, `text`, `footer`, `liked`, `saved`; fires like/comment/send/save/author/more): `{title, sections: [{header, footer, rows: [{id, type: 'row'|'toggle'|'button'|'input', title, subtitle, value, symbol, destructive, placeholder}]}]}`. Actions fire `on('screen', json)` with `{id, action: 'tap'|'change'|'input', value}`. |
| `ai.available()`, `ai.prompt(text, {system})`, `ai.summarize(text)` | The on-device model (Apple Intelligence). |
| `notify({title, body, url, tag})` | A notification; tapping it opens the app (`initialURL()` gives the url). Same `tag` replaces the last one. |
| `initialURL()` | The link or notification URL the app was opened from, or null. |
| `on('refresh', f)` | Native pull to refresh; return a promise to keep the spinner. |
| `log(text)` | A line in Documents/App Logs/<id>.log. Page errors and failed images are logged automatically. |

Background refresh: a `background.js` page (or app.json `"background"`) is loaded for about 8 seconds whenever iOS runs Fruitfox's background refresh (hours apart). Use it to `fetch` and `notify`.

## kit.css

Follows light and dark mode, text size and the accent color, so don't hard-code colors.

| Class | |
|---|---|
| `.list` of `.cell`; `.list.inset` | Plain or grouped (card) lists. |
| `.row`, `.grow`, `.ellipsis`, `.pad`, `.center` | Layout: flex row, fill, one line, padding, centered empty/error state. |
| `.secondary`, `.small`, `.caption`, `.headline`, `.title` | Text. |
| `.avatar` (`.large`, `.ring`) | Round pictures. |
| `.button` (`.plain`), `.icon-button` (`.on`) | Buttons. |
| `.grid`, `.carousel` | 3-column square grid; swipeable pages. |
| `.chips` of `.chip` (`.on`) | Filters. |
| `.spinner`, `.fade-in`, `.tappable` | Loading, appearing, tap highlight. |
| `<input type="checkbox">` | Looks like an iOS switch. |

## Gotchas (each cost a round of debugging)

- **iOS doesn't send `click` for taps on plain elements** (no link/button/handler of their own) when the listener is on `window`/`document`. Put listeners on a real container element, or use `pointerdown`/`pointerup` (stories do).
- **Broken `<img>` shows a "?" icon** unless it has `alt=""`.
- **CORP-protected media** (profile pictures on Instagram): load through `fruitfox.media(url)`.
- **Pace requests** (Instagram: ≥350 ms apart, one global queue) and debounce search typing; sites flag bursts.
- A web page instead of JSON (`<!DOCTYPE`) usually means signed out, or an endpoint that no longer exists (404 page).

## Reverse-engineering a site's private API (the method that works)

Most sites have no public API; their website uses a private one. Copy what the website does, don't guess.

1. **Sign in to the site in a desktop browser you can script** (Claude's browser pane). The user signs in; never type their password.
2. **Record the site's own requests.** Patch `XMLHttpRequest` and `fetch` in the page (log method, URL, headers, body, first KB of the response), then **navigate inside the single-page app by clicking its links** (a full page load drops the patch). Reading pages is fine; for actions (like, follow, send), ask the user to do them in the browser while you record.
3. **Read the request's name and inputs.** Facebook-family sites (Instagram, Threads, Facebook) use Relay GraphQL: form body with `doc_id`, `variables` (JSON), `fb_api_req_friendly_name`. Copy `variables` exactly, including `__relay_internal__pv__…` flags: a missing one fails with `missing_required_variable_value`.
4. **Find the minimum it needs** by replaying the request from the page's console with fewer fields until it breaks (Instagram GraphQL needs `lsd` + `fb_dtsg` tokens; see its NOTES.md in riceelijah/fruitfox-releases `apps/instagram/`).
5. **Look up IDs in the site's scripts.** Relay sites ship `__d("<OperationName>_instagramRelayOperation",[],(function(…){….exports="<doc_id>"})` for every query: scan the page's loaded `.js` files (performance resource entries) to map names to IDs. Useful when IDs change.
6. **Test from the phone with logs.** Build, install, reproduce, then pull the log:
   `xcrun devicectl device copy from --device <udid> --domain-type appDataContainer --domain-identifier com.riceelijah.fruitfox --source "Documents/App Logs/<id>.log" --destination log.txt`
7. **Write down what worked** in the app's NOTES.md (endpoint, variables, response path, quirks).

Some actions can't be copied: if the site does them over a WebSocket with a binary protocol (Instagram DMs are MQTT), use `ui.web` to do them on the site's own page instead.

Old REST endpoints disappear (Instagram's `web/likes/…/like/` now 404s; `users/{id}/info/` answers 429 on the web): prefer whatever the website itself calls today.
