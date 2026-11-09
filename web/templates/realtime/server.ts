import { get, json, pipe, putHeader, serve, text } from "@wess/atlas/server"
import { wsConfig } from "./src/channels/chat.ts"
import { config } from "./src/config.ts"
import { notifications } from "./src/events/notifications.ts"

const page = await Bun.file(new URL("./index.html", import.meta.url)).text()

const shell = pipe((c) => putHeader(text(c, 200, page), "content-type", "text/html; charset=utf-8"))

serve({
  port: config.port,
  routes: [
    get("/", shell),
    get("/rooms/*", shell),
    get("/health", pipe((c) => json(c, 200, { healthy: true }))),
    get("/events/notifications", notifications.pipe),
  ],
  websocket: wsConfig,
})

console.log(`Server running on :${config.port}`)
console.log(`WebSocket at ws://localhost:${config.port}/ws`)
