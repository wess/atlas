// The field survey: Atlas as a gamebook.
//
// Every section is numbered the way a gamebook numbers them — out of order, so
// the shape of the tree is not visible from the numbers and a reader cannot
// skim ahead to the ending. The numbers are the URLs (`/atlas/47/`), which is
// the whole conceit: "turn to §47" is a real place you can link someone to.
//
// Two rules the content has to keep:
//
//   1. Every path terminates. A fork whose choices lead nowhere is a dead end
//      in a book you cannot close.
//   2. Every ending is real. The stack, the command, and the code are what you
//      would actually type — not a sketch of what you might type. `bun run
//      site:build` fails if a choice points at a section that does not exist,
//      but nothing can check that the code is honest except writing it that
//      way.

export type Choice = {
  readonly label: string;
  /** The section this leads to, or an absolute site path for an escape hatch. */
  readonly to: number | string;
  readonly note?: string;
};

export type StackEntry = {
  readonly name: string;
  readonly why: string;
  /** The doc slug this module's reference lives at, when it has one. */
  readonly slug?: string;
};

export type Snippet = {
  readonly file: string;
  readonly language: "ts" | "tsx" | "rust" | "bash" | "toml";
  readonly source: string;
};

export type Reading = {
  readonly title: string;
  /** A doc slug, or an absolute URL for anything off-site. */
  readonly slug: string;
};

export type Passage = {
  readonly n: number;
  readonly kind: "fork" | "ending" | "appendix";
  /** Which half of Atlas this section belongs to; drives the station colour. */
  readonly field: "open" | "web" | "desktop" | "both";
  readonly title: string;
  readonly lede: string;
  readonly body?: readonly string[];
  readonly choices?: readonly Choice[];
  /** Endings only. */
  readonly plate?: string;
  readonly stack?: readonly StackEntry[];
  readonly command?: string;
  readonly snippet?: Snippet;
  readonly reading?: readonly Reading[];
};

// ---------------------------------------------------------------------------
// The opening
// ---------------------------------------------------------------------------

const opening: readonly Passage[] = [
  {
    n: 1,
    kind: "fork",
    field: "open",
    title: "You are about to build something",
    lede: "Nothing has been decided yet except the one thing that decides everything else: where it runs.",
    body: [
      "The language follows from it. So does the way you ship a fix on a Friday, the way a stranger installs it, and how much of what you write you will still recognise in a year.",
      "Atlas is two boilerplates for two answers. Pick the one you are actually building, not the one that sounds more ambitious.",
    ],
    choices: [
      {
        label: "In a browser — or answering one",
        to: 14,
        note: "An API, a site, a service. Bun and TypeScript.",
      },
      {
        label: "On someone's machine, in its own window",
        to: 31,
        note: "A native app. Rust, gpui, and guise.",
      },
      { label: "Both, and they do not talk yet", to: 22 },
      {
        label: "I know what I want — show me everything",
        to: "/map/",
        note: "The full module chart.",
      },
    ],
  },
  {
    n: 22,
    kind: "fork",
    field: "both",
    title: "Two boilerplates, one repository",
    lede: "Atlas is not a framework that also does desktop. It is two boilerplates that were written by the same person and have therefore converged on the same habits.",
    body: [
      "`web/` is nineteen Bun packages you compose with functions and pipes. `desktop/` is a Rust workspace on gpui and guise with three templates and a full signing and release pipeline.",
      "They share no code and never will — a TypeScript pipe and a Rust trait have nothing to say to each other. What they share is the shape: one layer per concern, one seam where the async work crosses into the UI, and enough written down that an agent can work in either without being told twice.",
      "Build one first. Building both at once is how you end up with neither.",
    ],
    choices: [
      { label: "Start with the half people reach over the network", to: 14 },
      { label: "Start with the half people install", to: 31 },
    ],
  },
];

// ---------------------------------------------------------------------------
// The web branch
// ---------------------------------------------------------------------------

const webForks: readonly Passage[] = [
  {
    n: 14,
    kind: "fork",
    field: "web",
    title: "What shape is it?",
    lede: "Nineteen modules, and no opinion about which you take. But the shape of the thing decides the first three, and the first three decide most of the rest.",
    body: [
      "None of these are exclusive forever. They are exclusive today, because the fastest way to never finish is to build all five.",
    ],
    choices: [
      { label: "It answers requests with JSON", to: 7, note: "An API, with or without a UI in front of it." },
      {
        label: "It serves pages people look at",
        to: 19,
        note: "Server-rendered HTML with React where it earns its place.",
      },
      { label: "It runs in a terminal", to: 88 },
      { label: "It stands in front of other services", to: 64, note: "A proxy, TLS, certificates." },
      { label: "It talks to a model", to: 41 },
    ],
  },
  {
    n: 7,
    kind: "fork",
    field: "web",
    title: "Who is calling it?",
    lede: "An API that knows who is calling is a different program from one that does not — different tables, different failure modes, a different amount of your life spent on it.",
    body: [
      "Answer for the callers you have on the first day. Adding accounts later is a migration. Building accounts you do not need yet is a month.",
    ],
    choices: [
      { label: "Anyone. It is public.", to: 53 },
      { label: "People, with accounts", to: 12 },
      { label: "Other machines, with tokens you issue", to: 77, note: "You are becoming the identity provider." },
      { label: "An agent, on someone's behalf", to: 41 },
    ],
  },
  {
    n: 12,
    kind: "fork",
    field: "web",
    title: "How do they prove it?",
    lede: "Three ways in, and the difference is who you make responsible for the password.",
    body: ["The third option is the one people forget is available, and it is the one that closes enterprise deals."],
    choices: [
      { label: "Email and a password you store", to: 26, note: "You hold the hash. You also hold the reset flow." },
      { label: "Google, GitHub, Apple — someone else's button", to: 95, note: "No password to lose." },
      { label: "Their employer's identity provider", to: 38, note: "OIDC. Someone in procurement will ask." },
    ],
  },
  {
    n: 19,
    kind: "fork",
    field: "web",
    title: "What does it need beyond pages?",
    lede: "You have decided people will look at it. The next question is what happens to the data behind the pages, and how often it moves.",
    choices: [
      { label: "Someone has to edit the data", to: 59, note: "You, at first. Then someone who is not you." },
      { label: "The page has to change without a reload", to: 83 },
      { label: "Pages and forms. That is all.", to: 47 },
    ],
  },
];

