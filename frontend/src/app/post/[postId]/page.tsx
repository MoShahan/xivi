"use client"

import React, { use, useEffect, useState } from "react"
import { Box, Button, CircularProgress, Typography, useTheme } from "@mui/material"
import axios from "axios"
import { useRouter } from "next/navigation"

import { useAppDispatch, useAppSelector } from "@/app/hooks"
import AppShell from "@/components/AppShell"
import PostWidget from "@/components/PostWidget"
import { api } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { hasOptimisticComments, startLiveFeedPoll } from "@/lib/liveFeed"
import { setPost } from "@/state"
import { store } from "@/state/store"
import type { Post } from "@/types/models"

type PostPageProps = {
  params: Promise<{ postId: string }>
}

type LoadStatus = "loading" | "ready" | "notfound" | "error"

const PostPage = ({ params }: PostPageProps) => {
  const { postId } = use(params)
  const dispatch = useAppDispatch()
  const router = useRouter()
  const theme = useTheme()
  const accessToken = useAppSelector(state => state.accessToken)
  const post = useAppSelector(state => state.posts.find(p => String(p._id) === String(postId)))

  const [status, setStatus] = useState<LoadStatus>("loading")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (!accessToken || !postId) return

    let cancelled = false
    void (async () => {
      try {
        setStatus("loading")
        setErrorMsg("")
        const { data } = await api.get<Post>(`/posts/${postId}`)
        if (cancelled) return
        dispatch(setPost({ post: data }))
        setStatus("ready")
      } catch (err: unknown) {
        if (cancelled) return
        const statusCode = axios.isAxiosError(err) ? err.response?.status : undefined
        if (statusCode === 404 || statusCode === 400) {
          setStatus("notfound")
        } else {
          setStatus("error")
          setErrorMsg(getErrorMessage(err, "Failed to load post"))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [postId, accessToken, dispatch])

  useEffect(() => {
    if (!accessToken || !postId || status !== "ready") return

    let cancelled = false
    const stop = startLiveFeedPoll(() => {
      void (async () => {
        try {
          const local = store.getState().posts.find(item => String(item._id) === String(postId))
          if (hasOptimisticComments(local)) return
          const { data } = await api.get<Post>(`/posts/${postId}`)
          if (cancelled) return
          dispatch(setPost({ post: data }))
        } catch (err: unknown) {
          if (cancelled) return
          const statusCode = axios.isAxiosError(err) ? err.response?.status : undefined
          if (statusCode === 404 || statusCode === 400) {
            setStatus("notfound")
          }
        }
      })()
    })

    return () => {
      cancelled = true
      stop()
    }
  }, [accessToken, postId, status, dispatch])

  return (
    <AppShell narrow>
      {status === "loading" && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }} role="status" aria-live="polite">
          <CircularProgress size={36} />
        </Box>
      )}

      {status === "notfound" && (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography sx={{ color: theme.palette.neutral.medium, mb: 2 }}>Post not found.</Typography>
          <Button onClick={() => router.push("/home")} variant="contained">
            Back to home
          </Button>
        </Box>
      )}

      {status === "error" && (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography sx={{ color: "error.main", mb: 2 }} role="alert">
            {errorMsg || "Something went wrong."}
          </Typography>
          <Button onClick={() => router.push("/home")} variant="outlined">
            Back to home
          </Button>
        </Box>
      )}

      {status === "ready" && post && <PostWidget post={post} onDeleted={() => router.push("/home")} />}
    </AppShell>
  )
}

export default PostPage
