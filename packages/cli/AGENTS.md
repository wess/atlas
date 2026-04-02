# @atlas/cli

CLI framework and Foreman-style process manager. Zero external dependencies.

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
