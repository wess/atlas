const authModules: Record<string, string> = {
  hash: "password",
  verify: "password",
  createMemoryStore: "session",
  SessionStore: "session",
  login: "flows",
  signup: "flows",
  requireAuth: "flows",
  passwordReset: "flows",
  Jwk: "token",
  Jwks: "token",
  Rs256KeyPair: "token",
  TokenPayload: "token",
  generateRs256KeyPair: "token",
  publicJwkOf: "token",
  apple: "social",
  facebook: "social",
  github: "social",
  google: "social",
  microsoft: "social",
  socialAuth: "social",
  tiktok: "social",
  twitter: "social",
};

export const canonicalImport = (name: string): string => {
  name = name.replace(/^(?:@atlas\/|atlas\/)/, "@wess/atlas/");
  if (name.startsWith("@wess/atlas/packages/mcp/")) return "@wess/atlas/mcp";
  return name.replace("@wess/atlas/packages/storage/signing/index.ts", "@wess/atlas/storage/signing");
};

// split only named imports; namespace and dynamic imports retain their explicit aggregate entrypoint
export const migrateImports = (text: string): string => {
  text = text.replace(
    /(["'])((?:@wess\/atlas\/|@atlas\/|atlas\/)[^"']+)\1/g,
    (_, quote: string, name: string) => `${quote}${canonicalImport(name)}${quote}`,
  );
  const driver = [...text.matchAll(/\bdriver:\s*["'](postgres|sqlite)["']/g)].map((match) => match[1]);
  const database = driver.length && driver.every((value) => value === driver[0]) ? driver[0] : undefined;
  return text.replace(
    /import\s+(type\s+)?\{([^}]+)\}\s+from\s*(["'])@wess\/atlas\/(auth|db)\3;?/g,
    (original, typeOnly: string | undefined, clause: string, quote: string, module: string) => {
      const groups = new Map<string, string[]>();
      const lines: string[] = [];
      for (const item of clause
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)) {
        // leave commented imports for manual review rather than damaging a comment or binding
        if (item.includes("/") || !/^(?:type\s+)?\w+(?:\s+as\s+\w+)?$/.test(item)) return original;
        const name = item.replace(/^type\s+/, "").split(/\s+as\s+/)[0]!;
        if (module === "auth" && name === "token" && !typeOnly && !item.startsWith("type ")) {
          const local = item.split(/\s+as\s+/)[1] ?? "token";
          lines.push(`import * as ${local} from ${quote}@wess/atlas/auth/token${quote};`);
          continue;
        }
        const subpath =
          module === "auth"
            ? authModules[name]
            : name === "connect"
              ? database
              : name === "changeset"
                ? "changeset"
                : "query";
        const target = subpath ? `${module}/${subpath}` : module;
        groups.set(target, [...(groups.get(target) ?? []), item]);
      }
      for (const [target, items] of groups) {
        lines.push(`import ${typeOnly ?? ""}{ ${items.join(", ")} } from ${quote}@wess/atlas/${target}${quote};`);
      }
      return lines.join("\n");
    },
  );
};
