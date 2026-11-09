# Atlas skills

Task-focused instructions for coding agents building with Atlas. Each skill holds the imports, signatures, and working patterns for one kind of work, so an agent can act without loading the full docs.

```sh
atlas skills                        # list them
atlas skills atlasserver            # print one
atlas skills install                # copy all into .claude/skills
atlas skills install --dir .agents/skills atlasserver atlasdb
```

`atlas` is the entry point and routes to the rest. Every `ts` and `tsx` snippet is typechecked against the source by `bun run skills:verify`.
