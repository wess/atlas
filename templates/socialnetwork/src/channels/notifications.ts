import type { ServerWebSocket } from "bun"

type Notification = {
  type: "like" | "follow"
  fromUserId: number
  postId?: number
}

const connections = new Map<number, Set<ServerWebSocket<{ userId: number }>>>()

export const addConnection = (userId: number, ws: ServerWebSocket<{ userId: number }>) => {
  const set = connections.get(userId) ?? new Set()
  set.add(ws)
  connections.set(userId, set)
}

export const removeConnection = (userId: number, ws: ServerWebSocket<{ userId: number }>) => {
  const set = connections.get(userId)
  if (set) {
    set.delete(ws)
    if (set.size === 0) connections.delete(userId)
  }
}

export const notifyUser = (userId: number, notification: Notification) => {
  const set = connections.get(userId)
  if (!set) return

  const payload = JSON.stringify(notification)
  for (const ws of set) {
    ws.send(payload)
  }
}

export const wsConfig = {
  open(ws: ServerWebSocket<{ userId: number }>) {
    if (ws.data?.userId) {
      addConnection(ws.data.userId, ws)
    }
  },
  message(ws: ServerWebSocket<{ userId: number }>, message: string | Buffer) {
    // clients can send pings; respond with pong
    if (message === "ping") {
      ws.send("pong")
    }
  },
  close(ws: ServerWebSocket<{ userId: number }>) {
    if (ws.data?.userId) {
      removeConnection(ws.data.userId, ws)
    }
  },
}
