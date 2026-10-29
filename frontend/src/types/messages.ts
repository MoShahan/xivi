export type ChatBox = "friends" | "requests"

export type ChatUser = {
  _id: string
  firstName: string
  lastName: string
  picturePath: string
  avatarColor?: string
  online: boolean
  lastSeenAt: string | null
}

export type Conversation = {
  _id: string
  box: ChatBox
  otherUser: ChatUser | null
  lastMessageText: string
  lastMessageAt: string | null
  lastSenderId: string | null
  lastReadAt: {
    mine: string | null
    other: string | null
  }
  unread: boolean
  createdAt: string | null
}

export type ChatMessage = {
  _id: string
  conversationId: string
  senderId: string
  text: string
  createdAt: string | null
  /** Local-only: waiting for the server to confirm. */
  pending?: boolean
}

export type ConversationsPage = {
  conversations: Conversation[]
  nextCursor: string | null
  hasMore: boolean
}

export type MessagesPage = {
  messages: ChatMessage[]
  nextCursor: string | null
  hasMore: boolean
  lastReadAt: {
    mine: string | null
    other: string | null
  }
}

export type SocketMessagePayload = {
  conversation: Conversation
  message: ChatMessage
}

export type SocketReadPayload = {
  conversationId: string
  userId: string
  lastReadAt: string | null
}

export type SocketTypingPayload = {
  conversationId: string
  userId: string
  typing: boolean
}

export type SocketPresencePayload = {
  userId: string
  online: boolean
  lastSeenAt: string | null
}
