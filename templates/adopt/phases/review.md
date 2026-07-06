# Phase 3 — Review the adoption

You are the reviewing agent for the adoption workspace at `{{featurePath}}/`.
The migration should have changed *where* code lives, not *what it does*. Verify
exactly that.

## Before you start

1. Check [../STATUS.md](../STATUS.md): the status must be `implemented`. If it
   isn't, stop and tell the user which phase should run instead.
2. Read [../PLAN.md](../PLAN.md), [../TASKS.md](../TASKS.md), and
   [../NOTES.md](../NOTES.md).

## Review

- Confirm the files actually landed where the **Target mapping** says, and that no
  file was left orphaned in an old location. Read the diff; do not trust the
  checkboxes.
- Confirm the change is relocation-only: no behaviour changes, no renames beyond
  moves, no dependency changes crept in.
- Run the project's verification commands (typecheck, build, tests — see
  [../../../environment.md](../../../environment.md) if present, otherwise
  `package.json` scripts). Start the app/dev server if feasible to confirm the
  entrypoint still resolves.
- Confirm path config (`tsconfig.json`, `vite.config.*`, `index.html`) points at
  the new locations and that no dead path aliases remain.
- Confirm `neptr index` was run and [../../../module-map.md](../../../module-map.md)
  matches the folders that now hold code.
- Fix any breakage you find. Log each fix in [../NOTES.md](../NOTES.md) under a
  `## Review fixes` heading.

## When done

1. Set the status line in [../STATUS.md](../STATUS.md) to `Status: done` and
   append a log row.
2. Summarize for the user: what moved, what was verified, what was fixed, and any
   files deliberately left in place (and why).
