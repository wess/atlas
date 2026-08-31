await import("./generator/index.ts");

const root = new URL("../dist/", import.meta.url).pathname;
const base = (Bun.env.SITE_BASE ?? "/atlas").replace(/\/$/, "");
const port = Number(Bun.env.PORT ?? 4321);

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const path = base && url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
    const relative = decodeURIComponent(path).replace(/^\/+/, "");
    if (relative.includes("..")) return new Response("Bad request", { status: 400 });

    const target = relative === "" || relative.endsWith("/") ? `${relative}index.html` : relative;
    const file = Bun.file(`${root}${target}`);
    if (await file.exists()) return new Response(file);

    return new Response(Bun.file(`${root}404.html`), { status: 404 });
  },
});

console.log(`site on ${server.url.origin}${base}/`);
