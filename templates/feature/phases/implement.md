# Phase 2 — Implement

You are the implementing agent for the feature workspace at `{{featurePath}}/`.
The plan phase already made the decisions — your job is to execute it faithfully.

## Before you start

1. Determine your scope. If your prompt names a specific milestone, you
   implement **only** that `## Milestone N` section of [../TASKS.md](../TASKS.md).
   Otherwise you implement all of TASKS.md.
2. Check [../STATUS.md](../STATUS.md):
   - Unscoped run, or Milestone 1: the status must be `planned`.
   - Milestone N (N > 1): the status must be `implementing` **and** every task
     in all earlier milestones must be checked off.
   If the check fails, stop and tell the user which phase or milestone should
   run instead.
3. Read [../PLAN.md](../PLAN.md) and [../TASKS.md](../TASKS.md) in full.
4. Install the skills the plan recommends. For each command in the **Recommended
   skills** section of [../PLAN.md](../PLAN.md), run it from the project root (they
   look like `neptr skill "…" --yes`). `neptr skill` re-runs the security audit and
   installs only skills that pass, so anything that fails is skipped automatically.
   Note which skills installed in [../NOTES.md](../NOTES.md), then re-read your
   `.agents/skills/` so the new guidance is in context. The installed-skills
   inventory in `.agents/CAPABILITIES.md` refreshes on the next `neptr index`; if a
   new skill overlaps one already listed there, record which one wins in that file's
   precedence list. Skip this step if the plan says "None needed" — or if an earlier
   milestone already installed them (check [../NOTES.md](../NOTES.md) and skip what's installed).
5. Install the MCP servers the plan recommends. For each command in the
   **Recommended MCP servers** section of [../PLAN.md](../PLAN.md), run it from the
   project root (they look like `neptr mcp "…" --yes`). `neptr mcp` re-runs the
   safety check and adds only servers marked safe (version-pinned) to both
   `.mcp.json` (for Claude) and `.cursor/mcp.json` (for Cursor), so anything unsafe
   is skipped automatically. Any server that declares credentials/environment
   variables needs them filled in by hand — note those and which servers installed
   in [../NOTES.md](../NOTES.md), then restart your agent so it picks up the new MCP
   config. The MCP inventory in `.agents/CAPABILITIES.md` refreshes on the next
   `neptr index`; if a new server overlaps one already listed there, record which one
   wins in that file's precedence list. Skip this step if the plan says "None
   needed" — or if an earlier milestone already installed them (check NOTES.md).
6. Set the status line to `Status: implementing` (if it isn't already) and
   append a log row — for a milestone run, note it, e.g.
   `| <date> | implementing | Milestone 2 started |`.

## While implementing

- Follow the plan. Work through [../TASKS.md](../TASKS.md) in order (only your
  milestone's section on a milestone run); check off each item only after
  verifying it works.
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

1. Run the project's checks (typecheck, build, tests — see `.docs/environment.md` if
   present, otherwise `package.json` scripts) and fix what they surface.
2. **Milestone run that is not the last milestone:** confirm every task in
   *your* milestone is checked, append a log row (e.g.
   `| <date> | implementing | Milestone N complete |`), keep the status at
   `implementing`, and stop — tell the user to run the Milestone N+1 prompt
   from `{{featurePath}}/PROMPTS.md` in a fresh agent session.
3. **Unscoped run, or the last milestone:** confirm every TASKS.md item across
   all milestones is checked and NOTES.md tells the reviewer what to look at,
   set the status line to `Status: implemented`, and append a log row.
4. Stop. Tell the user implementation is complete and the next step is the
   review phase (`{{featurePath}}/phases/review.md`).
