import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Connection } from "../../db/index.ts";
import { column, connect, defineSchema } from "../../db/index.ts";
import { router } from "../../server/index.ts";
import { admin, model } from "../config/index.ts";
import { adminHtml } from "../ui/shell.ts";

const users = defineSchema("users", { id: column.serial().primaryKey(), email: column.text() });

let db: Connection;
let app: (req: Request) => Promise<Response>;
let panel: (req: Request) => Promise<Response>;
const get = (handler: typeof app, path: string) => handler(new Request(`http://local${path}`));

beforeAll(() => {
  db = connect({ driver: "sqlite", path: ":memory:" });
  app = router(...admin({ db, allowUnauthenticated: true, models: [model({ schema: users })] }).routes);
  panel = router(
    ...admin({ db, basePath: "/panel", allowUnauthenticated: true, models: [model({ schema: users })] }).routes,
  );
});
afterAll(() => db.close?.());

test("every screen path serves the shell so a reload or shared link works", async () => {
  for (const path of [
    "/admin",
    "/admin/query",
    "/admin/models/users",
    "/admin/models/users/new",
    "/admin/models/users/records/5",
  ]) {
    const response = await get(app, path);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain('src="/admin/assets/entry.js"');
  }
});

test("the shell's script is javascript, not the shell again", async () => {
  const response = await get(app, "/admin/assets/entry.js");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/javascript");
  const body = await response.text();
  expect(body).not.toContain("<!DOCTYPE");
  expect(body).toContain("data-atlas-mode");
}, 30_000);

test("the shell's stylesheet is compiled css with the components in it", async () => {
  const response = await get(app, "/admin/assets/entry.css");
  expect(response.headers.get("content-type")).toContain("text/css");
  const body = await response.text();
  expect(body).toContain(".atlas-button");
  expect(body).not.toContain("@use");
}, 30_000);

test("unknown assets and api paths are 404s, not the shell", async () => {
  for (const path of ["/admin/assets/nope.js", "/admin/api/nope/1/2/3"]) {
    const response = await get(app, path);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).not.toContain("text/html");
  }
});

test("a custom base path flows into the shell and its assets", async () => {
  const html = await (await get(panel, "/panel/models/users")).text();
  expect(html).toContain('data-base-path="/panel"');
  expect(html).toContain('href="/panel/assets/entry.css"');
  expect((await get(panel, "/panel/assets/entry.js")).status).toBe(200);
}, 30_000);

test("the shell escapes its base path", () => {
  expect(adminHtml('/a"><script>')).not.toContain('"><script>');
});

test("the shell applies a saved color mode before first paint, using the same script as the ui package", async () => {
  const { colorModeScript } = await import("../../ui/headless/colormodescript.ts");
  expect(adminHtml("/admin")).toContain(colorModeScript);
  const template = await Bun.file(new URL("../../../templates/fullstack/index.html", import.meta.url).pathname).text();
  expect(template).toContain(colorModeScript);
  expect(colorModeScript).toContain("atlas-color-mode");
  expect(colorModeScript).toContain("atlas-color-scheme");
});

test("the color script applies saved values, ignores junk, and survives blocked storage", async () => {
  const { colorModeScript } = await import("../../ui/headless/colormodescript.ts");
  const source = colorModeScript.replace("<script>", "").replace("</script>", "");
  const run = (stored: Record<string, string> | null) => {
    const attributes: Record<string, string> = {};
    const localStorage = stored && { getItem: (key: string) => stored[key] ?? null };
    const document = {
      documentElement: {
        setAttribute: (key: string, value: string) => {
          attributes[key] = value;
        },
      },
    };
    new Function("localStorage", "document", source)(localStorage, document);
    return attributes;
  };
  expect(run({ "atlas-color-mode": "dark", "atlas-color-scheme": "atlas" })).toEqual({
    "data-atlas-mode": "dark",
    "data-atlas-scheme": "atlas",
  });
  expect(run({ "atlas-color-mode": "chartreuse" })).toEqual({});
  expect(run(null)).toEqual({});
});
