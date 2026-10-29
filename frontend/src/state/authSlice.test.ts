import { describe, expect, it } from "vitest"

import type { Post, User } from "@/types/models"

import reducer, {
  prependPost,
  prependPosts,
  removePostsByUser,
  setFriends,
  setLogin,
  setLogout,
  setPost,
  setPosts,
} from "./index"

const baseUser: User = {
  _id: "u1",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  picturePath: "",
  friends: [],
  savedPosts: [],
}

describe("authSlice", () => {
  it("setLogin stores user and tokens and strips password if present", () => {
    const state = reducer(
      undefined,
      setLogin({
        user: { ...baseUser, password: "secret" } as User & { password?: string },
        accessToken: "a",
        refreshToken: "r",
      })
    )
    expect(state.accessToken).toBe("a")
    expect(state.refreshToken).toBe("r")
    expect(state.user?._id).toBe("u1")
    expect((state.user as { password?: string } | null)?.password).toBeUndefined()
  })

  it("setLogout clears session and posts", () => {
    let state = reducer(
      undefined,
      setLogin({
        user: baseUser,
        accessToken: "a",
        refreshToken: "r",
      })
    )
    state = reducer(state, setPosts({ posts: [{ _id: "p1" } as Post] }))
    state = reducer(state, setLogout())
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.posts).toEqual([])
  })

  it("setFriends updates the logged-in user friends list", () => {
    let state = reducer(
      undefined,
      setLogin({
        user: baseUser,
        accessToken: "a",
        refreshToken: "r",
      })
    )
    state = reducer(
      state,
      setFriends({
        friends: [
          {
            _id: "f1",
            firstName: "Bob",
            lastName: "Friend",
            occupation: "",
            location: "",
            picturePath: "",
          },
        ],
      })
    )
    expect(state.user?.friends).toHaveLength(1)
    expect(state.user?.friends[0]._id).toBe("f1")
  })

  it("setPost upserts and prependPost dedupes", () => {
    let state = reducer(undefined, setPosts({ posts: [] }))
    const post = { _id: "p1", description: "hi", userId: "u1", likes: {}, comments: [] } as Post
    state = reducer(state, setPost({ post }))
    expect(state.posts).toHaveLength(1)
    state = reducer(state, setPost({ post: { ...post, description: "updated" } }))
    expect(state.posts).toHaveLength(1)
    expect(state.posts[0].description).toBe("updated")
    state = reducer(state, prependPost({ post: { ...post, description: "again" } }))
    expect(state.posts).toHaveLength(1)
    expect(state.posts[0].description).toBe("again")
  })

  it("prependPosts inserts a newest-first batch and dedupes", () => {
    const older = { _id: "old", description: "old", userId: "u1", likes: {}, comments: [] } as Post
    const a = { _id: "a", description: "a", userId: "u1", likes: {}, comments: [] } as Post
    const b = { _id: "b", description: "b", userId: "u1", likes: {}, comments: [] } as Post
    let state = reducer(undefined, setPosts({ posts: [older, a] }))
    state = reducer(state, prependPosts({ posts: [b, a] }))
    expect(state.posts.map(p => p._id)).toEqual(["b", "a", "old"])
  })

  it("removePostsByUser drops their posts and comments and severs local graph", () => {
    let state = reducer(
      undefined,
      setLogin({
        user: {
          ...baseUser,
          following: ["u2"],
          friends: [
            {
              _id: "u2",
              firstName: "Bob",
              lastName: "Friend",
              occupation: "",
              location: "",
              picturePath: "",
            },
          ],
        },
        accessToken: "a",
        refreshToken: "r",
      })
    )
    state = reducer(
      state,
      setPosts({
        posts: [
          { _id: "p1", description: "theirs", userId: "u2", likes: {}, comments: [] } as Post,
          {
            _id: "p2",
            description: "mine",
            userId: "u1",
            likes: {},
            comments: [{ _id: "c1", userId: "u2", text: "hi" }],
          } as Post,
        ],
      })
    )
    state = reducer(state, removePostsByUser({ userId: "u2" }))
    expect(state.posts.map(p => p._id)).toEqual(["p2"])
    expect(state.posts[0].comments).toEqual([])
    expect(state.user?.following).toEqual([])
    expect(state.user?.friends).toEqual([])
  })
})
