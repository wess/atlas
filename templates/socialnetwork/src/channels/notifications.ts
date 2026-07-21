import { token } from "@atlas/auth"
import type { WsConfig } from "@atlas/server/ws"
import { channel } from "@atlas/server/ws"
import { config } from "../config.ts"

type Notification = {
  readonly type: "like" | "follow"
  readonly fromUserId: number
  readonly postId?: number
}

type RawSocket = { readonly send: (payload: string) => void }

const sockets = new Map<number, Set<RawSocket>>()
const owners = new WeakMap<RawSocket, number>()

const register = (socket: RawSocket, userId: number) => {
  const set = sockets.get(userId) ?? new Set<RawSocket>()
  set.add(socket)
  sockets.set(userId, set)
  owners.set(socket, userId)
}

const unregister = (socket: RawSocket) => {
  const userId = owners.get(socket)
  if (userId === undefined) return

  owners.delete(socket)
  const set = sockets.get(userId)
  if (!set) return

  set.delete(socket)
  if (set.size === 0) sockets.delete(userId)
}

export const notifyUser = (userId: number, notification: Notification) => {
  const set = sockets.get(userId)
  if (!set) return

  const payload = JSON.stringify(notification)
  for (const socket of set) socket.send(payload)
}

// Clients join by sending: { channel: "notifications", event: "join", payload: { token } }
const notifications = channel("notifications", {
  join: async (ws, params) => {
    if (typeof params.token !== "string") return false

    try {
      const claims = await token.verify(params.token, config.auth.secret)
      register(ws.raw as RawSocket, Number(claims.userId))
      return true
    } catch {
      return false
    }
  },
  leave: (ws) => unregister(ws.raw as RawSocket),
})

export const wsConfig: WsConfig = {
  channels: [notifications],
  onMessage: (ws, message) => {
    if (message === "ping") ws.send("pong")
  },
  onClose: (ws) => unregister(ws.raw as RawSocket),
}
