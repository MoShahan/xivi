import assert from "node:assert/strict"
import { before, describe, it } from "node:test"

import jwt from "jsonwebtoken"

import {
  getAccessTokenExpires,
  signAccessToken,
  signRefreshToken,
  verifyAccessTokenString,
  verifyRefreshTokenString,
} from "./tokens.js"

before(() => {
  process.env.ACCESS_TOKEN_SECRET = "test-access-secret"
  process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret"
  delete process.env.ACCESS_TOKEN_EXPIRES
})

describe("auth tokens", () => {
  it("issues access + refresh tokens that verify with the correct type", () => {
    const accessToken = signAccessToken("507f1f77bcf86cd799439011")
    const refreshToken = signRefreshToken("507f1f77bcf86cd799439011")
    const access = verifyAccessTokenString(accessToken)
    const refresh = verifyRefreshTokenString(refreshToken)
    assert.equal(access.id, "507f1f77bcf86cd799439011")
    assert.notEqual(access.typ, "refresh")
    assert.equal(refresh.id, "507f1f77bcf86cd799439011")
    assert.equal(refresh.typ, "refresh")
    assert.ok(refresh.jti)
  })

  it("rejects a refresh token as an access token", () => {
    const refreshToken = signRefreshToken("507f1f77bcf86cd799439011")
    assert.throws(() => verifyAccessTokenString(refreshToken))
  })

  it("defaults access token lifetime to 15m and signs with HS256", () => {
    assert.equal(getAccessTokenExpires(), "15m")
    const accessToken = signAccessToken("507f1f77bcf86cd799439011")
    const decoded = jwt.decode(accessToken, { complete: true })
    assert.equal(decoded?.header?.alg, "HS256")
  })

  it("rejects access tokens signed with a non-HS256 algorithm", () => {
    // none-alg style token must not verify under algorithms: ["HS256"]
    const forged = jwt.sign(
      { id: "507f1f77bcf86cd799439011", typ: "access" },
      process.env.ACCESS_TOKEN_SECRET,
      { algorithm: "HS384", expiresIn: "15m" }
    )
    assert.throws(() => verifyAccessTokenString(forged))
  })
})
