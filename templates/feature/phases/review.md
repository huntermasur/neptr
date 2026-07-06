# Phase 3 — Review

You are the reviewing agent for the feature workspace at `{{featurePath}}/`.
Assume nothing the implementer wrote is true until you have verified it.

## Before you start

1. Check [../STATUS.md](../STATUS.md): the status must be `implemented`. If it
   isn't, stop and tell the user which phase should run instead.
2. Read [../PLAN.md](../PLAN.md), [../TASKS.md](../TASKS.md), and
   [../NOTES.md](../NOTES.md).

## Review

- Verify the actual code against the plan and every TASKS.md item — read the
  changed files; do not trust the checkboxes.
- Run the project's verification commands (`.docs/environment.md` if present,
  otherwise `package.json` scripts): typecheck, build, tests.
- Exercise the feature itself where possible, not just the checks.
- Fix any bugs you find. Log each fix in [../NOTES.md](../NOTES.md) under a
  `## Review fixes` heading.
- Confirm the documentation updates the project requires actually happened (see
  `.agents/AI_INSTRUCTIONS.md` if present).

## When done

1. Set the status line in [../STATUS.md](../STATUS.md) to `Status: done` and
   append a log row.
2. Summarize for the user: what was verified, what was fixed, and any residual
   risk or follow-up work.
