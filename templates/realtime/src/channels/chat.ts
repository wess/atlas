type ChatSocket = {
  data: { room: string; user: string }
}

const rooms = new Map<string, Set<unknown>>()

const getRoom = (name: string): Set<unknown> => {
  if (!rooms.has(name)) rooms.set(name, new Set())
  return rooms.get(name)!
}

export const chatHandlers = {
  open(ws: ChatSocket & { subscribe: (t: string) => void }) {
    const { room, user } = ws.data
    getRoom(room).add(ws)
    ws.subscribe(`chat:${room}`)
    console.log(`${user} joined room ${room}`)
  },

  message(ws: ChatSocket & { publish: (t: string, d: string) => void }, message: string) {
    const { room, user } = ws.data
    const payload = JSON.stringify({ user, text: JSON.parse(message).text })
    ws.publish(`chat:${room}`, payload)
  },

  close(ws: ChatSocket & { unsubscribe: (t: string) => void }) {
    const { room, user } = ws.data
    getRoom(room).delete(ws)
    ws.unsubscribe(`chat:${room}`)
    console.log(`${user} left room ${room}`)
    if (getRoom(room).size === 0) rooms.delete(room)
  },
}
