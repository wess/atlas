# @wess/atlas/cli

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

- `generatePackageJson(answers)` — package.json selecting exact coordinated Atlas libraries and their required peers
- `generateEnv(answers)` — .env with db, cache, storage, auth config
- `generateServerTs(answers)` — working server.ts with selected features
- `generateTsconfig()` — standard bun tsconfig
- `generateProcfile(answers)` — Procfile for atlas dev
- `generateGitignore()` — standard gitignore
- `generateSchemaTs(answers)` — example db schema (postgres or sqlite)
- `generateProject(answers)` — returns all files as `{ path, content }[]`

### init/index.ts

The `atlas init` command. Flags: `--yes/-y` (skip prompts), `--name/-n` (project name), `--template/-t` (project template).

### add/index.ts

The `atlas add` command validates public module names and installs the facade, selected implementation libraries, and the required external peers using the release catalog. It accepts narrow entries such as `auth/password` and `db/postgres`.

### entry.ts

CLI bin entry point. Registers init, add, check, dev, mcp, and docs commands, then calls `cli("atlas", commands)`.

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
atlas add auth/password cache    # installs only selected libraries and required peers
atlas add               # lists available packages
```

### atlas check

Check an application's manifests, Bun lockfile, installed Atlas links, source imports,
and TypeScript aliases. Atlas facade and backing libraries must use the same exact
stable version. Local paths, legacy aliases, and links outside node_modules fail the check.
Run `bunx --package https://github.com/wess/atlas/releases/download/v0.4.2/wess-atlas-cli-0.4.2.tgz atlas check` in application CI after a frozen install.

### atlas dev

Start development servers from Procfile.

```sh
atlas dev
```

### atlas docs

Print Atlas documentation directly to stdout — `atlas docs` for the index,
`atlas docs <package>` for a package's `AGENTS.md`, `atlas docs <doc>` for a
top-level `docs/<name>.md` file, or `atlas docs <file>` for a root agent file
(`llms.txt`, `SOUL.md`, `CLAUDE.md`, `README.md`).

```sh
atlas docs              # list packages, top-level docs, and root agent files
atlas docs db           # print packages/db/AGENTS.md
atlas docs agents       # print the agent grounding guide
atlas docs api          # print docs/api.md
atlas docs cookbook     # print docs/cookbook.md
atlas docs llms.txt     # print root llms.txt
```

Useful for terminal lookups and for piping into agent tools (`atlas docs db | ...`).
The same content is exposed as the `docs.list` / `docs.read` tools by `atlas mcp`.

## Programmatic Usage

The questions and templates are designed for programmatic access:

```ts
import { applyDefaults, generateProject } from "@wess/atlas/cli/scaffold"

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
import { getQuestionSpec } from "@wess/atlas/cli/scaffold"

const questions = getQuestionSpec()
// Returns typed Question[] with id, prompt, type, options, default
```

## Global Installation

```sh
bun add -g https://github.com/wess/atlas/releases/download/v0.4.2/wess-atlas-cli-0.4.2.tgz
atlas init
```

## Usage

### CLI commands

```ts
import { cli, command, flag } from "@wess/atlas/cli"

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
import { foreman } from "@wess/atlas/cli"

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

Scaffolds use public `@wess/atlas/*` imports. The distributed package includes the CLI bin and all ten templates. `atlas init` creates a local `.env` with fresh 32-byte authentication/state secrets; templates reject short auth secrets. Custom servers use the same connection, route, guard, and admin APIs as the library.

The `/cli` root exports only command parsing and process management. Import project generation from `/cli/scaffold` and documentation commands from `/cli/docs`. The CLI executable resolves optional MCP from the consuming project; run `atlas add mcp` before `atlas mcp`.
