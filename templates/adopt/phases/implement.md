# Phase 2 — Implement the adoption

You are the implementing agent for the adoption workspace at `{{featurePath}}/`.
The plan phase decided the mappings — your job is to execute the four workstreams
exactly as planned, in order (**code, tests, docs, docker**), keeping the project
green after every batch.

## Before you start

1. Determine your scope. If your prompt names a specific milestone, you execute
   **only** that `## Milestone N` section of [../TASKS.md](../TASKS.md) — work
   only the workstream sections below that its tasks belong to and skip the
   others. Otherwise you execute all of TASKS.md.
2. Check [../STATUS.md](../STATUS.md):
   - Unscoped run, or Milestone 1: the status must be `planned`.
   - Milestone N (N > 1): the status must be `implementing` **and** every task
     in all earlier milestones must be checked off.
   If the check fails, stop and tell the user which phase or milestone should
   run instead.
3. Read [../PLAN.md](../PLAN.md) (especially the **Target mapping** tables and the
   **Docker plan**) and [../TASKS.md](../TASKS.md) in full.
4. Make sure the working tree is clean and committed, so each batch is an
   easy diff to review and revert. If it isn't, tell the user before proceeding.
5. On the first run only (unscoped, or Milestone 1): run the test suite once and
   record the passing count in [../NOTES.md](../NOTES.md) — the same count must
   pass after tests move. Later milestones read the recorded count from NOTES.md
   instead of re-recording.
6. Set the status line to `Status: implementing` (if it isn't already) and
   append a log row — for a milestone run, note it, e.g.
   `| <date> | implementing | Milestone 2 started |`.

## Workstream 1 — code

- Work the code tasks in [../TASKS.md](../TASKS.md) in order, one move-batch at a
  time.
- Prefer your editor/tooling's **move-and-update-imports** capability so imports
  are rewritten for you; otherwise move the file, then fix every import that
  referenced it (and every import *inside* it that used a relative path).
- Update anything that hardcodes the old paths: path aliases in `tsconfig.json`,
  `vite.config.*`, and the `<script src>` in `index.html`.
- After each batch, run the project's typecheck and build (see
  [../../../environment.md](../../../environment.md) if present, otherwise
  `package.json` scripts). Do not start the next batch until they pass.
- Do not change behaviour. If a "move" seems to require a code change beyond
  fixing imports, stop and note it; that's a refactor for later, out of scope here.

## Workstream 2 — tests

- Move test files per the **Target mapping — tests** table: unit tests beside
  their subject, shared helpers/fixtures and cross-cutting suites into root
  `tests/`.
- Update runner config (`include`/`testMatch`/`roots` in `vitest.config.*`,
  `jest.config.*`, `playwright.config.*`, …) so the moved tests are still found.
- Run the full suite: the same number of tests must be found and pass as before
  the move. A dropped count means the runner lost files — fix the config, don't
  proceed.

## Workstream 3 — docs

- Move or merge each doc per the **Target mapping — docs** table. Merging means
  appending/weaving content into the target file without rewriting its meaning.
- Fix every relative link *inside* moved docs and every inbound link *to* them
  (the plan phase listed these; grep the old paths to be sure).
- Delete an original only once its content is fully accounted for at the target.
- Update `.docs/documents/README.md` (index of documents) and
  [../../../environment.md](../../../environment.md) where run/setup content
  merged into it.

## Workstream 4 — docker

- Work from the **Docker plan** checklist. Verify each DRAFT file line by line
  against the real project (base image, install, build line, CMD, ports,
  services); remove a file's DRAFT header only after you have verified it.
- Wire every required env var: reference it in compose (`${VAR:-default}` style),
  declare it in `.env.example` (names and placeholders only — **never real
  secrets**), and document it in `environment.md`.
- Compose references `.env` via `env_file` — make sure `.env` exists (copy from
  `.env.example`) or remove the `env_file` lines.
- Account for migrations/seed commands the plan identified.
- Verify: `docker compose config` must parse clean; if the docker CLI is
  available, `docker compose build` (and `up` if feasible) should succeed. Add
  the working compose commands to `environment.md`.
- Record every deviation, tricky import, or config change in
  [../NOTES.md](../NOTES.md) as you go — not at the end.

## When done

**Milestone run that is not the last milestone:** run your workstream's
verification, confirm every task in *your* milestone is checked, append a log
row (e.g. `| <date> | implementing | Milestone N complete |`), keep the status
at `implementing`, and stop — tell the user to run the Milestone N+1 prompt from
`{{featurePath}}/PROMPTS.md` in a fresh agent session. Steps 1–6 below run only
on an unscoped run or the **final** milestone.

1. Delete any now-empty old folders and run `neptr index` to refresh
   `.docs/REPO_MAP.md`, the `.agents/KNOWLEDGE_MAP.md` tables, and the
   `.agents/CAPABILITIES.md` skills/MCP inventory.
2. Update [../../../module-map.md](../../../module-map.md) so its rows match the folders
   that now actually hold code.
3. Run typecheck, build, and tests one final time and fix what they surface.
4. Confirm every TASKS.md item is checked (across all milestones) and NOTES.md
   tells the reviewer what to look at.
5. Set the status line to `Status: implemented` and append a log row.
6. Stop. Tell the user the migration is complete and the next step is the review
   phase (`{{featurePath}}/phases/review.md`).
