# {{name}}

Real-time app with WebSocket chat rooms and SSE notification stream.

## Setup

```sh
cp .env.example .env
bun install
bun run server.ts
```

Open http://localhost:3000 for the chat UI.

## Features

- WebSocket chat with room support
- Server-Sent Events for notifications
- Auto-reconnect on disconnect
- Multiple rooms via the room selector
