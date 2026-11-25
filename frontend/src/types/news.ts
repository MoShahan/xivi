export type NewsArticle = {
  id: string
  title: string
  description: string
  url: string
  image: string
  publishedAt: string
  sourceName: string
  sourceUrl: string
}

export type NewsFeedResponse = {
  hourKey: string
  fetchedAt: string
  articles: NewsArticle[]
}
