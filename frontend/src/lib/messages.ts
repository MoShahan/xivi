import { api } from "@/lib/api"
import type { Conversation } from "@/types/messages"

/** Keep in sync with backend `MESSAGE_TEXT_MAX`. */
export const MESSAGE_TEXT_MAX = 2000

export async function openConversation(recipientId: string): Promise<Conversation> {
  const { data } = await api.post<{ conversation: Conversation }>("/conversations", { recipientId })
  return data.conversation
}

export function isMessageRead(createdAt: string | null, otherLastReadAt: string | null): boolean {
  if (!createdAt || !otherLastReadAt) return false
  return new Date(otherLastReadAt).getTime() >= new Date(createdAt).getTime()
}
