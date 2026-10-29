"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AccessTime,
  ArrowBack,
  Done,
  DoneAll,
  EditOutlined,
  MailOutlined,
  SendRounded,
} from "@mui/icons-material"
import {
  alpha,
  Box,
  CircularProgress,
  IconButton,
  InputBase,
  Skeleton,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { useRouter } from "next/navigation"

import { useAppSelector } from "@/app/hooks"
import AppShell from "@/components/AppShell"
import EmojiPickerButton from "@/components/EmojiPickerButton"
import EmptyState from "@/components/EmptyState"
import { segmentedTabsSx } from "@/components/segmentedTabsSx"
import UserImage from "@/components/UserImage"
import { api } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { isMessageRead, MESSAGE_TEXT_MAX } from "@/lib/messages"
import { displayName, formatLastSeen } from "@/lib/presence"
import { formatCompactTime } from "@/lib/time"
import { useFeatureFlags } from "@/providers/FeatureFlagsProvider"
import { useRealtime } from "@/providers/RealtimeProvider"
import { useToast } from "@/providers/ToastProvider"
import type { ChatBox, ChatMessage, Conversation, ConversationsPage, MessagesPage } from "@/types/messages"
import { sameUserId } from "@/types/models"

import NewChatDialog from "./NewChatDialog"
import OnlineDot from "./OnlineDot"

const PAGE_LIMIT = 20

type MessagesAppProps = {
  conversationId?: string
}

function upsertConversation(list: Conversation[], incoming: Conversation, box: ChatBox): Conversation[] {
  const without = list.filter(c => c._id !== incoming._id)
  if (incoming.box !== box) return without
  return [incoming, ...without].sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return tb - ta
  })
}