// ---------------------------------------------------------------------------
// The desktop branch
// ---------------------------------------------------------------------------

const desktopForks: readonly Passage[] = [
  {
    n: 31,
    kind: "fork",
    field: "desktop",
    title: "What does it open?",
    lede: "Desktop apps divide cleanly by this, and the division survives contact with the code: it decides the routing, the state scopes, and which template you start from.",
    body: [
      "Atlas Desktop has three templates and they map onto these three answers exactly. Start at the smallest one that fits — each template's `AGENTS.md` says what to add when it outgrows itself, and the thing you add is the next template.",
    ],
    choices: [
      { label: "Nothing. One window, one job.", to: 5 },
      { label: "Several surfaces you move between", to: 70, note: "A nav rail and routed views." },
      { label: "Something — a database, a repository, a document", to: 33 },
    ],
  },
  {
    n: 5,
    kind: "fork",
    field: "desktop",
    title: "Does it wait on anything?",
    lede: "This is the question that decides whether you need a crate you would otherwise not write.",
    body: [
      "gpui has its own executor and its own main thread. Anything that blocks — a network call, a slow disk, a child process — has to happen somewhere else and arrive back as a message. Atlas gives you exactly one place for that, and the cost of pretending you do not need it is a UI that freezes on a spinning disk.",
    ],
    choices: [
      { label: "No. Everything it needs is already in memory.", to: 61 },
      { label: "Yes — a network call, a slow disk, a child process", to: 16 },
    ],
  },
  {
    n: 70,
    kind: "fork",
    field: "desktop",
    title: "What feeds the lists?",
    lede: 'Several surfaces means several lists, and a list is only as good as its answer to "what happened while I was looking away".',
    choices: [
      { label: "Files and state on this machine", to: 92, note: "You control when it changes." },
      { label: "A daemon, a socket, something that streams", to: 44, note: "It changes without asking you." },
    ],
  },
  {
    n: 33,
    kind: "fork",
    field: "desktop",
    title: "How many at once?",
    lede: "An app that opens things has two lives: the screen where you choose, and the screen where you work. Everything scoped to the open thing has to die when it closes.",
    choices: [
      { label: "One. Open it, work, close it.", to: 28 },
      { label: "One — and each carries a credential", to: 86, note: "A password, a token, a key." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Endings — the web half
// ---------------------------------------------------------------------------

const webEndings: readonly Passage[] = [
  {
    n: 53,
    kind: "ending",
    field: "web",
    plate: "Plate 53",
    title: "The open API",
    lede: "No accounts, no sessions, no reset emails. Requests come in, rows go out, and the only thing you have to be careful about is how many of them one caller can make.",
    body: [
      "This is the smallest complete Atlas server, and more services should stop here than do. Add identity the day a caller needs to be told apart from another caller — not before.",
    ],
    stack: [
      { name: "@atlas/config", why: "Typed environment variables, read once at boot.", slug: "config" },
      { name: "@atlas/db", why: "Schemas, a query builder, Postgres or SQLite.", slug: "db" },
      { name: "@atlas/migrate", why: "Timestamped SQL, generated from the schema you already wrote.", slug: "migrate" },
      { name: "@atlas/server", why: "Pipe-based routes over Bun.serve.", slug: "server" },
      { name: "@atlas/security", why: "Rate limiting, because public means public.", slug: "security" },
    ],
    command: "atlas init -n myapi --template api",
    snippet: {
      file: "src/server.ts",
      language: "ts",
      source: `import { connect, from } from "@atlas/db"
import { migrate } from "@atlas/migrate"
import { serve, get, json } from "@atlas/server"
import { posts } from "./schema"

const db = connect({ driver: "sqlite", path: "./app.db" })
await migrate.up(db, "./migrations")

serve({
  port: 3000,
  routes: [
    get("/posts", async (c) =>
      json(c, 200, await db.all(from(posts).select("id", "title").limit(50)))),
  ],
})`,
    },
    reading: [
      { title: "Quick start", slug: "quickstart" },
      { title: "@wess/atlas/server", slug: "server" },
      { title: "@wess/atlas/db", slug: "db" },
    ],
  },
  {
    n: 26,
    kind: "ending",
    field: "web",
    plate: "Plate 26",
    title: "The API with accounts",
    lede: "You are holding the password now. That is one hash, one reset flow, one rate limit on the login route, and one decision you cannot take back quietly.",
    body: [
      "`signup` and `login` are route handlers, not a framework — they take your table and your field names and hand you the user. What you do with the user is yours: the token below is a JWT, but a database-backed revocable session from `@atlas/security` is the better default the moment you need to kick someone out.",
      "`token.sign` and `token.verify` are async. Forgetting the `await` yields a Promise that stringifies to `[object Promise]` and a token that verifies as garbage.",
    ],
    stack: [
      { name: "@atlas/server", why: "Routes and the pipe pipeline.", slug: "server" },
      { name: "@atlas/db", why: "The users table.", slug: "db" },
      { name: "@atlas/auth", why: "Hashing, JWTs, signup and login flows.", slug: "auth" },
      { name: "@atlas/security", why: "Rate limits, audit log, revocable sessions, TOTP.", slug: "security" },
      { name: "@atlas/email", why: "The reset mail you will need by week two.", slug: "email" },
    ],
    command: "atlas init -n myapi --template api",
    snippet: {
      file: "src/auth.ts",
      language: "ts",
      source: `import { token, signup, login, requireAuth } from "@atlas/auth"
import { post, pipeline, parseJson, json } from "@atlas/server"

export const routes = [
  post("/auth/signup", pipeline(parseJson)(signup({
    db, table: "users", fields: ["email", "name", "password"],
    onSuccess: (c, user) => json(c, 201, { id: user.id, email: user.email }),
  }))),

  post("/auth/login", pipeline(parseJson)(login({
    db, table: "users", identity: "email", password: "password",
    // token.sign is async — the missing await is the bug you will not see.
    onSuccess: async (c, user) =>
      json(c, 200, { token: await token.sign({ id: user.id }, secret) }),
  }))),
]

export const guard = requireAuth({ secret })`,
    },
    reading: [
      { title: "@wess/atlas/auth", slug: "auth" },
      { title: "@wess/atlas/security", slug: "security" },
      { title: "Cookbook", slug: "cookbook" },
    ],
  },
  {
    n: 95,
    kind: "ending",
    field: "web",
    plate: "Plate 95",
    title: "The API with social login",
    lede: "Someone else stores the password. You store a provider name and an id, and you get to skip the entire reset-email apparatus.",
    body: [
      "PKCE and the state parameter ride in a signed HttpOnly cookie, so the flow is stateless — no session table, no schema, nothing to sweep. Add providers by adding entries to the map.",
      "Apple is the exception: it delivers the callback as `form_post`, so its route is a `POST` behind `parseForm` while every other provider is a `GET`.",
    ],
    stack: [
      { name: "@atlas/auth/social", why: "Google, GitHub, Apple, Microsoft, Facebook, X, TikTok.", slug: "auth" },
      { name: "@atlas/auth", why: "The session or JWT you issue once they come back.", slug: "auth" },
      { name: "@atlas/server", why: "Routes, redirects, cookie headers.", slug: "server" },
      { name: "@atlas/db", why: "Users, keyed by provider and provider id.", slug: "db" },
    ],
    command: "atlas init -n myapp --template api",
    snippet: {
      file: "src/social.ts",
      language: "ts",
      source: `import { socialAuth, google, github } from "@atlas/auth/social"
import { get, redirect, putHeader } from "@atlas/server"

const social = socialAuth({
  secret: process.env.OAUTH_STATE_SECRET!,
  cookie: { secure: process.env.NODE_ENV === "production" },
  providers: {
    google: google({ clientId, clientSecret, redirectUri: \`\${origin}/auth/google/callback\` }),
    github: github({ clientId, clientSecret, redirectUri: \`\${origin}/auth/github/callback\` }),
  },
})

const onSuccess = async (c, { profile }) => {
  const user = await upsertUserFromProfile(profile)  // keyed by (provider, providerId)
  const jwt = await token.sign({ id: user.id }, secret, { expiresIn: 86400 })
  return redirect(putHeader(c, "set-cookie", \`session=\${jwt}; HttpOnly; Path=/\`), "/")
}

export const routes = [
  get("/auth/google", social.start("google")),
  get("/auth/google/callback", social.callback("google", { onSuccess })),
]`,
    },
    reading: [
      { title: "@wess/atlas/auth", slug: "auth" },
      { title: "Cookbook", slug: "cookbook" },
      { title: "Quick start", slug: "quickstart" },
    ],
  },
  {
    n: 38,
    kind: "ending",
    field: "web",
    plate: "Plate 38",
    title: "The API behind single sign-on",
    lede: "Their IT department runs the identity provider. You are the relying party: you trust an id token, you map a `sub` to a local user, and you never see a password at all.",
    body: [
      "This is the one that gets asked for in procurement and is usually quoted as a quarter of work. It is `mountSso` plus a function that turns claims into a local user.",
      "Back-channel logout is mounted for you. When their IdP says a session is over, it is over here too — which is the actual reason the requirement exists.",
    ],
    stack: [
      { name: "@atlas/sso", why: "OIDC discovery, PKCE, code exchange, id-token verification.", slug: "sso" },
      { name: "@atlas/db", why: "State rows and the local user mapping.", slug: "db" },
      { name: "@atlas/security", why: "The revocable session the back-channel logout kills.", slug: "security" },
      { name: "@atlas/server", why: "The three routes it mounts.", slug: "server" },
    ],
    command: "bun add @wess/atlas",
    snippet: {
      file: "src/sso.ts",
      language: "ts",
      source: `import { mountSso, ensureSsoStateTable } from "@atlas/sso"

await ensureSsoStateTable(db)

export const ssoRoutes = mountSso({
  db,
  issuerUrl: process.env.OIDC_ISSUER!,
  clientId: process.env.OIDC_CLIENT_ID!,
  clientSecret: process.env.OIDC_CLIENT_SECRET!,
  // Claims in, your user out. This is the whole integration.
  onAuthenticated: async (db, claims) => {
    const user = await upsertUserBySub(db, claims.sub, claims.email)
    return { localUserId: user.id, displayName: claims.name }
  },
  issueSession: (conn, user) => putSessionCookie(conn, user),
})`,
    },
    reading: [
      { title: "@wess/atlas/sso", slug: "sso" },
      { title: "@wess/atlas/security", slug: "security" },
    ],
  },
  {
    n: 77,
    kind: "ending",
    field: "web",
    plate: "Plate 77",
    title: "The identity provider",
    lede: "Other people's software signs in to yours. You are issuing the tokens now, and the specification is not optional.",
    body: [
      "OAuth 2.1 with PKCE, refresh rotation, a device flow for things with no browser, and discovery so clients configure themselves. Registered clients, scopes, and an audit trail come with it.",
      "This is a real commitment. Take it when integrators are asking for it, not because it sounds like the mature choice — everything in §26 is still true underneath, and you now own an expiry sweep as well.",
    ],
    stack: [
      { name: "@atlas/oauth", why: "Authorize, token, revoke, device, discovery, client admin.", slug: "oauth" },
      { name: "@atlas/auth", why: "The human login the authorize endpoint sits behind.", slug: "auth" },
      { name: "@atlas/db", why: "Clients, codes, refresh tokens, device codes.", slug: "db" },
      { name: "@atlas/security", why: "Rate limits and the audit log you will be asked for.", slug: "security" },
    ],
    command: "bun add @wess/atlas",
    snippet: {
      file: "src/oauth.ts",
      language: "ts",
      source: `import { oauthRoutes, sweepExpired } from "@atlas/oauth"
import { requireAuth } from "@atlas/auth"

const cfg = {
  db,
  secret: config.secret,
  scopes: ["profile", "email", "offline_access"],
  loadUser: (db, userId) => findUserById(db, userId),
  buildAccessTokenClaims: (user) => ({ sub: String(user.id), email: user.email }),
  // The consent screen is a normal authenticated page; the client admin is not.
  requireUser: requireAuth({ secret: config.secret }),
  requireAdmin: requireStaff,
}

export const routes = oauthRoutes(cfg, { basePath: "/oauth", adminBasePath: "/oauth/clients" })

// Codes, refresh tokens, and device codes all expire. Nothing deletes them
// for you, and the tables only grow.
setInterval(() => void sweepExpired(cfg), 15 * 60_000)`,
    },
    reading: [
      { title: "@wess/atlas/oauth", slug: "oauth" },
      { title: "@wess/atlas/auth", slug: "auth" },
    ],
  },
  {
    n: 59,
    kind: "ending",
    field: "web",
    plate: "Plate 59",
    title: "The full-stack app with an admin",
    lede: "Pages for the people who use it, and a generated CRUD surface for the person who has to fix a row at eleven at night.",
    body: [
      "The admin is derived from the same `defineSchema` the app already uses, so it cannot drift from the tables. Search fields, filters, bulk actions and read-only models are configuration, not a second application.",
      "It mounts behind your auth. It is a full administrative surface over your database — treat an unprotected `basePath` as a public database.",
    ],
    stack: [
      { name: "@atlas/server", why: "Routes and static serving.", slug: "server" },
      { name: "@atlas/db", why: "Schemas the admin reads its shape from.", slug: "db" },
      { name: "@atlas/auth", why: "Who gets in, and who gets into `/admin`.", slug: "auth" },
      { name: "@atlas/admin", why: "Generated list, detail, create, filters, bulk actions.", slug: "admin" },
      { name: "@atlas/ui", why: "React blocks for the half people see.", slug: "ui" },
    ],
    command: "atlas init -n myapp --template admin",
    snippet: {
      file: "src/admin.ts",
      language: "ts",
      source: `import { admin, model } from "@atlas/admin"
import { users, uploads } from "./schema"

const panel = admin({
  db,
  basePath: "/admin",
  auth: { secret: config.secret },   // not optional in production
  models: [
    model({ schema: users, searchFields: ["email", "name"], filterFields: ["createdAt"] }),
    model({ schema: uploads, searchFields: ["filename"], readOnly: true }),
  ],
})

serve({ port: 3000, routes: [...appRoutes, ...panel.mount([])] })`,
    },
    reading: [
      { title: "@wess/atlas/admin", slug: "admin" },
      { title: "@wess/atlas/ui", slug: "ui" },
      { title: "Quick start", slug: "quickstart" },
    ],
  },
  {
    n: 83,
    kind: "ending",
    field: "web",
    plate: "Plate 83",
    title: "The realtime app",
    lede: "Two transports, and picking the wrong one costs you a week. Server-sent events if the server does the talking. WebSockets if both ends do.",
    body: [
      'Most "realtime" features are one-way — a feed, a counter, a job that finishes. SSE is a plain HTTP response that survives proxies, reconnects by itself, and needs no protocol upgrade. Reach for WebSockets when the client genuinely talks back.',
      "Rooms are the part people rebuild badly. `createRooms` gives you join, leave, broadcast, and members, and `leaveAll` on disconnect is what stops a room filling with ghosts.",
    ],
    stack: [
      { name: "@atlas/server/ws", why: "Channels, rooms, JSON-wrapped connections.", slug: "server" },
      { name: "@atlas/server/sse", why: "Broadcast channels over plain HTTP.", slug: "server" },
      { name: "@atlas/cache", why: "The shared state two processes both need.", slug: "cache" },
      { name: "@atlas/ui", why: "The half that renders the updates.", slug: "ui" },
    ],
    command: "atlas init -n mylive --template realtime",
    snippet: {
      file: "src/live.ts",
      language: "ts",
      source: `import { channel, createRooms } from "@atlas/server/ws"
import { createSseChannel } from "@atlas/server/sse"
import { get } from "@atlas/server"

const rooms = createRooms()

const room = channel("room", {
  join: (ws, params) => {
    rooms.join(ws, String(params.room))
    return true
  },
  handle: (ws, event, payload) => {
    if (event === "say") rooms.broadcast(String(payload.room), payload, ws)
  },
  // Without this a disconnected client stays a member of every room it joined.
  leave: (ws) => rooms.leaveAll(ws),
})

// One-way updates ride SSE instead: a plain HTTP response that survives
// proxies and reconnects by itself. \`pipe\` is a PipeFn, so it is the handler.
const feed = createSseChannel()
const feedRoute = get("/feed", (c) => feed.pipe(c))
// elsewhere: feed.broadcast("job", { id, status: "done" })`,
    },
    reading: [
      { title: "@wess/atlas/server", slug: "server" },
      { title: "@wess/atlas/cache", slug: "cache" },
      { title: "Cookbook", slug: "cookbook" },
    ],
  },
  {
    n: 47,
    kind: "ending",
    field: "web",
    plate: "Plate 47",
    title: "The full-stack app",
    lede: "Pages and forms, which is what most software is, and what most stacks make disproportionately hard.",
    body: [
      "The server renders and serves; React appears where interaction earns it, not by default. `@atlas/ui` is Mantine blocks — forms, tables, auth pages, navigation — so the parts every app has are already built and the parts that are yours are the ones you write.",
      "When someone other than you needs to edit a row, turn to §59 and add the admin. It is configuration over the schemas you already have.",
    ],
    stack: [
      { name: "@atlas/server", why: "Routes, forms, static assets.", slug: "server" },
      { name: "@atlas/db", why: "Schemas, queries, changesets.", slug: "db" },
      { name: "@atlas/auth", why: "Sessions for the people looking at it.", slug: "auth" },
      { name: "@atlas/ui", why: "Forms, tables, auth pages, shell.", slug: "ui" },
    ],
    command: "atlas init -n mysite --template fullstack",
    snippet: {
      file: "src/app.tsx",
      language: "tsx",
      source: `import { AtlasProvider, AppShell } from "@atlas/ui/provider"
import { createForm, TextField, SubmitButton } from "@atlas/ui/forms"
import { createTable, TextColumn, DateColumn } from "@atlas/ui/table"

const PostForm = createForm({ fields: { title: "", body: "" } })
const PostTable = createTable([
  TextColumn("title", "Title"),
  DateColumn("createdAt", "Published"),
])

export default function App({ posts }) {
  return (
    <AtlasProvider>
      <AppShell>
        <PostForm onSubmit={(values) => post("/posts", values)}>
          <TextField name="title" label="Title" />
          <SubmitButton>Publish</SubmitButton>
        </PostForm>
        <PostTable rows={posts} />
      </AppShell>
    </AtlasProvider>
  )
}`,
    },
    reading: [
      { title: "@wess/atlas/ui", slug: "ui" },
      { title: "@wess/atlas/server", slug: "server" },
      { title: "Quick start", slug: "quickstart" },
    ],
  },
  {
    n: 88,
    kind: "ending",
    field: "web",
    plate: "Plate 88",
    title: "The command-line tool",
    lede: "No port, no HTML, no browser. Arguments in, exit code out, and a `--help` that does not lie.",
    body: [
      "`cli` takes command definitions and runs them. `foreman` reads a Procfile and supervises processes, which is how `atlas dev` runs a server and a bundler under one Ctrl-C.",
      "Atlas's own CLI is built this way, so the surface you are using to scaffold is the surface you are building on.",
    ],
    stack: [
      { name: "@atlas/cli", why: "Commands, flags, arg parsing, Foreman, scaffolding.", slug: "cli" },
      { name: "@atlas/config", why: "Environment and defaults, typed.", slug: "config" },
      { name: "@atlas/request", why: "For the API it almost certainly calls.", slug: "request" },
    ],
    command: "bun add @wess/atlas",
    snippet: {
      file: "bin/tool.ts",
      language: "ts",
      source: `import { cli, command, flag } from "@atlas/cli"

cli("tool", [
  command("deploy", {
    flags: {
      env: flag("e", { type: "string", default: "staging" }),
      dry: flag("d", { type: "boolean", default: false }),
    },
    run: async ({ flags, args }) => {
      if (flags.dry) return console.log(\`would deploy \${args[0]} to \${flags.env}\`)
      await deploy(args[0], flags.env)
    },
  }),
])`,
    },
    reading: [
      { title: "@wess/atlas/cli", slug: "cli" },
      { title: "@wess/atlas/config", slug: "config" },
    ],
  },
  {
    n: 64,
    kind: "ending",
    field: "web",
    plate: "Plate 64",
    title: "The edge",
    lede: "TLS, certificates, and compression, without a Caddy sidecar and without a `nginx.conf` nobody on the team can read.",
    body: [
      "`@atlas/edge` terminates TLS, issues and renews Let's Encrypt certificates thirty days before expiry, and reverse-proxies to your app. In development with no `DOMAIN` set it detects localhost and serves plain HTTP on `:8080` — no certs, no sudo.",
      "Use the staging directory for the first production boot. Let's Encrypt allows five failures per hostname per hour, and the fastest way to spend that budget is a typo in a DNS record. The browser will call staging certs untrusted; that is the point of them.",
    ],
    stack: [
      { name: "@atlas/edge", why: "TLS termination, ACME, proxying, compression.", slug: "edge" },
      { name: "@atlas/security", why: "Headers and rate limits at the boundary.", slug: "security" },
    ],
    command: "atlas init -n myedge --template edge",
    snippet: {
      file: "edge.ts",
      language: "ts",
      source: `import { LETSENCRYPT_PROD, LETSENCRYPT_STAGING, defineEdge, proxy } from "@atlas/edge"

defineEdge({
  acme: process.env.ADMIN_EMAIL
    ? {
        email: process.env.ADMIN_EMAIL,
        storage: process.env.CERT_DIR ?? "/var/atlas/edge",
        // ACME_STAGING=1 on the first prod boot. Five failures an hour is
        // not many when a DNS record is wrong.
        directoryUrl: process.env.ACME_STAGING ? LETSENCRYPT_STAGING : LETSENCRYPT_PROD,
      }
    : undefined,
  sites: [{
    host: process.env.DOMAIN ?? "localhost",
    compress: ["gzip", "zstd"],
    routes: [{ handler: proxy("http://localhost:3000") }],
  }],
}).listen()`,
    },
    reading: [
      { title: "@wess/atlas/edge", slug: "edge" },
      { title: "@wess/atlas/security", slug: "security" },
    ],
  },
  {
    n: 41,
    kind: "ending",
    field: "web",
    plate: "Plate 41",
    title: "The agent service",
    lede: "A model on one side, your data on the other, and a protocol in between so the model can ask for things instead of hallucinating them.",
    body: [
      "`@atlas/ai` is provider-agnostic — OpenAI, Anthropic, or a local Ollama behind the same calls, with streaming, embeddings, RAG, and conversations. `@atlas/mcp` exposes your own application over the Model Context Protocol: tools register from whatever you put in the context, so handing an agent your database is a line, not a project.",
      "Two documentation tools are always on, with or without a context: `docs.list` and `docs.read`. An agent working in your repository can read Atlas's canonical documentation without a network round trip.",
    ],
    stack: [
      { name: "@atlas/ai", why: "Providers, chat, streaming, embeddings, RAG, agents.", slug: "ai" },
      { name: "@atlas/mcp", why: "Your app as MCP tools, plus the docs tools.", slug: "mcp" },
      { name: "@atlas/server", why: "The HTTP surface in front of it.", slug: "server" },
      { name: "@atlas/cache", why: "Embeddings are not free twice.", slug: "cache" },
    ],
    command: "atlas init -n mybot --template ai",
    snippet: {
      file: "src/agent.ts",
      language: "ts",
      source: `import { createProvider } from "@atlas/ai"
import { collectTools, createContext, createMcpServer } from "@atlas/mcp"

const model = createProvider({ provider: "anthropic", key: process.env.ANTHROPIC_API_KEY! })

for await (const chunk of model.chatStream({
  messages: [{ role: "user", content: "Summarise the last release" }],
})) {
  if (chunk.type === "text") process.stdout.write(chunk.content ?? "")
}

// The same app, exposed to an agent. Tools register from what the context has.
const ctx = createContext({ db, routes, config })
createMcpServer(collectTools(ctx), ctx).start()`,
    },
    reading: [
      { title: "@wess/atlas/ai", slug: "ai" },
      { title: "@wess/atlas/mcp", slug: "mcp" },
      { title: "Agent guide", slug: "agents" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Endings — the desktop half
// ---------------------------------------------------------------------------

const desktopEndings: readonly Passage[] = [
  {
    n: 61,
    kind: "ending",
    field: "desktop",
    plate: "Plate 61",
    title: "The single-window tool",
    lede: "One window that does one thing. No router, no async layer, no crate you added because you might need it.",
    body: [
      "Three crates: the types, the store, and the app. Settings, an About card that does not claim a local build is a release, and self-update that installs in place are already wired — they are the chrome every desktop app owes its users and none of it is your problem.",
      "The template's `AGENTS.md` says what to add when this stops fitting. Each thing it names is one of the other two templates.",
    ],
    stack: [
      { name: "model", why: "The domain types. Pure serde, no gpui.", slug: "desktop/architecture" },
      { name: "store", why: "Atomic JSON under `~/.<app>/`, plus the keychain.", slug: "desktop/architecture" },
      { name: "app", why: "gpui and guise: theme, menu bar, window, overlays.", slug: "desktop/architecture" },
    ],
    command: "scripts/new.sh Acme ~/Dev/acme --template minimal",
    snippet: {
      file: "crates/app/src/main.rs",
      language: "rust",
      source: `use atlas::prelude::*;

fn main() {
    Application::new().run(|cx: &mut App| {
        // Read the store before the window opens, so the theme follows the
        // saved preference on the first frame instead of flashing the default.
        let store = store::Store::new();
        let settings = store.settings();

        Scheme::new().build(scheme_for(&settings)).init(cx);
        Chrome::new("Acme").docs("https://github.com/wess/acme").install(cx);

        MainWindow::versioned("Acme", env!("CARGO_PKG_VERSION"))
            .size(900.0, 640.0)
            .open(cx, move |cx| root::Root::new(store, cx));
    });
}`,
    },
    reading: [
      { title: "Desktop architecture", slug: "desktop/architecture" },
      { title: "Scaffolding", slug: "desktop/scaffolding" },
      { title: "Gotchas", slug: "desktop/gotchas" },
    ],
  },
  {
    n: 16,
    kind: "ending",
    field: "desktop",
    plate: "Plate 16",
    title: "The single-window tool that waits",
    lede: "Still one window, but now something slow sits behind it — and gpui's main thread is not where slow things go.",
    body: [
      "Add a `host` crate: the async service facade, gpui-free, where every operation the app can perform is a method. Views never touch it directly. They dispatch through `atlas::bridge::run`, which puts the future on the process-wide tokio runtime and delivers the result back on the UI thread.",
      "One seam is the whole point. There is one place to look when a result never arrives, and one runtime to reason about rather than a `Runtime::new()` per module and four thread pools fighting over the same cores.",
      'Use `Load<T>` for what comes back. An `Option<Vec<T>>` cannot tell "still loading" from "loaded and empty" from "failed", which is how an empty table ends up spinning forever.',
    ],
    stack: [
      { name: "model", why: "The domain types.", slug: "desktop/architecture" },
      { name: "store", why: "Local persistence.", slug: "desktop/architecture" },
      { name: "host", why: "The async facade. Everything slow lives here.", slug: "desktop/architecture" },
      { name: "app", why: "The UI, and the one bridge call per dispatch.", slug: "desktop/architecture" },
    ],
    command: "scripts/new.sh Acme ~/Dev/acme --template minimal",
    snippet: {
      file: "crates/app/src/state.rs",
      language: "rust",
      source: `use atlas::prelude::*;

impl AppState {
    /// Fetch the list and publish it. Three states in one signal, so a view
    /// cannot render a failure as an empty list.
    pub fn reload(&self, cx: &mut gpui::App) {
        let host = Arc::clone(&self.host);
        let items = self.items.clone();
        items.set(cx, Load::Loading);

        bridge::run(cx, async move { host.items().await }, move |result, cx| {
            items.set(cx, result.into());
        });
    }
}`,
    },
    reading: [
      { title: "Desktop architecture", slug: "desktop/architecture" },
      { title: "Gotchas", slug: "desktop/gotchas" },
    ],
  },
  {
    n: 92,
    kind: "ending",
    field: "desktop",
    plate: "Plate 92",
    title: "The navigator",
    lede: "A nav rail down the left, routed views on the right, and lists you control the timing of.",
    body: [
      "This is the `sidebar` template, and it is the one to read to understand how the pieces fit. A `Route` enum with a stable id per destination, `atlas::shell::Nav` rendering the rail, and one view per surface reading the signals it cares about.",
      "The rail collapses to icons and remembers that it did. A preference that has to be re-applied every launch is not a preference.",
    ],
    stack: [
      { name: "model + store", why: "Types and local persistence.", slug: "desktop/architecture" },
      { name: "host", why: "The async facade behind every list.", slug: "desktop/architecture" },
      { name: "atlas::shell::Nav", why: "The collapsing rail.", slug: "desktop/architecture" },
      { name: "atlascore::Load", why: "Loading, ready, and failed as three screens.", slug: "desktop/architecture" },
    ],
    command: "scripts/new.sh Acme ~/Dev/acme --template sidebar",
    snippet: {
      file: "crates/app/src/root.rs",
      language: "rust",
      source: `let nav = Nav::new(Route::nav(), route.id())
    .title("Acme")
    .collapsed(collapsed)
    .on_select(move |id, cx| {
        if let Some(next) = Route::from_id(&id) { route_signal.set(cx, next); }
    })
    .on_toggle(move |cx| collapse.toggle(cx));

// gpui dispatches actions along the focus path. With nothing focused the
// menu bar greys out and swallows its own shortcuts.
focus::claim(window, cx, &self.focus);

div().track_focus(&self.focus).flex().child(nav).child(content)`,
    },
    reading: [
      { title: "Desktop architecture", slug: "desktop/architecture" },
      { title: "Scaffolding", slug: "desktop/scaffolding" },
      { title: "Gotchas", slug: "desktop/gotchas" },
    ],
  },
  {
    n: 44,
    kind: "ending",
    field: "desktop",
    plate: "Plate 44",
    title: "The client",
    lede: "The lists change without asking you. A daemon, a socket, a subscription — something on the other end has opinions about when things happen.",
    body: [
      "`bridge::stream` is the shape for this: a producer on the tokio runtime, each item delivered to the UI thread as it arrives, and cancellation that needs no abort registry. When the view goes away the receiver drops, the producer's `send` starts failing, and it stops.",
      "Coalesce. A `compose up` of twenty services emits hundreds of events in a second, and refetching per event hammers the daemon and thrashes the list. Bump an epoch signal instead and let the views refetch once.",
    ],
    stack: [
      { name: "host", why: "The streaming facade, gpui-free.", slug: "desktop/architecture" },
      {
        name: "atlas::bridge::stream",
        why: "Many items, one seam, implicit cancellation.",
        slug: "desktop/architecture",
      },
      { name: "atlas::shell::Nav", why: "The rail over the routed views.", slug: "desktop/architecture" },
      { name: "atlas::shell::Toasts", why: "One severity vocabulary for what fails.", slug: "desktop/architecture" },
    ],
    command: "scripts/new.sh Acme ~/Dev/acme --template sidebar",
    snippet: {
      file: "crates/app/src/root.rs",
      language: "rust",
      source: `bridge::stream(
    cx,
    move |tx| async move {
        // A closed receiver means the view is gone; returning false stops us.
        let _ = host.stream_events(|event| tx.unbounded_send(event).is_ok()).await;
    },
    move |_event, cx| state.bump(cx),   // coalesce: bump an epoch, refetch once
    |_| {},
);`,
    },
    reading: [
      { title: "Desktop architecture", slug: "desktop/architecture" },
      { title: "Gotchas", slug: "desktop/gotchas" },
    ],
  },
  {
    n: 28,
    kind: "ending",
    field: "desktop",
    plate: "Plate 28",
    title: "The workspace",
    lede: "A home screen where you choose, and a workspace where you work. The two-scope shape, and the one that is worth understanding before you change anything.",
    body: [
      "`AppState` is provided by the root and lives for the whole process. `WorkspaceState` is provided by the workspace view and lives only while a project is open — its entries, its selection, its active tab.",
      "The root drops the workspace entity when the route goes home. That is what stops a closed project's state leaking into the next one, and what stops an in-flight load landing in a view that has moved on. Settings stay at the root, because ⌘, has to work on the home screen too.",
    ],
    stack: [
      { name: "model", why: "The project, and what a project contains.", slug: "desktop/architecture" },
      { name: "store", why: "Projects on disk, one JSON document.", slug: "desktop/architecture" },
      { name: "host", why: "Owns the active-project cursor, not the UI.", slug: "desktop/architecture" },
      { name: "app", why: "Home ⇄ workspace routing, two state scopes.", slug: "desktop/architecture" },
    ],
    command: "scripts/new.sh Acme ~/Dev/acme --template workspace",
    snippet: {
      file: "crates/app/src/root.rs",
      language: "rust",
      source: `match self.state.route.get(cx) {
    Route::Home => {
        // Dropping the entity here is what stops a closed project's signals
        // and in-flight loads from outliving it.
        self.workspace = None;
        div().size_full().child(self.home.clone())
    }
    Route::Workspace(id) => match self.state.host.active().filter(|p| p.id == id) {
        Some(project) => div().size_full().child(self.workspace_for(project, cx)),
        // The route says open and the host disagrees. An empty workspace
        // would strand the user, so fall back rather than render nothing.
        None => { self.state.route.set(cx, Route::Home); div().size_full().child(self.home.clone()) }
    },
}`,
    },
    reading: [
      { title: "Desktop architecture", slug: "desktop/architecture" },
      { title: "Scaffolding", slug: "desktop/scaffolding" },
    ],
  },
  {
    n: 86,
    kind: "ending",
    field: "desktop",
    plate: "Plate 86",
    title: "The workspace with a keychain",
    lede: "Each project carries a credential. That credential does not go in the JSON file, and this is the passage that exists to say so.",
    body: [
      "`projects.json` gets synced, backed up, copied into a bug report, and read by anything on the machine. Secrets go to the OS keychain, keyed per project, and are deleted when the project is forgotten — an orphan keychain entry is the kind of thing nobody notices until a security review.",
      "One trap, and it is silent: **the macOS keychain hex-encodes a value containing a newline**, which corrupts it on read. `Keychain::put_json` writes single-line JSON and asserts it in debug builds for exactly this reason.",
    ],
    stack: [
      { name: "store::Keychain", why: "One service per app, one entry per key.", slug: "desktop/architecture" },
      { name: "host", why: "The facade that opens the project and holds the cursor.", slug: "desktop/architecture" },
      { name: "app", why: "Home ⇄ workspace, two state scopes.", slug: "desktop/architecture" },
    ],
    command: "scripts/new.sh Acme ~/Dev/acme --template workspace",
    snippet: {
      file: "crates/store/src/lib.rs",
      language: "rust",
      source: `impl Store {
    /// A project's secret. Never projects.json — that file gets synced,
    /// backed up, and pasted into bug reports.
    pub fn secret(&self, project_id: &str) -> Option<String> {
        self.inner.keychain().get(&format!("project.{project_id}"))
    }

    pub fn save_secret(&self, project_id: &str, secret: &str) -> bool {
        self.inner.keychain().put(&format!("project.{project_id}"), secret)
    }

    /// Called when a project is forgotten. An orphan entry outlives the app.
    pub fn drop_secret(&self, project_id: &str) {
        self.inner.keychain().delete(&format!("project.{project_id}"));
    }
}`,
    },
    reading: [
      { title: "Desktop architecture", slug: "desktop/architecture" },
      { title: "Gotchas", slug: "desktop/gotchas" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Appendices — reachable from every ending
// ---------------------------------------------------------------------------

const appendices: readonly Passage[] = [
  {
    n: 100,
    kind: "appendix",
    field: "web",
    plate: "Appendix A",
    title: "Putting it online",
    lede: "The part that is usually a second stack: a certificate, a renewal, a proxy, and a `nginx.conf` nobody wants to own.",
    body: [
      "`@atlas/edge` is all four. It terminates TLS, issues and renews Let's Encrypt certificates automatically thirty days before expiry, compresses, and proxies to your app — so the compose file loses its Caddy sidecar entirely.",
      "In development with no `DOMAIN` set it detects localhost and serves plain HTTP on `:8080`. No certificates, no sudo, no separate dev path to get wrong.",
      "On the first production boot, run once with `ACME_STAGING=1`. Let's Encrypt allows five failures per hostname per hour and a wrong DNS record spends that in a minute. Staging certs show as untrusted in the browser — that is what they are for. Then clear the cert volume and restart without it.",
    ],
    choices: [
      { label: "Read the edge reference", to: "/docs/edge/" },
      { label: "Back to the start", to: 1 },
    ],
  },
  {
    n: 101,
    kind: "appendix",
    field: "desktop",
    plate: "Appendix B",
    title: "Signing and shipping",
    lede: "A version bump on `main` is the release. Everything below happens without you watching it.",
    body: [
      "The workflow tags it, publishes the notes from `CHANGELOG.md`, and builds a signed and notarized `.app` and `.dmg`, `.tar.gz`/`.deb`/`.AppImage` for x86_64 and aarch64, and `.zip`/`.msi` with Scoop and Chocolatey manifests. Then it rewrites the Homebrew cask.",
      "Signing credentials are optional — without them every job still runs and produces ad-hoc artifacts with a warning, so a fork keeps building.",
      "Two things that bite. **`assets/entitlements.plist` is not optional**: gpui JITs its Metal shaders, so a hardened-runtime build without `allow-jit` notarizes cleanly and then crashes on first paint. And **check the staple, not the signature** — a signed-but-not-notarized build looks identical until a stranger downloads it. `xcrun stapler validate` and `spctl -a -vvv -t install` are the two commands that actually answer.",
      "Set the Developer ID team in `update.rs`. Without it guise refuses to execute a downloaded bundle and opens the release page instead — an app that ships notarized builds and forgets this has quietly lost its own update path.",
    ],
    choices: [
      { label: "Read the release guide", to: "/docs/desktop/release/" },
      { label: "Read the packaging guide", to: "/docs/desktop/packaging/" },
      { label: "Back to the start", to: 1 },
    ],
  },
  {
    n: 102,
    kind: "appendix",
    field: "both",
    plate: "Appendix C",
    title: "Handing it to an agent",
    lede: "Whatever you built, something that is not a person is going to read it. Atlas is written on the assumption that this is normal.",
    body: [
      "Every page on this site has a Markdown alternate at the same URL plus `index.md`, advertised in the HTML as `rel=alternate`. `llms.txt` is the concise index; `llms-full.txt` is the entire corpus in one fetch when context is cheap and a round trip is not.",
      "`docs/agents.md` is the grounding guide: what order to read things in, which package to reach for, what is safe to mutate, and how to verify. Point an agent there first and it will stop guessing at APIs.",
      "In a repository, `atlas docs <package>` prints the canonical source to stdout, and `@atlas/mcp` exposes `docs.list` and `docs.read` as always-on tools — with or without an application context. On the desktop side, every template ships an `AGENTS.md` describing its own layering and the traps that look like bugs.",
    ],
    choices: [
      { label: "Read the agent guide", to: "/docs/agents/" },
      { label: "Fetch llms.txt", to: "/llms.txt" },
      { label: "Back to the start", to: 1 },
    ],
  },
];

export const passages: readonly Passage[] = [
  ...opening,
  ...webForks,
  ...desktopForks,
  ...webEndings,
  ...desktopEndings,
  ...appendices,
];

export const bySection: ReadonlyMap<number, Passage> = new Map(passages.map((p) => [p.n, p]));

/** Where an ending sends you next, by which half of Atlas it belongs to. */
export const onward = (passage: Passage): readonly Choice[] => {
  if (passage.kind !== "ending") return [];
  const ship: Choice =
    passage.field === "desktop"
      ? { label: "Sign it and ship it", to: 101, note: "Appendix B" }
      : { label: "Put it online", to: 100, note: "Appendix A" };
  return [
    ship,
    { label: "Hand it to an agent", to: 102, note: "Appendix C" },
    { label: "Walk it again from the start", to: 1 },
  ];
};

/**
 * Every choice must land somewhere. A gamebook with a dangling "turn to §51"
 * is a book you cannot finish, and the only moment this is cheap to catch is
 * at build time.
 */
export const validate = (): void => {
  const seen = new Set<number>();
  for (const passage of passages) {
    if (seen.has(passage.n)) throw new Error(`section §${passage.n} is defined twice`);
    seen.add(passage.n);
  }
  for (const passage of passages) {
    const outgoing = [...(passage.choices ?? []), ...onward(passage)];
    for (const choice of outgoing) {
      if (typeof choice.to === "number" && !seen.has(choice.to)) {
        throw new Error(`§${passage.n} sends the reader to §${choice.to}, which does not exist`);
      }
    }
    if (passage.kind !== "ending" && (passage.choices?.length ?? 0) === 0) {
      throw new Error(`§${passage.n} is a dead end: no choices and not an ending`);
    }
  }

  // Everything except the opening has to be reachable, or it is written but
  // unreadable — which is worse than not written.
  const reachable = new Set<number>([1]);
  const queue: number[] = [1];
  while (queue.length > 0) {
    const n = queue.shift() as number;
    const passage = bySection.get(n);
    if (!passage) continue;
    for (const choice of [...(passage.choices ?? []), ...onward(passage)]) {
      if (typeof choice.to === "number" && !reachable.has(choice.to)) {
        reachable.add(choice.to);
        queue.push(choice.to);
      }
    }
  }
  const stranded = passages.filter((p) => !reachable.has(p.n)).map((p) => `§${p.n}`);
  if (stranded.length > 0) throw new Error(`unreachable sections: ${stranded.join(", ")}`);
};
