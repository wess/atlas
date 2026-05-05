import { expect, test } from "bun:test";
import { dispatch } from "../site/dispatch.ts";
import type { Site } from "../site/types.ts";

const ok = (body: string) => async () => new Response(body, { status: 200, headers: { "content-type": "text/plain" } });

test("dispatch picks site by host pattern", async () => {
  const sites: Site[] = [
    { host: "api.example.com", routes: [{ handler: ok("api") }] },
    { host: "*.example.com", routes: [{ handler: ok("wild") }] },
  ];
  const apiRes = await dispatch(
    new Request("https://api.example.com/"),
    { remoteIp: "1.1.1.1", tls: true, host: "api.example.com" },
    sites,
  );
  expect(await apiRes.text()).toBe("api");

  const wildRes = await dispatch(
    new Request("https://other.example.com/"),
    { remoteIp: "1.1.1.1", tls: true, host: "other.example.com" },
    sites,
  );
  expect(await wildRes.text()).toBe("wild");
});

test("dispatch returns 404 when no site matches host", async () => {
  const sites: Site[] = [{ host: "example.com", routes: [{ handler: ok("x") }] }];
  const res = await dispatch(new Request("https://other/"), { remoteIp: "1.1.1.1", tls: false, host: "other" }, sites);
  expect(res.status).toBe(404);
});

test("dispatch first-match wins among routes", async () => {
  const sites: Site[] = [
    {
      host: "h",
      routes: [{ match: { path: /\.git/ }, handler: ok("git") }, { handler: ok("default") }],
    },
  ];
  const a = await dispatch(
    new Request("http://h/foo/bar.git/info/refs"),
    { remoteIp: "1.1.1.1", tls: false, host: "h" },
    sites,
  );
  expect(await a.text()).toBe("git");

  const b = await dispatch(new Request("http://h/anything"), { remoteIp: "1.1.1.1", tls: false, host: "h" }, sites);
  expect(await b.text()).toBe("default");
});

test("dispatch applies compression when configured", async () => {
  const big = "abc".repeat(500);
  const sites: Site[] = [
    {
      host: "h",
      compress: ["gzip"],
      routes: [{ handler: async () => new Response(big, { headers: { "content-type": "text/plain" } }) }],
    },
  ];
  const res = await dispatch(
    new Request("http://h/", { headers: { "accept-encoding": "gzip" } }),
    { remoteIp: "1.1.1.1", tls: false, host: "h" },
    sites,
  );
  expect(res.headers.get("content-encoding")).toBe("gzip");
  expect(res.headers.get("vary")).toContain("Accept-Encoding");
});
