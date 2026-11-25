import assert from "node:assert/strict"
import { after, before, beforeEach, describe, it, mock } from "node:test"

import request from "supertest"

import { resetNewsInFlight } from "../lib/news.js"
import NewsCache from "../models/NewsCache.js"

import { authHeader, getApp, registerUser, startTestApp, stopTestApp } from "./helpers.js"

const SAMPLE_ARTICLE = {
  id: "article-1",
  title: "Sample headline",
  description: "A short description of the story.",
  url: "https://example.com/sample-headline",
  image: "https://example.com/image.jpg",
  publishedAt: "2026-11-25T12:00:00Z",
  source: { name: "Example News", url: "https://example.com" },
}

describe("news API", () => {
  let userToken
  let originalFetch
  let originalApiKey

  before(async () => {
    originalFetch = globalThis.fetch
    originalApiKey = process.env.GNEWS_API_KEY
    process.env.GNEWS_API_KEY = "test-gnews-key"
    await startTestApp()

    const user = await registerUser({
      email: "news-user@example.com",
      firstName: "News",
      lastName: "Reader",
    })
    assert.equal(user.res.status, 201, JSON.stringify(user.res.body))
    userToken = user.res.body.accessToken
  })

  after(async () => {
    globalThis.fetch = originalFetch
    if (originalApiKey === undefined) delete process.env.GNEWS_API_KEY
    else process.env.GNEWS_API_KEY = originalApiKey
    resetNewsInFlight()
    await stopTestApp()
  })

  beforeEach(async () => {
    resetNewsInFlight()
    await NewsCache.deleteMany({})
    globalThis.fetch = originalFetch
    process.env.GNEWS_API_KEY = "test-gnews-key"
  })

  it("GET /news returns 401 without a token", async () => {
    const res = await request(getApp()).get("/news")
    assert.equal(res.status, 401)
  })

  it("GET /news fetches GNews once per hour then serves cache", async () => {
    let fetchCalls = 0
    globalThis.fetch = mock.fn(async () => {
      fetchCalls += 1
      return {
        ok: true,
        async json() {
          return { totalArticles: 1, articles: [SAMPLE_ARTICLE] }
        },
      }
    })

    const first = await request(getApp()).get("/news").set(authHeader(userToken))
    assert.equal(first.status, 200, JSON.stringify(first.body))
    assert.equal(typeof first.body.hourKey, "string")
    assert.equal(first.body.articles.length, 1)
    assert.equal(first.body.articles[0].title, "Sample headline")
    assert.equal(first.body.articles[0].sourceName, "Example News")
    assert.equal(fetchCalls, 1)

    const second = await request(getApp()).get("/news").set(authHeader(userToken))
    assert.equal(second.status, 200)
    assert.equal(second.body.hourKey, first.body.hourKey)
    assert.equal(second.body.articles[0].title, "Sample headline")
    assert.equal(fetchCalls, 1)
  })

  it("GET /news returns 503 when GNEWS_API_KEY is missing", async () => {
    delete process.env.GNEWS_API_KEY

    const res = await request(getApp()).get("/news").set(authHeader(userToken))
    assert.equal(res.status, 503)
    assert.equal(res.body.error, "News is temporarily unavailable")
  })
})
