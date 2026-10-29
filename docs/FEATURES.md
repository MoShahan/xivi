# Xivi - Features

Full feature list for the current app, plus planned items for a later release.

← Back to [README](../README.md)

---

## Auth & accounts

- Register (slim form: first name, last name, email, password + confirm)
- Auto-login after register (lands on home)
- Log in / log out
- Password show/hide on auth forms
- Client + server password policy on register (8–24 chars; upper, lower, number, symbol)
- Single-character first/last names allowed (1–50 characters)
- Protected routes (`AuthProvider`); guests redirected to login
- Bearer **access JWT** (default expiry **1 day**) + **refresh JWT** (default **7 days**)
- Silent token refresh on API `401` (axios interceptor); logout if refresh fails
- Password hashes never returned to the client (`select: false` + strip on responses)
- Rate limiting on login / register / refresh / OAuth
- Consistent “Invalid credentials” login errors (no email enumeration)
- Optional OAuth sign-in: Google, GitHub, Discord (when configured in backend env)
- OAuth can link to an existing account with the same email

## Posts & feed

- Create text and/or image posts (emoji picker on the compose bar; image dropzone with preview)
- Home feed with author name, avatar, and relative time
- Infinite scroll on home feed and profile Posts tab (`?limit=&cursor=`)
- Home feed tabs: **Everyone** and **Following** (you + friends + people you follow)
- Like / unlike posts (optimistic UI; rolls back on failure)
- View who liked a post (click like count → list with profiles)
- Save / unsave posts (bookmark on post cards)
- Own profile tabs: Posts / Saved / Liked / Commented; other profiles show Posts only
- Comment on posts (optimistic add + list with author; emoji picker on the comment box)
- Edit / delete **own** comments (⋮ menu; confirm on delete); edited comments show a muted **Edited** mark
- Like / unlike comments (optimistic; heart + count)
- View who liked a comment (click comment like count → list)
- Edit **own** posts (⋮ → Edit; text + replace/remove image); edited posts show a muted **Edited** mark next to the time
- Delete **own** posts (⋮ menu + confirm dialog)
- Single-post page at `/post/[postId]`
- Share menu (copy link, X, Facebook, LinkedIn, WhatsApp)
- Expandable post/comment text (“See more”)
- Click a post photo to open a fullscreen lightbox (Escape, backdrop click, or close)

## Friends, follow & profiles

- **Friend requests** (send → accept / decline / cancel) - mutual friends only after accept
- Unfriend removes both sides
- **Follow / unfollow** (one-way) - see someone’s posts in **Following** without being friends; no auto-follow-back
- Friend-request inbox in the left rail (badge) + `/friend-requests` (Incoming / Outgoing)
- Friend-request activity also appears in the notifications bell
- Separate **Follow** and **Friend** actions on profiles and Add people (icon-only in dense lists)
- Profile header: clickable **friends / followers / following** counts → modal with tabs + infinite scroll (paginated APIs)
- **Find people** at `/people` (left rail / mobile drawer) with search + **infinite scroll**
- Own profile (`/profile`) and other profiles (`/profile/[userId]`)
- Edit own profile (name, location, occupation, avatar, social handles, avatar color, cover color)
- Solid color profile header (`coverColor`) and initials avatar color (`avatarColor`) when no photo
- Optional public social links (Facebook, X, LinkedIn, Instagram) - shown only when set
- Profile visit counter (`viewedProfile`) when another user loads your profile
- Join date on profiles and Find people / Add people rows (`Joined Mon YYYY`)
- Click name/avatar to open the correct profile
- User details widget on profile only (not on home)

## Notifications

- In-app notifications for likes, comments, friend requests / accepts
- Slim top-bar bell with unread badge
- `/notifications` page with mark-read / mark-all-read

## Settings

- `/settings` in the left app shell for every signed-in user
- Regular users see a **coming soon** empty state (personal settings not available yet)
- Admins manage **Site settings / Features** (live toggles): create/edit/delete posts, images, emoji picker, comments, likes, share, notifications, profile edit/avatar, save, friend requests, follow
- Flags apply to **users only**; **admins always keep full capability**
- FE hides related controls when a flag is off; API rejects restricted writes with 403
- `GET /settings/features` (any auth user); `PATCH /settings/features` (admin only)

## Media & uploads

- Image uploads via **Multer (memory) → ImageKit**
- Image MIME whitelist (jpeg / png / gif / webp), **5 MB** size limit
- Server-generated unique filenames
- Avatars fall back to initials (user-chosen solid color) when no photo
- Clear toast when an image exceeds the size limit

## Admin

- Admins are normal users with `role: admin`
- Promotion from **`ADMIN_EMAILS`** in local `backend/.env` on password login only (not committed; not on register/OAuth signup)
- Admins can delete **any** post or comment
- Admins can deactivate / reactivate users (not self / not other admins)
- Deactivated users cannot authenticate
- Profile shows an **Admin** badge for admin accounts
- Do **not** put real admin emails or passwords in git

## UX & client architecture

