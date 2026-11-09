import { afterAll, afterEach, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act } from "react";
import type { Root } from "react-dom/client";
import { AdminApp } from "../ui/app.tsx";

// react checks for a dom once on import, so it has to load after the dom exists
GlobalRegistrator.register({ url: "http://local/admin" });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");

const schema = {
  models: [
    {
      table: "users",
      columns: [
        { name: "id", type: "integer", primary: true },
        { name: "email", type: "text" },
      ],
      relations: [{ table: "posts", foreignKey: "user", label: "Posts" }],
    },
  ],
};
const requests: string[] = [];
const realFetch = globalThis.fetch;
let status = 200;
let session: Record<string, boolean> = { authRequired: false, authenticated: true, loginEnabled: false };
let signInStatus = 200;

const stubFetch = () => {
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    requests.push(String(input));
    if (String(input).endsWith("/session")) {
      if (init?.method === "POST") {
        if (signInStatus === 200) session = { ...session, authenticated: true };
        return Response.json(signInStatus === 200 ? {} : { error: "That email and password don't match." }, {
          status: signInStatus,
        });
      }
      if (init?.method === "DELETE") return Response.json({});
      return Response.json(session);
    }
    if (status !== 200) return Response.json({}, { status });
    if (String(input).endsWith("/api/schema")) return Response.json(schema);
    if (/\/api\/users\/\d+$/.test(String(input))) return Response.json({ data: { id: 5, email: "a@b.co" } });
    return Response.json({
      data: [{ id: 5, email: "a@b.co" }],
      meta: { page: 1, limit: 20, total: 60, pages: 3 },
    });
  }) as unknown as typeof fetch;
};

let root: Root;
const settle = () => act(() => new Promise<void>((done) => setTimeout(done, 15)));
const open = async (path: string) => {
  window.history.replaceState(null, "", path);
  stubFetch();
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(<AdminApp />));
  await settle();
};
const click = async (element: Element) => {
  await act(
    async () => void element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })),
  );
  await settle();
};
const heading = () => document.querySelector("h2")?.textContent;
const here = () => `${location.pathname}${location.search}`;
const back = async () => {
  window.history.back();
  // happy-dom moves the url but fires no popstate; chrome does both
  await act(async () => void window.dispatchEvent(new PopStateEvent("popstate")));
  await settle();
  await settle();
};

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
  requests.length = 0;
  status = 200;
  signInStatus = 200;
  session = { authRequired: false, authenticated: true, loginEnabled: false };
});
afterAll(() => {
  globalThis.fetch = realFetch;
  GlobalRegistrator.unregister();
});

test("a deep link opens the screen it names", async () => {
  await open("/admin/models/users/records/5");
  expect(heading()).toContain("users");
  expect(heading()).toContain("#5");
  expect(requests).toContain("/admin/api/users/5");
});

test("sidebar links are real hrefs that move the url, and back returns", async () => {
  await open("/admin");
  expect(heading()).toBe("Dashboard");
  const link = document.querySelector('nav a[href="/admin/models/users"]')!;
  expect(link).not.toBeNull();
  await click(link);
  expect(here()).toBe("/admin/models/users");
  expect(heading()).toBe("users");
  await back();
  expect(here()).toBe("/admin");
  expect(heading()).toBe("Dashboard");
});

test("a modified click is left to the browser", async () => {
  await open("/admin");
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, metaKey: true });
  await act(async () => void document.querySelector('nav a[href="/admin/query"]')!.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
});

test("page and sort live in the query string and survive a reload", async () => {
  await open("/admin/models/users?page=2&sort=email&order=desc");
  expect(
    requests.some((url) => url.includes("page=2") && url.includes("sort=email") && url.includes("order=desc")),
  ).toBe(true);
  await click(document.querySelector('nav[aria-label="Pagination"] button[aria-label="Next page"]')!);
  expect(new URLSearchParams(location.search).get("page")).toBe("2");
});

test("searching replaces the url instead of stacking history", async () => {
  await open("/admin/models/users");
  const before = history.length;
  const input = document.querySelector<HTMLInputElement>('input[placeholder="Search..."]')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "ann");
  await act(async () => void input.dispatchEvent(new Event("input", { bubbles: true })));
  await settle();
  expect(here()).toBe("/admin/models/users?search=ann");
  expect(history.length).toBe(before);
  expect(requests.some((url) => url.includes("search=ann"))).toBe(true);
});

