# Xivi - Database schema

MongoDB collections and fields as defined by Mongoose models in `backend/models/`.

Database name comes from the path in `MONGODB_URI` (local/Atlas). Collection names are Mongoose defaults (lowercased, pluralized).

← [README](../README.md) · [ER diagram](./ERD.md) · [API](./API.md) · [Features](./FEATURES.md)

---

## Overview

| Collection       | Model              | Purpose                                             |
| ---------------- | ------------------ | --------------------------------------------------- |
| `users`          | `User.js`          | Accounts, profile, friends, following, saved posts  |
| `posts`          | `Post.js`          | Feed posts; **comments embedded**                   |
| `friendrequests` | `FriendRequest.js` | Friend request lifecycle                            |
| `blocks`         | `Block.js`         | One-way block rows (mutual hide is enforced in API) |
| `conversations`  | `Conversation.js`  | 1:1 DM threads                                      |
| `messages`       | `Message.js`       | DM messages                                         |
| `notifications`  | `Notification.js`  | In-app notifications                                |
| `sitesettings`   | `SiteSettings.js`  | Singleton site feature flags (`_id: "global"`)      |

There is **no** separate `comments` collection.

---

## `sitesettings`

**File:** `backend/models/SiteSettings.js`  
**Timestamps:** `createdAt`, `updatedAt`

| Field       | Type            | Notes                                                                               |
| ----------- | --------------- | ----------------------------------------------------------------------------------- |
| `_id`       | String          | Always `"global"` (singleton)                                                       |
| `features`  | Mixed object    | Booleans keyed by catalog (`postsCreate`, `commentsCreate`, …); defaults all `true` |
| `updatedBy` | ObjectId → User | Last admin who patched flags                                                        |

---

## `users`

**File:** `backend/models/User.js`  
**Timestamps:** `createdAt`, `updatedAt`

| Field            | Type              | Required | Default     | Notes                                                                                                      |
| ---------------- | ----------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| `_id`            | ObjectId          | auto     |             | Primary key                                                                                                |
| `firstName`      | String            | yes      |             | Length 1–50                                                                                                |
| `lastName`       | String            | yes      |             | Length 1–50                                                                                                |
| `email`          | String            | yes      |             | Max 100; **unique**                                                                                        |
| `password`       | String            | yes      |             | bcrypt hash; **`select: false`**                                                                           |
| `role`           | String            |          | `"user"`    | Enum: `user`, `admin`                                                                                      |
| `isActive`       | Boolean           |          | `true`      | Soft deactivation                                                                                          |
| `deactivatedAt`  | Date              |          | `null`      | Set when deactivated                                                                                       |
| `deactivatedBy`  | ObjectId → User   |          | `null`      | Admin who deactivated                                                                                      |
| `oauthProviders` | Array of subdocs  |          | `[]`        | See below                                                                                                  |
| `picturePath`    | String            |          | `""`        | ImageKit HTTPS URL or empty                                                                                |
| `avatarColor`    | String            |          | `"#314F3B"` | Allowlisted hex (enforced in API)                                                                          |
| `coverColor`     | String            |          | `"#57534E"` | Allowlisted hex (enforced in API)                                                                          |
| `friends`        | ObjectId[] → User |          | `[]`        | Mutual friends                                                                                             |
| `following`      | ObjectId[] → User |          | `[]`        | One-way follows (people I follow). Followers of X = users whose `following` contains X (no separate array) |
| `savedPosts`     | ObjectId[] → Post |          | `[]`        | Bookmarks; private to owner                                                                                |
| `location`       | String            |          | `""`        |                                                                                                            |
| `occupation`     | String            |          | `""`        |                                                                                                            |
| `facebook`       | String            |          | `""`        | Handle / username                                                                                          |
| `x`              | String            |          | `""`        |                                                                                                            |
| `linkedin`       | String            |          | `""`        |                                                                                                            |
| `instagram`      | String            |          | `""`        |                                                                                                            |
| `viewedProfile`  | Number            |          | `0`         | Incremented on other-user profile views                                                                    |
| `lastSeenAt`     | Date              |          | `null`      | Login and socket disconnect; chat presence only, not on discover cards                                     |
| `createdAt`      | Date              | auto     |             |                                                                                                            |
| `updatedAt`      | Date              | auto     |             |                                                                                                            |

