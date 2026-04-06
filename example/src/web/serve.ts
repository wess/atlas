import index from "./index.html"

const API = process.env.API_URL ?? "http://localhost:3000"

Bun.serve({
  port: Number(process.env.WEB_PORT ?? 3001),
  routes: {
    "/": index,
  },
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname.startsWith("/api/")) {
      const target = `${API}${url.pathname.replace("/api", "")}${url.search}`
      const res = await fetch(target, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      })
      return new Response(res.body, { status: res.status, headers: res.headers })
    }
    return new Response("Not Found", { status: 404 })
  },
  development: {
    hmr: true,
    console: true,
  },
})

console.log(`chirp web on http://localhost:${process.env.WEB_PORT ?? 3001}`)
