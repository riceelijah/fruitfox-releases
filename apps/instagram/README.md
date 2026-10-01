# Instagram

A [Fruitfox App](https://github.com/riceelijah/fruitfox-releases/tree/main/apps): a website's own app inside Fruitfox, the iOS browser. Its pages are HTML, CSS and JavaScript that Fruitfox shows in a native frame (tab bar, navigation, sheets), signed in with your own account on the site. To install it, open Fruitfox › Settings › Apps › Install from File and choose this zip.

How Fruitfox Apps work, and how to make or change one: [the Fruitfox Apps guide](../GUIDE.md).

## About Instagram

The app allows users to interact with Instagram's content by browsing posts, reels, and comments, managing messages, following others, and editing media. It supports offline access, personalized feeds, search functionality, and full-screen editing with gestures and visual feedback.

- Uses your account on: instagram.com, cdninstagram.com, fbcdn.net
- Tabs: Home, Search, Messages, Profile
- Version: 4

## Files

- `NOTES.md`: The file defines how to interact with Instagram's API to fetch and display Polaris-related content using GraphQL, includes edits to the Polaris app for managing posts, comments, DMs, clips, and media interactions via GraphQL queries and mutations, and handles media and message interactions using GraphQL mutations for Polaris.
- `activity.html`: It displays user activity, follow requests, and clickable media items in a list for editing.
- `app.json`: Saves app metadata, links, and navigation tabs.
- `comments.html`: Displays the comments page for a specific fruitfox account.
- `feed.html`: feed.html updates the feed and tray based on user settings and loads more posts as needed, while triggering refresh and button actions to load different UI pages.
- `follows.html`: It displays a searchable list of followers or people being followed, loading more as the user scrolls near the bottom.
- `ig.css`: The file defines styles for Instagram-themed elements, including avatars, tiles, buttons, bubbles, cards, and comment sections, along with emoji buttons and reply indicators for visual feedback during editing.
- `ig.js`: This file enables offline Instagram data retrieval, authentication token generation, and content filtering while updating cached scripts, handling API changes, and supporting editing features like follow logic, styling, and media rendering. It also manages user interactions, infinite scroll, comments, and full-screen media with visual and haptic feedback.
- `inbox.html`: Displays inbox messages in a list, showing unread ones in bold and loading new data on refresh.
- `post.html`: It loads and displays a post in the app.
- `posts.html`: It loads and appends more posts as the user scrolls.
- `profile.html`: profile.html displays a user's profile with tabs for posts, reels, and tagged content, including biography, links, follow status, and recent highlights. It toggles the active tab, shows a spinner, loads the next page, and opens a menu on button click.
- `reels.html`: This file styles reels for full-screen videos with captions, side buttons, and a fade effect, initializes a Reels player with multiple controls and swipe navigation, and manages feed scrolling, comment visibility, and drag-to-close behavior.
- `saved.html`: It renders saved items in a grid for editing.
- `search.html`: search.html displays search results and hashtags as users type, triggers searching on Enter, and updates results when clicking links.
- `settings.html`: It lets you set daily usage limits and toggle UI preferences for the app.
- `story.html`: The file creates a full-screen editor interface for Instagram stories with navigation, actions, and styling. It loads Instagram stories, stickers, and interactive hearts while triggering gestures for media controls, likes, and linking.
- `tag.html`: It renders Instagram-style tiles based on a keyword search.
- `thread.html`: The file adds a reply button to the bottom of the thread and updates the message list to open Instagram posts or reels in the app when clicked.
- `viewer.html`: The file sets up a full-screen viewer with swipe navigation, pinch zoom, and a close button, then removes the script.
