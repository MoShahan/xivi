import express from "express"

import {
  createConversation,
  getConversation,
  listConversations,
  listMessages,
  markRead,
  sendMessage,
  unreadCount,
} from "../controllers/conversations.js"
import { requireObjectId } from "../lib/objectId.js"
import { verifyAccessToken } from "../middleware/auth.js"
import { authCreateLimiter, authReadLimiter, authWriteLimiter } from "../middleware/rateLimit.js"

const router = express.Router()

router.get("/", verifyAccessToken, authReadLimiter, listConversations)
router.get("/unread-count", verifyAccessToken, unreadCount)
router.post("/", verifyAccessToken, authCreateLimiter, createConversation)

router.get("/:id", verifyAccessToken, authReadLimiter, requireObjectId("id"), getConversation)
router.get("/:id/messages", verifyAccessToken, authReadLimiter, requireObjectId("id"), listMessages)
router.post(
  "/:id/messages",
  verifyAccessToken,
  requireObjectId("id"),
  authCreateLimiter,
  sendMessage
)
router.patch("/:id/read", verifyAccessToken, requireObjectId("id"), authWriteLimiter, markRead)

export default router
