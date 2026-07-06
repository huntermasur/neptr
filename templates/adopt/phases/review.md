# Phase 3 — Review the adoption

You are the reviewing agent for the adoption workspace at `{{featurePath}}/`.
The migration should have changed *where* things live — code, tests, docs — and
made the project runnable in containers, without changing *what the code does*.
Verify exactly that, workstream by workstream.

## Before you start

1. Check [../STATUS.md](../STATUS.md): the status must be `implemented`. If it
   isn't, stop and tell the user which phase should run instead.
2. Read [../PLAN.md](../PLAN.md), [../TASKS.md](../TASKS.md), and
   [../NOTES.md](../NOTES.md).

## Review — code

- Confirm the files actually landed where **Target mapping — code** says, and
  that no file was left orphaned in an old location. Read the diff; do not trust
  the checkboxes.
- Confirm the change is relocation-only: no behaviour changes, no renames beyond
  moves, no dependency changes crept in.
- Run the project's verification commands (typecheck, build — see
  [../../../environment.md](../../../environment.md) if present, otherwise
  `package.json` scripts). Start the app/dev server if feasible to confirm the
  entrypoint still resolves.
- Confirm path config (`tsconfig.json`, `vite.config.*`, `index.html`) points at
  the new locations and that no dead path aliases remain.

## Review — tests

- Run the full suite: it must find and pass the same number of tests recorded in
  NOTES.md before the move. A silently shrunken suite is a failure.
- Confirm every file in **Target mapping — tests** landed, and runner config no
  longer references old paths.

## Review — docs

- Confirm every doc in **Target mapping — docs** is accounted for: moved, merged,
  or deliberately left with a reason in NOTES.md.
- Grep for the old doc paths — no broken inbound links may remain (READMEs, code
  comments, other docs).
- Confirm `.docs/documents/README.md` and `environment.md` reflect the merged
  content.

## Review — docker

- No DRAFT headers may remain in `Dockerfile`, `docker-compose.yml`, or related
  files — a remaining header means the file was never verified.
- `docker compose config` must parse clean; run `docker compose build` if the
  docker CLI is available.
- Every env var referenced in compose or the Dockerfile must exist in
  `.env.example` and be documented in `environment.md`. Confirm **no real secret
  values** appear anywhere in the diff.

## Wrap up

- Confirm `neptr index` was run and [../../../module-map.md](../../../module-map.md)
  matches the folders that now hold code.
- Fix any breakage you find. Log each fix in [../NOTES.md](../NOTES.md) under a
  `## Review fixes` heading.

## When done

1. Set the status line in [../STATUS.md](../STATUS.md) to `Status: done` and
   append a log row.
2. Summarize for the user: what moved, what was verified, what was fixed, and any
   files deliberately left in place (and why).
