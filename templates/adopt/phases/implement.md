# Phase 2 — Implement the adoption

You are the implementing agent for the adoption workspace at `{{featurePath}}/`.
The plan phase decided the mapping — your job is to move the files exactly as
planned, keeping the project green after every batch.

## Before you start

1. Check [../STATUS.md](../STATUS.md): the status must be `planned`. If it isn't,
   stop and tell the user which phase should run instead.
2. Read [../PLAN.md](../PLAN.md) (especially the **Target mapping**) and
   [../TASKS.md](../TASKS.md) in full.
3. Make sure the working tree is clean and committed, so each move-batch is an
   easy diff to review and revert. If it isn't, tell the user before proceeding.
4. Set the status line to `Status: implementing` and append a log row.

## While implementing

- Work [../TASKS.md](../TASKS.md) in order, one move-batch at a time.
- Prefer your editor/tooling's **move-and-update-imports** capability so imports
  are rewritten for you; otherwise move the file, then fix every import that
  referenced it (and every import *inside* it that used a relative path).
- Update anything that hardcodes the old paths: path aliases in `tsconfig.json`,
  `vite.config.*`, and the `<script src>` in `index.html`.
- After each batch, run the project's typecheck and build (see
  [../../../environment.md](../../../environment.md) if present, otherwise
  `package.json` scripts). Do not start the next batch until they pass. Check the
  task off only then.
- Record every deviation, tricky import, or path-config change in
  [../NOTES.md](../NOTES.md) as you go — not at the end.
- Do not change behaviour. If a "move" seems to require a code change beyond
  fixing imports, stop and note it; that's a refactor for later, out of scope here.

## When done

1. Delete any now-empty old folders and run `neptr index` to refresh
   `.docs/REPO_MAP.md` and the `.agents/KNOWLEDGE_MAP.md` tables.
2. Update [../../../module-map.md](../../../module-map.md) so its rows match the folders
   that now actually hold code.
3. Run typecheck, build, and tests one final time and fix what they surface.
4. Confirm every TASKS.md item is checked and NOTES.md tells the reviewer what to
   look at.
5. Set the status line to `Status: implemented` and append a log row.
6. Stop. Tell the user the migration is complete and the next step is the review
   phase (`{{featurePath}}/phases/review.md`).
