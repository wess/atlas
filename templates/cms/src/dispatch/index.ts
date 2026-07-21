import { from } from "@atlas/db"
import { request } from "@atlas/request"
import { db } from "../db.ts"
import { webhooks } from "../schema.ts"

const signPayload = async (payload: string, secret: string): Promise<string> => {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ])
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export const dispatchWebhooks = async (event: string, data: unknown): Promise<void> => {
  const hooks = await db.all(from(webhooks).where((q) => q("active").equals(1)))
  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() })

  for (const hook of hooks) {
    const events: string[] = typeof hook.events === "string" ? JSON.parse(hook.events) : []
    if (!events.includes(event)) continue

    const signature = await signPayload(payload, hook.secret)

    request(hook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": signature,
        "x-webhook-event": event,
      },
      body: payload,
      timeout: 10_000,
    }).catch(() => {
      // webhook delivery is best-effort
    })
  }
}
