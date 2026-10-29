import http from "node:http"

import dotenv from "dotenv"
import mongoose from "mongoose"

import { attachRealtime } from "./lib/realtime.js"
import { createApp } from "./app.js"

dotenv.config()

const app = createApp()
const server = http.createServer(app)
const PORT = process.env.PORT

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is required")
  process.exit(1)
}
if (!process.env.ACCESS_TOKEN_SECRET) {
  console.error("ACCESS_TOKEN_SECRET is required")
  process.exit(1)
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("mongo connected")
    attachRealtime(server)
    server.listen(PORT, () => console.log(`listening from ${PORT}`))
  })
  .catch(e => {
    console.log("mongo could not be connected")
    console.log(e.message)
    process.exit(1)
  })

process.on("SIGINT", async () => {
  await mongoose.connection.close()
  process.exit(0)
})
