import { get, json, pipe, serve } from "@atlas/server";
import { config } from "./src/config.ts";

// Your application server. The edge proxies all incoming traffic here.
serve({
  port: config.appPort,
  routes: [
    get("/", pipe((c) => json(c, 200, { hello: "world" }))),
    get("/health", pipe((c) => json(c, 200, { healthy: true }))),
  ],
});

console.log(`[app] listening on :${config.appPort}`);
