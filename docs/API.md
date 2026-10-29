# Xivi - API overview

Express REST API used by the Next.js frontend. Auth (except register, login, refresh, and OAuth start/callback) expects:

```http
Authorization: Bearer <accessToken>
```

← Back to [README](../README.md) · [Features](./FEATURES.md)

---

## Endpoints

| Method   | Path                                           | Purpose                                                                                                                                                                              |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST`   | `/auth/register`                               | Create account; returns user + access + refresh tokens                                                                                                                               |
| `POST`   | `/auth/login`                                  | Log in; returns user + access + refresh tokens                                                                                                                                       |
| `POST`   | `/auth/refresh`                                | Rotate refresh: exchange valid refresh for a new access + refresh pair                                                                                                               |
| `POST`   | `/auth/logout`                                 | Revoke refresh session (Bearer access; body may include `refreshToken`)                                                                                                              |
| `GET`    | `/auth/me`                                     | Current user (Bearer)                                                                                                                                                                |
| `GET`    | `/auth/providers`                              | Configured OAuth providers                                                                                                                                                           |
| `GET`    | `/auth/:provider`                              | Start OAuth (`google` \| `github` \| `discord`)                                                                                                                                      |
| `GET`    | `/auth/:provider/callback`                     | OAuth callback → redirect to FE with tokens in URL fragment                                                                                                                          |
| `GET`    | `/notifications`                               | Notifications page (`?limit=&cursor=` → `{ notifications, nextCursor, hasMore }`)                                                                                                    |
| `GET`    | `/notifications/unread-count`                  | Unread notification count                                                                                                                                                            |
| `PATCH`  | `/notifications/read-all`                      | Mark all notifications read                                                                                                                                                          |
| `PATCH`  | `/notifications/:id/read`                      | Mark one notification read                                                                                                                                                           |
| `GET`    | `/users/discover`                              | Recent users or search (`?q=&limit=&cursor=` → `{ users, nextCursor, hasMore }`; excludes self; includes `relationship`)                                                             |
| `PATCH`  | `/users/me`                                    | Update own profile (multipart optional `picture` → ImageKit; `avatarColor` / `coverColor` allowlisted hex)                                                                           |
| `GET`    | `/users/me/friend-requests`                    | Pending requests (`?box=incoming\|outgoing`)                                                                                                                                         |
| `GET`    | `/users/me/friend-requests/count`              | Incoming pending count                                                                                                                                                               |
| `POST`   | `/users/me/friend-requests/:requestId/accept`  | Accept → mutual friends                                                                                                                                                              |
| `POST`   | `/users/me/friend-requests/:requestId/decline` | Decline                                                                                                                                                                              |
| `DELETE` | `/users/me/friend-requests/:requestId`         | Cancel own outgoing request                                                                                                                                                          |
| `DELETE` | `/users/me/friends/:friendId`                  | Unfriend (mutual remove)                                                                                                                                                             |
| `GET`    | `/users/me/following`                          | People I follow (`?cursor=&limit=` → `{ users, nextCursor, hasMore, total }`)                                                                                                        |
| `POST`   | `/users/:id/friend-requests`                   | Send friend request                                                                                                                                                                  |
| `POST`   | `/users/:id/follow`                            | Follow                                                                                                                                                                               |
| `DELETE` | `/users/:id/follow`                            | Unfollow                                                                                                                                                                             |
| `POST`   | `/users/:id/deactivate`                        | Admin: soft-deactivate user                                                                                                                                                          |
| `POST`   | `/users/:id/reactivate`                        | Admin: reactivate user                                                                                                                                                               |
| `GET`    | `/users/:id/relationship`                      | Viewer relationship flags vs `:id`                                                                                                                                                   |
| `GET`    | `/users/:id`                                   | Get a user (no password). Includes `friendCount`, `followerCount`, `followingCount` (following ids omitted)                                                                          |
| `GET`    | `/users/:id/friends`                           | Friends list (`?cursor=&limit=`, default 20, max 30) → `{ users, nextCursor, hasMore, total }` + `relationship` per row                                                              |
| `GET`    | `/users/:id/following`                         | People `:id` follows (same pagination shape)                                                                                                                                         |
| `GET`    | `/users/:id/followers`                         | People who follow `:id` (same pagination shape)                                                                                                                                      |
| `POST`   | `/posts`                                       | Create a post (multipart optional `picture` → ImageKit); `{ post }`                                                                                                                  |
| `GET`    | `/posts`                                       | Home feed (`?scope=all\|friends&limit=&cursor=&since=`; `cursor` = older than ISO `createdAt`; `since` = newer than; `since` wins if both set; `friends` = me ∪ friends ∪ following) |
| `GET`    | `/posts/saved`                                 | Saved posts (paginated `{ posts, nextCursor, hasMore }`)                                                                                                                             |
| `GET`    | `/posts/liked`                                 | Liked posts (paginated `{ posts, nextCursor, hasMore }`)                                                                                                                             |
| `GET`    | `/posts/commented`                             | Commented posts (paginated envelope)                                                                                                                                                 |
| `GET`    | `/posts/:userId/posts`                         | One user’s posts (same `cursor` / `since` pagination as the feed)                                                                                                                    |
| `GET`    | `/posts/:postId`                               | Single post                                                                                                                                                                          |
| `PUT`    | `/posts/:postId/save`                          | Save/bookmark a post (idempotent)                                                                                                                                                    |
| `DELETE` | `/posts/:postId/save`                          | Unsave a post                                                                                                                                                                        |
| `PATCH`  | `/posts/:postId`                               | Edit own post (multipart optional `picture`, `removeImage`)                                                                                                                          |
| `GET`    | `/posts/:postId/likes`                         | Users who liked the post (`?page=&limit=`, default 20, max 50)                                                                                                                       |
| `PATCH`  | `/posts/:postId/like`                          | Like or unlike                                                                                                                                                                       |
| `POST`   | `/posts/:postId/comments`                      | Add a comment                                                                                                                                                                        |
| `PATCH`  | `/posts/:postId/comments/:commentId`           | Edit own comment                                                                                                                                                                     |
| `DELETE` | `/posts/:postId/comments/:commentId`           | Delete own comment                                                                                                                                                                   |
| `GET`    | `/posts/:postId/comments/:commentId/likes`     | Users who liked a comment (`?page=&limit=`)                                                                                                                                          |
| `PATCH`  | `/posts/:postId/comments/:commentId/like`      | Like or unlike a comment                                                                                                                                                             |
| `DELETE` | `/posts/:postId`                               | Delete own post (or any post if admin)                                                                                                                                               |
| `GET`    | `/settings/features`                           | Site feature flags (auth; defaults all `true`)                                                                                                                                       |
| `PATCH`  | `/settings/features`                           | Admin: merge partial `{ features: { postsCreate: false, … } }`                                                                                                                       |

### Feature flags

Flags apply to **`role: user` only** - admins always bypass. When a write is blocked the API returns **403** `{ error: "This feature is currently disabled" }`. See [FEATURES.md](./FEATURES.md) for the catalog and UI behavior.

---

## Uploads

Post and avatar images are uploaded to **ImageKit** (Multer memory → ImageKit). MongoDB stores the returned HTTPS URL (e.g. on `Post.url` / user `picturePath`). Configure `IMAGEKIT_*` in `backend/.env` (see `backend/.env.example`). Max image size: **5 MB**; allowed types: jpeg, png, gif, webp.

---

## Related

- [Features](./FEATURES.md)
- [Database schema](./SCHEMA.md)
- [ER diagram](./ERD.md)
- [README](../README.md) (setup, env, scripts)
