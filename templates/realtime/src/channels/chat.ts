import { channel, createRooms, type WsConfig, type WsConn } from "@atlas/server/ws"

const rooms = createRooms()
const identities = new Map<WsConn, { room: string; user: string }>()

const chat = channel("chat", {
  join: (ws, params) => {
    const room = typeof params.room === "string" ? params.room : "general"
    const user = typeof params.user === "string" ? params.user : "anon"
    identities.set(ws, { room, user })
    rooms.join(ws, room)
    console.log(`${user} joined room ${room}`)
    return true
  },

  handle: (ws, event, payload) => {
    if (event !== "message") return
    const identity = identities.get(ws)
    if (!identity) return
    const { text } = (payload ?? {}) as { text?: string }
    if (!text) return
    rooms.broadcast(identity.room, { user: identity.user, text })
  },

  leave: (ws) => {
    const identity = identities.get(ws)
    if (!identity) return
    rooms.leave(ws, identity.room)
    identities.delete(ws)
    console.log(`${identity.user} left room ${identity.room}`)
  },
})

export const wsConfig: WsConfig = {
  channels: [chat],
  onClose: (ws) => {
    rooms.leaveAll(ws)
    identities.delete(ws)
  },
}
