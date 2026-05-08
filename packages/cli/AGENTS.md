# @atlas/cli

CLI framework, Foreman-style process manager, and project scaffolding tool. Zero external dependencies.

## Modules

### command/index.ts

Minimal CLI argument parser and command router.

- `flag(short, opts)` — create a flag definition with short alias, type, default, description
- `command(name, opts)` — create a command definition with flags, args, subcommands, run handler
- `parseArgs(argv, flagDefs)` — parse argv into `{ args, flags }` using flag definitions
- `cli(name, commands)` — entry point that reads `process.argv`, matches command, parses args, runs handler

Types: `FlagDef`, `CommandDef`, `ParsedArgs`

### foreman/index.ts

Procfile parser and parallel process runner with color-coded output.

- `parseProcfile(content)` — parse Procfile string into `Record<string, string>`
- `foreman(procs)` — spawn all processes, prefix output with colored names, handle SIGINT/SIGTERM

Type: `ProcSpec` (alias for `Record<string, string>`)

### init/questions.ts

Interactive question definitions for project scaffolding.

- `questions` — array of `Question` objects (name, database, features, frontend, port)
- `getQuestionSpec()` — returns questions array (for LLM/AI programmatic access)
- `askQuestions()` — interactive stdin prompt, returns `Answers`
- `applyDefaults(partial?)` — non-interactive, fills defaults with optional overrides

Types: `Question`, `Answers`

### init/templates.ts

Project file generators based on user answers.

- `generatePackageJson(answers)` — package.json with selected atlas deps
- `generateEnv(answers)` — .env with db, cache, storage, auth config
- `generateServerTs(answers)` — working server.ts with selected features
- `generateTsconfig()` — standard bun tsconfig
- `generateProcfile(answers)` — Procfile for atlas dev
- `generateGitignore()` — standard gitignore
- `generateSchemaTs(answers)` — example db schema (postgres or sqlite)
- `generateProject(answers)` — returns all files as `{ path, content }[]`

### init/index.ts

The `atlas init` command. Flags: `--yes/-y` (skip prompts), `--name/-n` (project name).

### add/index.ts

The `atlas add` command. Maps short names (auth, db, cache, etc.) to `@atlas/*` packages and runs `bun add`.

### entry.ts

CLI bin entry point. Registers init, add, and dev commands, then calls `cli("atlas", commands)`.

## CLI Commands

### atlas init

Create a new Atlas project interactively.

```sh
atlas init              # interactive prompts
atlas init -y           # use all defaults
atlas init -y -n myapp  # defaults with custom name
```

### atlas add

Add Atlas packages to an existing project.

```sh
atlas add auth cache    # installs @atlas/auth @atlas/cache
atlas add               # lists available packages
```

### atlas dev

Start development servers from Procfile.

```sh
atlas dev
```

### atlas docs

Print Atlas documentation directly to stdout — `atlas docs` for the index,
`atlas docs <package>` for a package's `AGENTS.md`, or `atlas docs <doc>` for a
top-level `docs/<name>.md` file.

```sh
atlas docs              # list all packages and top-level docs
atlas docs db           # print packages/db/AGENTS.md
atlas docs api          # print docs/api.md
atlas docs cookbook     # print docs/cookbook.md
```

Useful for terminal lookups and for piping into AI tools (`atlas docs db | ...`).
The same content is exposed as the `docs.list` / `docs.read` tools by `atlas mcp`.

## LLM/AI Programmatic Usage

The questions and templates are designed for programmatic access:

```ts
import { applyDefaults, generateProject } from "@atlas/cli"

// Generate a project with specific answers (no interactive prompts)
const answers = applyDefaults({
  name: "my-api",
  database: "postgres",
  features: ["auth", "cache", "migrate"],
  frontend: false,
  port: "4000",
})

const files = generateProject(answers)
// files = [{ path: "package.json", content: "..." }, ...]
```

To inspect available questions:

```ts
import { getQuestionSpec } from "@atlas/cli"

const questions = getQuestionSpec()
// Returns typed Question[] with id, prompt, type, options, default
```

## Global Installation

```sh
bun add -g @atlas/cli
atlas init
```

## Usage

### CLI commands

```ts
import { cli, command, flag } from "@atlas/cli"

cli("myapp", [
  command("serve", {
    description: "Start the server",
    flags: {
      port: flag("p", { type: "number", default: 3000 }),
      verbose: flag("v", { type: "boolean", description: "Verbose output" }),
    },
    run: ({ flags }) => {
      console.log(`Listening on port ${flags.port}`)
    },
  }),
])
```

### Foreman

```ts
import { foreman } from "@atlas/cli"

// From a Procfile path
await foreman("./Procfile")

// From an object
await foreman({
  web: "bun run server.ts",
  worker: "bun run worker.ts",
})
```

### Procfile format

```
web: bun run server.ts
worker: bun run worker.ts
# comments are ignored
```

## Testing

```sh
bun test packages/cli/
```

## Conventions

- Functional style, no classes
- All file names lowercase, no dashes or underscores
- Zero external dependencies, Bun APIs only
