import express from "express"

import { listNews } from "../controllers/news.js"
import { verifyAccessToken } from "../middleware/auth.js"

const router = express.Router()

router.get("/", verifyAccessToken, listNews)

export default router
