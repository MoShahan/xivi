"use client"

import { useParams } from "next/navigation"

import MessagesApp from "@/components/messages/MessagesApp"

const ConversationPage = () => {
  const params = useParams()
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : ""
  return <MessagesApp conversationId={conversationId} />
}

export default ConversationPage
