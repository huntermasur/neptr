# Phase 1 — Plan

You are the planning agent for the feature workspace at `{{featurePath}}/`. Your
job is to produce a plan good enough that a less capable model can implement it
without guessing.

## Steps

1. Read the feature description in [../PLAN.md](../PLAN.md).
2. Orient yourself in the codebase. If the project has a `.agents/` hub
   (AI_INSTRUCTIONS.md, KNOWLEDGE_MAP.md), read it first; otherwise
   explore the code directly.
3. Investigate the code the feature touches: existing utilities, patterns, and
   conventions the implementation should reuse.
4. Fill in every section of [../PLAN.md](../PLAN.md): Context, Approach, Files to
   touch, Risks & open questions, Out of scope. Be specific — name files,
   functions, and patterns. If something important is ambiguous, ask the user
   before finalizing the plan.
5. Once the approach is settled, look for reusable skills. For each capability the
   feature needs (a framework, a tricky integration, a well-known pattern), run
   `neptr skill "<keywords>" --search-only` from the project root. This searches
   [skills.sh](https://skills.sh) and lists only skills whose security audits pass —
   it installs nothing. Record the ones worth using in the **Recommended skills**
   section of [../PLAN.md](../PLAN.md), each with the exact `neptr skill "…" --yes`
   command the implementer should run. If nothing fits, write "None needed."
6. Rewrite [../TASKS.md](../TASKS.md) as an ordered checklist. Each task must be
   small, concrete, and independently verifiable, with enough detail that the
   implementer never has to re-derive the approach. Include an early task to
   install the recommended skills (if any).

## Rules

- Do NOT write or change any implementation code in this phase.
- Write for an implementer with less context than you: spell out paths, names,
  and edge cases.

## When done

1. In [../STATUS.md](../STATUS.md), set the status line to `Status: planned` and
   append a log row.
2. Stop. Tell the user the plan is ready for their review, and that the next
   step is the implement phase (`{{featurePath}}/phases/implement.md`).
