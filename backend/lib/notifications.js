import Notification from "../models/Notification.js"

import { isBlockedEitherWay } from "./blocks.js"

/**
 * Create a notification unless actor === recipient.
 * Like / friend_request notifications are deduped (D3) so toggle spam does not flood the inbox.
 * Failures are logged, never thrown to callers.
 * @param {{ recipientId: string, actorId: string, type: string, postId?: string|null, commentId?: string|null }} opts
 */
export async function createNotification({ recipientId, actorId, type, postId = null, commentId = null }) {
  try {
    if (!recipientId || !actorId || !type) return
    if (String(recipientId) === String(actorId)) return
    if (await isBlockedEitherWay(recipientId, actorId)) return

    const doc = {
      recipient: recipientId,
      actor: actorId,
      type,
      postId: postId || null,
      commentId: commentId || null,
      read: false,
    }

    if (type === "post_like" || type === "comment_like" || type === "friend_request") {
      const existing = await Notification.findOne({
        recipient: doc.recipient,
        actor: doc.actor,
        type: doc.type,
        postId: doc.postId,
        commentId: doc.commentId,
      })
      if (existing) {
        existing.read = false
        existing.createdAt = new Date()
        await existing.save()
        return
      }
    }

    await Notification.create(doc)
  } catch (err) {
    console.error("createNotification failed:", err.message)
  }
}
