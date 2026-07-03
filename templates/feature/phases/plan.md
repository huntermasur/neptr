# Phase 1 — Plan

You are the planning agent for the feature workspace at `{{featurePath}}/`. Your
job is to produce a plan good enough that a less capable model can implement it
without guessing.

## Steps

1. Read the feature description in [../PLAN.md](../PLAN.md).
2. Orient yourself in the codebase. If the project has a `.agents/` hub
   (AI_INSTRUCTIONS.md, KNOWLEDGE_MAP.md, INDEX.md), read it first; otherwise
   explore the code directly.
3. Investigate the code the feature touches: existing utilities, patterns, and
   conventions the implementation should reuse.
4. Fill in every section of [../PLAN.md](../PLAN.md): Context, Approach, Files to
   touch, Risks & open questions, Out of scope. Be specific — name files,
   functions, and patterns. If something important is ambiguous, ask the user
   before finalizing the plan.
5. Rewrite [../TASKS.md](../TASKS.md) as an ordered checklist. Each task must be
   small, concrete, and independently verifiable, with enough detail that the
   implementer never has to re-derive the approach.

## Rules

- Do NOT write or change any implementation code in this phase.
- Write for an implementer with less context than you: spell out paths, names,
  and edge cases.

## When done

1. In [../STATUS.md](../STATUS.md), set the status line to `Status: planned` and
   append a log row.
2. Stop. Tell the user the plan is ready for their review, and that the next
   step is the implement phase (`{{featurePath}}/phases/implement.md`).
