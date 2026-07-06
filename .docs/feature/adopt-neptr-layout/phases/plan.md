# Phase 1 — Plan the adoption

You are the planning agent for the adoption workspace at `.docs/feature/adopt-neptr-layout/`. Your
job is to turn the auto-generated inventory into a precise, mechanical migration
plan that a less capable model can execute without breaking the build.

## Steps

1. Read [../PLAN.md](../PLAN.md) and the auto-generated inventory in
   [../NOTES.md](../NOTES.md).
2. Read [../../../module-map.md](../../../module-map.md) so you know what each target
   section (`app/`, `modules/`, `services/`, `data/`, `integrations/`, `shared/`,
   `config/`) is for.
3. Orient yourself in the codebase. Confirm the framework, the entrypoint
   (`src/main.*` / `src/index.*` and the `<script>` in `index.html`), how imports
   resolve (relative paths? a path alias like `@/`? configured in `tsconfig.json`
   and/or `vite.config.*`?), and where the build/test/typecheck commands live.
4. Verify every suggested mapping in the inventory. For each file decide its real
   target section from what it *does*, not just its name. Leave framework entry
   files (main, App, root styles) under `src/app/` unless there's a reason not to.
5. Fill in [../PLAN.md](../PLAN.md): Context, Approach, the confirmed **Target
   mapping** table (one row per file/folder), Risks & open questions, Out of scope.
   Call out anything that hardcodes paths (`vite.config.*`, `tsconfig.json` paths,
   `index.html` script src, path aliases) since those must change when files move.
6. Rewrite [../TASKS.md](../TASKS.md) as an ordered checklist of small move-batches
   — ideally one target section per task, each ending in "typecheck + build still
   pass". The first task should establish or confirm a path alias if that makes the
   moves safer; the last should delete now-empty old folders and refresh the docs.

## Rules

- This is a **mechanical relocation**, not a refactor. No renames beyond moving,
  no behaviour changes, no dependency changes, no "while I'm here" cleanups.
- Do NOT move any files or write implementation changes in this phase.
- If the right home for a file is genuinely ambiguous, ask the user rather than guess.

## When done

1. In [../STATUS.md](../STATUS.md), set the status line to `Status: planned` and
   append a log row.
2. Stop. Tell the user the plan is ready for review, and that the next step is the
   implement phase (`.docs/feature/adopt-neptr-layout/phases/implement.md`).
