import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { moduleDependencies, version } from "../modules/index.ts";
import { releaseUrl } from "../modules/source.ts";
import type { Answers } from "./questions.ts";

// Template scaffolding

const knownTemplates = [
  "minimal",
  "api",
  "fullstack",
  "admin",
  "worker",
  "realtime",
  "socialnetwork",
  "cms",
  "ai",
  "edge",
];

export const listTemplates = (): string[] => knownTemplates;

const findTemplateDir = (templateName: string): string | null => {
  // Check relative to this file (monorepo layout: packages/cli/init/templates.ts -> templates/)
  const monorepoPath = join(dirname(import.meta.dir), "..", "..", "templates", templateName);
  if (existsSync(monorepoPath)) return monorepoPath;

  return null;
};

const collectFiles = (dir: string, base: string = ""): { rel: string; abs: string }[] => {
  const results: { rel: string; abs: string }[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const abs = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(abs).isDirectory()) {
      results.push(...collectFiles(abs, rel));
    } else {
      results.push({ rel, abs });
    }
  }

  return results;
};

export const scaffoldFromTemplate = async (
  templateName: string,
  projectDir: string,
  projectName: string,
): Promise<void> => {
  const templateDir = knownTemplates.includes(templateName) ? findTemplateDir(templateName) : null;
  if (!templateDir) {
    const available = listTemplates();
    throw new Error(
      `Template "${templateName}" not found. Available templates: ${available.join(", ")}. Use 'atlas init' to see all options.`,
    );
  }

  const files = collectFiles(templateDir);

  for (const file of files) {
    const destPath = join(projectDir, file.rel);
    const destDir = dirname(destPath);
    mkdirSync(destDir, { recursive: true });

    let content = await Bun.file(file.abs).text();
    content = content.replaceAll("{{name}}", projectName);
    if (file.rel === "package.json") {
      const manifest = JSON.parse(content);
      for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
        for (const name of Object.keys(manifest[section] ?? {})) {
          if (/^@wess\/atlas(?:-|$)/.test(name)) manifest[section][name] = releaseUrl(name, version);
        }
      }
      content = `${JSON.stringify(manifest, null, 2)}\n`;
    }

    await Bun.write(destPath, content);
    console.log(`  created ${file.rel}`);
  }
  const example = Bun.file(join(projectDir, ".env.example"));
  if (await example.exists()) {
    const content = (await example.text()).replace(
      /^(AUTH_SECRET|OAUTH_STATE_SECRET|ADMIN_SETUP_SECRET)=.*$/gm,
      (_, name) => `${name}=${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`,
    );
    await Bun.write(join(projectDir, ".env"), content);
  }
};

// Custom project generation (when template === "custom")

export const generatePackageJson = (answers: Answers): string => {
  const modules = ["server", "config", "cli/entry"];
  if (answers.database !== "none") modules.push("db/query", `db/${answers.database}`, "migrate");
  const features = answers.features as string[];
  if (features.includes("auth") || features.includes("admin")) modules.push("auth/flows");
  for (const name of ["storage", "cache", "admin", "email", "share", "ai"]) {
    if (features.includes(name)) modules.push(name);
  }
  if (features.includes("social")) modules.push("auth/social");
  if (answers.frontend) modules.push("ui/provider");
  const deps = moduleDependencies(modules);
  const cliVersion = deps["@wess/atlas-cli"]!;
  delete deps["@wess/atlas-cli"];

  return JSON.stringify(
    {
      name: answers.name,
      type: "module",
      scripts: {
        dev: "atlas dev",
        start: "bun run server.ts",
        test: "bun test",
        lint: "bunx biome lint src/",
        "migrate:up": "atlas migrate up",
        "migrate:down": "atlas migrate down",
        "migrate:new": "atlas migrate new",
      },
      dependencies: deps,
      devDependencies: {
        "@wess/atlas-cli": cliVersion,
        "@types/bun": "latest",
        "@biomejs/biome": "latest",
        typescript: "^7.0.2",
      },
    },
    null,
    2,
  );
};

export const generateEnv = (answers: Answers): string => {
  const lines: string[] = [];
  lines.push(`PORT=${answers.port ?? 3000}`);
  lines.push(`HOST=0.0.0.0`);

  const db = answers.database as string;
  if (db === "postgres") {
    lines.push(`DATABASE_URL=postgres://localhost:5432/${answers.name}`);
    lines.push(`DB_POOL_SIZE=5`);
  }
  if (db === "sqlite") {
    lines.push(`DATABASE_PATH=./${answers.name}.db`);
  }

  const features = answers.features as string[];
  if (features.includes("storage")) {
    lines.push(`S3_ENDPOINT=http://localhost:9000`);
    lines.push(`S3_BUCKET=${answers.name}`);
    lines.push(`S3_ACCESS_KEY=minioadmin`);
    lines.push(`S3_SECRET_KEY=minioadmin`);
  }
  if (features.includes("cache")) {
    lines.push(`REDIS_URL=redis://localhost:6379`);
  }
  if (features.includes("auth") || features.includes("admin")) {
    lines.push(`AUTH_SECRET=${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`);
  }
  if (features.includes("social")) {
    lines.push(`OAUTH_STATE_SECRET=${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`);
    lines.push(`# Fill in only the providers you want enabled — each requires a developer-console app.`);
    lines.push(`GOOGLE_CLIENT_ID=`);
    lines.push(`GOOGLE_CLIENT_SECRET=`);
    lines.push(`GITHUB_CLIENT_ID=`);
    lines.push(`GITHUB_CLIENT_SECRET=`);
    lines.push(`APPLE_CLIENT_ID=`);
    lines.push(`APPLE_TEAM_ID=`);
    lines.push(`APPLE_KEY_ID=`);
    lines.push(`# Paste the .p8 contents with newlines escaped as \\n, or load from a file in code.`);
    lines.push(`APPLE_PRIVATE_KEY=`);
    lines.push(`MICROSOFT_CLIENT_ID=`);
    lines.push(`MICROSOFT_CLIENT_SECRET=`);
    lines.push(`MICROSOFT_TENANT=common`);
    lines.push(`FACEBOOK_CLIENT_ID=`);
    lines.push(`FACEBOOK_CLIENT_SECRET=`);
    lines.push(`TWITTER_CLIENT_ID=`);
    lines.push(`TWITTER_CLIENT_SECRET=`);
    lines.push(`TIKTOK_CLIENT_KEY=`);
    lines.push(`TIKTOK_CLIENT_SECRET=`);
    lines.push(`PUBLIC_ORIGIN=http://localhost:${answers.port ?? 3000}`);
  }
  if (features.includes("email") || features.includes("share")) {
    lines.push(`RESEND_API_KEY=`);
    lines.push(`RESEND_FROM=no-reply@example.com`);
  }

  return `${lines.join("\n")}\n`;
};