### `oauthProviders[]` subdocument

| Field        | Type   | Required | Notes                               |
| ------------ | ------ | -------- | ----------------------------------- |
| `provider`   | String | yes      | Enum: `google`, `github`, `discord` |
| `providerId` | String | yes      | Provider’s user id                  |

### Indexes

| Index                        | Spec                                        |
| ---------------------------- | ------------------------------------------- |
| Unique email                 | `{ email: 1 }` unique (from `unique: true`) |
| Following (followers lookup) | `{ following: 1 }`                          |

---

## `posts`

**File:** `backend/models/Post.js`  
**Timestamps:** `createdAt`, `updatedAt` on the post; comments have `createdAt` only. `editedAt` is set only when the author changes post text/image or comment text.

| Field         | Type                   | Required | Default | Notes                                            |
| ------------- | ---------------------- | -------- | ------- | ------------------------------------------------ |
| `_id`         | ObjectId               | auto     |         | Primary key                                      |
| `userId`      | String                 | yes      |         | Author’s User `_id` (stored as string)           |
| `description` | String                 |          | `""`    | Post text                                        |
| `url`         | String                 |          | `""`    | ImageKit image URL (optional)                    |
| `likes`       | Map\<String, Boolean\> |          |         | Keys = liker user ids                            |
| `comments`    | Comment[]              |          | `[]`    | Embedded subdocuments                            |
| `createdAt`   | Date                   | auto     |         |                                                  |
| `updatedAt`   | Date                   | auto     |         | Touches on like / comment / save of the document |
| `editedAt`    | Date                   |          | `null`  | Set when description or image is edited          |

### `comments[]` subdocument

| Field       | Type                   | Required | Default | Notes                               |
| ----------- | ---------------------- | -------- | ------- | ----------------------------------- |
| `_id`       | ObjectId               | auto     |         | Subdocument id                      |
| `userId`    | String                 | yes      |         | Commenter User `_id`                |
| `text`      | String                 | yes      |         | Trimmed                             |
| `likes`     | Map\<String, Boolean\> |          | `{}`    | Keys = liker user ids               |
| `createdAt` | Date                   | auto     |         | No `updatedAt` on comments          |
| `editedAt`  | Date                   |          | `null`  | Set when the comment text is edited |

### Indexes

None declared on the Post schema today (feed/profile queries may benefit from `{ userId: 1, createdAt: -1 }` later).

---

## `blocks`

**File:** `backend/models/Block.js`  
**Timestamps:** `createdAt`, `updatedAt`

| Field          | Type            | Required | Default | Notes                                      |
| -------------- | --------------- | -------- | ------- | ------------------------------------------ |
| `_id`          | ObjectId        | auto     |         | Primary key                                |
| `blocker`      | ObjectId → User | yes      |         | Who blocked; indexed                       |
| `blocked`      | ObjectId → User | yes      |         | Who was blocked                            |
| `reason`       | String          | yes      |         | Enum below                                 |
| `customReason` | String          |          | `""`    | Required when `reason` is `other`; max 200 |
| `createdAt`    | Date            | auto     |         | Used to sort the blocked list              |
| `updatedAt`    | Date            | auto     |         |                                            |

**Reason enum:** `harassment`, `bullying`, `hate_speech`, `offensive`, `spam`, `impersonation`, `fake_account`, `dont_want`, `other`

### Indexes

| Index       | Spec                                |
| ----------- | ----------------------------------- |
| Unique pair | `{ blocker: 1, blocked: 1 }` unique |
| Owner list  | `{ blocker: 1, createdAt: -1 }`     |
| Incoming    | `{ blocked: 1 }`                    |

---

## `friendrequests`

**File:** `backend/models/FriendRequest.js`  
**Timestamps:** `createdAt`, `updatedAt`

| Field       | Type            | Required | Default     | Notes               |
| ----------- | --------------- | -------- | ----------- | ------------------- |
| `_id`       | ObjectId        | auto     |             | Primary key         |
| `from`      | ObjectId → User | yes      |             | Requester; indexed  |
| `to`        | ObjectId → User | yes      |             | Recipient; indexed  |
| `status`    | String          | yes      | `"pending"` | Enum below; indexed |
| `createdAt` | Date            | auto     |             |                     |
| `updatedAt` | Date            | auto     |             |                     |

