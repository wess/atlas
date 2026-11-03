import type { ApnsConfig, FcmConfig, NotifyMessage, NotifyProvider, NotifyResult } from "./notify";

const encoder = new TextEncoder();
const base64url = (value: string | Uint8Array): string => {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return Buffer.from(bytes).toString("base64url");
};

const pemBytes = (pem: string): ArrayBuffer => {
  const bytes = Uint8Array.from(
    Buffer.from(
      pem
        .replace(/\\n/g, "\n")
        .replace(/-----BEGIN [^-]+-----/g, "")
        .replace(/-----END [^-]+-----/g, "")
        .replace(/\s/g, ""),
      "base64",
    ),
  );
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

const errorResult = async (provider: string, response: Response): Promise<NotifyResult> => {
  const body = await response.text().catch(() => "");
  return {
    ok: false,
    provider,
    status: response.status,
    retryable: response.status === 429 || response.status >= 500,
    error: body.slice(0, 500) || `${response.status} ${response.statusText}`,
  };
};

const caught = (provider: string, error: unknown): NotifyResult => ({
  ok: false,
  provider,
  error: error instanceof Error ? error.message : String(error),
  retryable: true,
});

const jwt = async (
  algorithm: EcKeyImportParams | RsaHashedImportParams,
  signingAlgorithm: EcdsaParams | AlgorithmIdentifier,
  privateKey: string,
  header: Readonly<Record<string, unknown>>,
  claims: Readonly<Record<string, unknown>>,
): Promise<string> => {
  const encoded = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(privateKey), algorithm, false, ["sign"]);
  const input = encoder.encode(encoded);
  const signature = await crypto.subtle.sign(
    signingAlgorithm,
    key,
    input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer,
  );
  return `${encoded}.${base64url(new Uint8Array(signature))}`;
};

export const createApnsProvider = (config: ApnsConfig): NotifyProvider => {
  let token: { readonly value: string; readonly createdAt: number } | undefined;
  const authorization = async (): Promise<string> => {
    const now = Math.floor(Date.now() / 1000);
    if (token && now - token.createdAt < 50 * 60) return token.value;
    const value = await jwt(
      { name: "ECDSA", namedCurve: "P-256" },
      { name: "ECDSA", hash: "SHA-256" },
      config.privateKey,
      { alg: "ES256", kid: config.keyId },
      { iss: config.teamId, iat: now },
    );
    token = { value, createdAt: now };
    return value;
  };

  return {
    name: "apns",
    supports: (destination) => destination.kind === "apns",
    send: async (message) => {
      if (message.to.kind !== "apns") return caught("apns", "Unsupported destination");
      try {
        const topic = message.to.topic?.trim() || config.topic.trim();
        const host = config.production === false ? "api.sandbox.push.apple.com" : "api.push.apple.com";
        const aps = {
          alert: message.title ? { title: message.title, body: message.body } : message.body,
          badge: message.badge,
          sound: message.sound,
          "mutable-content": message.mutableContent ? 1 : undefined,
          "content-available": message.contentAvailable ? 1 : undefined,
        };
        const headers: Record<string, string> = {
          authorization: `bearer ${await authorization()}`,
          "apns-topic": topic,
          "apns-push-type": message.contentAvailable && !message.title ? "background" : "alert",
          "apns-priority": message.priority === "high" ? "10" : "5",
        };
        if (message.collapseKey) headers["apns-collapse-id"] = message.collapseKey;
        if (message.ttlSeconds !== undefined) {
          headers["apns-expiration"] = String(Math.floor(Date.now() / 1000) + message.ttlSeconds);
        }
        const response = await fetch(`https://${host}/3/device/${encodeURIComponent(message.to.token)}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ ...message.data, aps }),
        });
        if (!response.ok) return errorResult("apns", response);
        return { ok: true, provider: "apns", id: response.headers.get("apns-id") ?? undefined };
      } catch (error) {
        return caught("apns", error);
      }
    },
  };
};

export const createFcmProvider = (config: FcmConfig): NotifyProvider => {
  let access: { readonly value: string; readonly expiresAt: number } | undefined;
  const accessToken = async (): Promise<string> => {
    const now = Math.floor(Date.now() / 1000);
    if (access && access.expiresAt - now > 60) return access.value;
    const assertion = await jwt(
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      "RSASSA-PKCS1-v1_5",
      config.privateKey,
      { alg: "RS256", typ: "JWT" },
      {
        iss: config.clientEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      },
    );
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!response.ok) throw new Error((await response.text()).slice(0, 500));
    const body = (await response.json()) as { access_token: string; expires_in?: number };
    access = { value: body.access_token, expiresAt: now + (body.expires_in ?? 3600) };
    return access.value;
  };

  return {
    name: "fcm",
    supports: (destination) => destination.kind === "fcm",
    send: async (message) => {
      if (message.to.kind !== "fcm") return caught("fcm", "Unsupported destination");
      try {
        const target = message.to.token
          ? { token: message.to.token }
          : message.to.topic
            ? { topic: message.to.topic }
            : message.to.condition
              ? { condition: message.to.condition }
              : undefined;
        if (!target) return caught("fcm", "FCM requires a token, topic, or condition");
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${await accessToken()}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              message: {
                ...target,
                notification: { title: message.title, body: message.body, image: message.imageUrl },
                data: message.data,
                android: {
                  collapse_key: message.collapseKey,
                  priority: message.priority === "high" ? "HIGH" : "NORMAL",
                  ttl: message.ttlSeconds === undefined ? undefined : `${message.ttlSeconds}s`,
                },
                apns: {
                  headers: message.collapseKey ? { "apns-collapse-id": message.collapseKey } : undefined,
                  payload: {
                    aps: {
                      badge: message.badge,
                      sound: message.sound,
                      "mutable-content": message.mutableContent ? 1 : undefined,
                      "content-available": message.contentAvailable ? 1 : undefined,
                    },
                  },
                },
              },
            }),
          },
        );
        if (!response.ok) return errorResult("fcm", response);
        const body = (await response.json().catch(() => ({}))) as { name?: string };
        return { ok: true, provider: "fcm", id: body.name };
      } catch (error) {
        return caught("fcm", error);
      }
    },
  };
};

export const createConsoleProvider = (): NotifyProvider => ({
  name: "console",
  supports: () => true,
  send: async (message: NotifyMessage) => {
    console.error("[notify]", JSON.stringify(message));
    return { ok: true, provider: "console", logged: true };
  },
});
