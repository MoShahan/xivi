import { Server } from "socket.io"

import Conversation from "../models/Conversation.js"
import User from "../models/User.js"

import { isValidObjectId } from "./objectId.js"
import { verifyAccessTokenString } from "./tokens.js"

/** @type {import("socket.io").Server | null} */
let io = null

/** userId → Set of socket ids */
const socketsByUser = new Map()

export function setIo(instance) {
  io = instance
}

export function getIo() {
  return io
}

export function isUserOnline(userId) {
  const set = socketsByUser.get(String(userId))
  return Boolean(set && set.size > 0)
}

export function addUserSocket(userId, socketId) {
  const key = String(userId)
  let set = socketsByUser.get(key)
  if (!set) {
    set = new Set()
    socketsByUser.set(key, set)
  }
  set.add(socketId)
}

/** @returns {boolean} true if the user has no remaining sockets (went offline) */
export function removeUserSocket(userId, socketId) {
  const key = String(userId)
  const set = socketsByUser.get(key)
  if (!set) return true
  set.delete(socketId)
  if (set.size === 0) {
    socketsByUser.delete(key)
    return true
  }
  return false
}

export async function touchLastSeen(userId) {
  if (!userId) return
  await User.updateOne({ _id: userId }, { $set: { lastSeenAt: new Date() } })
}

export function emitToConversation(conversationId, event, payload) {
  if (!io || !conversationId) return
  io.to(`conversation:${conversationId}`).emit(event, payload)
}

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return
  io.to(`user:${userId}`).emit(event, payload)
}

export function emitToParticipants(participantIds, event, payload) {
  for (const id of participantIds || []) {
    emitToUser(id, event, payload)
  }
}

function frontendOrigins() {
  return (process.env.FRONTEND_URL || "http://localhost:3000")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
}

async function presencePayload(userId, online) {
  const user = await User.findById(userId).select("lastSeenAt")
  return {
    userId: String(userId),
    online: Boolean(online),
    lastSeenAt: user?.lastSeenAt ? new Date(user.lastSeenAt).toISOString() : null,
  }
}

async function broadcastPresence(userId, online) {
  const payload = await presencePayload(userId, online)
  const convos = await Conversation.find({ participants: userId }).select("participants")
  const others = new Set()
  for (const convo of convos) {
    for (const participant of convo.participants || []) {
      const id = String(participant)
      if (id !== String(userId)) others.add(id)
    }
  }
  for (const otherId of others) {
    emitToUser(otherId, "presence", payload)
  }
}

/**
 * Attach Socket.io to the HTTP server. No-op extra secrets — JWT from handshake.auth.token.
 * @param {import("http").Server} httpServer
 */
export function attachRealtime(httpServer) {
  const origins = frontendOrigins()
  const server = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || origins.includes(origin)) return callback(null, true)
        return callback(new Error("Not allowed by CORS"))
      },
      credentials: true,
    },
  })
  setIo(server)

  server.use(async (socket, next) => {
    const token =
      (typeof socket.handshake.auth?.token === "string" && socket.handshake.auth.token.trim()) ||
      ""
    if (!token) return next(new Error("Unauthorized"))
    try {
      const payload = verifyAccessTokenString(token)
      const user = await User.findById(payload.id).select("isActive")
      if (!user || user.isActive === false) return next(new Error("Unauthorized"))
      socket.userId = String(user._id)
      next()
    } catch {
      next(new Error("Unauthorized"))
    }
  })

  server.on("connection", socket => {
    const userId = socket.userId
    addUserSocket(userId, socket.id)
    socket.join(`user:${userId}`)
    void broadcastPresence(userId, true)

    socket.on("join", async conversationId => {
      if (!isValidObjectId(conversationId)) return
      const convo = await Conversation.findById(conversationId).select("participants")
      if (!convo) return
      const isParticipant = (convo.participants || []).some(id => String(id) === userId)
      if (!isParticipant) return
      socket.join(`conversation:${String(conversationId)}`)
    })

    socket.on("leave", conversationId => {
      if (!conversationId) return
      socket.leave(`conversation:${conversationId}`)
    })

    socket.on("typing", async payload => {
      const conversationId = payload?.conversationId
      if (!isValidObjectId(conversationId)) return
      const convo = await Conversation.findById(conversationId).select("participants")
      if (!convo) return
      const isParticipant = (convo.participants || []).some(id => String(id) === userId)
      if (!isParticipant) return
      socket.to(`conversation:${String(conversationId)}`).emit("typing", {
        conversationId: String(conversationId),
        userId,
        typing: Boolean(payload?.typing),
      })
    })

    socket.on("disconnect", async () => {
      const wentOffline = removeUserSocket(userId, socket.id)
      if (wentOffline) {
        await touchLastSeen(userId)
        void broadcastPresence(userId, false)
      }
    })
  })

  return server
}