function dateKey(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dateSeparatorLabel(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((startToday - startThat) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

const MessagesApp = ({ conversationId }: MessagesAppProps) => {
  const theme = useTheme()
  const router = useRouter()
  const isWide = useMediaQuery("(min-width: 1000px)")
  const isDark = theme.palette.mode === "dark"
  const myId = useAppSelector(s => s.user?._id)
  const { enabled } = useFeatureFlags()
  const canMessage = enabled("messaging")
  const { error: toastError } = useToast()
  const {
    refreshUnread,
    presenceOf,
    joinConversation,
    leaveConversation,
    emitTyping,
    subscribeMessages,
    subscribeRead,
    subscribeTyping,
  } = useRealtime()

  const [box, setBox] = useState<ChatBox>("friends")
  const [inbox, setInbox] = useState<Conversation[]>([])
  const [inboxLoading, setInboxLoading] = useState(true)
  const [inboxError, setInboxError] = useState("")
  const [inboxCursor, setInboxCursor] = useState<string | null>(null)
  const [inboxHasMore, setInboxHasMore] = useState(false)
  const [newChatOpen, setNewChatOpen] = useState(false)

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [msgCursor, setMsgCursor] = useState<string | null>(null)
  const [msgHasMore, setMsgHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [peerTyping, setPeerTyping] = useState(false)
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null)

  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const composeRef = useRef<HTMLTextAreaElement | null>(null)
  const typingTimeout = useRef<number | null>(null)
  const loadingOlderRef = useRef(false)
  const stickToBottom = useRef(true)

  const selectedId = conversationId || ""
  const showInbox = isWide || !selectedId
  const showThread = isWide || Boolean(selectedId)

  const loadInbox = useCallback(
    async (nextBox: ChatBox, cursor?: string | null) => {
      if (!canMessage) {
        setInbox([])
        setInboxLoading(false)
        return
      }
      if (!cursor) setInboxLoading(true)
      setInboxError("")
      try {
        const { data } = await api.get<ConversationsPage>("/conversations", {
          params: { box: nextBox, limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
        })
        setInbox(prev => (cursor ? [...prev, ...(data.conversations || [])] : data.conversations || []))
        setInboxCursor(data.nextCursor)
        setInboxHasMore(Boolean(data.hasMore))
      } catch (err: unknown) {
        if (!cursor) {
          setInbox([])
          setInboxError(getErrorMessage(err, "Could not load conversations"))
        }
      } finally {
        setInboxLoading(false)
      }
    },
    [canMessage]
  )

  useEffect(() => {
    void loadInbox(box)
  }, [box, loadInbox])

  useEffect(() => {
    if (!selectedId || !canMessage) {
      setConversation(null)
      setMessages([])
      return
    }
    let cancelled = false
    setThreadLoading(true)
    void (async () => {
      try {
        const [{ data: header }, { data: page }] = await Promise.all([
          api.get<{ conversation: Conversation }>(`/conversations/${selectedId}`),
          api.get<MessagesPage>(`/conversations/${selectedId}/messages`, {
            params: { limit: PAGE_LIMIT },
          }),
        ])
        if (cancelled) return
        setConversation(header.conversation)
        setMessages([...(page.messages || [])].reverse())
        setMsgCursor(page.nextCursor)
        setMsgHasMore(Boolean(page.hasMore))
        setOtherLastReadAt(page.lastReadAt?.other || header.conversation.lastReadAt.other)
        stickToBottom.current = true
      } catch (err: unknown) {
        if (!cancelled) {
          setConversation(null)
          setMessages([])
          toastError(getErrorMessage(err, "Could not open conversation"))
        }
      } finally {
        if (!cancelled) setThreadLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId, canMessage, toastError])

  useEffect(() => {
    if (!selectedId) return
    joinConversation(selectedId)
    return () => leaveConversation(selectedId)
  }, [selectedId, joinConversation, leaveConversation])

  const markRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/conversations/${id}/read`)
      await refreshUnread()
      setInbox(prev => prev.map(c => (c._id === id ? { ...c, unread: false } : c)))
    } catch {
      // ignore
    }
  }, [refreshUnread])

  useEffect(() => {
    if (!selectedId || !conversation) return
    void markRead(selectedId)
  }, [selectedId, conversation, markRead])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !stickToBottom.current) return
    el.scrollTop = el.scrollHeight
  }, [messages, peerTyping, threadLoading])

  useEffect(() => {
    return subscribeMessages(payload => {
      const incoming = payload.conversation
      const message = payload.message
      setInbox(prev => upsertConversation(prev, incoming, box))
      if (incoming._id !== selectedId) return
      setConversation(incoming)
      setMessages(prev => (prev.some(m => m._id === message._id) ? prev : [...prev, message]))
      stickToBottom.current = true
      if (message.senderId && myId && !sameUserId(message.senderId, myId)) {
        void markRead(incoming._id)
      }
    })
  }, [subscribeMessages, box, selectedId, myId, markRead])

  useEffect(() => {
    return subscribeRead(payload => {
      if (payload.conversationId !== selectedId) return
      if (myId && !sameUserId(payload.userId, myId)) {
        setOtherLastReadAt(payload.lastReadAt)
      }
    })
  }, [subscribeRead, selectedId, myId])

  useEffect(() => {
    return subscribeTyping(payload => {
      if (payload.conversationId !== selectedId) return
      if (myId && sameUserId(payload.userId, myId)) return
      setPeerTyping(Boolean(payload.typing))
    })
  }, [subscribeTyping, selectedId, myId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedId && !isWide) {
        router.push("/messages")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedId, isWide, router])

  const loadOlder = async () => {
    if (!selectedId || !msgHasMore || !msgCursor || loadingOlderRef.current) return
    const el = scrollerRef.current
    const prevHeight = el?.scrollHeight || 0
    loadingOlderRef.current = true
    setLoadingOlder(true)
    try {
      const { data } = await api.get<MessagesPage>(`/conversations/${selectedId}/messages`, {
        params: { limit: PAGE_LIMIT, cursor: msgCursor },
      })
      const older = [...(data.messages || [])].reverse()
      setMessages(prev => [...older, ...prev])
      setMsgCursor(data.nextCursor)
      setMsgHasMore(Boolean(data.hasMore))
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight
      })
    } catch {
      // ignore
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }

  const send = async () => {
    const text = draft.trim()
    if (!text || !selectedId || sending) return
    if (text.length > MESSAGE_TEXT_MAX) {
      toastError(`Messages can be ${MESSAGE_TEXT_MAX} characters`)
      return
    }
    const tempId = `temp-${Date.now()}`
    const pending: ChatMessage = {
      _id: tempId,
      conversationId: selectedId,
      senderId: String(myId || ""),
      text,
      createdAt: new Date().toISOString(),
      pending: true,
    }
    setDraft("")
    setSending(true)
    setMessages(prev => [...prev, pending])
    stickToBottom.current = true
    emitTyping(selectedId, false)
    try {
      const { data } = await api.post<{ conversation: Conversation; message: ChatMessage }>(
        `/conversations/${selectedId}/messages`,
        { text }
      )
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m._id !== tempId)
        if (withoutTemp.some(m => m._id === data.message._id)) return withoutTemp
        return [...withoutTemp, data.message]
      })
      setConversation(data.conversation)
      setInbox(prev => upsertConversation(prev, data.conversation, box))
    } catch (err: unknown) {
      setMessages(prev => prev.filter(m => m._id !== tempId))
      setDraft(text)
      toastError(getErrorMessage(err, "Could not send"))
    } finally {
      setSending(false)
      composeRef.current?.focus()
    }
  }

  const onDraftChange = (value: string) => {
    setDraft(value)
    if (!selectedId) return
    emitTyping(selectedId, true)
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current)
    typingTimeout.current = window.setTimeout(() => emitTyping(selectedId, false), 1800)
  }

  const other = conversation?.otherUser || null
  const livePresence = other ? presenceOf(other._id) : null
  const otherOnline = livePresence?.online ?? Boolean(other?.online)
  const otherLastSeen = livePresence?.lastSeenAt ?? other?.lastSeenAt ?? null
  const otherName = displayName(other)
  const subtitle = formatLastSeen(otherOnline, otherLastSeen)

  const paneBorder = `1px solid ${theme.palette.divider}`

  const inboxPane = (
    <Box
      sx={{
        width: { xs: "100%", md: 360 },
        flexShrink: 0,
        display: showInbox ? "flex" : "none",
        flexDirection: "column",
        minHeight: 0,
        borderRight: isWide ? paneBorder : 0,
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ px: 2, pt: 1.75, pb: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: "-0.02em", flex: 1 }}>
          Messages
        </Typography>
        <IconButton
          aria-label="New chat"
          onClick={() => setNewChatOpen(true)}
          disabled={!canMessage}
          sx={{
            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1),
            color: "primary.main",
            "&:hover": { bgcolor: alpha(theme.palette.primary.main, isDark ? 0.24 : 0.16) },
          }}
        >
          <EditOutlined fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ px: 2 }}>
        <Tabs
          value={box}
          onChange={(_e, next: ChatBox) => setBox(next)}
          sx={{ ...segmentedTabsSx, mb: 1.25 }}
        >
          <Tab value="friends" label="Friends" />
          <Tab value="requests" label="Other" />
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 0.75, pb: 1.5 }}>
        {!canMessage ? (
          <Box sx={{ p: 1.5 }}>
            <EmptyState title="Messaging is off" description="An admin has turned off private messages." />
          </Box>
        ) : inboxLoading ? (
          <Box sx={{ px: 1.25, py: 0.5 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1.25, py: 1 }}>
                <Skeleton variant="circular" width={48} height={48} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="55%" height={18} />
                  <Skeleton width="80%" height={16} />
                </Box>
              </Box>
            ))}
          </Box>
        ) : inboxError ? (
          <Box sx={{ p: 1.5 }}>
            <EmptyState title="Couldn’t load messages" description={inboxError} actionLabel="Retry" onAction={() => void loadInbox(box)} />
          </Box>
        ) : inbox.length === 0 ? (
          <Box sx={{ p: 1.5 }}>
            <EmptyState
              title={box === "friends" ? "No friend chats yet" : "No message requests"}
              description={
                box === "friends"
                  ? "You can message someone here after they accept your friend request."
                  : "Follow-only or pending friend requests land here. Open or ignore them."
              }
              actionLabel="New chat"
              onAction={() => setNewChatOpen(true)}
            />
          </Box>
        ) : (
          inbox.map(row => {
            const name = displayName(row.otherUser)
            const live = row.otherUser ? presenceOf(row.otherUser._id) : null
            const online = live?.online ?? Boolean(row.otherUser?.online)
            const selected = row._id === selectedId
            return (
              <Box
                key={row._id}
                component="button"
                type="button"
                onClick={() => router.push(`/messages/${row._id}`)}
                aria-current={selected ? "page" : undefined}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  width: "100%",
                  textAlign: "left",
                  border: 0,
                  cursor: "pointer",
                  font: "inherit",
                  color: "inherit",
                  px: 1.25,
                  py: 1.1,
                  mb: 0.35,
                  borderRadius: 2.5,
                  bgcolor: selected
                    ? alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1)
                    : "transparent",
                  "&:hover": {
                    bgcolor: selected
                      ? alpha(theme.palette.primary.main, isDark ? 0.2 : 0.14)
                      : alpha(theme.palette.primary.main, isDark ? 0.08 : 0.06),
                  },
                }}
              >
                <Box sx={{ position: "relative", flexShrink: 0 }}>
                  <UserImage
                    image={row.otherUser?.picturePath || ""}
                    name={name}
                    size="48px"
                    bgColor={row.otherUser?.avatarColor}
                  />
                  <Box sx={{ position: "absolute", right: -1, bottom: -1 }}>
                    <OnlineDot online={online} />
                  </Box>
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                    <Typography noWrap sx={{ fontWeight: row.unread ? 700 : 600, fontSize: "0.92rem", flex: 1 }}>
                      {name}
                    </Typography>
                    <Typography sx={{ color: "text.secondary", fontSize: "0.7rem", flexShrink: 0 }}>
                      {formatCompactTime(row.lastMessageAt)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Typography
                      noWrap
                      sx={{
                        flex: 1,
                        color: row.unread ? "text.primary" : "text.secondary",
                        fontSize: "0.8rem",
                        fontWeight: row.unread ? 600 : 400,
                      }}
                    >
                      {row.lastMessageText || "No messages yet"}
                    </Typography>
                    {row.unread ? (
                      <Box
                        aria-label="Unread"
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: "primary.main",
                          flexShrink: 0,
                        }}
                      />
                    ) : null}
                  </Box>
                </Box>
              </Box>
            )
          })
        )}
        {inboxHasMore && !inboxLoading ? (
          <Box sx={{ textAlign: "center", py: 1 }}>
            <Typography
              component="button"
              type="button"
              onClick={() => void loadInbox(box, inboxCursor)}
              sx={{
                border: 0,
                background: "none",
                color: "primary.main",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.82rem",
              }}
            >
              Load more
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Box>
  )

  const threadPane = (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: showThread ? "flex" : "none",
        flexDirection: "column",
        bgcolor: isDark ? "background.default" : alpha(theme.palette.primary.main, 0.03),
      }}
    >
      {!selectedId ? (
        <Box sx={{ m: "auto", p: 3, maxWidth: 420, textAlign: "center" }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: 3,
              mx: "auto",
              mb: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1),
              color: "primary.main",
            }}
          >
            <MailOutlined sx={{ fontSize: 36 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.75 }}>
            Your conversations
          </Typography>
          <Typography sx={{ color: "text.secondary", lineHeight: 1.6 }}>
            Pick someone from the list, or start a new chat. Friends land in Friends. Everyone else goes to Other.
          </Typography>
        </Box>
      ) : threadLoading && messages.length === 0 ? (
        <Box sx={{ m: "auto" }}>
          <CircularProgress size={28} />
        </Box>
      ) : !conversation ? (
        <Box sx={{ m: "auto", p: 2, maxWidth: 360 }}>
          <EmptyState title="Conversation not found" description="This chat may have been removed." />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: { xs: 1, sm: 1.75 },
              py: 1.1,
              borderBottom: paneBorder,
              bgcolor: "background.paper",
              flexShrink: 0,
            }}
          >
            {!isWide ? (
              <IconButton aria-label="Back to messages" onClick={() => router.push("/messages")}>
                <ArrowBack />
              </IconButton>
            ) : null}
            <Box
              component="button"
              type="button"
              onClick={() => other && router.push(`/profile/${other._id}`)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.15,
                minWidth: 0,
                flex: 1,
                border: 0,
                background: "none",
                font: "inherit",
                color: "inherit",
                cursor: other ? "pointer" : "default",
                textAlign: "left",
                p: 0.25,
                borderRadius: 2,
                "&:hover": other ? { bgcolor: "action.hover" } : undefined,
              }}
            >
              <Box sx={{ position: "relative", flexShrink: 0 }}>
                <UserImage
                  image={other?.picturePath || ""}
                  name={otherName}
                  size="42px"
                  bgColor={other?.avatarColor}
                />
                <Box sx={{ position: "absolute", right: -1, bottom: -1 }}>
                  <OnlineDot online={otherOnline} />
                </Box>
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  {otherName}
                </Typography>
                <Typography noWrap sx={{ color: otherOnline ? "success.main" : "text.secondary", fontSize: "0.75rem" }}>
                  {peerTyping ? `${otherName.split(" ")[0]} is typing…` : subtitle || " "}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box
            ref={scrollerRef}
            onScroll={e => {
              const el = e.currentTarget
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
              if (el.scrollTop < 48) void loadOlder()
            }}
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              px: { xs: 1.25, sm: 2.25 },
              py: 1.75,
              display: "flex",
              flexDirection: "column",
              gap: 0.65,
            }}
          >
            {loadingOlder ? (
              <CircularProgress size={18} sx={{ alignSelf: "center", mb: 1 }} />
            ) : null}
            {messages.map((msg, index) => {
              const mine = sameUserId(msg.senderId, myId)
              const prev = messages[index - 1]
              const showDate = dateKey(msg.createdAt) !== dateKey(prev?.createdAt || null)
              const read = isMessageRead(msg.createdAt, otherLastReadAt)
              return (
                <Box key={msg._id}>
                  {showDate ? (
                    <Typography
                      sx={{
                        textAlign: "center",
                        color: "text.secondary",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        my: 1.25,
                      }}
                    >
                      {dateSeparatorLabel(msg.createdAt)}
                    </Typography>
                  ) : null}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: mine ? "flex-end" : "flex-start",
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: "min(78%, 520px)",
                        px: 1.35,
                        py: 0.85,
                        borderRadius: 2.5,
                        borderTopRightRadius: mine ? 0.75 : 2.5,
                        borderTopLeftRadius: mine ? 2.5 : 0.75,
                        bgcolor: mine
                          ? isDark
                            ? alpha(theme.palette.primary.main, 0.28)
                            : theme.palette.primary.main
                          : "background.paper",
                        color: mine && !isDark ? "primary.contrastText" : "text.primary",
                        boxShadow: mine ? "none" : `0 1px 2px ${alpha("#000", isDark ? 0.35 : 0.06)}`,
                        border: mine ? 0 : paneBorder,
                      }}
                    >
                      <Typography sx={{ fontSize: "0.925rem", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {msg.text}
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: 0.35,
                          mt: 0.35,
                          opacity: 0.8,
                        }}
                      >
                        <Typography sx={{ fontSize: "0.65rem", lineHeight: 1 }}>
                          {msg.createdAt
                            ? new Date(msg.createdAt).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : ""}
                        </Typography>
                        {mine ? (
                          msg.pending ? (
                            <AccessTime sx={{ fontSize: 13 }} aria-label="Sending" />
                          ) : read ? (
                            <DoneAll sx={{ fontSize: 15 }} aria-label="Read" />
                          ) : (
                            <Done sx={{ fontSize: 15 }} aria-label="Sent" />
                          )
                        ) : null}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              )
            })}
            {peerTyping ? (
              <Typography sx={{ color: "text.secondary", fontSize: "0.8rem", pl: 0.5, mt: 0.5 }}>
                {otherName.split(" ")[0]} is typing…
              </Typography>
            ) : null}
          </Box>

          <Box
            component="form"
            onSubmit={e => {
              e.preventDefault()
              void send()
            }}
            sx={{
              px: { xs: 1, sm: 1.5 },
              py: 1.1,
              pb: "max(0.75rem, env(safe-area-inset-bottom))",
              borderTop: paneBorder,
              bgcolor: "background.paper",
              display: "flex",
              alignItems: "flex-end",
              gap: 0.75,
              flexShrink: 0,
            }}
          >
            <EmojiPickerButton
              dense
              disabled={!canMessage || sending}
              onSelect={emoji => {
                setDraft(prev => `${prev}${emoji}`)
                composeRef.current?.focus()
              }}
            />
            <InputBase
              inputRef={composeRef}
              multiline
              maxRows={5}
              value={draft}
              onChange={e => onDraftChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="Message"
              disabled={!canMessage}
              inputProps={{ "aria-label": "Message", maxLength: MESSAGE_TEXT_MAX + 50 }}
              sx={{
                flex: 1,
                bgcolor: isDark ? alpha("#fff", 0.06) : "background.default",
                borderRadius: 3,
                px: 1.5,
                py: 1,
                fontSize: "0.95rem",
                border: paneBorder,
              }}
            />
            <IconButton
              type="submit"
              color="primary"
              disabled={!canMessage || sending || !draft.trim()}
              aria-label="Send message"
              sx={{
                bgcolor: "primary.main",
                color: "primary.contrastText",
                "&:hover": { bgcolor: "primary.dark" },
                "&.Mui-disabled": {
                  bgcolor: alpha(theme.palette.primary.main, 0.3),
                  color: alpha(theme.palette.primary.contrastText, 0.7),
                },
              }}
            >
              {sending ? <CircularProgress size={18} color="inherit" /> : <SendRounded fontSize="small" />}
            </IconButton>
          </Box>
        </>
      )}
    </Box>
  )

  return (
    <AppShell fill>
      <Box
        sx={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          height: "100%",
          borderTop: paneBorder,
        }}
      >
        {inboxPane}
        {threadPane}
      </Box>
      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onOpened={convo => {
          setBox(convo.box)
          router.push(`/messages/${convo._id}`)
        }}
      />
    </AppShell>
  )
}

export default MessagesApp
