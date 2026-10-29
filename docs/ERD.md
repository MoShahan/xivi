# Xivi - Entity relationship diagram

Data model derived from the Mongoose schemas in `backend/models/`.

MongoDB stores some relationships as arrays or embedded documents (not separate SQL-style tables).

← Back to [README](../README.md) · [Schema](./SCHEMA.md) · [Features](./FEATURES.md) · [API](./API.md)

---

## Diagram

```mermaid
erDiagram
  USER ||--o{ POST : "authors (userId)"
  USER ||--o{ FRIEND_REQUEST : "from"
  USER ||--o{ FRIEND_REQUEST : "to"
  USER ||--o{ NOTIFICATION : "recipient"
  USER ||--o{ NOTIFICATION : "actor"
  POST ||--o{ NOTIFICATION : "postId (optional)"
  USER ||--o{ USER : "friends (mutual)"
  USER ||--o{ USER : "following (one-way)"
  USER ||--o{ BLOCK : "blocker"
  USER ||--o{ BLOCK : "blocked"
  USER ||--o{ CONVERSATION : "participants"
  CONVERSATION ||--o{ MESSAGE : "contains"
  USER ||--o{ MESSAGE : "senderId"
  USER ||--o{ POST : "savedPosts"
  USER ||--o| USER : "deactivatedBy"
  POST ||--|{ COMMENT : "embeds"

  USER {
    ObjectId _id PK
    string firstName
    string lastName
    string email UK
    string password "hash, select false"
    string role "user | admin"
    boolean isActive
    date deactivatedAt
    ObjectId deactivatedBy FK
    object oauthProviders "provider + providerId[]"
    string picturePath
    string avatarColor
    string coverColor
    ObjectId friends "User[]"
    ObjectId following "User[]"
    ObjectId savedPosts "Post[]"
    string location
    string occupation
    string facebook
    string x
    string linkedin
    string instagram
    number viewedProfile
    date lastSeenAt "chat presence"
    date createdAt
    date updatedAt
  }

  POST {
    ObjectId _id PK
    string userId FK "author User"
    string description
    string url "ImageKit HTTPS"
    map likes "userId -> boolean"
    object comments "embedded[]"
    date createdAt
    date updatedAt
    date editedAt "text/image edit only"
  }

  COMMENT {
    ObjectId _id "subdoc id"
    string userId FK
    string text
    map likes "userId -> boolean"
    date createdAt
    date editedAt "text edit only"
  }

  FRIEND_REQUEST {
    ObjectId _id PK
    ObjectId from FK
    ObjectId to FK
    string status "pending|accepted|declined|cancelled"
    date createdAt
    date updatedAt
  }

  BLOCK {
    ObjectId _id PK
    ObjectId blocker FK
    ObjectId blocked FK
    string reason "harassment|bullying|hate_speech|offensive|spam|impersonation|fake_account|dont_want|other"
    string customReason
    date createdAt
    date updatedAt
  }

  CONVERSATION {
    ObjectId _id PK
    ObjectId participants "exactly two User ids"
    string participantKey UK
    date lastMessageAt
    string lastMessageText
    ObjectId lastSenderId FK
    map lastReadAt "userId -> Date"
    date createdAt
    date updatedAt
  }

  MESSAGE {
    ObjectId _id PK
    ObjectId conversationId FK
    ObjectId senderId FK
    string text
    date createdAt
    date updatedAt
  }

  NOTIFICATION {
    ObjectId _id PK
    ObjectId recipient FK
    ObjectId actor FK
    string type "post_like|comment|comment_like|friend|friend_request|friend_accept"
    ObjectId postId FK "nullable"
    string commentId "nullable"
    boolean read
    date createdAt
    date updatedAt
  }
```

---

## Collections

| Collection       | Model file                        | Notes                                          |
| ---------------- | --------------------------------- | ---------------------------------------------- |
| `users`          | `backend/models/User.js`          | Auth, profile, friends, following, saved posts |
| `posts`          | `backend/models/Post.js`          | Feed content; comments embedded                |
| `friendrequests` | `backend/models/FriendRequest.js` | Pending/accepted/declined/cancelled requests   |
| `blocks`         | `backend/models/Block.js`         | Blocker → blocked, with private reason         |
| `conversations`  | `backend/models/Conversation.js`  | 1:1 DM threads                                 |
| `messages`       | `backend/models/Message.js`       | DM messages                                    |
| `notifications`  | `backend/models/Notification.js`  | In-app bell notifications                      |

`Comment` is **not** a separate collection - it is an embedded subdocument array on `Post`.

---

## Relationship notes

| Relationship         | How it is stored                                                               |
| -------------------- | ------------------------------------------------------------------------------ |
| Friends              | Both users’ `friends` arrays (mutual)                                          |
| Following            | Follower’s `following` array only (one-way)                                    |
| Post / comment likes | `Map` keyed by user id on the post or comment                                  |
| Saved posts          | `User.savedPosts` → `Post`                                                     |
| Friend request       | `FriendRequest.from` / `.to` → `User` (unique pending pair index)              |
| Block                | `Block.blocker` / `.blocked` → `User` (unique pair; API hides both directions) |
| Conversation         | Two `participants` + unique `participantKey`                                   |
| Message              | `Message.conversationId` → Conversation; `senderId` → User                     |
| Notification         | `recipient` + `actor` → `User`; optional `postId` → `Post`                     |
| Admin deactivate     | `User.deactivatedBy` → `User`                                                  |

---

## Indexes (high level)

- **User:** unique `email`
- **FriendRequest:** unique pending `(from, to)`; indexes on `(to, status, createdAt)` and `(from, status, createdAt)`
- **Block:** unique `(blocker, blocked)`; indexes on `(blocker, createdAt)` and `blocked`
- **Notification:** `recipient`; `(recipient, createdAt)`
