import express from "express"

import { blockUser, listMyBlocks, unblockUser } from "../controllers/blocks.js"
import {
  acceptFriendRequest,
  cancelFriendRequest,
  countIncomingFriendRequests,
  declineFriendRequest,
  followUser,
  getUserRelationship,
  listFollowing,
  listFriendRequests,
  sendFriendRequest,
  unfollowUser,
  unfriend,
} from "../controllers/relationships.js"
import {
  deactivateUser,
  discoverUsers,
  getUser,
  getUserFollowers,
  getUserFollowing,
  getUserFriends,
  reactivateUser,
  updateProfile,
} from "../controllers/users.js"
import { requireObjectId } from "../lib/objectId.js"
import { requireAdmin, verifyAccessToken } from "../middleware/auth.js"
import { authCreateLimiter, authWriteLimiter } from "../middleware/rateLimit.js"
import { uploadPicture } from "../middleware/upload.js"

const router = express.Router()

router.get("/discover", verifyAccessToken, discoverUsers)

router.patch("/me", verifyAccessToken, authWriteLimiter, uploadPicture, updateProfile)

router.get("/me/friend-requests/count", verifyAccessToken, countIncomingFriendRequests)
router.get("/me/friend-requests", verifyAccessToken, listFriendRequests)
router.post(
  "/me/friend-requests/:requestId/accept",
  verifyAccessToken,
  authWriteLimiter,
  requireObjectId("requestId"),
  acceptFriendRequest
)
router.post(
  "/me/friend-requests/:requestId/decline",
  verifyAccessToken,
  authWriteLimiter,
  requireObjectId("requestId"),
  declineFriendRequest
)
router.delete(
  "/me/friend-requests/:requestId",
  verifyAccessToken,
  authWriteLimiter,
  requireObjectId("requestId"),
  cancelFriendRequest
)
router.delete("/me/friends/:friendId", verifyAccessToken, authWriteLimiter, requireObjectId("friendId"), unfriend)
router.get("/me/following", verifyAccessToken, listFollowing)
router.get("/me/blocks", verifyAccessToken, listMyBlocks)

router.post("/:id/deactivate", verifyAccessToken, requireAdmin, requireObjectId("id"), deactivateUser)
router.post("/:id/reactivate", verifyAccessToken, requireAdmin, requireObjectId("id"), reactivateUser)

router.post("/:id/friend-requests", verifyAccessToken, authCreateLimiter, requireObjectId("id"), sendFriendRequest)
router.post("/:id/follow", verifyAccessToken, authWriteLimiter, requireObjectId("id"), followUser)
router.delete("/:id/follow", verifyAccessToken, authWriteLimiter, requireObjectId("id"), unfollowUser)
router.post("/:id/block", verifyAccessToken, authWriteLimiter, requireObjectId("id"), blockUser)
router.delete("/:id/block", verifyAccessToken, authWriteLimiter, requireObjectId("id"), unblockUser)
router.get("/:id/relationship", verifyAccessToken, requireObjectId("id"), getUserRelationship)

router.get("/:id/friends", verifyAccessToken, requireObjectId("id"), getUserFriends)
router.get("/:id/following", verifyAccessToken, requireObjectId("id"), getUserFollowing)
router.get("/:id/followers", verifyAccessToken, requireObjectId("id"), getUserFollowers)

router.get("/:id", verifyAccessToken, requireObjectId("id"), getUser)

export default router
