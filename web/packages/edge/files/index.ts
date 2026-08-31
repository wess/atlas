import { join, normalize } from "node:path";

export type FilesOptions = {
  readonly root: string;
  readonly index?: string;
  readonly stripPrefix?: string;
};

const safeJoin = (root: string, sub: string): string | null => {
  const cleaned = normalize(sub).replace(/^(\.\.[/\\])+/, "");
  const out = normalize(join(root, cleaned));
  if (!out.startsWith(normalize(root))) return null;
  return out;
};

export const files =
  (options: FilesOptions) =>
  async (req: Request, _ctx: { remoteIp: string; tls: boolean; host: string }): Promise<Response> => {
    const url = new URL(req.url);
    let pathname = url.pathname;
    if (options.stripPrefix && pathname.startsWith(options.stripPrefix)) {
      pathname = pathname.slice(options.stripPrefix.length);
    }
    if (pathname.endsWith("/")) pathname += options.index ?? "index.html";

    const resolved = safeJoin(options.root, pathname);
    if (!resolved) return new Response("Not Found", { status: 404 });

    const file = Bun.file(resolved);
    if (!(await file.exists())) return new Response("Not Found", { status: 404 });

    const headers = new Headers();
    if (file.type) headers.set("content-type", file.type);
    return new Response(file, { status: 200, headers });
  };
