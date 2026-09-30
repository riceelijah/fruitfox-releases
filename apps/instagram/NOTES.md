# Instagram: what works (confirmed 2026-09-30)

All requests go to `https://www.instagram.com` with the user's cookies. Headers on every request:
`X-IG-App-ID: 936619743392459` (instagram.com's public app id), `X-CSRFToken: <csrftoken cookie>`, `Referer`/`Origin: https://www.instagram.com/`.
Signed in = cookie `sessionid` exists; your user id = cookie `ds_user_id`.

## REST (`/api/v1/…`, add `X-Requested-With: XMLHttpRequest`)

| What | Request | Response |
|---|---|---|
| Home feed | POST `feed/timeline/` form `reason=cold_start_fetch&is_pull_to_refresh=0` (+ `max_id`, `reason=pagination`) | `feed_items[].media_or_ad` (v1 media), `next_max_id`, `more_available`. Ads: `ad_id`/`injected`/`ad_metadata`. Suggested: `user.friendship_status.following === false`. Reels: `product_type === "clips"`. |
| Story tray | GET `feed/reels_tray/` | `tray[]` {id, user, seen, latest_reel_media} |
| Stories | GET `feed/reels_media/?reel_ids=<id>` | `reels[id].items[]` (or `reels_media[0]`); stickers: `story_link_stickers[].story_link.url` (unwrap `l.instagram.com/?u=`), `reel_mentions[].user`, `story_bloks_stickers[].bloks_sticker.sticker_data.ig_mention`, `story_feed_media[].media_id`, `story_cta[0].links[0].webUri`; x/y/width/height are fractions of the 9:16 frame, x/y the centre. Not marked seen unless you POST seen. |
| Post | GET `media/<pk>/info/` | `items[0]` |
| Comments | GET `media/<pk>/comments/?can_support_threading=true&permalink_enabled=false` (+`min_id`) | `comments[]`, `next_min_id` |
| Add comment | POST `web/comments/<pk>/add/` form `comment_text` | |
| Search | GET `web/search/topsearch/?context=blended&query=` | `users[].user`, `hashtags`, `places` |
| Explore | GET `discover/web/explore_grid/?include_fixed_destinations=true&is_nonpersonalized_explore=false&is_prefetch=false&module=explore_popular` (+`max_id`) | `sectional_items` nested layouts: collect every object with `pk` + `image_versions2`. `next_max_id`, `more_available`. |
| Replies to a comment | GET `media/<pk>/comments/<comment pk>/child_comments/` | `child_comments[]` (comments carry `child_comment_count`, `preview_child_comments`) |
| Saved posts | GET `feed/saved/posts/` (+`max_id`) | `items[].media`, `next_max_id` |
| Highlight or story items | GET `feed/reels_media/?reel_ids=highlight:<id>` | same as stories |
| Followers / following | GET `friendships/<id>/followers/?count=12&search_surface=follow_list_page` (`following/` likewise) | `users[]`, `next_max_id` |

Dead on the web: `web/likes/<pk>/like/` (404), `users/<id>/info/` and `users/web_profile_info/` (429), `web/friendships/<id>/follow/`.

## GraphQL

POST form to `/api/graphql` or `/graphql/query` (as listed): `doc_id`, `variables` (JSON), `lsd`, `fb_dtsg`, `fb_api_req_friendly_name`, `fb_api_caller_class=RelayModern`, `server_timestamps=true`; header `X-FB-LSD: <lsd>`.
Tokens: GET `https://www.instagram.com/` (HTML) → `"LSD",[],{"token":"…"}` and `"DTSGInitialData",[],{"token":"…"}`. Refetch when a query answers HTML.
Relay flags (send them all; extras are ignored): see `RELAY` in ig.js.

*Note:* When a query breaks (and at most once every 24 hours), Fruitfox automatically fetches the Instagram home and profile pages, scans their linked `.js` bundles, extracts the updated `doc_id`s, and retries the query. The IDs below are fallbacks.

| Name | Path | doc_id | variables | Result |
|---|---|---|---|---|
| PolarisProfilePageContentQuery | /api/graphql | 28036671149327607 | `{id, enable_integrity_filters: true, …RELAY}` | `data.user`: username, full_name, biography, follower_count, following_count, media_count, is_private, is_verified, friendship_status.following, hd_profile_pic_url_info.url, external_url, bio_links, category, fbid_v2 |
| PolarisProfilePostsQuery | /graphql/query | 28570182382647478 | `{username, data: {count: 12, include_relationship_info, latest_reel_media, …}, …RELAY}` + `{after, first: 12, before: null, last: null}` to page | `data.xdt_api__v1__feed__user_timeline_graphql_connection.edges[].node` (v1 media), `page_info.end_cursor` |
| PolarisProfileReelsTabContentQuery | /graphql/query | 29628758406714645 | `{data: {include_feed_video: true, page_size: 12, target_user_id}, user_id}` | `data.fetch__XDTUserDict.clips_connection.edges[].node.media` |
| PolarisProfileTaggedTabContentQuery | /graphql/query | 39772566182330372 | `{count: 12, user_id}`; next page: `…_connection` 28751062417852963 with `{after, first: 12, …}` | `data.xdt_api__v1__usertags__user_id__feed_connection.edges[].node` |
| PolarisProfileStoryHighlightsTrayContentQuery | /api/graphql | 26970053832668570 | `{user_id}` | `data.highlights.edges[].node` {id: "highlight:<n>", title, cover_media.cropped_image_version.url} |
| PolarisKeywordSearchExplorePageRelayPaginationQuery (hashtag/keyword results) | /api/graphql | 28656899673911396 | `{query: "#cats", first: 24, search_session_id, serp_session_id}` (+`after`) | `data.xdt_fbsearch__top_serp_graphql.edges[].node.items[]` (v1 media), `page_info` |
| PolarisFeedTimelineRootV2Query (home, like the site) | /graphql/query | 29085360807728108 | `{variant: "home", first, after, data: {device_id, …}}` | `data.xdt_api__v1__feed__timeline__connection.edges[].node.media`; `variant: "following"` is NOT chronological |
| PolarisClipsTabDesktopPaginationQuery (Reels feed) | /graphql/query | 28230813126620480 | `{data: {container_module: "clips_tab_desktop_page", seen_reels: "[]"}, first: 10, after}` | `data.xdt_api__v1__clips__home__connection_v2.edges[].node.media` |
| PolarisPostRootQuery | /graphql/query | 27830990013244856 | `{shortcode}` | `data.xdt_api__v1__media__shortcode__web_info.items[0]` |
| PolarisPostCommentsContainerQuery | /api/graphql | 28319576384320582 | `{media_id}` | `data.xdt_api__v1__media__media_id__comments__connection.edges[].node` |
| PolarisActivityFeedStoriesViewQuery (notifications) | /graphql/query | 28990670510517370 | `{inbox_request_data: {}, pending_request_data: {}}` | `data.xdt_activity_inbox.new_stories[]`/`old_stories[]`: `args.text`, `args.links[]` (user ranges), `args.users[]`, `args.media[]`, `args.timestamp`, `args.destination`; `data.xdt_api__v1__friendships__pending.users[]` (follow requests) |
| PolarisDirectInboxQuery (DMs) | /api/graphql | 28988285840768396 | `{device_id_for_iris_subscription: <uuid>, …IGD flags}` (answers with a harmless warning) | `data.get_slide_mailbox_for_iris_subscription.threads_by_folder.edges[].node.as_ig_direct_thread`: thread_fbid, thread_title, users[], slide_messages.edges[].node {text_body, igd_snippet, sender_fbid, timestamp_ms, content_type}, viewer.interop_messaging_user_fbid (you) |
| IGDThreadDetailQuery (a conversation) | /api/graphql | 28288012930891325 | `{min_uq_seq_id: null, thread_fbid, __relay_internal__pv__IGDInitialMessagePageCountrelayprovider: 20, …}` | `data.get_slide_thread_nullable.as_ig_direct_thread.slide_messages` |
| usePolarisLikeMediaXIGLikeMutation / …Unlike… | /api/graphql | 27182485238052618 / 27345296031770102 | `{input: {actor_id: <your fbid_v2>, client_mutation_id: "<n>", media_id: <pk>, container_module}}` | `data.xig_media_like.media.has_liked` |
| usePolarisSaveMediaSaveMutation / …Unsave… | /api/graphql | 27365486596441074 / 27371251859134880 | same input as like | |
| usePolarisFollowMutation / usePolarisUnfollowMutation | /api/graphql | 26508036048874888 / 27789106940691111 | `{target_user_id, container_module: "profile"}` | `data.xdt_create_friendship.friendship_status` |

| PolarisCommentActionsLikeMutation / …UnlikeMutation | /api/graphql | 27184292767848867 / 27318337671093716 | `{input: {comment_id, actor_id, client_mutation_id}}` | `data.xig_comment_like` |
| usePolarisStoriesV4LikeMutationLikeMutation / …UnlikeMutation | /api/graphql | 26938887309082050 / 26510485515280697 | `{input: {actor_id, client_mutation_id, media_id: <story item pk>}}` | `data.xig_send_story_like` |

`actor_id` is your `fbid_v2` (from PolarisProfilePageContentQuery on yourself).

## Media

- Post and story files load directly. **Profile pictures** send `Cross-Origin-Resource-Policy: same-origin`: use `fruitfox.media(url)`.
- v1 media: `pk`, `id` (`<pk>_<owner>`), `code` (URL shortcode: `/p/<code>/`), `media_type` (1 photo, 2 video, 8 carousel), `image_versions2.candidates[0].url`, `video_versions[0].url`, `carousel_media[]`, `caption.text`, `like_count`, `comment_count`, `has_liked`, `has_viewer_saved`, `user`, `taken_at`, `original_width/height`.

## Messages

- Reading: PolarisDirectInboxQuery / IGDThreadDetailQuery above. Message `content.__typename`: `SlideMessageText` (text_body), `SlideMessageXMAContent` (a shared post/reel/link: `xma.header_title_text`, `xma.header_icon.url`, `xma.preview_image.url`, `xma.target_id` = media pk, `xma.target_url`), `SlideMessageAdminText` (notices: `text_fragments[].plaintext`), `SlideMessageRavenImageContent` (view-once), `msg_reactions[]` (hearts).
- **Sending isn't an HTTP request:** instagram.com sends messages (and story replies) as binary MQTT over `wss://gateway.instagram.com/ws/realtime`. The app replies through the conversation's instagram.com page in a sheet (`fruitfox.ui.web`).

## Still to capture

Posting a photo.
