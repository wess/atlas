---
name: atlasadmin
description: Add the generated admin panel from @wess/atlas/admin to an Atlas app. Use for CRUD screens from schemas, admin sign-in, list filters and search, relations, custom bulk actions, or mounting the admin under a path.
---

# Atlas admin

CRUD screens, a query builder, and sign-in generated from your schemas. The bundle ships prebuilt, so the server needs no React and no build step.

```ts
import { admin, model } from "@wess/atlas/admin"
import { verify } from "@wess/atlas/auth/password"
import { from } from "@wess/atlas/db/query"
import { serve } from "@wess/atlas/server"

const panel = admin({
  db,
  basePath: "/admin",
  models: [
    model({
      schema: users,
      searchFields: ["email"],
      filterFields: ["active"],
      bulkActions: ["delete", "export"],
      relations: [{ schema: posts, foreignKey: "authorId", label: "Posts" }],
      actions: [
        {
          name: "deactivate",
          label: "Deactivate",
          handler: async (_db, ids) => ({ message: `Deactivated ${ids.length}` }),
        },
      ],
    }),
    model({ schema: posts, readOnly: true }),
  ],
  auth: {
    secret,
    authorize: (claims) => claims.role === "admin",
    login: async ({ email, password }) => {
      const user = await db.one(from(users).where((q) => q("email").equals(email)))
      return user && (await verify(password, user.passwordHash)) ? { userId: user.id, role: user.role } : null
    },
  },
})

serve({ port: 3000, routes: [...panel.routes] })
```

Put your own routes first if any wildcard could overlap. In `relations`, `schema` is the related table and `foreignKey` is its column pointing back at this model.

## Sign-in

- **`login`** checks credentials and returns claims, or null. Claims must pass `authorize` or no session is issued. `authorize` also runs on every request, so removing someone's rights applies immediately.
- **Without `login`,** the screen explains that sign-in isn't set up. Bearer tokens still work for scripts.
- **The session** is an `HttpOnly`, `SameSite=Strict` cookie scoped to `basePath`, `Secure` in production, lasting 8 hours (`sessionSeconds`).
- **Writes** with a cookie must come from the same origin. If a proxy rewrites `Host`, add the public origin to `trustedOrigins`.
- **Signing out** clears the cookie but can't revoke the token, so a copied cookie works until it expires.
- **Attempts** are limited to 10 per email per 15 minutes. Pass `rateLimit: createDbRateLimit({ db })` when running more than one process.
- **Scaffolds:** the `admin` template and `atlas init` admin feature sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

Local development without auth needs an explicit `allowUnauthenticated: true`, which is refused when `NODE_ENV=production`.

## URLs

`/admin`, `/admin/login`, `/admin/query`, `/admin/models/:table`, `/admin/models/:table/new`, `/admin/models/:table/records/:id`. List page, search, sort, and filters are in the query string, and a record's tab is `?tab=`. The API is under `/admin/api/*`, sessions at `/admin/session`, and assets at `/admin/assets/*`.

Own components can be imported from `@wess/atlas/admin/ui`, which keeps React out of server startup.
