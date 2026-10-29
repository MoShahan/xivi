import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { AuthState, Friend, Post, User } from "@/types/models"

const initialState: AuthState = {
  /** SSR / first-paint fallback; ThemeInit may align to system before any user toggle. */
  mode: "light",
  user: null,
  posts: [],
  accessToken: null,
  refreshToken: null,
}

/** Never persist a password if a buggy API response included one. */
function sanitizeUser(user: User): User {
  const { ...safe } = user as User & { password?: unknown }
  delete (safe as { password?: unknown }).password
  safe.savedPosts = (safe.savedPosts || []).map(id => String(id))
  safe.following = (safe.following || []).map(id => String(id))
  return safe
}

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    toggleMode: state => {
      state.mode = state.mode === "light" ? "dark" : "light"
    },
    setMode: (state, action: PayloadAction<"light" | "dark">) => {
      state.mode = action.payload
    },
    setLogin: (state, action: PayloadAction<{ user: User; accessToken: string; refreshToken: string }>) => {
      state.user = sanitizeUser(action.payload.user)
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
    },
    setTokens: (state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) => {
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
    },
    setLogout: state => {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.posts = []
    },
    setFriends: (state, action: PayloadAction<{ friends: Friend[] }>) => {
      if (state.user) {
        state.user.friends = action.payload.friends
      } else {
        console.warn("User does not exist, cannot set Friends")
      }
    },
    setFollowing: (state, action: PayloadAction<{ following: string[] }>) => {
      if (state.user) {
        state.user.following = action.payload.following.map(id => String(id))
      } else {
        console.warn("User does not exist, cannot set following")
      }
    },
    setSavedPosts: (state, action: PayloadAction<{ savedPosts: string[] }>) => {
      if (state.user) {
        state.user.savedPosts = action.payload.savedPosts.map(id => String(id))
      } else {
        console.warn("User does not exist, cannot set saved posts")
      }
    },
    setUser: (state, action: PayloadAction<{ user: User }>) => {
      const next = sanitizeUser(action.payload.user)
      // Preserve friends/saved/following when the API returns raw ids or omits private lists.
      if (state.user) {
        const incoming = action.payload.user.friends as unknown
        const first = Array.isArray(incoming) ? incoming[0] : undefined
        const looksLikeRawIds = typeof first === "string"
        if (!Array.isArray(incoming) || looksLikeRawIds) {
          next.friends = state.user.friends
        }
        if (!next.savedPosts?.length && state.user.savedPosts?.length) {
          next.savedPosts = state.user.savedPosts
        }
        if (action.payload.user.following === undefined && state.user.following?.length) {
          next.following = state.user.following
        }
      }
      state.user = next
    },
    setPosts: (state, action: PayloadAction<{ posts: Post[] }>) => {
      state.posts = action.payload.posts
    },
    prependPost: (state, action: PayloadAction<{ post: Post }>) => {
      const id = String(action.payload.post._id)
      state.posts = [action.payload.post, ...state.posts.filter(p => String(p._id) !== id)]
    },
    prependPosts: (state, action: PayloadAction<{ posts: Post[] }>) => {
      const incoming = action.payload.posts
      if (!incoming.length) return
      const incomingIds = new Set(incoming.map(post => String(post._id)))
      const rest = state.posts.filter(post => !incomingIds.has(String(post._id)))
      state.posts = [...incoming, ...rest]
    },
    appendPosts: (state, action: PayloadAction<{ posts: Post[] }>) => {
      const seen = new Set(state.posts.map(p => String(p._id)))
      for (const post of action.payload.posts) {
        const id = String(post._id)
        if (!seen.has(id)) {
          seen.add(id)
          state.posts.push(post)
        }
      }
    },
    setPost: (state, action: PayloadAction<{ post: Post }>) => {
      const updated = action.payload.post
      const id = String(updated._id)
      const idx = state.posts.findIndex(post => String(post._id) === id)
      if (idx >= 0) {
        state.posts[idx] = { ...state.posts[idx], ...updated }
      } else {
        // Upsert so single-post page likes/comments work when the feed is empty.
        state.posts.push(updated)
      }
    },
    removePost: (state, action: PayloadAction<{ postId: string }>) => {
      const id = String(action.payload.postId)
      state.posts = state.posts.filter(post => String(post._id) !== id)
    },
    removePostsByUser: (state, action: PayloadAction<{ userId: string }>) => {
      const uid = String(action.payload.userId)
      state.posts = state.posts
        .filter(post => String(post.userId) !== uid)
        .map(post => ({
          ...post,
          comments: (post.comments || []).filter(comment => String(comment.userId) !== uid),
        }))
      if (state.user) {
        if (state.user.following) {
          state.user.following = state.user.following.filter(id => String(id) !== uid)
        }
        if (state.user.friends) {
          state.user.friends = state.user.friends.filter(friend => String(friend._id ?? friend.id) !== uid)
        }
      }
    },
  },
})

export const {
  toggleMode,
  setMode,
  setFriends,
  setFollowing,
  setSavedPosts,
  setUser,
  setLogin,
  setTokens,
  setPost,
  setPosts,
  prependPost,
  prependPosts,
  appendPosts,
  removePost,
  removePostsByUser,
  setLogout,
} = authSlice.actions

export default authSlice.reducer
