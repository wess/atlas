// models/ and records/ namespace the screens, so a table called "query" or "api" or a record
// called "new" can never collide with another screen
export type AdminRoute =
  | { name: "dashboard" }
  | { name: "login" }
  | { name: "query" }
  | { name: "list"; table: string }
  | { name: "create"; table: string }
  | { name: "detail"; table: string; id: string }
  | { name: "notfound" };

const segment = encodeURIComponent;

export const paths = {
  dashboard: "",
  login: "login",
  query: "query",
  list: (table: string) => `models/${segment(table)}`,
  create: (table: string) => `models/${segment(table)}/new`,
  detail: (table: string, id: string | number) => `models/${segment(table)}/records/${segment(String(id))}`,
};

export const hrefFor = (basePath: string, path: string) => (path ? `${basePath}/${path}` : basePath || "/");

const decodeParts = (relative: string) => {
  try {
    return relative.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
};

export const parseRoute = (pathname: string, basePath: string): AdminRoute => {
  if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return { name: "notfound" };
  const parts = decodeParts(pathname.slice(basePath.length));
  if (!parts) return { name: "notfound" };
  const [first, table, third, id, ...rest] = parts;
  if (!first) return { name: "dashboard" };
  if (first === "query" && !table) return { name: "query" };
  if (first === "login" && !table) return { name: "login" };
  if (first !== "models" || !table || rest.length) return { name: "notfound" };
  if (!third) return { name: "list", table };
  if (third === "new" && !id) return { name: "create", table };
  if (third === "records" && id) return { name: "detail", table, id };
  return { name: "notfound" };
};
