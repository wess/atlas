import { createSseChannel } from "@atlas/server/sse"

export const notifications = createSseChannel()

// Demo broadcast so connected clients see events arriving. Replace with real
// notifications: call notifications.broadcast("notification", {...}) anywhere.
setInterval(() => {
  notifications.broadcast("notification", { text: "heartbeat", at: new Date().toISOString() })
}, 30000)
