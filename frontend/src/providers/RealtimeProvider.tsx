"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { io, type Socket } from "socket.io-client"

import { useAppSelector } from "@/app/hooks"
import { api, getApiBaseUrl } from "@/lib/api"
import type {
  SocketMessagePayload,
  SocketPresencePayload,
  SocketReadPayload,
  SocketTypingPayload,
} from "@/types/messages"

type PresenceState = { online: boolean; lastSeenAt: string | null }

type RealtimeContextValue = {
  connected: boolean
  unreadCount: number
  refreshUnread: () => Promise<void>
  presenceOf: (userId: string) => PresenceState | null
  joinConversation: (conversationId: string) => void
  leaveConversation: (conversationId: string) => void
  emitTyping: (conversationId: string, typing: boolean) => void
  subscribeMessages: (fn: (payload: SocketMessagePayload) => void) => () => void
  subscribeRead: (fn: (payload: SocketReadPayload) => void) => () => void
  subscribeTyping: (fn: (payload: SocketTypingPayload) => void) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext)
  if (!ctx) {
    throw new Error("useRealtime must be used within RealtimeProvider")
  }
  return ctx
}

const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const accessToken = useAppSelector(s => s.accessToken)
  const myId = useAppSelector(s => s.user?._id)
  const socketRef = useRef<Socket | null>(null)
  const messageListeners = useRef(new Set<(payload: SocketMessagePayload) => void>())
  const readListeners = useRef(new Set<(payload: SocketReadPayload) => void>())
  const typingListeners = useRef(new Set<(payload: SocketTypingPayload) => void>())
  const [connected, setConnected] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [presence, setPresence] = useState<Record<string, PresenceState>>({})

  const refreshUnread = useCallback(async () => {
    if (!accessToken) {
      setUnreadCount(0)
      return
    }
    try {
      const { data } = await api.get<{ count: number }>("/conversations/unread-count")
      setUnreadCount(data.count || 0)
    } catch {
      // ignore
    }
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) {
      socketRef.current?.disconnect()
      socketRef.current = null
      setConnected(false)
      setUnreadCount(0)
      return
    }

    const socket = io(getApiBaseUrl(), {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
    })
    socketRef.current = socket

    socket.on("connect", () => setConnected(true))
    socket.on("disconnect", () => setConnected(false))

    socket.on("message", (payload: SocketMessagePayload) => {
      messageListeners.current.forEach(fn => fn(payload))
      const senderId = payload.message?.senderId
      const convoId = payload.conversation?._id
      const viewing =
        typeof window !== "undefined" && convoId && window.location.pathname === `/messages/${convoId}`
      if (senderId && myId && String(senderId) !== String(myId) && !viewing) {
        setUnreadCount(n => n + 1)
      }
    })
    socket.on("read", (payload: SocketReadPayload) => {
      readListeners.current.forEach(fn => fn(payload))
      if (payload.userId && myId && String(payload.userId) === String(myId)) {
        void refreshUnread()
      }
    })
    socket.on("typing", (payload: SocketTypingPayload) => {
      typingListeners.current.forEach(fn => fn(payload))
    })
    socket.on("presence", (payload: SocketPresencePayload) => {
      if (!payload?.userId) return
      setPresence(prev => ({
        ...prev,
        [payload.userId]: { online: Boolean(payload.online), lastSeenAt: payload.lastSeenAt },
      }))
    })

    void refreshUnread()
    const poll = window.setInterval(() => void refreshUnread(), 60_000)

    return () => {
      window.clearInterval(poll)
      socket.removeAllListeners()
      socket.disconnect()
      if (socketRef.current === socket) socketRef.current = null
      setConnected(false)
    }
  }, [accessToken, myId, refreshUnread])

  const presenceOf = useCallback(
    (userId: string): PresenceState | null => presence[userId] || null,
    [presence]
  )

  const joinConversation = useCallback((conversationId: string) => {
    if (!conversationId) return
    socketRef.current?.emit("join", conversationId)
  }, [])

  const leaveConversation = useCallback((conversationId: string) => {
    if (!conversationId) return
    socketRef.current?.emit("leave", conversationId)
  }, [])

  const emitTyping = useCallback((conversationId: string, typing: boolean) => {
    if (!conversationId) return
    socketRef.current?.emit("typing", { conversationId, typing })
  }, [])

  const subscribeMessages = useCallback((fn: (payload: SocketMessagePayload) => void) => {
    messageListeners.current.add(fn)
    return () => {
      messageListeners.current.delete(fn)
    }
  }, [])

  const subscribeRead = useCallback((fn: (payload: SocketReadPayload) => void) => {
    readListeners.current.add(fn)
    return () => {
      readListeners.current.delete(fn)
    }
  }, [])

  const subscribeTyping = useCallback((fn: (payload: SocketTypingPayload) => void) => {
    typingListeners.current.add(fn)
    return () => {
      typingListeners.current.delete(fn)
    }
  }, [])

  const value = useMemo(
    () => ({
      connected,
      unreadCount,
      refreshUnread,
      presenceOf,
      joinConversation,
      leaveConversation,
      emitTyping,
      subscribeMessages,
      subscribeRead,
      subscribeTyping,
    }),
    [
      connected,
      unreadCount,
      refreshUnread,
      presenceOf,
      joinConversation,
      leaveConversation,
      emitTyping,
      subscribeMessages,
      subscribeRead,
      subscribeTyping,
    ]
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export default RealtimeProvider
