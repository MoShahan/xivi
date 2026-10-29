import cors from "cors"
import express from "express"
import helmet from "helmet"
import morgan from "morgan"

import { errorHandler } from "./middleware/errorHandler.js"
import authRoutes from "./routes/auth.js"
import conversationRoutes from "./routes/conversations.js"
import notificationRoutes from "./routes/notifications.js"
import postRoutes from "./routes/posts.js"
import settingsRoutes from "./routes/settings.js"
import userRoutes from "./routes/users.js"

/**
 * Build the Express app (no listen / no Mongo connect).
 * Used by `index.js` and by integration tests.
 */
export function createApp() {
  const app = express()

  // D10: correct client IP behind Render / reverse proxies (rate limits, logs)
  if (process.env.TRUST_PROXY === "1" || process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1)
  }

  app.use(express.json({ limit: "1mb" }))

  const frontendOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)

  // A9: no Origin (curl/mobile) allowed; browser origins must be allowlisted
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || frontendOrigins.includes(origin)) {
          return callback(null, true)
        }
        return callback(null, false)
      },
      credentials: true,
    })
  )
  app.use(express.urlencoded({ extended: true, limit: "1mb" }))
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    })
  )
  app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }))
  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("common"))
  }

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true })
  })

  app.use("/auth", authRoutes)
  app.use("/users", userRoutes)
  app.use("/posts", postRoutes)
  app.use("/conversations", conversationRoutes)
  app.use("/notifications", notificationRoutes)
  app.use("/settings", settingsRoutes)

  app.use(errorHandler)
  return app
}
