export const verifySignature = async (
  body: string,
  header: string,
  secret: string,
  options: { now?: number; tolerance?: number } = {},
): Promise<boolean> => {
  if (!secret) return false;
  const parts = header.split(",").map((part) => part.trim().split("=", 2));
  const timestamps = parts.filter(([name]) => name === "t");
  const timestamp = timestamps[0]?.[1];
  const tolerance = options.tolerance ?? 300;
  if (
    timestamps.length !== 1 ||
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    !Number.isSafeInteger(Number(timestamp)) ||
    !Number.isFinite(tolerance) ||
    tolerance <= 0 ||
    Math.abs((options.now ?? Date.now() / 1000) - Number(timestamp)) > tolerance
  )
    return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const payload = new TextEncoder().encode(`${timestamp}.${body}`);
  for (const [name, value] of parts) {
    if (name !== "v1" || !value || !/^[a-f\d]{64}$/i.test(value)) continue;
    const bytes = Uint8Array.from(value.match(/../g)!, (pair) => Number.parseInt(pair, 16));
    if (await crypto.subtle.verify("HMAC", key, bytes, payload)) return true;
  }
  return false;
};
