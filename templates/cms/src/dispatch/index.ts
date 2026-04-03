import { request } from "@atlas/request"
import { db } from "../db.ts"
import { config } from "../config.ts"

const signPayload = async (payload: string, secret: string): Promise<string> => {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export const dispatchWebhooks = async (event: string, data: unknown) => {
  const rows = await db.query(
    "select id, url, events, secret from webhooks where active = 1",
  )

  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() })

  for (const webhook of rows) {
    const events = typeof webhook.events === "string"
      ? JSON.parse(webhook.events)
      : webhook.events

    if (!events.includes(event)) continue

    const signature = await signPayload(payload, webhook.secret)

    request(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": event,
      },
      body: payload,
      timeout: config.webhookTimeout,
    }).catch(() => {
      /* webhook delivery is best-effort */
    })
  }
}
