# Phase 1 — Plan the adoption

You are the planning agent for the adoption workspace at `{{featurePath}}/`. Your
job is to turn the auto-generated inventories into a precise migration plan that
a less capable model can execute without breaking the build. The plan covers four
workstreams, in this order: **code, tests, docs, docker**.

## Steps

1. Read [../PLAN.md](../PLAN.md) and the auto-generated inventories in
   [../NOTES.md](../NOTES.md).
2. Read [../../../module-map.md](../../../module-map.md) so you know what each target
   section (`app/`, `modules/`, `services/`, `data/`, `integrations/`, `shared/`,
   `config/`) is for.
3. Orient yourself in the codebase. Confirm the framework, the entrypoint
   (`src/main.*` / `src/index.*` and the `<script>` in `index.html`), how imports
   resolve (relative paths? a path alias like `@/`? configured in `tsconfig.json`
   and/or `vite.config.*`?), and where the build/test/typecheck commands live.
4. **Code:** verify every suggested mapping in the `src/` inventory. For each file
   decide its real target section from what it *does*, not just its name. Leave
   framework entry files (main, App, root styles) under `src/app/` unless there's
   a reason not to.
5. **Tests:** verify the test inventory. For each test identify its subject file
   (a unit test follows its subject to that file's target section; shared
   helpers/fixtures and cross-cutting suites go to root `tests/`). Find every
   runner config path that pins test locations (`include`/`testMatch` in
   `vitest.config.*`, `jest.config.*`, etc.) — those must change when tests move.
6. **Docs:** verify the documentation inventory. Skim every listed doc and decide:
   move it, merge it into an existing `.docs/` file, or deliberately leave it
   (record why). Search the repo for inbound links to each doc so they can be
   fixed when it moves.
7. **Docker:** verify the detection in the Docker inventory. If `neptr adopt`
   wrote DRAFT files, read each one and list everything needed to make it real:
   env vars to wire, migrations/seed commands, the actual start command, ports.
   If the project already had Docker files, gap-check them against the detected
   services instead. Check how the app reads its db/cache connection settings —
   compose service hostnames (e.g. `postgres`, `redis`) must be reachable via env
   vars, not hardcoded `localhost`.
8. Fill in [../PLAN.md](../PLAN.md): Context, Approach, all three **Target
   mapping** tables, the **Docker plan** checklist, Risks & open questions, Out of
   scope. Call out anything that hardcodes paths (`vite.config.*`, `tsconfig.json`
   paths, `index.html` script src, path aliases, runner config).
9. Rewrite [../TASKS.md](../TASKS.md) as an ordered checklist grouped by
   workstream (code → tests → docs → docker), each task a small batch ending in
   its workstream's verification. The first task should establish or confirm a
   path alias if that makes the moves safer; the last should delete now-empty old
   folders and refresh the docs.

## Rules

- Code and test moves are **mechanical relocation**, not a refactor. No renames
  beyond moving, no behaviour changes, no dependency changes, no "while I'm here"
  cleanups.
- Doc consolidation must preserve content: merge and fix links, never rewrite
  meaning.
- Docker work is constructive — you may plan new config freely — but application
  code must not change behaviour to suit it (reading a connection string from an
  env var it already supports is fine; changing logic is not).
- Do NOT move any files or write implementation changes in this phase.
- If the right home for a file is genuinely ambiguous, ask the user rather than guess.

## When done

1. In [../STATUS.md](../STATUS.md), set the status line to `Status: planned` and
   append a log row.
2. Stop. Tell the user the plan is ready for review, and that the next step is the
   implement phase (`{{featurePath}}/phases/implement.md`).
