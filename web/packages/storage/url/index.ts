export const uriEncode = (value: string): string =>
  encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");

export const canonicalPath = (url: URL): string =>
  url.pathname
    .split("/")
    .map((segment) => uriEncode(decodeURIComponent(segment)))
    .join("/") || "/";

export const objectUrl = (store: { endpoint: string; bucket: string }, key: string): URL => {
  if (!store.bucket || /[/\\?#]/.test(store.bucket) || [".", ".."].includes(store.bucket)) {
    throw new Error("Invalid storage bucket name");
  }
  const segments = key.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Storage object keys must not contain dot path segments");
  }
  return new URL(`/${uriEncode(store.bucket)}/${segments.map(uriEncode).join("/")}`, store.endpoint);
};
