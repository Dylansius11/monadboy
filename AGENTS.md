# Agent guidance

Read `CLAUDE.md` for repository rules and `docs/PRD.md` before product or scope decisions.

## TanStack Intent mapping

Package-specific TanStack Intent guidance is generated after dependencies exist.
Task 2.1 installs the approved workspace packages with `bun install`, then generates the mapping:

```sh
bunx @tanstack/intent@latest install
```

Use the generated mapping to load matching guidance before editing TanStack code.
Do not invent package or skill entries before installation or retain entries for packages absent from this repo.