- Light / dark mode (persisted; first visit follows system preference)
- Stone-first theme + Fraunces / Source Sans 3; Xivi logo + mark; favicon / apple-touch icon
- Split login/register layout with atmosphere images
- **Help & FAQ** (`/help`), **Coming soon** (`/coming-soon`), **Privacy** (`/privacy`), **Terms** (`/terms`)
- Authenticated **app shell**: left sidebar (Home, Messages, Find people, Friend requests, Groups, Events, Marketplace, News, Settings, Coming soon, Help, tutorial, theme; name/photo opens your profile; logout) + slim top bar (notifications bell); mobile hamburger drawer. Messages / Groups / Events / Marketplace / News are **Coming soon placeholders** (no product yet). Notifications stay on the bell, not a second rail item.
- In-app **product tutorial** (`react-joyride`): rail **Show tutorial** (compose, Find people, notifications, profile); replayable; optional one-time auto-run
- Mobile nav drawer mirrors the left rail items
- Skeleton loaders for posts feed, profile header, likers / friends / followers / following lists, and friend-request inbox
- Toast / snackbar feedback for key actions (compact, centered)
- Formik + Yup validation with visible field errors
- Accessibility: skip-to-content, labeled controls, focus-visible rings, contrast
- Shared **axios** client + Bearer request interceptor
- Redux Toolkit for auth, posts, theme (redux-persist)
- TypeScript frontend (no `any` in `frontend/src`)
- npm workspaces monorepo (`frontend` + `backend`)

## API security & hygiene

- CORS allowlist via `FRONTEND_URL`
- Helmet security headers
- Central error handler (no stack traces to clients); Mongoose validation → clear 400 messages
- ObjectId validation on route params
- JWT identity for create post / like / comment / delete / friends (not body `userId` trust)
- Auth secrets and token lifetimes configurable via env

---

## Coming soon (future version)

These are **not** in the current release. Planned for a later update:

- Private friend graphs - option to hide friends / followers / following **lists** from other users (counts may still show)
- Separate admin SPA / dedicated admin host
- Moderator role (between regular user and full admin)
- Report / block user
- Comment replies + @mentions (see below)
- Live feed updates (see below)
- Multiple images per post, image compression, and soft-delete posts
- Messaging / DMs / chat (see below) - sidebar tab exists as a placeholder
- Groups - create/join communities with their own feed (sidebar placeholder)
- Events - time-bound hangouts, separate from Groups (sidebar placeholder)
- Marketplace - member buy/sell listings, not site ads (sidebar placeholder)
- News - headlines in their own tab, separate from the social feed (sidebar placeholder)
- Ads / sponsored content - not a sidebar tab; different from Marketplace
- GIF, audio, or other non-image post attachments

### Comment replies + @mentions (design)

**Not in this release.** Scope is **comments and replies only** - not the home compose / new-post box.

**@mentions (Instagram / Facebook style)**

- Typing `@` in a comment or reply opens a small user picker.
- The list filters as you type after `@`.
- Choosing a user inserts `@username` as a hyperlink to that person’s profile.
- Clicking a posted mention opens `/profile/[userId]`.

**Replies - one indent only (not Reddit / Tumblr nesting)**

- A **top-level comment** sits flush with the comment list.
- A **reply** is indented once, slightly to the right of that comment.
- There is **no second indent**. A reply cannot have its own nested thread.
- Replying to a reply still creates a sibling at that same indent, stacked below.

Example:

```text
A   Comment
    B   Reply to A
    C   Reply to B (same indent as B, directly under B)
    D   Another reply to A (same indent as B and C)
```

So: comment A → children B, C, D in one column. Reply to C still lands under D as another child of A, not pushed further right.

### Live feed updates

**Not in this release.** Opening Home, a profile, or a post loads that snapshot once. New posts, comments, and profile photos from other people do not appear until you refresh or navigate. A later update will show those changes without a manual refresh. The delivery method (periodic refetch vs realtime) is not decided yet.

### Messaging / DMs

**Not in this release.** A **Messages** tab is in the sidebar (`/messages`) as a placeholder.

Two inboxes when it ships:

- **Friends inbox** - you can message someone here only after they **accept your friend request**. Mutual friends only.
- **Other / requests inbox** - if you **only follow** them, or a friend request is still **pending**, the message does **not** enter their Friends inbox. It goes to a separate inbox they can open or ignore.

Following someone is not enough for the Friends inbox.

### Groups, Events, Marketplace, News

**Not in this release.** Each has a sidebar tab that explains the idea:

- **Groups** (`/groups`) - ongoing communities people can create and join.
- **Events** (`/events`) - one occasion with a date/time (meetup, birthday). Not a group.
- **Marketplace** (`/marketplace`) - person-to-person listings. **Not** sponsored ads.
- **News** (`/news`) - headlines in their own place, not mixed into Home.

**Ads / sponsored content** stay on this roadmap only (no member sidebar tab). **Notifications** stay on the existing bell / `/notifications` page.

---

See also: [Design roadmap](./DESIGN_ROADMAP.md) · [API overview](./API.md) · [Schema](./SCHEMA.md) · [ER diagram](./ERD.md) · [README](../README.md)
