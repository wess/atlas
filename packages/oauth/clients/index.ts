import type { Connection } from "@atlas/db";
import { from } from "@atlas/db";
import type { Route } from "@atlas/server";
import { del, get, json, parseJson, patch, pipeline, post } from "@atlas/server";
import { randomId, sha256, sha256Equal, shortId } from "../helpers";
import { authIdOf, type ClientRow, ctxOf, logAudit, type OAuthConfig, resolveTables } from "../types.ts";

const parseJsonArray = (v: string | string[] | null | undefined): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const validateRedirectUris = (uris: unknown): { ok: true; uris: string[] } | { ok: false; error: string } => {
  if (!Array.isArray(uris) || uris.length === 0) {
    return { ok: false, error: "redirect_uris must be a non-empty array" };
  }
  for (const uri of uris) {
    if (typeof uri !== "string" || uri.length === 0) {
      return { ok: false, error: "Every redirect_uri must be a non-empty string" };
    }
    // Allow http(s) and custom schemes (e.g. butter://callback). Reject obvious garbage.
    if (!/^[a-z][a-z0-9+.-]*:/i.test(uri)) {
      return { ok: false, error: `Invalid redirect_uri: ${uri}` };
    }
  }
  return { ok: true, uris: uris as string[] };
};

const validateScopes = (
  scopes: unknown,
  supported: readonly string[],
): { ok: true; scopes: string[] } | { ok: false; error: string } => {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return { ok: false, error: `allowed_scopes must be a non-empty array. Supported: ${supported.join(", ")}` };
  }
  for (const s of scopes) {
    if (typeof s !== "string" || !supported.includes(s)) {
      return { ok: false, error: `Unknown scope: ${s}. Supported: ${supported.join(", ")}` };
    }
  }
  return { ok: true, scopes: scopes as string[] };
};

const toPublicClient = (row: ClientRow) => ({
  id: row.id,
  client_id: row.client_id,
  name: row.name,
  description: row.description,
  icon_url: row.icon_url,
  redirect_uris: parseJsonArray(row.redirect_uris),
  allowed_scopes: parseJsonArray(row.allowed_scopes),
  is_official: row.is_official,
  is_public_client: row.client_secret_hash === null,
  created_at: row.created_at,
  revoked_at: row.revoked_at,
});

/**
 * Verify that a client secret presented at the token endpoint matches the one
 * stored hashed on the client row. Public clients (no stored secret) skip
 * verification — PKCE is the proof-of-possession instead.
 */
export const verifyClientCredentials = (
  client: Pick<ClientRow, "client_secret_hash">,
  providedSecret: string | undefined,
): boolean => {
  if (!client.client_secret_hash) return true;
  if (!providedSecret) return false;
  return sha256Equal(sha256(providedSecret), client.client_secret_hash);
};

/** Look up a client row by `client_id`. */
export const findClient = async (db: Connection, table: string, clientId: string): Promise<ClientRow | null> =>
  (await db.one(from(table).where((q) => q("client_id").equals(clientId)))) as ClientRow | null;

/**
 * Admin-only routes for managing OAuth clients. Mounted under `/admin/oauth`
 * by default — change the prefix by setting `basePath`.
 */
