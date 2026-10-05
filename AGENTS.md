<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `bunx --no-install --package @tanstack/intent intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `bunx --no-install --package @tanstack/intent intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# Agent guidance

Read `CLAUDE.md` for repository rules and `docs/PRD.md` before product or scope decisions.
Use `docs/technical/BUILD-PLAN.md` as the live task tracker; update its checkbox and proof in the same commit as the work.

## TanStack Intent mapping

Package-specific TanStack Intent guidance is generated after dependencies exist.
Task 2.1 installs the approved workspace packages with `bun install`, then generates the mapping:

```sh
bunx @tanstack/intent@latest install
```

Use the generated mapping to load matching guidance before editing TanStack code.
Do not invent package or skill entries before installation or retain entries for packages absent from this repo.
