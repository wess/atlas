import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export type FilesOptions = {
  readonly root: string;
  readonly index?: string;
  readonly stripPrefix?: string;
};

const isWithin = (root: string, path: string): boolean => {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

export const files =
  (options: FilesOptions) =>
  async (req: Request, _ctx: { remoteIp: string; tls: boolean; host: string }): Promise<Response> => {
    if (req.method !== "GET" && req.method !== "HEAD")
      return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
    const url = new URL(req.url);
    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Not Found", { status: 404 });
    }
    if (pathname.includes("\0") || pathname.includes("\\")) return new Response("Not Found", { status: 404 });
    if (options.stripPrefix && pathname.startsWith(options.stripPrefix)) {
      pathname = pathname.slice(options.stripPrefix.length);
    }
    if (pathname.split("/").some((part) => part.startsWith(".") && part !== ".well-known")) {
      return new Response("Not Found", { status: 404 });
    }
    if (pathname.endsWith("/")) pathname += options.index ?? "index.html";

    const root = resolve(options.root);
    const candidate = resolve(root, `.${pathname.startsWith("/") ? pathname : `/${pathname}`}`);
    if (!isWithin(root, candidate)) return new Response("Not Found", { status: 404 });
    let resolved: string;
    try {
      const actualRoot = await realpath(root);
      resolved = await realpath(candidate);
      if (
        !isWithin(actualRoot, resolved) ||
        relative(actualRoot, resolved)
          .split(/[/\\]/)
          .some((part) => part.startsWith(".") && part !== ".well-known")
      )
        return new Response("Not Found", { status: 404 });
    } catch {
      return new Response("Not Found", { status: 404 });
    }

    const file = Bun.file(resolved);
    if (!(await file.exists())) return new Response("Not Found", { status: 404 });

    const headers = new Headers();
    if (file.type) headers.set("content-type", file.type);
    headers.set("x-content-type-options", "nosniff");
    return new Response(req.method === "HEAD" ? null : file, { status: 200, headers });
  };
