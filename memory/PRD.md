# Agora - Social Media App PRD

## Overview
**App Name:** Agora  
**Description:** A social media / comments board app combining the best features of X (Twitter) and Bluesky — clean, healthy, public discourse platform with a Neo-Brutalist Soft design.  
**URL:** https://civic-forum.preview.emergentagent.com  
**Date Created:** February 2026

---

## Architecture
- **Frontend:** React (CRA + CRACO), TailwindCSS, @phosphor-icons/react, Outfit + Figtree fonts
- **Backend:** FastAPI + Motor (async MongoDB)
- **Database:** MongoDB (test_database)
- **Auth:** JWT (python-jose + bcrypt), 7-day token expiry
- **Design System:** Neo-Brutalist Soft — mint green CTA (#A3E6D0), pastel accents, hard 1px borders, solid box shadows

---

## User Personas
1. **Social Discoverer** — wants a clean, ad-free alternative to X for sharing thoughts and consuming content
2. **Community Builder** — wants threaded conversations, following feeds, and hashtag organization
3. **Content Creator** — wants profile pages, post metrics (likes, reposts), and engagement notifications

---

## Core Requirements (Static)
- [x] Email/password authentication (JWT-based)
- [x] Post creation with hashtag extraction and display
- [x] For You (algorithmic recency) + Following (filtered) feed tabs
- [x] Like, Repost, Bookmark toggles with real-time counts
- [x] Threaded replies on PostDetail page
- [x] User profiles (posts / replies / likes tabs)
- [x] Follow/unfollow users
- [x] Trending hashtags (last 7 days)
- [x] Search posts and users (Explore page)
- [x] Notifications (like, reply, repost, follow)
- [x] Dark/light mode toggle
- [x] Responsive 3-column layout (desktop) + mobile bottom nav
- [x] Delete own posts

---

## What's Been Implemented

### Phase 1 - MVP (February 2026)
**Backend (/app/backend/server.py):**
- Auth: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
- Feed: GET /api/feed?type=for_you|following
- Posts: POST /api/posts, GET /api/posts/:id, DELETE /api/posts/:id
- Interactions: POST /api/posts/:id/like|repost|bookmark, GET /api/posts/:id/replies
- Users: GET /api/users/:username, GET /api/users/:username/posts|replies|likes, PUT /api/users/profile, POST /api/users/:username/follow, GET /api/users/suggestions
- Explore: GET /api/explore/trending, GET /api/explore/search
- Notifications: GET /api/notifications, PUT /api/notifications/read, GET /api/notifications/unread-count
- Bookmarks: GET /api/bookmarks

**Frontend (/app/frontend/src):**
- Pages: Auth, Home, PostDetail, Profile, Explore, Notifications
- Components: Layout, LeftSidebar, RightSidebar, PostCard, PostComposer, PostComposerModal, BottomNav
- Contexts: AuthContext (JWT), ThemeContext (dark/light)
- Utils: helpers.js (formatRelativeTime, renderContent, getAvatarFallback)

**Test Results (Iteration 1):**
- Backend: 100% (27/27 tests passed)
- Frontend: 95% (all core flows working)

---

## Prioritized Backlog

### P0 - Critical (must have before public launch)
- [ ] Image upload for posts (currently URL-only)
- [ ] Rate limiting on API endpoints
- [ ] Input validation (username format, password strength)

### P1 - High Priority
- [ ] Quote posts (repost with comment)
- [ ] Hashtag pages (clicking hashtag -> dedicated hashtag feed)
- [ ] Mention @username in posts (autocomplete + notification)
- [ ] Direct Messages (DM)
- [ ] Content warnings / labeling (Bluesky feature)
- [ ] Infinite scroll (replace load more button)
- [ ] Real-time notifications (WebSocket)

### P2 - Nice to Have
- [ ] Custom algorithmic feed settings
- [ ] Lists (curated user collections)
- [ ] Post scheduling
- [ ] Analytics for creators (views, engagement rate)
- [ ] Verified badges / labels
- [ ] Post editing (with edit history)
- [ ] Thread creation (multi-post threads)

---

## Next Tasks List
1. Add image upload support (S3 or object storage)
2. Implement quote posts
3. Add @mention autocomplete and notifications
4. Add real-time notification badge updates
5. Implement hashtag-specific feed pages
6. Add infinite scroll to feeds
7. Rate limit backend endpoints
