/** Friend list item as returned by the API (formatted objects, not raw ids). */
export type Friend = {
  _id: string
  firstName: string
  lastName: string
  occupation?: string
  location?: string
  picturePath?: string
  avatarColor?: string
  /** @deprecated Prefer `_id`; kept for older persisted Redux state. */
  id?: string
  /** @deprecated Prefer `picturePath`. */
  url?: string
}

export type UserRole = "user" | "admin"

export type User = {
  _id: string
  firstName: string
  lastName: string
  email?: string
  picturePath: string
  /** Site role (`admin` can moderate). */
  role?: UserRole
  /** Soft-active flag; deactivated users cannot log in. */
  isActive?: boolean
  /** Initials avatar background when no photo (allowlisted hex). */
  avatarColor?: string
  /** Solid profile header/cover color (allowlisted hex). */
  coverColor?: string
  friends: Friend[]
  /** User ids I follow (one-way). Private to me (session/auth payloads). */
  following?: string[]
  /** Public relationship counts (prefer these over array lengths on profiles). */
  friendCount?: number
  followerCount?: number
  followingCount?: number
  /** Post ids the user has bookmarked (private). */
  savedPosts?: string[]
  location?: string
  occupation?: string
  facebook?: string
  x?: string
  linkedin?: string
  instagram?: string
  viewedProfile?: number
  /** Account creation time (ISO). */
  createdAt?: string
}

/** Paginated people list (`/users/:id/friends|followers|following`). */
export type PaginatedPeople = {
  users: (Friend & {
    relationship?: {
      isFriend: boolean
      isFollowing: boolean
      outgoingRequestId: string | null
      incomingRequestId: string | null
    }
  })[]
  nextCursor: string | null
  hasMore: boolean
  total: number
}

export type PeopleListTab = "friends" | "followers" | "following"

/** Public discover / search row (safe fields only). */
export type DiscoverUser = {
  _id: string
  firstName: string
  lastName: string
  picturePath?: string
  avatarColor?: string
  location?: string
  occupation?: string
  /** Account creation time (ISO). */
  createdAt?: string
  relationship?: {
    isFriend: boolean
    isFollowing: boolean
    outgoingRequestId: string | null
    incomingRequestId: string | null
  }
}

/** Post likes are a Map on the server, serialized as an object keyed by user id. */
export type PostLikes = Record<string, boolean>

export type PostComment = {
  _id?: string
  userId: string
  text: string
  createdAt?: string
  /** Set when the comment text was edited. */
  editedAt?: string | null
  /** Comment likes keyed by user id (same shape as post likes). */
  likes?: PostLikes
  user?: Pick<User, "firstName" | "lastName" | "picturePath" | "avatarColor"> | null
}

export type Post = {
  _id: string
  userId: string
  description: string
  url?: string
  likes: PostLikes
  comments: PostComment[]
  createdAt?: string
  updatedAt?: string
  /** Set when description or image was edited (not on like / comment). */
  editedAt?: string | null
  user?: Pick<User, "firstName" | "lastName" | "location" | "picturePath" | "avatarColor"> | null
}

export type PaginatedPosts = {
  posts: Post[]
  nextCursor: string | null
  hasMore: boolean
}

export type AuthState = {
  mode: "light" | "dark"
  user: User | null
  posts: Post[]
  accessToken: string | null
  refreshToken: string | null
}

export type LoginFormValues = {
  email: string
  password: string
}

export type RegisterFormValues = {
  firstName: string
  lastName: string
  email: string
  password: string
  cPassword: string
}

export type CreatePostFormValues = {
  description: string
  picture: File | null
}

export type ApiErrorBody = {
  msg?: string
  error?: string
}

/** Resolve a friend entry id whether it is a formatted object or a legacy string id. */
export function friendIdOf(friend: Friend | string | null | undefined): string {
  if (friend == null) return ""
  if (typeof friend === "string") return friend
  return String(friend._id ?? friend.id ?? "")
}

/** Compare Mongo user ids safely (string / ObjectId / undefined). */
export function sameUserId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null || a === "" || b === "") return false
  return String(a) === String(b)
}
