import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"

import request from "supertest"

import { authHeader, getApp, registerUser, startTestApp, stopTestApp } from "./helpers.js"

describe("posts API", () => {
  let token
  let userId

  before(async () => {
    await startTestApp()
    const { res } = await registerUser({ email: "poster@example.com", firstName: "Pat", lastName: "Poster" })
    token = res.body.accessToken
    userId = res.body.user._id
  })

  after(async () => {
    await stopTestApp()
  })

  it("creates a text post and returns it in the feed", async () => {
    const create = await request(getApp())
      .post("/posts")
      .set(authHeader(token))
      .send({ description: "Hello Xivi" })
    assert.equal(create.status, 201)
    assert.equal(create.body.post.description, "Hello Xivi")
    assert.equal(String(create.body.post.userId), String(userId))

    const feed = await request(getApp())
      .get("/posts")
      .query({ scope: "all", limit: 10 })
      .set(authHeader(token))
    assert.equal(feed.status, 200)
    assert.ok(Array.isArray(feed.body.posts))
    assert.ok(feed.body.posts.some(p => p.description === "Hello Xivi"))
    assert.ok("nextCursor" in feed.body)
    assert.ok("hasMore" in feed.body)
  })

  it("toggles like on a post", async () => {
    const create = await request(getApp())
      .post("/posts")
      .set(authHeader(token))
      .send({ description: "Like me" })
    const postId = create.body.post._id

    const liked = await request(getApp()).patch(`/posts/${postId}/like`).set(authHeader(token))
    assert.equal(liked.status, 200)
    assert.equal(Boolean(liked.body.updatedPost.likes[userId]), true)

    const unliked = await request(getApp()).patch(`/posts/${postId}/like`).set(authHeader(token))
    assert.equal(unliked.status, 200)
    assert.equal(Boolean(unliked.body.updatedPost.likes[userId]), false)
  })

  it("adds a comment and toggles comment like", async () => {
    const create = await request(getApp())
      .post("/posts")
      .set(authHeader(token))
      .send({ description: "Comment me" })
    const postId = create.body.post._id

    const commented = await request(getApp())
      .post(`/posts/${postId}/comments`)
      .set(authHeader(token))
      .send({ text: "Nice post" })
    assert.equal(commented.status, 201)
    const commentId = commented.body.updatedPost.comments.at(-1)._id
    assert.ok(commentId)

    const liked = await request(getApp())
      .patch(`/posts/${postId}/comments/${commentId}/like`)
      .set(authHeader(token))
    assert.equal(liked.status, 200)
    const likes = liked.body.updatedPost.comments.find(c => String(c._id) === String(commentId)).likes
    assert.equal(Boolean(likes[userId]), true)
  })

  it("saves and unsaves a post", async () => {
    const create = await request(getApp())
      .post("/posts")
      .set(authHeader(token))
      .send({ description: "Save me" })
    const postId = create.body.post._id

    const saved = await request(getApp()).put(`/posts/${postId}/save`).set(authHeader(token))
    assert.equal(saved.status, 200)

    const list = await request(getApp()).get("/posts/saved").set(authHeader(token))
    assert.equal(list.status, 200)
    const posts = Array.isArray(list.body) ? list.body : list.body.posts
    assert.ok(posts.some(p => String(p._id) === String(postId)))

    const unsaved = await request(getApp()).delete(`/posts/${postId}/save`).set(authHeader(token))
    assert.equal(unsaved.status, 200)
  })

  it("sets editedAt when a post or comment is edited, not when liked", async () => {
    const create = await request(getApp())
      .post("/posts")
      .set(authHeader(token))
      .send({ description: "Edit me" })
    assert.equal(create.status, 201)
    const postId = create.body.post._id
    assert.equal(create.body.post.editedAt, null)

    const liked = await request(getApp()).patch(`/posts/${postId}/like`).set(authHeader(token))
    assert.equal(liked.status, 200)
    assert.equal(liked.body.updatedPost.editedAt, null)

    const edited = await request(getApp())
      .patch(`/posts/${postId}`)
      .set(authHeader(token))
      .send({ description: "Edited copy" })
    assert.equal(edited.status, 200)
    assert.ok(edited.body.updatedPost.editedAt)

    const commented = await request(getApp())
      .post(`/posts/${postId}/comments`)
      .set(authHeader(token))
      .send({ text: "First take" })
    assert.equal(commented.status, 201)
    const comment = commented.body.updatedPost.comments.at(-1)
    assert.ok(comment?._id)
    assert.equal(comment.editedAt, null)

    const commentLiked = await request(getApp())
      .patch(`/posts/${postId}/comments/${comment._id}/like`)
      .set(authHeader(token))
    assert.equal(commentLiked.status, 200)
    const afterLike = commentLiked.body.updatedPost.comments.find(c => String(c._id) === String(comment._id))
    assert.equal(afterLike.editedAt, null)

    const commentEdited = await request(getApp())
      .patch(`/posts/${postId}/comments/${comment._id}`)
      .set(authHeader(token))
      .send({ text: "Second take" })
    assert.equal(commentEdited.status, 200)
    const afterEdit = commentEdited.body.updatedPost.comments.find(c => String(c._id) === String(comment._id))
    assert.ok(afterEdit.editedAt)
  })

  it("rejects create post without auth", async () => {
    const res = await request(getApp()).post("/posts").send({ description: "Nope" })
    assert.equal(res.status, 401)
  })

  it("rejects create post when description exceeds 5000 characters", async () => {
    const res = await request(getApp())
      .post("/posts")
      .set(authHeader(token))
      .send({ description: "x".repeat(5001) })
    assert.equal(res.status, 400)
    assert.match(String(res.body.error || ""), /5000/i)
  })
})