export const oauthClientRoutes = (cfg: OAuthConfig, basePath = "/admin/oauth"): readonly Route[] => {
  const tables = resolveTables(cfg);
  const authId = authIdOf(cfg);
  const ctx = ctxOf(cfg);
  const guard = pipeline(cfg.requireAdmin);
  const authed = pipeline(cfg.requireAdmin, parseJson);

  return [
    get(
      `${basePath}/clients`,
      guard(async (c) => {
        const rows = (await cfg.db.execute(from(tables.clients).orderBy("created_at", "DESC"))) as ClientRow[];
        return json(c, 200, rows.map(toPublicClient));
      }),
    ),

    post(
      `${basePath}/clients`,
      authed(async (c) => {
        const userId = authId(c);
        const body = c.body as {
          name?: string;
          description?: string;
          icon_url?: string;
          redirect_uris?: unknown;
          allowed_scopes?: unknown;
          is_official?: boolean;
          is_public_client?: boolean;
        };
        const name = body.name?.trim();
        if (!name) return json(c, 422, { error: "name is required" });

        const uris = validateRedirectUris(body.redirect_uris);
        if (!uris.ok) return json(c, 422, { error: uris.error });
        const scopes = validateScopes(body.allowed_scopes, cfg.scopes);
        if (!scopes.ok) return json(c, 422, { error: scopes.error });

        const clientId = shortId();
        const isPublic = body.is_public_client !== false; // default to public (PKCE)
        const secretRaw = isPublic ? null : `cs_${randomId(32)}`;
        const secretHash = secretRaw ? sha256(secretRaw) : null;

        const inserted = (await cfg.db.execute(
          from(tables.clients)
            .insert({
              client_id: clientId,
              client_secret_hash: secretHash,
              name,
              description: body.description?.trim() || null,
              icon_url: body.icon_url?.trim() || null,
              redirect_uris: JSON.stringify(uris.uris),
              allowed_scopes: JSON.stringify(scopes.scopes),
              is_official: !!body.is_official,
              created_by: userId,
            })
            .returning(
              "id",
              "client_id",
              "client_secret_hash",
              "name",
              "description",
              "icon_url",
              "redirect_uris",
              "allowed_scopes",
              "is_official",
              "created_at",
              "revoked_at",
            ),
        )) as ClientRow[];

        const requestCtx = ctx(c.request);
        logAudit(cfg, {
          userId,
          event: "oauth.client_created",
          metadata: { client_id: clientId, name, scopes: scopes.scopes, is_official: !!body.is_official },
          ip: requestCtx.ip ?? null,
          userAgent: requestCtx.userAgent ?? null,
        });

        return json(c, 201, {
          ...toPublicClient(inserted[0]!),
          // Secret is returned exactly once at creation, only for confidential clients.
          ...(secretRaw ? { client_secret: secretRaw } : {}),
        });
      }),
    ),

    patch(
      `${basePath}/clients/:id`,
      authed(async (c) => {
        const id = Number(c.params.id);
        const body = c.body as {
          name?: string;
          description?: string;
          icon_url?: string;
          redirect_uris?: unknown;
          allowed_scopes?: unknown;
          is_official?: boolean;
        };
        const update: Record<string, unknown> = {};
        if (typeof body.name === "string") update.name = body.name.trim();
        if (typeof body.description === "string") update.description = body.description.trim() || null;
        if (typeof body.icon_url === "string") update.icon_url = body.icon_url.trim() || null;
        if (body.redirect_uris !== undefined) {
          const r = validateRedirectUris(body.redirect_uris);
          if (!r.ok) return json(c, 422, { error: r.error });
          update.redirect_uris = JSON.stringify(r.uris);
        }
        if (body.allowed_scopes !== undefined) {
          const s = validateScopes(body.allowed_scopes, cfg.scopes);
          if (!s.ok) return json(c, 422, { error: s.error });
          update.allowed_scopes = JSON.stringify(s.scopes);
        }
        if (typeof body.is_official === "boolean") update.is_official = body.is_official;

        if (Object.keys(update).length === 0) return json(c, 422, { error: "Nothing to update" });

        await cfg.db.execute(
          from(tables.clients)
            .where((q) => q("id").equals(id))
            .update(update),
        );

        const fresh = (await cfg.db.one(from(tables.clients).where((q) => q("id").equals(id)))) as ClientRow | null;
        if (!fresh) return json(c, 404, { error: "Client not found" });

        const requestCtx = ctx(c.request);
        logAudit(cfg, {
          userId: authId(c),
          event: "oauth.client_updated",
          metadata: { client_id: fresh.client_id, fields: Object.keys(update) },
          ip: requestCtx.ip ?? null,
          userAgent: requestCtx.userAgent ?? null,
        });

        return json(c, 200, toPublicClient(fresh));
      }),
    ),

    post(
      `${basePath}/clients/:id/rotate-secret`,
      guard(async (c) => {
        const id = Number(c.params.id);
        const row = (await cfg.db.one(
          from(tables.clients)
            .where((q) => q("id").equals(id))
            .select("client_id", "client_secret_hash", "revoked_at"),
        )) as { client_id: string; client_secret_hash: string | null; revoked_at: string | null } | null;
        if (!row) return json(c, 404, { error: "Client not found" });
        if (row.revoked_at) return json(c, 409, { error: "Client is revoked" });
        if (!row.client_secret_hash) {
          return json(c, 409, { error: "Public clients have no secret to rotate" });
        }

        const newSecret = `cs_${randomId(32)}`;
        const hash = sha256(newSecret);
        const now = new Date().toISOString();
        await cfg.db.execute(
          from(tables.clients)
            .where((q) => q("id").equals(id))
            .update({ client_secret_hash: hash }),
        );
        // Force re-auth: every existing refresh token for this client is now stale.
        await cfg.db.execute(
          from(tables.refreshTokens)
            .where((q) => q("client_id").equals(row.client_id))
            .where((q) => q("revoked_at").isNull())
            .update({ revoked_at: now }),
        );

        const requestCtx = ctx(c.request);
        logAudit(cfg, {
          userId: authId(c),
          event: "oauth.client_secret_rotated",
          metadata: { client_id: row.client_id },
          ip: requestCtx.ip ?? null,
          userAgent: requestCtx.userAgent ?? null,
        });

        return json(c, 200, { client_id: row.client_id, client_secret: newSecret });
      }),
    ),

    del(
      `${basePath}/clients/:id`,
      guard(async (c) => {
        const id = Number(c.params.id);
        const row = (await cfg.db.one(
          from(tables.clients)
            .where((q) => q("id").equals(id))
            .select("client_id"),
        )) as { client_id: string } | null;
        if (!row) return json(c, 404, { error: "Client not found" });

        const now = new Date().toISOString();
        // Mark revoked + cascade-invalidate every refresh token for this client.
        await cfg.db.execute(
          from(tables.clients)
            .where((q) => q("id").equals(id))
            .update({ revoked_at: now }),
        );
        await cfg.db.execute(
          from(tables.refreshTokens)
            .where((q) => q("client_id").equals(row.client_id))
            .where((q) => q("revoked_at").isNull())
            .update({ revoked_at: now }),
        );

        const requestCtx = ctx(c.request);
        logAudit(cfg, {
          userId: authId(c),
          event: "oauth.client_revoked",
          metadata: { client_id: row.client_id },
          ip: requestCtx.ip ?? null,
          userAgent: requestCtx.userAgent ?? null,
        });

        return json(c, 200, { revoked: id });
      }),
    ),
  ];
};
