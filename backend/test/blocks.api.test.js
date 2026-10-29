import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"

import request from "supertest"

import { authHeader, getApp, registerUser, startTestApp, stopTestApp } from "./helpers.js"

describe("block user API", () => {
  let tokenA
  let tokenB
  let tokenC
  let idA
  let idB
  let idC

  before(async () => {
    await startTestApp()
    const a = await registerUser({
      email: "alice-block@example.com",
      firstName: "Alice",
      lastName: "Blocker",
    })
    const b = await registerUser({
      email: "bob-block@example.com",
      firstName: "Bob",
      lastName: "Blocked",
    })
    const c = await registerUser({
      email: "cara-block@example.com",
      firstName: "Cara",
      lastName: "Bystander",
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

  it("rejects unauthenticated, self, missing, and invalid reasons", async () => {
    const unauth = await request(getApp()).post(`/users/${idB}/block`).send({ reason: "spam" })
    assert.equal(unauth.status, 401)

    const self = await request(getApp()).post(`/users/${idA}/block`).set(authHeader(tokenA)).send({ reason: "spam" })
    assert.equal(self.status, 400)

    const missing = await request(getApp())
      .post("/users/aaaaaaaaaaaaaaaaaaaaaaaa/block")
      .set(authHeader(tokenA))
      .send({ reason: "spam" })
    assert.equal(missing.status, 404)

    const badReason = await request(getApp())
      .post(`/users/${idB}/block`)
      .set(authHeader(tokenA))
      .send({ reason: "nope" })
    assert.equal(badReason.status, 400)

    const otherEmpty = await request(getApp())
      .post(`/users/${idB}/block`)
      .set(authHeader(tokenA))
      .send({ reason: "other", customReason: "  " })
    assert.equal(otherEmpty.status, 400)
  })

  it("blocks with a reason, hides both ways, and severs friends/follows", async () => {
    await request(getApp()).post(`/users/${idB}/follow`).set(authHeader(tokenA))
    await request(getApp()).post(`/users/${idA}/follow`).set(authHeader(tokenB))
    const sent = await request(getApp()).post(`/users/${idB}/friend-requests`).set(authHeader(tokenA))
    assert.equal(sent.status, 201)
    const accepted = await request(getApp())
      .post(`/users/me/friend-requests/${sent.body.request._id}/accept`)
      .set(authHeader(tokenB))
    assert.equal(accepted.status, 200)

    const postB = await request(getApp())
      .post("/posts")
      .set(authHeader(tokenB))
      .send({ description: "Bob should vanish" })
    assert.equal(postB.status, 201)
    const postBId = postB.body.post._id

    const postA = await request(getApp()).post("/posts").set(authHeader(tokenA)).send({ description: "Alice public" })
    assert.equal(postA.status, 201)
    const postAId = postA.body.post._id

    const postC = await request(getApp())
      .post("/posts")
      .set(authHeader(tokenC))
      .send({ description: "Cara hosts a comment" })
    assert.equal(postC.status, 201)
    const postCId = postC.body.post._id

    const commented = await request(getApp())
      .post(`/posts/${postCId}/comments`)
      .set(authHeader(tokenB))
      .send({ text: "Bob on Cara" })
    assert.equal(commented.status, 201)

    await request(getApp()).patch(`/posts/${postBId}/like`).set(authHeader(tokenA))
    await request(getApp()).post(`/posts/${postBId}/comments`).set(authHeader(tokenA)).send({ text: "Alice on Bob" })

    const blocked = await request(getApp())
      .post(`/users/${idB}/block`)
      .set(authHeader(tokenA))
      .send({ reason: "harassment" })
    assert.equal(blocked.status, 201, JSON.stringify(blocked.body))
    assert.equal(blocked.body.block.reason, "harassment")
    assert.equal(String(blocked.body.blockedUser._id), String(idB))

    const dup = await request(getApp()).post(`/users/${idB}/block`).set(authHeader(tokenA)).send({ reason: "spam" })
    assert.equal(dup.status, 409)

    const profileAseesB = await request(getApp()).get(`/users/${idB}`).set(authHeader(tokenA))
    assert.equal(profileAseesB.status, 200)
    assert.equal(profileAseesB.body.blockedByMe, true)
    assert.equal(typeof profileAseesB.body.friendCount, "undefined")

    const profileBseesA = await request(getApp()).get(`/users/${idA}`).set(authHeader(tokenB))
    assert.equal(profileBseesA.status, 404)

    const relB = await request(getApp()).get(`/users/${idA}/relationship`).set(authHeader(tokenB))
    assert.equal(relB.status, 404)

    const relA = await request(getApp()).get(`/users/${idB}/relationship`).set(authHeader(tokenA))
    assert.equal(relA.status, 200)
    assert.equal(relA.body.relationship.blockedByMe, true)
    assert.equal(relA.body.relationship.isFriend, false)
    assert.equal(relA.body.relationship.isFollowing, false)

    const feedA = await request(getApp()).get("/posts").query({ scope: "all" }).set(authHeader(tokenA))
    assert.equal(feedA.status, 200)
    assert.equal(
      feedA.body.posts.some(p => String(p._id) === String(postBId)),
      false
    )

    const feedB = await request(getApp()).get("/posts").query({ scope: "all" }).set(authHeader(tokenB))
    assert.equal(
      feedB.body.posts.some(p => String(p.userId) === String(idA)),
      false
    )

    const caraPost = await request(getApp()).get(`/posts/${postCId}`).set(authHeader(tokenA))
    assert.equal(caraPost.status, 200)
    assert.equal(
      (caraPost.body.comments || []).some(c => String(c.userId) === String(idB)),
      false
    )

    const hiddenPost = await request(getApp()).get(`/posts/${postBId}`).set(authHeader(tokenA))
    assert.equal(hiddenPost.status, 404)

    const followAfter = await request(getApp()).post(`/users/${idB}/follow`).set(authHeader(tokenA))
    assert.equal(followAfter.status, 403)

    const friendAfter = await request(getApp()).post(`/users/${idB}/friend-requests`).set(authHeader(tokenA))
    assert.equal(friendAfter.status, 403)

    const commentAfter = await request(getApp())
      .post(`/posts/${postBId}/comments`)
      .set(authHeader(tokenA))
      .send({ text: "nope" })
    assert.equal(commentAfter.status, 403)

    const likeAfter = await request(getApp()).patch(`/posts/${postAId}/like`).set(authHeader(tokenB))
    assert.equal(likeAfter.status, 403)

    const discoverA = await request(getApp()).get("/users/discover").set(authHeader(tokenA))
    assert.equal(
      (discoverA.body.users || []).some(u => String(u._id) === String(idB)),
      false
    )

    const inboxB = await request(getApp()).get("/users/me/friend-requests?box=incoming").set(authHeader(tokenB))
    assert.equal(
      (inboxB.body.requests || []).some(r => String(r.from) === String(idA)),
      false
    )

    const notesA = await request(getApp()).get("/notifications").set(authHeader(tokenA))
    assert.equal(notesA.status, 200)
    assert.equal(
      (notesA.body.notifications || []).some(n => String(n.actor?._id || n.actor) === String(idB)),
      false
    )

    const list = await request(getApp()).get("/users/me/blocks").query({ limit: 10 }).set(authHeader(tokenA))
    assert.equal(list.status, 200)
    assert.equal(list.body.total, 1)
    assert.equal(String(list.body.users[0]._id), String(idB))
    assert.equal(list.body.users[0].reason, "harassment")

    const me = await request(getApp()).get(`/users/${idA}`).set(authHeader(tokenA))
    assert.equal(me.body.blockedCount, 1)
  })

  it("unblocks and restores visibility without restoring friends", async () => {
    const unblocked = await request(getApp()).delete(`/users/${idB}/block`).set(authHeader(tokenA))
    assert.equal(unblocked.status, 200)

    const missing = await request(getApp()).delete(`/users/${idB}/block`).set(authHeader(tokenA))
    assert.equal(missing.status, 404)

    const profile = await request(getApp()).get(`/users/${idB}`).set(authHeader(tokenA))
    assert.equal(profile.status, 200)
    assert.notEqual(profile.body.blockedByMe, true)
    assert.equal(profile.body.friendCount, 0)

    const feedA = await request(getApp()).get("/posts").query({ scope: "all" }).set(authHeader(tokenA))
    assert.equal(
      feedA.body.posts.some(p => String(p.userId) === String(idB)),
      true
    )

    const follow = await request(getApp()).post(`/users/${idB}/follow`).set(authHeader(tokenA))
    assert.equal(follow.status, 200)
  })

  it("stores a custom reason on other", async () => {
    const blocked = await request(getApp())
      .post(`/users/${idC}/block`)
      .set(authHeader(tokenA))
      .send({ reason: "other", customReason: "  too many DMs  " })
    assert.equal(blocked.status, 201, JSON.stringify(blocked.body))
    assert.equal(blocked.body.block.reason, "other")
    assert.equal(blocked.body.block.customReason, "too many DMs")

    const list = await request(getApp()).get("/users/me/blocks").set(authHeader(tokenA))
    const row = (list.body.users || []).find(u => String(u._id) === String(idC))
    assert.ok(row)
    assert.equal(row.customReason, "too many DMs")

    const undone = await request(getApp()).delete(`/users/${idC}/block`).set(authHeader(tokenA))
    assert.equal(undone.status, 200)
  })
})
