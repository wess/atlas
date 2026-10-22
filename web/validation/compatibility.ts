export const migrateCompatibility = (app: string, path: string, text: string): string => {
  if (!["pluck", "standinghere"].includes(app)) return text;
  if (path === "web/src/auth/social.ts") {
    if (!text.includes("createMemoryIntentStore,"))
      text = text.replace("  apple,", "  apple,\n  createMemoryIntentStore,");
    if (!text.includes("intentStore: createMemoryIntentStore()")) {
      text = text.replace(
        /return socialAuth\(\{\n\s*secret,\n\s*providers,/,
        "return socialAuth({\n    secret,\n    providers,\n    intentStore: createMemoryIntentStore(),",
      );
    }
    text = text.replace(
      /\/\/ the error path runs[^\n]*\n\/\/[^\n]*\n/,
      "// recover only a server-held redirect hint; provider state stays opaque\n",
    );
    text = text.replace(
      /const intentFromUnverifiedState = \(c: Conn\): string => \{[\s\S]*?\n\}/,
      'const intentReturn = (value?: string): string => {\n  try {\n    return safeReturn((JSON.parse(value ?? "{}") as Intent).r)\n  } catch {\n    return "/app"\n  }\n}',
    );
    text = text.replace("onError: async (c, err) =>", "onError: async (c, err, context) =>");
    text = text.replace("intentFromUnverifiedState(c)", "intentReturn(context.returnTo)");
    if (!text.includes("intentStore: createMemoryIntentStore()") || text.includes("state.split(")) {
      throw new Error(`${app}: OAuth intent migration did not match source`);
    }
  }
  if (app === "pluck" && ["web/tests/social.test.ts", "web/tests/apple.test.ts"].includes(path)) {
    text = text.replace(/import \{([^}]+)\} from "@wess\/atlas\/auth\/social"/, (original, names: string) =>
      names.includes("createMemoryIntentStore")
        ? original
        : `import { createMemoryIntentStore, ${names.trim()} } from "@wess/atlas/auth/social"`,
    );
    text = text.replace(/socialAuth\(\{(?!\s*intentStore:)/g, "socialAuth({ intentStore: createMemoryIntentStore(),");
    text = text.replace(
      'const payload = JSON.parse(Buffer.from(state.split(".")[1]!, "base64url").toString("utf8"))',
      'expect(state).not.toContain(".")\n    const privateState = start.headers.getSetCookie().find(value => value.startsWith("_atlas_oauth_state="))!.split(";")[0]!.split("=")[1]!\n    const payload = JSON.parse(Buffer.from(privateState.split(".")[1]!, "base64url").toString("utf8"))',
    );
  }
  if (app === "pluck" && path === "web/tests/apple.test.ts" && !text.includes("const deniedStart =")) {
    text = text.replace(
      "    const failed = await handle(",
      '    const deniedStart = await handle(new Request("http://localhost:4500/auth/apple?return_to=pluck://auth/callback&client=ios"))\n    const deniedState = new URL(deniedStart.headers.get("location")!).searchParams.get("state")!\n    const failed = await handle(',
    );
    text = text.replace(
      'new URLSearchParams({ error: "access_denied", state })',
      'new URLSearchParams({ error: "access_denied", state: deniedState })',
    );
  }
  return text;
};
