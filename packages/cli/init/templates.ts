import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Answers } from "./questions.ts";

// Template scaffolding

const knownTemplates = ["minimal", "api", "fullstack", "admin", "worker", "realtime", "socialnetwork", "cms"];

export const listTemplates = (): string[] => knownTemplates;

const findTemplateDir = (templateName: string): string | null => {
  // Check relative to this file (monorepo layout: packages/cli/init/templates.ts -> templates/)
  const monorepoPath = join(dirname(import.meta.dir), "..", "..", "templates", templateName);
  if (existsSync(monorepoPath)) return monorepoPath;

  // Check in node_modules (installed package)
  const nmPath = join(process.cwd(), "node_modules", "@atlas", "cli", "templates", templateName);
  if (existsSync(nmPath)) return nmPath;

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
  const templateDir = findTemplateDir(templateName);
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

    await Bun.write(destPath, content);
    console.log(`  created ${file.rel}`);
  }
};

// Custom project generation (when template === "custom")

export const generatePackageJson = (answers: Answers): string => {
  const deps: Record<string, string> = {
    "@atlas/config": "latest",
    "@atlas/server": "latest",
    "@atlas/cli": "latest",
  };

  const features = answers.features as string[];
  const db = answers.database as string;

  if (db !== "none") deps["@atlas/db"] = "latest";
  if (features.includes("auth") || features.includes("social")) deps["@atlas/auth"] = "latest";
  if (features.includes("storage")) deps["@atlas/storage"] = "latest";
  if (features.includes("cache")) deps["@atlas/cache"] = "latest";
  if (features.includes("admin")) deps["@atlas/admin"] = "latest";
  if (features.includes("migrate")) deps["@atlas/migrate"] = "latest";
  if (features.includes("email") || features.includes("share")) deps["@atlas/email"] = "latest";
  if (features.includes("share")) deps["@atlas/share"] = "latest";
  if (answers.frontend) deps["@atlas/ui"] = "latest";

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
        "@types/bun": "latest",
        "@biomejs/biome": "latest",
        typescript: "^5",
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
    lines.push(`DATABASE_PATH=./data/${answers.name}.db`);
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
  if (features.includes("auth")) {
    lines.push(`AUTH_SECRET=change-me-in-production`);
  }
  if (features.includes("social")) {
    lines.push(`OAUTH_STATE_SECRET=change-me-in-production`);
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
  const imports: string[] = [];
  const setup: string[] = [];
  const routes: string[] = [];

  imports.push(`import { config } from "@atlas/config"`);
  imports.push(`import { serve } from "@atlas/server"`);

  const db = answers.database as string;
  const features = answers.features as string[];

  if (db !== "none") {
    imports.push(`import { db } from "@atlas/db"`);
    setup.push(`const database = db(config)`);
  }

  if (features.includes("auth")) {
    imports.push(`import { auth } from "@atlas/auth"`);
    setup.push(`const authentication = auth(config)`);
  }

  if (features.includes("cache")) {
    imports.push(`import { cache } from "@atlas/cache"`);
    setup.push(`const redis = cache(config)`);
  }

  if (features.includes("admin")) {
    imports.push(`import { admin } from "@atlas/admin"`);
    setup.push(`const panel = admin(config)`);
  }

  routes.push(`  "/": () => new Response("Hello from Atlas!"),`);
  routes.push(`  "/health": () => Response.json({ status: "ok" }),`);

  if (features.includes("admin")) {
    routes.push(`  "/admin/*": panel.handler,`);
  }

  const lines: string[] = [
    ...imports,
    "",
    `const cfg = config()`,
    "",
    ...setup,
    "",
    `serve({`,
    `  port: cfg.port,`,
    `  routes: {`,
    ...routes,
    `  },`,
    `})`,
    "",
    `console.log(\`Server running on port \${cfg.port}\`)`,
    "",
  ];

  return lines.join("\n");
};

export const generateTsconfig = (): string => {
  return JSON.stringify(
    {
      compilerOptions: {
        lib: ["ESNext"],
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

export const generateSchemaTs = (answers: Answers): string => {
  const db = answers.database as string;
  if (db === "postgres") {
    return [
      `// Define your database schema here`,
      `// See @atlas/db for schema helpers`,
      ``,
      `export const users = {`,
      `  table: "users",`,
      `  columns: {`,
      `    id: "serial primary key",`,
      `    email: "text unique not null",`,
      `    name: "text",`,
      `    created: "timestamp default now()",`,
      `  },`,
      `}`,
      ``,
    ].join("\n");
  }
  return [
    `// Define your database schema here`,
    `// See @atlas/db for schema helpers`,
    ``,
    `export const users = {`,
    `  table: "users",`,
    `  columns: {`,
    `    id: "integer primary key autoincrement",`,
    `    email: "text unique not null",`,
    `    name: "text",`,
    `    created: "text default (datetime('now'))",`,
    `  },`,
    `}`,
    ``,
  ].join("\n");
};

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
