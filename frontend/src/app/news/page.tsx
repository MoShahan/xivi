"use client"

import { useCallback, useEffect, useState } from "react"
import { Box, Typography } from "@mui/material"

import AppShell from "@/components/AppShell"
import EmptyState from "@/components/EmptyState"
import NewsArticleCard from "@/components/news/NewsArticleCard"
import NewsFeedSkeleton from "@/components/news/NewsFeedSkeleton"
import { api } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import type { NewsArticle, NewsFeedResponse } from "@/types/news"

function formatLastUpdated(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

const NewsPage = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<NewsFeedResponse>("/news")
      if (signal?.cancelled) return
      setArticles(Array.isArray(data.articles) ? data.articles : [])
      setFetchedAt(typeof data.fetchedAt === "string" ? data.fetchedAt : null)
    } catch (err: unknown) {
      if (signal?.cancelled) return
      setArticles([])
      setFetchedAt(null)
      setError(getErrorMessage(err, "Could not load news"))
    } finally {
      if (!signal?.cancelled) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load])

  return (
    <AppShell narrow>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        News
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: fetchedAt && !loading ? 0.75 : 2.25, lineHeight: 1.5 }}>
        Top headlines, refreshed hourly - separate from posts by people you know.
      </Typography>
      {!loading && fetchedAt ? (
        <Typography
          sx={{
            color: "text.secondary",
            fontSize: "0.8rem",
            mb: 2.25,
            lineHeight: 1.4,
          }}
        >
          Last updated at {formatLastUpdated(fetchedAt)}
        </Typography>
      ) : null}

      {loading ? <NewsFeedSkeleton /> : null}

      {!loading && error ? (
        <EmptyState
          title="Could not load news"
          description={error}
          actionLabel="Try again"
          onAction={() => {
            void load()
          }}
        />
      ) : null}

      {!loading && !error && articles.length === 0 ? (
        <EmptyState
          title="No headlines right now"
          description="Check back soon - we will refresh this feed on the hour."
          actionLabel="Refresh"
          onAction={() => {
            void load()
          }}
        />
      ) : null}

      {!loading && !error && articles.length > 0 ? (
        <Box
          component="section"
          aria-label="Top headlines"
          sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}
        >
          {articles.map((article, index) => (
            <NewsArticleCard key={article.id || article.url} article={article} hero={index === 0} />
          ))}
          <Typography
            sx={{
              mt: 0.5,
              textAlign: "center",
              color: "text.secondary",
              fontSize: "0.75rem",
            }}
          >
            Stories open on their original sites.
          </Typography>
        </Box>
      ) : null}
    </AppShell>
  )
}

export default NewsPage
