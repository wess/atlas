export type Guide = {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly source: string;
};

export type PackageDoc = Guide & {
  readonly group: "foundation" | "identity" | "network" | "service" | "interface";
  readonly x: number;
  readonly y: number;
};

export const guides: readonly Guide[] = [
  {
    slug: "overview",
    title: "Architecture overview",
    description: "The package graph, design philosophy, and the boundaries between modules.",
    source: "docs/overview.md",
  },
  {
    slug: "quickstart",
    title: "Quick start",
    description: "Build an authenticated application with storage and an admin surface.",
    source: "docs/quickstart.md",
  },
  {
    slug: "api",
    title: "API reference",
    description: "A condensed, cross-package lookup for exports, types, and signatures.",
    source: "docs/api.md",
  },
  {
    slug: "cookbook",
    title: "Cookbook",
    description: "Practical recipes for common application patterns and edge cases.",
    source: "docs/cookbook.md",
  },
  {
    slug: "readme",
    title: "Project readme",
    description: "Installation, package inventory, templates, and development commands.",
    source: "README.md",
  },
];

export const packages: readonly PackageDoc[] = [
  {
    slug: "config",
    title: "@wess/atlas/config",
    description: "Typed environment variables and immutable configuration.",
    source: "packages/config/AGENTS.md",
    group: "foundation",
    x: 48,
    y: 10,
  },
  {
    slug: "db",
    title: "@wess/atlas/db",
    description: "Query building, schemas, changesets, and Postgres or SQLite drivers.",
    source: "packages/db/AGENTS.md",
    group: "foundation",
    x: 24,
    y: 24,
  },
  {
    slug: "server",
    title: "@wess/atlas/server",
    description: "Pipe-based HTTP, typed routes, WebSockets, and server-sent events.",
    source: "packages/server/AGENTS.md",
    group: "network",
    x: 76,
    y: 20,
  },
  {
    slug: "auth",
    title: "@wess/atlas/auth",
    description: "Passwords, JWTs, sessions, auth flows, and social sign-in.",
    source: "packages/auth/AGENTS.md",
    group: "identity",
    x: 60,
    y: 32,
  },
  {
    slug: "security",
    title: "@wess/atlas/security",
    description: "Headers, rate limiting, audit logs, TOTP, and revocable sessions.",
    source: "packages/security/AGENTS.md",
    group: "identity",
    x: 50,
    y: 46,
  },
  {
    slug: "oauth",
    title: "@wess/atlas/oauth",
    description: "An OAuth 2.1 server with PKCE, refresh rotation, and device flow.",
    source: "packages/oauth/AGENTS.md",
    group: "identity",
    x: 75,
    y: 43,
  },
  {
    slug: "request",
    title: "@wess/atlas/request",
    description: "A fetch client with retries, interceptors, and provider presets.",
    source: "packages/request/AGENTS.md",
    group: "network",
    x: 90,
    y: 47,
  },
  {
    slug: "storage",
    title: "@wess/atlas/storage",
    description: "S3-compatible object operations and presigned URLs.",
    source: "packages/storage/AGENTS.md",
    group: "service",
    x: 12,
    y: 45,
  },
  {
    slug: "cache",
    title: "@wess/atlas/cache",
    description: "Redis caching, memory stores, TTLs, and cache-aside helpers.",
    source: "packages/cache/AGENTS.md",
    group: "service",
    x: 31,
    y: 48,
  },
  {
    slug: "cli",
    title: "@wess/atlas/cli",
    description: "Commands, scaffolding, documentation lookup, and Foreman.",
    source: "packages/cli/AGENTS.md",
    group: "interface",
    x: 19,
    y: 66,
  },
  {
    slug: "ui",
    title: "@wess/atlas/ui",
    description: "React and Mantine blocks for forms, tables, auth, and more.",
    source: "packages/ui/AGENTS.md",
    group: "interface",
    x: 45,
    y: 67,
  },
  {
    slug: "admin",
    title: "@wess/atlas/admin",
    description: "Schema-driven CRUD routes and a generated administration UI.",
    source: "packages/admin/AGENTS.md",
    group: "interface",
    x: 69,
    y: 67,
  },
  {
    slug: "mcp",
    title: "@wess/atlas/mcp",
    description: "Application introspection and Atlas documentation over MCP.",
    source: "packages/mcp/AGENTS.md",
    group: "interface",
    x: 89,
    y: 74,
  },
  {
    slug: "ai",
    title: "@wess/atlas/ai",
    description: "Providers, chat, embeddings, RAG, agents, and streaming.",
    source: "packages/ai/AGENTS.md",
    group: "service",
    x: 12,
    y: 84,
  },
  {
    slug: "edge",
    title: "@wess/atlas/edge",
    description: "A TLS reverse proxy with built-in Let's Encrypt automation.",
    source: "packages/edge/AGENTS.md",
    group: "network",
    x: 34,
    y: 84,
  },
  {
    slug: "email",
    title: "@wess/atlas/email",
    description: "Provider-agnostic email delivery and account templates.",
    source: "packages/email/AGENTS.md",
    group: "service",
    x: 53,
    y: 84,
  },
  {
    slug: "share",
    title: "@wess/atlas/share",
    description: "Social share URLs and server-side share-by-email.",
    source: "packages/share/AGENTS.md",
    group: "service",
    x: 72,
    y: 85,
  },
  {
    slug: "sso",
    title: "@wess/atlas/sso",
    description: "An OIDC relying party for signing in with an identity provider.",
    source: "packages/sso/AGENTS.md",
    group: "identity",
    x: 26,
    y: 96,
  },
  {
    slug: "migrate",
    title: "@wess/atlas/migrate",
    description: "Timestamped SQL migrations and schema-diff generation.",
    source: "packages/migrate/AGENTS.md",
    group: "foundation",
    x: 62,
    y: 96,
  },
];

export const docs = [...guides, ...packages] as const;
