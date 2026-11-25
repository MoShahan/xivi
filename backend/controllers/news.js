import { getNewsForCurrentHour } from "../lib/news.js"

export const listNews = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthenticated" })

    const feed = await getNewsForCurrentHour()
    return res.status(200).json(feed)
  } catch (e) {
    if (e?.expose && e.status) {
      return res.status(e.status).json({ error: e.message })
    }
    next(e)
  }
}
