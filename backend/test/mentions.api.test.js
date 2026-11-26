import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"

import request from "supertest"

import Notification from "../models/Notification.js"

import { authHeader, getApp, registerUser, startTestApp, stopTestApp } from "./helpers.js"

describe("mentions API", () => {
  let tokenA
  let tokenB
  let tokenC
  let idA
  let idB
  let idC

  before(async () => {
    await startTestApp()
    const a = await registerUser({ email: "mention-a@example.com", firstName: "Ada", lastName: "Lovelace" })
    const b = await registerUser({ email: "mention-b@example.com", firstName: "Bob", lastName: "Builder" })
    const c = await registerUser({ email: "mention-c@example.com", firstName: "Cara", lastName: "Lee" })
    assert.equal(a.res.status, 201)
    assert.equal(b.res.status, 201)
    assert.equal(c.res.status, 201)
    tokenA = a.res.body.accessToken
    tokenB = b.res.body.accessToken
    tokenC = c.res.body.accessToken
    idA = String(a.res.body.user._id)
    idB = String(b.res.body.user._id)
    idC = String(c.res.body.user._id)
  })

  after(async () => {
    await stopTestApp()
  })

  it("requires auth for mention-suggest", async () => {
    const res = await request(getApp()).get("/users/mention-suggest")
    assert.equal(res.status, 401)
  })

  it("suggests users by name and excludes self", async () => {
    const res = await request(getApp())
      .get("/users/mention-suggest")
      .query({ q: "Bob" })
      .set(authHeader(tokenA))
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.users))
    const ids = res.body.users.map(u => String(u._id))
    assert.ok(ids.includes(idB))
    assert.equal(ids.includes(idA), false)
    assert.equal(res.body.users[0].email, undefined)
  })

  it("creates a post mention, stores metadata, and notifies", async () => {
    const res = await request(getApp())
      .post("/posts")
      .set(authHeader(tokenA))
      .field("description", "Hello @Bob Builder")
      .field("mentionedUserIds", JSON.stringify([idB]))
    assert.equal(res.status, 201)
    assert.equal(res.body.post.mentions?.length, 1)
    assert.equal(String(res.body.post.mentions[0].userId), idB)
    assert.equal(res.body.post.mentions[0].display, "Bob Builder")

    const notes = await Notification.find({ recipient: idB, type: "mention", actor: idA }).lean()
    assert.equal(notes.length, 1)
    assert.equal(String(notes[0].postId), String(res.body.post._id))
  })

  it("rejects spoofed mention ids that are not in the text", async () => {
    const res = await request(getApp())
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ description: "No mention here", mentionedUserIds: [idB] })
    assert.equal(res.status, 400)
    assert.match(String(res.body.error || ""), /must appear/i)
  })

  it("rejects invalid mentioned user ids", async () => {
    const res = await request(getApp())
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ description: "Hi @Bob Builder", mentionedUserIds: ["not-an-id"] })
    assert.equal(res.status, 400)
  })

  it("rejects mentioning a blocked user", async () => {
    const block = await request(getApp())
      .post(`/users/${idC}/block`)
      .set(authHeader(tokenA))
      .send({ reason: "spam" })
    assert.ok(block.status === 200 || block.status === 201)

    const res = await request(getApp())
      .post("/posts")
      .set(authHeader(tokenA))
      .send({ description: "Hey @Cara Lee", mentionedUserIds: [idC] })
    assert.equal(res.status, 400)
    assert.match(String(res.body.error || ""), /blocked/i)

    const suggest = await request(getApp())
      .get("/users/mention-suggest")
      .query({ q: "Cara" })
      .set(authHeader(tokenA))
    assert.equal(suggest.status, 200)
    assert.equal(
      suggest.body.users.some(u => String(u._id) === idC),
      false
    )
  })

  it("adds a comment mention and notifies", async () => {
    const post = await request(getApp())
      .post("/posts")
      .set(authHeader(tokenB))
      .send({ description: "Open thread" })
    assert.equal(post.status, 201)
    const postId = post.body.post._id

    const res = await request(getApp())
      .post(`/posts/${postId}/comments`)
      .set(authHeader(tokenB))
      .send({ text: "Ping @Ada Lovelace", mentionedUserIds: [idA] })
    assert.equal(res.status, 201)
    const comments = res.body.updatedPost.comments || []
    const last = comments[comments.length - 1]
    assert.equal(last.mentions?.length, 1)
    assert.equal(String(last.mentions[0].userId), idA)

    const notes = await Notification.find({
      recipient: idA,
      type: "mention",
      actor: idB,
      commentId: String(last._id),
    }).lean()
    assert.equal(notes.length, 1)
  })

  it("notifies only newly mentioned users on edit", async () => {
    const create = await request(getApp())
      .post("/posts")
      .set(authHeader(tokenB))
      .field("description", "Only @Ada Lovelace")
      .field("mentionedUserIds", JSON.stringify([idA]))
    assert.equal(create.status, 201)
    const postId = create.body.post._id

    await Notification.deleteMany({ postId, type: "mention" })

    const edit = await request(getApp())
      .patch(`/posts/${postId}`)
      .set(authHeader(tokenB))
      .field("description", "Only @Ada Lovelace and later @Cara Lee")
      .field("mentionedUserIds", JSON.stringify([idA, idC]))
    assert.equal(edit.status, 200)
    assert.equal(edit.body.updatedPost.mentions?.length, 2)

    const notes = await Notification.find({ postId, type: "mention" }).lean()
    assert.equal(notes.length, 1)
    assert.equal(String(notes[0].recipient), idC)
  })
})