export const generateServerTs = (answers: Answers): string => {
  const features = answers.features as string[];
  const database = answers.database as string;
  if (features.includes("admin") && database === "none") throw new Error("The admin feature requires a database");
  const imports = [
    `import { defineConfig, env } from "@wess/atlas/config"`,
    `import { serve, get, json, pipeline } from "@wess/atlas/server"`,
  ];
  const config = [`port: env("PORT", { parse: Number, default: "3000" })`, `host: env("HOST", { default: "0.0.0.0" })`];
  const setup: string[] = [];
  const routes = [
    `get("/", c => json(c, 200, { status: "ok" }))`,
    `get("/health", c => json(c, 200, { healthy: true }))`,
  ];
  if (database !== "none") {
    imports.push(`import { connect } from "@wess/atlas/db/${database}"`);
    if (database === "postgres") {
      config.push(`databaseUrl: env("DATABASE_URL")`);
      setup.push(`const db = connect({ driver: "postgres", url: config.databaseUrl })`);
    } else {
      config.push(`databasePath: env("DATABASE_PATH", { default: "./app.db" })`);
      setup.push(`const db = connect({ driver: "sqlite", path: config.databasePath })`);
    }
  }
  if (features.includes("auth") || features.includes("admin")) {
    imports.push(`import { requireAuth } from "@wess/atlas/auth/flows"`);
    config.push(
      `secret: env("AUTH_SECRET", { parse: value => { if (value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 random characters"); return value } })`,
    );
    routes.push(`get("/me", pipeline(requireAuth({ secret: config.secret }))(c => json(c, 200, c.assigns.auth)))`);
  }
  if (features.includes("cache")) {
    imports.push(`import { createCache } from "@wess/atlas/cache"`);
    config.push(`redisUrl: env("REDIS_URL")`);
    setup.push(`const cache = createCache({ url: config.redisUrl })`);
  }
  if (features.includes("admin")) {
    imports.push(`import { admin, model } from "@wess/atlas/admin"`, `import { users } from "./src/schema.ts"`);
    setup.push(
      `const panel = admin({ db, models: [model({ schema: users })], auth: { secret: config.secret, authorize: claims => claims.role === "admin" } })`,
    );
    routes.push(`...panel.routes`);
  }
  return [
    ...imports,
    "",
    `const config = defineConfig({ ${config.join(", ")} })`,
    ...setup,
    "",
    `serve({ port: config.port, hostname: config.host, routes: [${routes.join(", ")}] })`,
    "",
  ].join("\n");
};

export const generateTsconfig = (): string => {
  return JSON.stringify(
    {
      compilerOptions: {
        lib: ["ESNext"],
        types: ["bun"],
        target: "ESNext",
        module: "Preserve",
        moduleDetection: "force",
        jsx: "react-jsx",
        allowJs: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
        noEmit: true,
        strict: true,
        skipLibCheck: true,
      },
    },
    null,
    2,
  );
};

export const generateProcfile = (_answers: Answers): string => {
  const lines: string[] = ["web: bun run server.ts"];
  return `${lines.join("\n")}\n`;
};

export const generateGitignore = (): string => {
  return `node_modules/\ndist/\nbuild/\n.env\n*.db\ndata/\n`;
};

export const generateSchemaTs = (_answers: Answers): string =>
  [
    `import { column, defineSchema } from "@wess/atlas/db/query"`,
    ``,
    `export const users = defineSchema("users", {`,
    `  id: column.serial().primaryKey(),`,
    `  email: column.text().unique(),`,
    `  name: column.text(),`,
    `})`,
    ``,
  ].join("\n");

export const generateProject = (answers: Answers): { path: string; content: string }[] => {
  const files: { path: string; content: string }[] = [
    { path: "package.json", content: generatePackageJson(answers) },
    { path: ".env", content: generateEnv(answers) },
    { path: "tsconfig.json", content: generateTsconfig() },
    { path: "Procfile", content: generateProcfile(answers) },
    { path: ".gitignore", content: generateGitignore() },
    { path: "server.ts", content: generateServerTs(answers) },
  ];

  const db = answers.database as string;
  if (db !== "none") {
    files.push({ path: "src/schema.ts", content: generateSchemaTs(answers) });
  }

  return files;
};
