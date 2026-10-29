import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"

import request from "supertest"

import { FEATURE_DISABLED_ERROR, invalidateFeaturesCache } from "../lib/features.js"
import User from "../models/User.js"

import {
  authHeader,
  getApp,
  registerUser,
  startTestApp,
  stopTestApp,
  VALID_PASSWORD,
} from "./helpers.js"

async function becomeFriends(tokenFrom, tokenTo, _fromId, toId) {
  const sent = await request(getApp())
    .post(`/users/${toId}/friend-requests`)
    .set(authHeader(tokenFrom))
  assert.equal(sent.status, 201, JSON.stringify(sent.body))
  const requestId = sent.body.request._id
  const accepted = await request(getApp())
    .post(`/users/me/friend-requests/${requestId}/accept`)
    .set(authHeader(tokenTo))
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body))
  return requestId
}

describe("conversations / DMs API", { concurrency: false }, () => {
  let tokenA
  let tokenB
  let tokenC
  let idA
  let idB
  let idC

  before(async () => {
    await startTestApp()
    const a = await registerUser({
      email: "alice-dm@example.com",
      firstName: "Alice",
      lastName: "Anderson",
    })
    const b = await registerUser({
      email: "bob-dm@example.com",
      firstName: "Bob",
      lastName: "Baker",
    })
    const c = await registerUser({
      email: "cara-dm@example.com",
      firstName: "Cara",
      lastName: "Cole",
    })
    assert.equal(a.res.status, 201, a.res.body?.error || "Alice register failed")
    assert.equal(b.res.status, 201, b.res.body?.error || "Bob register failed")
    assert.equal(c.res.status, 201, c.res.body?.error || "Cara register failed")
    tokenA = a.res.body.accessToken
    tokenB = b.res.body.accessToken
    tokenC = c.res.body.accessToken
    idA = a.res.body.user._id
    idB = b.res.body.user._id
    idC = c.res.body.user._id
  })

  after(async () => {
    await stopTestApp()
  })

  it("requires auth", async () => {
    const res = await request(getApp()).get("/conversations")
    assert.equal(res.status, 401)
  })

  it("rejects messaging yourself", async () => {
    const res = await request(getApp())
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ recipientId: idA, text: "hi" })
    assert.equal(res.status, 400)
  })

  it("rejects invalid recipient", async () => {
    const res = await request(getApp())
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ recipientId: "not-an-id", text: "hi" })
    assert.equal(res.status, 400)
  })

  it("non-friends land in the requests inbox, not friends", async () => {
    const created = await request(getApp())
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ recipientId: idB, text: "Hello Bob" })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    assert.equal(created.body.conversation.box, "requests")
    assert.equal(created.body.message.text, "Hello Bob")
    assert.equal(created.body.conversation.otherUser._id, String(idB))

    const friendsA = await request(getApp())
      .get("/conversations?box=friends")
      .set(authHeader(tokenA))
    assert.equal(friendsA.status, 200)
    assert.equal(friendsA.body.conversations.length, 0)

    const requestsA = await request(getApp())
      .get("/conversations?box=requests")
      .set(authHeader(tokenA))
    assert.equal(requestsA.body.conversations.length, 1)
    assert.equal(requestsA.body.conversations[0].unread, false)

    const requestsB = await request(getApp())
      .get("/conversations?box=requests")
      .set(authHeader(tokenB))
    assert.equal(requestsB.body.conversations.length, 1)
    assert.equal(requestsB.body.conversations[0].unread, true)
    assert.equal(requestsB.body.conversations[0].otherUser._id, String(idA))
  })

  it("follow-only never appears in Friends", async () => {
    const follow = await request(getApp()).post(`/users/${idC}/follow`).set(authHeader(tokenA))
    assert.equal(follow.status, 200)

    const created = await request(getApp())
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ recipientId: idC, text: "Hi Cara" })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    assert.equal(created.body.conversation.box, "requests")

    const friendsA = await request(getApp())
      .get("/conversations?box=friends")
      .set(authHeader(tokenA))
    assert.equal(friendsA.body.conversations.length, 0)

    const requestsC = await request(getApp())
      .get("/conversations?box=requests")
      .set(authHeader(tokenC))
    assert.equal(requestsC.body.conversations.length, 1)
  })

  it("accepting a friend request promotes the thread to Friends; unfriend demotes it", async () => {
    await becomeFriends(tokenA, tokenB, idA, idB)

    const friendsA = await request(getApp())
      .get("/conversations?box=friends")
      .set(authHeader(tokenA))
    assert.equal(friendsA.body.conversations.length, 1)
    assert.equal(friendsA.body.conversations[0].otherUser._id, String(idB))

    const requestsA = await request(getApp())
      .get("/conversations?box=requests")
      .set(authHeader(tokenA))
    assert.equal(requestsA.body.conversations.length, 1)
    assert.equal(requestsA.body.conversations[0].otherUser._id, String(idC))

    const unfriend = await request(getApp())
      .delete(`/users/me/friends/${idB}`)
      .set(authHeader(tokenA))
    assert.equal(unfriend.status, 200)

    const friendsAfter = await request(getApp())
      .get("/conversations?box=friends")
      .set(authHeader(tokenA))
    assert.equal(friendsAfter.body.conversations.length, 0)

    const requestsAfter = await request(getApp())
      .get("/conversations?box=requests")
      .set(authHeader(tokenA))
    assert.equal(
      requestsAfter.body.conversations.some(c => c.otherUser._id === String(idB)),
      true
    )
  })

  it("non-participant cannot read a thread", async () => {
    const list = await request(getApp())
      .get("/conversations?box=requests")
      .set(authHeader(tokenA))
    const withBob = list.body.conversations.find(c => c.otherUser._id === String(idB))
    assert.ok(withBob)

    const peek = await request(getApp())
      .get(`/conversations/${withBob._id}`)
      .set(authHeader(tokenC))
    assert.equal(peek.status, 404)

    const msgs = await request(getApp())
      .get(`/conversations/${withBob._id}/messages`)
      .set(authHeader(tokenC))
    assert.equal(msgs.status, 404)

    const send = await request(getApp())
      .post(`/conversations/${withBob._id}/messages`)
      .set(authHeader(tokenC))
      .send({ text: "intruder" })
    assert.equal(send.status, 404)
  })

  it("unread count increments for recipient and clears on read", async () => {
    const list = await request(getApp())
      .get("/conversations?box=requests")
      .set(authHeader(tokenB))
    const convo = list.body.conversations.find(c => c.otherUser._id === String(idA))
    assert.ok(convo)

    const unreadBefore = await request(getApp())
      .get("/conversations/unread-count")
      .set(authHeader(tokenB))
    assert.equal(unreadBefore.status, 200)
    assert.ok(unreadBefore.body.count >= 1)

    const read = await request(getApp())
      .patch(`/conversations/${convo._id}/read`)
      .set(authHeader(tokenB))
    assert.equal(read.status, 200, JSON.stringify(read.body))
    assert.equal(read.body.conversation.unread, false)

    const unreadAfter = await request(getApp())
      .get("/conversations/unread-count")
      .set(authHeader(tokenB))
    assert.equal(unreadAfter.body.count, 0)

    const msgs = await request(getApp())
      .get(`/conversations/${convo._id}/messages`)
      .set(authHeader(tokenA))
    assert.equal(msgs.status, 200)
    assert.ok(msgs.body.lastReadAt.other)
    const first = msgs.body.messages[0]
    assert.ok(new Date(msgs.body.lastReadAt.other) >= new Date(first.createdAt))
  })

  it("rejects empty and overlong messages", async () => {
    const opened = await request(getApp())
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ recipientId: idB })
    assert.ok([200, 201].includes(opened.status))
    const convoId = opened.body.conversation._id

    const empty = await request(getApp())
      .post(`/conversations/${convoId}/messages`)
      .set(authHeader(tokenA))
      .send({ text: "   " })
    assert.equal(empty.status, 400)

    const tooLong = await request(getApp())
      .post(`/conversations/${convoId}/messages`)
      .set(authHeader(tokenA))
      .send({ text: "x".repeat(2001) })
    assert.equal(tooLong.status, 400)
  })

  it("paginates messages newest-first", async () => {
    const opened = await request(getApp())
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ recipientId: idB })
    const convoId = opened.body.conversation._id

    for (let i = 0; i < 5; i += 1) {
      const sent = await request(getApp())
        .post(`/conversations/${convoId}/messages`)
        .set(authHeader(tokenA))
        .send({ text: `msg-${i}` })
      assert.equal(sent.status, 201, JSON.stringify(sent.body))
    }

    const page1 = await request(getApp())
      .get(`/conversations/${convoId}/messages?limit=2`)
      .set(authHeader(tokenA))
    assert.equal(page1.status, 200)
    assert.equal(page1.body.messages.length, 2)
    assert.equal(page1.body.hasMore, true)
    assert.ok(page1.body.nextCursor)

    const page2 = await request(getApp())
      .get(`/conversations/${convoId}/messages?limit=2&cursor=${page1.body.nextCursor}`)
      .set(authHeader(tokenA))
    assert.equal(page2.status, 200)
    assert.equal(page2.body.messages.length, 2)
    const ids = new Set([
      ...page1.body.messages.map(m => m._id),
      ...page2.body.messages.map(m => m._id),
    ])
    assert.equal(ids.size, 4)
  })

  it("cannot message a deactivated user", async () => {
    await User.updateOne({ _id: idC }, { $set: { isActive: false } })
    const res = await request(getApp())
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ recipientId: idC, text: "still there?" })
    assert.equal(res.status, 404)
    await User.updateOne({ _id: idC }, { $set: { isActive: true } })
  })

  it("cannot start a DM with a blocked user", async () => {
    const blocked = await request(getApp())
      .post(`/users/${idB}/block`)
      .set(authHeader(tokenA))
      .send({ reason: "harassment" })
    assert.equal(blocked.status, 201, JSON.stringify(blocked.body))

    const res = await request(getApp())
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ recipientId: idB, text: "hey" })
    assert.equal(res.status, 403)

    await request(getApp()).delete(`/users/${idB}/block`).set(authHeader(tokenA))
  })

  it("blocks user sends when messaging is off; admin still can", async () => {
    process.env.ADMIN_EMAILS = "dm-admin@example.com"
    invalidateFeaturesCache()
    const adminReg = await registerUser({
      email: "dm-admin@example.com",
      firstName: "Feat",
      lastName: "Admin",
      password: VALID_PASSWORD,
    })
    assert.equal(adminReg.res.status, 201)
    const adminLogin = await request(getApp())
      .post("/auth/login")
      .send({ email: "dm-admin@example.com", password: VALID_PASSWORD })
    assert.equal(adminLogin.status, 200)
    const adminToken = adminLogin.body.accessToken

    const patched = await request(getApp())
      .patch("/settings/features")
      .set(authHeader(adminToken))
      .send({ features: { messaging: false } })
    assert.equal(patched.status, 200, JSON.stringify(patched.body))
    assert.equal(patched.body.features.messaging, false)

    const blocked = await request(getApp())
      .post("/conversations")
      .set(authHeader(tokenA))
      .send({ recipientId: idB, text: "nope" })
    assert.equal(blocked.status, 403)
    assert.equal(blocked.body.error, FEATURE_DISABLED_ERROR)

    const adminSend = await request(getApp())
      .post("/conversations")
      .set(authHeader(adminToken))
      .send({ recipientId: idB, text: "admin hello" })
    assert.equal(adminSend.status, 201, JSON.stringify(adminSend.body))

    await request(getApp())
      .patch("/settings/features")
      .set(authHeader(adminToken))
      .send({ features: { messaging: true } })
    delete process.env.ADMIN_EMAILS
    invalidateFeaturesCache()
  })
})
