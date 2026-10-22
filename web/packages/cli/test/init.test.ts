import { expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { applyDefaults, getQuestionSpec, questions } from "../init/questions.ts";
import {
  generateEnv,
  generatePackageJson,
  generateProject,
  listTemplates,
  scaffoldFromTemplate,
} from "../init/templates.ts";
import { releaseUrl } from "../modules/source.ts";

test("questions are well-formed", () => {
  expect(questions.length).toBeGreaterThan(0);
  for (const q of questions) {
    expect(q.id).toBeTruthy();
    expect(q.prompt).toBeTruthy();
    expect(["text", "select", "multiselect", "confirm"]).toContain(q.type);
  }
});

test("questions include template selection as first question", () => {
  const q = questions.find((q) => q.id === "template");
  expect(q).toBeDefined();
  expect(q!.type).toBe("select");
  expect(questions[0]!.id).toBe("template");
});

test("template question has all expected options", () => {
  const q = questions.find((q) => q.id === "template")!;
  const values = q.options!.map((o) => o.value);
  expect(values).toContain("minimal");
  expect(values).toContain("api");
  expect(values).toContain("fullstack");
  expect(values).toContain("admin");
  expect(values).toContain("worker");
  expect(values).toContain("realtime");
  expect(values).toContain("custom");
});

test("getQuestionSpec returns questions", () => {
  const spec = getQuestionSpec();
  expect(spec).toEqual(questions);
});

test("applyDefaults fills all answers for custom template", () => {
  const answers = applyDefaults({ template: "custom" });
  expect(answers.name).toBe("my-app");
  expect(answers.database).toBe("postgres");
  expect(answers.features).toEqual(["auth", "migrate"]);
  expect(answers.frontend).toBe(false);
  expect(answers.port).toBe("3000");
});

test("applyDefaults with template skips feature questions", () => {
  const answers = applyDefaults({ template: "api", name: "myapp" });
  expect(answers.template).toBe("api");
  expect(answers.name).toBe("myapp");
  expect(answers.database).toBeUndefined();
  expect(answers.features).toBeUndefined();
  expect(answers.frontend).toBeUndefined();
});

test("applyDefaults accepts partial overrides", () => {
  const answers = applyDefaults({ template: "custom", name: "cool-project", database: "sqlite" });
  expect(answers.name).toBe("cool-project");
  expect(answers.database).toBe("sqlite");
  expect(answers.features).toEqual(["auth", "migrate"]);
});

test("generated projects select versioned Atlas libraries", () => {
  const answers = applyDefaults({ template: "custom", features: ["auth", "storage", "admin"] });
  const pkg = JSON.parse(generatePackageJson(answers));
  expect(pkg.dependencies["@wess/atlas"]).toBe(releaseUrl("@wess/atlas", "0.4.2"));
  expect(pkg.dependencies["@wess/atlas-server"]).toBe(releaseUrl("@wess/atlas-server", "0.4.2"));
  expect(pkg.dependencies["@wess/atlas-auth"]).toBe(releaseUrl("@wess/atlas-auth", "0.4.2"));
  expect(pkg.dependencies["@wess/atlas-admin"]).toBe(releaseUrl("@wess/atlas-admin", "0.4.2"));
  expect(pkg.dependencies["@wess/atlas-storage"]).toBe(releaseUrl("@wess/atlas-storage", "0.4.2"));
  expect(Object.values(pkg.dependencies).some((value) => /^(file:|link:|workspace:|github:)/.test(String(value)))).toBe(
    false,
  );
  expect(Object.keys(pkg.dependencies).some((name) => name.startsWith("@atlas/"))).toBe(false);
});

test("generateEnv includes postgres config", () => {
  const answers = applyDefaults({ template: "custom", database: "postgres", name: "myapp" });
  const env = generateEnv(answers);
  expect(env).toContain("DATABASE_URL=postgres://localhost:5432/myapp");
  expect(env).toContain("DB_POOL_SIZE=5");
});

test("generateEnv includes sqlite config", () => {
  const answers = applyDefaults({ template: "custom", database: "sqlite", name: "myapp" });
  const env = generateEnv(answers);
  expect(env).toContain("DATABASE_PATH=./myapp.db");
});

test("generateEnv includes storage config when selected", () => {
  const answers = applyDefaults({ template: "custom", features: ["storage"] });
  const env = generateEnv(answers);
  expect(env).toContain("S3_ENDPOINT");
  expect(env).toContain("S3_BUCKET");
});

test("frontend scaffolds declare the UI peer dependencies", () => {
  const pkg = JSON.parse(generatePackageJson(applyDefaults({ template: "custom", frontend: true })));
  expect(pkg.dependencies.react).toBeDefined();
  expect(pkg.dependencies["@mantine/core"]).toBeDefined();
  expect(pkg.dependencies["@wess/atlas"]).toBe(releaseUrl("@wess/atlas", "0.4.2"));
  expect(pkg.dependencies["@wess/atlas-ui"]).toBe(releaseUrl("@wess/atlas-ui", "0.4.2"));
  expect(pkg.dependencies["@tanstack/react-table"]).toBeUndefined();
});

test("generateEnv includes OAuth provider stubs when social is selected", () => {
  const answers = applyDefaults({ template: "custom", features: ["social"] });
  const env = generateEnv(answers);
  expect(env).toContain("OAUTH_STATE_SECRET");
  expect(env).toContain("GOOGLE_CLIENT_ID=");
  expect(env).toContain("GITHUB_CLIENT_ID=");
  expect(env).toContain("APPLE_TEAM_ID=");
  expect(env).toContain("MICROSOFT_TENANT=common");
  expect(env).toContain("FACEBOOK_CLIENT_ID=");
  expect(env).toContain("TWITTER_CLIENT_ID=");
  expect(env).toContain("TIKTOK_CLIENT_KEY=");
  expect(env).toContain("PUBLIC_ORIGIN=");
});

test("generateEnv includes Resend keys when email or share is selected", () => {
  const envShare = generateEnv(applyDefaults({ template: "custom", features: ["share"] }));
  expect(envShare).toContain("RESEND_API_KEY=");
  expect(envShare).toContain("RESEND_FROM=");

  const envEmail = generateEnv(applyDefaults({ template: "custom", features: ["email"] }));
  expect(envEmail).toContain("RESEND_API_KEY=");
});

test("generateProject returns all required files", () => {
  const answers = applyDefaults({ template: "custom" });
  const files = generateProject(answers);
  const paths = files.map((f) => f.path);
  expect(paths).toContain("package.json");
  expect(paths).toContain(".env");
  expect(paths).toContain("tsconfig.json");
  expect(paths).toContain("Procfile");
  expect(paths).toContain(".gitignore");
  expect(paths).toContain("server.ts");
});

test("generateProject includes schema when db selected", () => {
  const answers = applyDefaults({ template: "custom", database: "postgres" });
  const files = generateProject(answers);
  const paths = files.map((f) => f.path);
  expect(paths.some((p) => p.includes("schema"))).toBe(true);
});

test("generateProject excludes schema when no db", () => {
  const answers = applyDefaults({ template: "custom", database: "none", features: [] });
  const files = generateProject(answers);
  const paths = files.map((f) => f.path);
  expect(paths.some((p) => p.includes("schema"))).toBe(false);
});

test("listTemplates returns known template names", () => {
  const templates = listTemplates();
  expect(templates).toContain("minimal");
  expect(templates).toContain("api");
  expect(templates).toContain("fullstack");
  expect(templates).toContain("admin");
  expect(templates).toContain("worker");
  expect(templates).toContain("realtime");
});

test("scaffoldFromTemplate copies template files with name replacement", async () => {
  const testDir = join(import.meta.dir, "__test_scaffold__");
  try {
    await scaffoldFromTemplate("minimal", testDir, "testproject");

    expect(existsSync(join(testDir, "package.json"))).toBe(true);
    expect(existsSync(join(testDir, "server.ts"))).toBe(true);
    expect(existsSync(join(testDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(testDir, "Procfile"))).toBe(true);
    expect(existsSync(join(testDir, ".gitignore"))).toBe(true);
    expect(existsSync(join(testDir, ".env.example"))).toBe(true);

    const pkg = await Bun.file(join(testDir, "package.json")).text();
    const parsed = JSON.parse(pkg);
    expect(parsed.name).toBe("testproject");
    expect(pkg).not.toContain("{{name}}");
  } finally {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  }
});

test("scaffoldFromTemplate throws for unknown template", async () => {
  expect(scaffoldFromTemplate("nonexistent", "/tmp/test", "test")).rejects.toThrow('Template "nonexistent" not found');
});

test("scaffoldFromTemplate creates nested directories for api template", async () => {
  const testDir = join(import.meta.dir, "__test_scaffold_api__");
  try {
    await scaffoldFromTemplate("api", testDir, "myapi");

    expect(existsSync(join(testDir, "src", "routes", "users.ts"))).toBe(true);
    expect(existsSync(join(testDir, "src", "config.ts"))).toBe(true);
    expect(existsSync(join(testDir, "src", "db.ts"))).toBe(true);
    expect(existsSync(join(testDir, "migrations", "00000001_create_users", "up.sql"))).toBe(true);
  } finally {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  }
});