**Status enum:** `pending`, `accepted`, `declined`, `cancelled`

### Indexes

| Index               | Spec                                                               |
| ------------------- | ------------------------------------------------------------------ |
| Unique pending pair | `{ from: 1, to: 1 }` unique, **partial** where `status: "pending"` |
| Inbox               | `{ to: 1, status: 1, createdAt: -1 }`                              |
| Outbox              | `{ from: 1, status: 1, createdAt: -1 }`                            |

---

## `conversations`

**File:** `backend/models/Conversation.js`  
**Timestamps:** `createdAt`, `updatedAt`

| Field             | Type              | Required | Default | Notes                                      |
| ----------------- | ----------------- | -------- | ------- | ------------------------------------------ |
| `_id`             | ObjectId          | auto     |         | Primary key                                |
| `participants`    | ObjectId[] → User | yes      |         | Exactly two users                          |
| `participantKey`  | String            | yes      |         | Sorted `"idA:idB"`; **unique**             |
| `lastMessageAt`   | Date              |          | now     | Inbox sort                                 |
| `lastMessageText` | String            |          | `""`    | Preview snippet                            |
| `lastSenderId`    | ObjectId → User   |          | `null`  | Who sent the preview                       |
| `lastReadAt`      | Map\<String, Date\> |        |         | Per-participant last opened time           |

### Indexes

| Index        | Spec                                      |
| ------------ | ----------------------------------------- |
| Unique pair  | `{ participantKey: 1 }` unique            |
| Inbox        | `{ participants: 1, lastMessageAt: -1 }`  |

---

## `messages`

**File:** `backend/models/Message.js`  
**Timestamps:** `createdAt`, `updatedAt`

| Field            | Type            | Required | Notes            |
| ---------------- | --------------- | -------- | ---------------- |
| `_id`            | ObjectId        | auto     | Primary key      |
| `conversationId` | ObjectId → Conversation | yes | Indexed        |
| `senderId`       | ObjectId → User | yes      | From JWT         |
| `text`           | String          | yes      | Max 2000         |

### Indexes

| Index   | Spec                                   |
| ------- | -------------------------------------- |
| Thread  | `{ conversationId: 1, createdAt: -1 }` |

---

## `notifications`

**File:** `backend/models/Notification.js`  
**Timestamps:** `createdAt`, `updatedAt`

| Field       | Type            | Required | Default | Notes                            |
| ----------- | --------------- | -------- | ------- | -------------------------------- |
| `_id`       | ObjectId        | auto     |         | Primary key                      |
| `recipient` | ObjectId → User | yes      |         | Who sees it; indexed             |
| `actor`     | ObjectId → User | yes      |         | Who caused it                    |
| `type`      | String          | yes      |         | Enum below                       |
| `postId`    | ObjectId → Post |          | `null`  | Optional                         |
| `commentId` | String          |          | `null`  | Embedded comment `_id` as string |
| `read`      | Boolean         |          | `false` | Indexed                          |
| `createdAt` | Date            | auto     |         |                                  |
| `updatedAt` | Date            | auto     |         |                                  |

**Type enum:** `post_like`, `comment`, `comment_like`, `friend`, `friend_request`, `friend_accept`

### Indexes

| Index     | Spec                              |
| --------- | --------------------------------- |
| Recipient | `{ recipient: 1 }`                |
| Read flag | `{ read: 1 }`                     |
| Feed      | `{ recipient: 1, createdAt: -1 }` |

---

## Relationship summary

```
User ──authors──► Post (Post.userId)
User ──friends──► User[] (mutual arrays)
User ──follows──► User[] (following only)
User ──saves────► Post[] (savedPosts)
User ──from/to──► FriendRequest
User ──blocker/blocked──► Block
User ──recipient/actor──► Notification
User ──participants──► Conversation
Conversation ──has──► Message[]
Post ──embeds───► Comment[]
Post ◄──optional── Notification.postId
```

For a visual ER diagram, see [ERD.md](./ERD.md).
