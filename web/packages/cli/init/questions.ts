export type Question = {
  readonly id: string;
  readonly prompt: string;
  readonly type: "text" | "select" | "multiselect" | "confirm";
  readonly options?: { value: string; label: string }[];
  readonly default?: string | boolean | string[];
};

export type Answers = Record<string, string | boolean | string[]>;

export const templateOptions = [
  { value: "minimal", label: "Minimal — just server + config" },
  { value: "api", label: "API — REST API with db, auth, migrations" },
  { value: "fullstack", label: "Full-stack — API + React frontend" },
  { value: "admin", label: "Admin — API + admin panel" },
  { value: "worker", label: "Worker — background job processor" },
  { value: "realtime", label: "Realtime — WebSocket + SSE" },
  { value: "socialnetwork", label: "Social Network — users, posts, follows, feeds" },
  { value: "cms", label: "CMS — content management system" },
  { value: "ai", label: "AI — chatbot, RAG, agents, embeddings" },
  { value: "custom", label: "Custom — pick features manually" },
];

export const questions: Question[] = [
  {
    id: "template",
    prompt: "Project template",
    type: "select",
    options: templateOptions,
    default: "api",
  },
  {
    id: "name",
    prompt: "Project name",
    type: "text",
    default: "my-app",
  },
  {
    id: "database",
    prompt: "Database",
    type: "select",
    options: [
      { value: "postgres", label: "PostgreSQL (Bun.sql)" },
      { value: "sqlite", label: "SQLite (bun:sqlite)" },
      { value: "none", label: "None" },
    ],
    default: "postgres",
  },
  {
    id: "features",
    prompt: "Features to include",
    type: "multiselect",
    options: [
      { value: "auth", label: "Authentication (@atlas/auth)" },
      { value: "social", label: "Social login (@atlas/auth/social — Google, GitHub, Apple, MS, FB, X, TikTok)" },
      { value: "storage", label: "File storage (@atlas/storage)" },
      { value: "cache", label: "Redis cache (@atlas/cache)" },
      { value: "admin", label: "Admin panel (@atlas/admin)" },
      { value: "migrate", label: "Migrations (@atlas/migrate)" },
      { value: "email", label: "Email transport (@atlas/email)" },
      { value: "share", label: "Share-this-link helpers (@atlas/share)" },
    ],
    default: ["auth", "migrate"],
  },
  {
    id: "frontend",
    prompt: "Include frontend UI?",
    type: "confirm",
    default: false,
  },
  {
    id: "port",
    prompt: "Server port",
    type: "text",
    default: "3000",
  },
];

const customOnlyQuestions = new Set(["database", "features", "frontend"]);

export const getQuestionSpec = (): Question[] => questions;

export const askQuestions = async (): Promise<Answers> => {
  const answers: Answers = {};
  const stdin = Bun.stdin.stream();
  const reader = stdin.getReader();
  const decoder = new TextDecoder();

  for (const q of questions) {
    // Skip feature-selection questions when a template is chosen
    if (customOnlyQuestions.has(q.id) && answers.template && answers.template !== "custom") {
      continue;
    }

    if (q.type === "text") {
      const defaultStr = q.default ? ` (${q.default})` : "";
      process.stdout.write(`${q.prompt}${defaultStr}: `);
      const { value } = await reader.read();
      const input = decoder.decode(value).trim();
      answers[q.id] = input || (q.default as string) || "";
    } else if (q.type === "select") {
      console.log(`\n${q.prompt}:`);
      for (const [i, o] of q.options!.entries()) console.log(`  ${i + 1}) ${o.label}`);
      const defaultIdx = q.options!.findIndex((o) => o.value === q.default) + 1;
      process.stdout.write(`Choose (${defaultIdx}): `);
      const { value } = await reader.read();
      const input = decoder.decode(value).trim();
      const idx = (input ? parseInt(input, 10) : defaultIdx) - 1;
      answers[q.id] = q.options![idx]?.value ?? (q.default as string);
    } else if (q.type === "multiselect") {
      console.log(`\n${q.prompt}:`);
      for (const [i, o] of q.options!.entries()) {
        const selected = (q.default as string[])?.includes(o.value) ? "*" : " ";
        console.log(`  ${i + 1}) [${selected}] ${o.label}`);
      }
      process.stdout.write(`Select (comma-separated, e.g. 1,2,3): `);
      const { value } = await reader.read();
      const input = decoder.decode(value).trim();
      if (input) {
        const indices = input.split(",").map((s) => parseInt(s.trim(), 10) - 1);
        answers[q.id] = indices.map((i) => q.options![i]?.value).filter(Boolean) as string[];
      } else {
        answers[q.id] = q.default as string[];
      }
    } else if (q.type === "confirm") {
      const defaultStr = q.default ? "Y/n" : "y/N";
      process.stdout.write(`${q.prompt} (${defaultStr}): `);
      const { value } = await reader.read();
      const input = decoder.decode(value).trim().toLowerCase();
      answers[q.id] = input ? input === "y" || input === "yes" : (q.default as boolean);
    }
  }

  reader.releaseLock();
  return answers;
};

export const applyDefaults = (partial?: Partial<Answers>): Answers => {
  const answers: Answers = {};
  const template = partial?.template as string | undefined;

  for (const q of questions) {
    // Skip feature questions when using a template
    if (customOnlyQuestions.has(q.id) && template && template !== "custom") {
      continue;
    }
    answers[q.id] = partial?.[q.id] ?? q.default ?? "";
  }
  return answers;
};