test("a filter in the url opens the filter panel with its row", async () => {
  await open("/admin/models/users?filter.email=a%40b.co");
  expect(document.querySelector(".atlas-collapse")!.hasAttribute("data-expanded")).toBe(true);
  expect(requests.some((url) => url.includes("filter.email=a%40b.co"))).toBe(true);
  expect(document.querySelector<HTMLInputElement>(".atlas-collapse input")!.value).toBe("a@b.co");
});

test("a relation tab has its own address", async () => {
  await open("/admin/models/users/records/5?tab=posts");
  expect(document.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toBe("Posts");
  await click(document.querySelectorAll('[role="tab"]')[0]!);
  expect(here()).toBe("/admin/models/users/records/5");
  expect(document.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toBe("Details");
});

test("an address that matches nothing says so and offers a way out", async () => {
  await open("/admin/models/ghosts");
  expect(heading()).toBe("Page not found");
  await click(document.querySelector("main button")!);
  expect(here()).toBe("/admin");
});

test("a refused schema explains itself instead of rendering blank", async () => {
  status = 403;
  await open("/admin");
  expect(document.querySelector('[role="alert"]')!.textContent).toContain("administrator");
});

const signedOut = { authRequired: true, authenticated: false, loginEnabled: true };
const fill = async (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  await act(async () => void input.dispatchEvent(new Event("input", { bubbles: true })));
};
const submitLogin = async () => {
  const [email, password] = document.querySelectorAll<HTMLInputElement>("form input");
  await fill(email!, "a@b.co");
  await fill(password!, "pw");
  await act(
    async () =>
      void document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  await settle();
  await settle();
};

test("signed out, a deep link goes to sign-in and returns after it", async () => {
  session = signedOut;
  await open("/admin/models/users/records/5?tab=posts");
  expect(location.pathname).toBe("/admin/login");
  expect(new URLSearchParams(location.search).get("next")).toBe("/admin/models/users/records/5?tab=posts");
  expect(requests.some((url) => url.includes("/api/"))).toBe(false);
  await submitLogin();
  expect(here()).toBe("/admin/models/users/records/5?tab=posts");
  expect(heading()).toContain("#5");
});

test("a wrong password stays on sign-in and says why", async () => {
  session = signedOut;
  signInStatus = 401;
  await open("/admin/login");
  await submitLogin();
  expect(location.pathname).toBe("/admin/login");
  expect(document.querySelector('[role="alert"]')!.textContent).toContain("don't match");
});

test("next cannot send a signed-in visitor outside the admin", async () => {
  for (const next of ["https://evil.test/", "//evil.test/", "/elsewhere", "/adminish"]) {
    session = { ...signedOut, authenticated: true };
    await open(`/admin/login?next=${encodeURIComponent(next)}`);
    expect(here()).toBe("/admin");
    await act(async () => root.unmount());
  }
  await open("/admin");
});

test("a session that expires mid-use returns to sign-in, keeping the address", async () => {
  await open("/admin/models/users");
  session = signedOut;
  await act(async () => void window.dispatchEvent(new Event("atlas-admin-signedout")));
  await settle();
  await act(async () => root.unmount());
  session = signedOut;
  await open("/admin/models/users?page=2");
  expect(location.pathname).toBe("/admin/login");
  expect(new URLSearchParams(location.search).get("next")).toBe("/admin/models/users?page=2");
});

test("signing out returns to sign-in, and the button only exists when auth does", async () => {
  await open("/admin");
  expect([...document.querySelectorAll("nav button")].some((b) => b.textContent === "Sign out")).toBe(false);
  await act(async () => root.unmount());
  session = { ...signedOut, authenticated: true };
  await open("/admin");
  const out = [...document.querySelectorAll("nav button")].find((b) => b.textContent === "Sign out")!;
  await click(out);
  await settle();
  expect(location.pathname).toBe("/admin/login");
  expect(requests.at(-1)).toBe("/admin/session");
});

test("without a login function the screen says what to do", async () => {
  session = { ...signedOut, loginEnabled: false };
  await open("/admin");
  expect(document.querySelector('[role="alert"]')!.textContent).toContain("auth.login");
  expect(document.querySelector("form")).toBeNull();
});
