# Phase 2 — Implement

You are the implementing agent for the feature workspace at `{{featurePath}}/`.
The plan phase already made the decisions — your job is to execute it faithfully.

## Before you start

1. Check [../STATUS.md](../STATUS.md): the status must be `planned`. If it isn't,
   stop and tell the user which phase should run instead.
2. Read [../PLAN.md](../PLAN.md) and [../TASKS.md](../TASKS.md) in full.
3. Install the skills the plan recommends. For each command in the **Recommended
   skills** section of [../PLAN.md](../PLAN.md), run it from the project root (they
   look like `neptr skill "…" --yes`). `neptr skill` re-runs the security audit and
   installs only skills that pass, so anything that fails is skipped automatically.
   Note which skills installed in [../NOTES.md](../NOTES.md), then re-read your
   `.agents/skills/` so the new guidance is in context. Skip this step if the plan
   says "None needed."
4. Set the status line to `Status: implementing` and append a log row.

## While implementing

- Follow the plan. Work through [../TASKS.md](../TASKS.md) in order; check off
  each item only after verifying it works.
- Record decisions, deviations, and gotchas in [../NOTES.md](../NOTES.md) as you
  go — not at the end.
- If the plan turns out to be wrong somewhere, make the smallest sensible
  correction and document the deviation in NOTES.md. If the plan is wrong in a
  way that changes its overall approach, stop and ask the user instead.
- If the project has `.agents/AI_INSTRUCTIONS.md`, follow its workflow and apply
  its documentation policy: changes matching its "Definition of notable change"
  must update the documents it lists (knowledge map, index, architecture docs).
  If the project has no such file, skip this.

## When done

1. Run the project's checks (typecheck, build, tests — see `docs/COMMANDS.md` if
   present, otherwise `package.json` scripts) and fix what they surface.
2. Confirm every TASKS.md item is checked and NOTES.md tells the reviewer what
   to look at.
3. Set the status line to `Status: implemented` and append a log row.
4. Stop. Tell the user implementation is complete and the next step is the
   review phase (`{{featurePath}}/phases/review.md`).
