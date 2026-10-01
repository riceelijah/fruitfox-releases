# Threads: notes

Everything here works signed out (no cookies; `fruitfox.fetch(..., { cookies: false })`).

- Token: `LSD` from `https://www.threads.com/` (`"LSD",[],{"token":"…"}`), kept an hour.
- Queries: POST `https://www.threads.com/api/graphql` (not `/graphql/query`, which answers 403 outside the site), form `lsd`, `doc_id`,
  `variables` (JSON), `fb_api_req_friendly_name`; headers `X-FB-LSD`, `X-IG-App-ID: 238260118697367`. Every query also gets the
  `__relay_internal__pv__…` flags in `th.js` (`FLAGS`); a missing one fails with `missing_required_variable_value`.

| What | Name | doc_id | variables |
|---|---|---|---|
| Profile | BarcelonaProfilePageDirectQuery | 27771741022498740 | `canSeeFeedsTab`, `showLinkedIGStats`, `userID` |
| Profile threads | BarcelonaProfileThreadsTabDirectQuery | 29307336712207960 | `allow_page_info_for_lox_user: true`, `first`, `userID`, `after` (page_info.end_cursor) |
| Post | BarcelonaPostPageTargetQuery | 28483134274683819 | `postID` |
| Replies | BarcelonaPostPageDownwardQuery | 28290267110643663 | `postID`, `sortOrder: "TOP"` |
| People search | useBarcelonaAccountSearchGraphQLDataSourceQuery | 27899326536411969 | `query`, `first`, and the `should_fetch_…` flags in `th.js` |

Responses: profile threads are `mediaData.edges[].node.thread_items[].post` (Instagram-style media: `pk`, `code`, `user`, `caption.text`,
`image_versions2`, `carousel_media`, `video_versions`, `like_count`, `taken_at`, `text_post_app_info.{direct_reply_count, repost_count}`).
Replies are `media.text_post_app_info.direct_replies.edges[].node.posts.edges[].node` (each reply a thread of posts).
User IDs: from people search (exact username match). Post search and the home feed need a signed-in session, so Home is built from
people followed in the app; liking, replying and posting open the post on threads.com in a sheet.

Found by recording threads.com's own requests signed out (GUIDE.md's method); IDs change every few weeks.
