/**
 * Admin feature-flag catalog (labels for Settings UI).
 * Keys match `backend/lib/features.js` and PROJECT_PLAN Part 2.
 */
export type FeatureFlagKey =
  | "postsCreate"
  | "postsImages"
  | "postsEmoji"
  | "postsEdit"
  | "postsDelete"
  | "commentsCreate"
  | "commentsEdit"
  | "commentsDelete"
  | "likesPosts"
  | "likesComments"
  | "share"
  | "notifications"
  | "profileEdit"
  | "profileAvatar"
  | "postsSave"
  | "friendRequests"
  | "follow"
  | "messaging"

export type FeatureCatalogItem = {
  key: FeatureFlagKey
  label: string
  description: string
}

export type FeatureCatalogGroup = {
  id: string
  title: string
  items: FeatureCatalogItem[]
}

export const FEATURE_CATALOG_GROUPS: FeatureCatalogGroup[] = [
  {
    id: "posts",
    title: "Posts",
    items: [
      {
        key: "postsCreate",
        label: "Create posts",
        description: "When off, users cannot create new posts (compose hidden).",
      },
      {
        key: "postsImages",
        label: "Images on posts",
        description: "When off, users cannot attach or replace images (text-only).",
      },
      {
        key: "postsEmoji",
        label: "Emoji picker",
        description: "When off, hide the emoji control on compose and comments.",
      },
      {
        key: "postsEdit",
        label: "Edit own posts",
        description: "When off, users cannot edit their own post text or image.",
      },
      {
        key: "postsDelete",
        label: "Delete own posts",
        description: "When off, users cannot delete their own posts.",
      },
      {
        key: "postsSave",
        label: "Save / bookmark",
        description: "When off, users cannot save or unsave posts.",
      },
    ],
  },
  {
    id: "comments",
    title: "Comments",
    items: [
      {
        key: "commentsCreate",
        label: "Comments",
        description: "When off, users cannot add comments.",
      },
      {
        key: "commentsEdit",
        label: "Edit own comments",
        description: "When off, users cannot edit their own comments.",
      },
      {
        key: "commentsDelete",
        label: "Delete own comments",
        description: "When off, users cannot delete their own comments.",
      },
    ],
  },
  {
    id: "engagement",
    title: "Engagement",
    items: [
      {
        key: "likesPosts",
        label: "Like posts",
        description: "When off, users cannot like or unlike posts.",
      },
      {
        key: "likesComments",
        label: "Like comments",
        description: "When off, users cannot like or unlike comments.",
      },
      {
        key: "share",
        label: "Share menu",
        description: "When off, hide share and copy-link actions.",
      },
    ],
  },
  {
    id: "profile",
    title: "Profile",
    items: [
      {
        key: "profileEdit",
        label: "Edit profile",
        description: "When off, users cannot open or save profile edits.",
      },
      {
        key: "profileAvatar",
        label: "Change profile photo",
        description: "When off, users cannot upload a new avatar.",
      },
    ],
  },
  {
    id: "social",
    title: "Social",
    items: [
      {
        key: "friendRequests",
        label: "Friend requests",
        description: "When off, users cannot send, accept, decline, or cancel requests.",
      },
      {
        key: "follow",
        label: "Follow / unfollow",
        description: "When off, users cannot follow or unfollow.",
      },
      {
        key: "messaging",
        label: "Messaging",
        description: "When off, users cannot send or open private messages.",
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    items: [
      {
        key: "notifications",
        label: "Notifications",
        description: "When off, hide the bell and notifications page for users.",
      },
    ],
  },
]
