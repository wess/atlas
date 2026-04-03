import { config } from "./src/config.ts"
import { serve, get, pipe, json } from "@atlas/server"
import { chatHandlers } from "./src/channels/chat.ts"
import { notificationStream } from "./src/events/notifications.ts"
import index from "./index.html"

serve({
  port: config.port,
  routes: [
    get("/health", pipe((c) => json(c, 200, { healthy: true }))),
    get("/events/notifications", pipe(notificationStream)),
  ],
  static: {
    "/": index,
  },
  websocket: chatHandlers,
})

console.log(`Server running on :${config.port}`)
console.log(`WebSocket at ws://localhost:${config.port}/ws`)
