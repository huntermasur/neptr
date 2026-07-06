# AI Working Instructions

Workflow rules for agents in neptr-cli. The constitution
([CONSTITUTION.md](CONSTITUTION.md)) always wins over anything here. The root agent
file (AGENTS.md / CLAUDE.md / etc.) lists the required reading; this file defines the
workflow to follow once you have read it.

How to run the project lives in [../.docs/environment.md](../.docs/environment.md),
architecture docs in [../.docs/architecture/](../.docs/architecture/), and where each type
of component belongs in [../.docs/module-map.md](../.docs/module-map.md). The documentation
policy is the "Before you finish" section below.

## Work as a partner
You are a collaborator, not just an executor. Throughout every task:
- **Ask clarifying questions first.** If the request is ambiguous, underspecified, or has
  more than one plausible reading, ask before writing code. A short question now beats a
  wrong implementation later. Only skip this when the answer is already settled (e.g. an
  approved `PLAN.md`).
- **Offer options.** When multiple reasonable approaches exist, lay them out with their
  trade-offs and recommend one. Let the human choose on decisions that matter.
- **Explain your reasoning.** State why you picked an approach, what you ruled out, and
  what assumptions you are relying on — briefly, so the human can course-correct early.
- **Speak up.** Flag risks, edge cases, and better alternatives you notice, and push back
  respectfully when something looks wrong instead of silently complying.

## Before you start any task
1. Orient yourself with [KNOWLEDGE_MAP.md](KNOWLEDGE_MAP.md) — the folder map, key files,
   and where each component type lives ([../.docs/module-map.md](../.docs/module-map.md)).
2. Check [../.docs/environment.md](../.docs/environment.md) for how to run things.
3. If [../.docs/feature/](../.docs/feature/) contains feature folders, check each one's
   `STATUS.md` — a task that relates to an in-flight feature must follow that folder's
   `phases/` instructions.
4. If a skill in [skills/](skills/) matches the task, read it and apply it.
5. Look for existing utilities/patterns before writing new ones.

## Environment variables & secrets
- Configuration and secrets live in `.env` at the project root. **`.env` is gitignored —
  never commit it, and never hardcode secrets, tokens, or credentials in source.**
- `.env.example` is the committed template. Every variable the app reads must be listed
  there with a safe placeholder (no real secrets), and documented in
  [../.docs/environment.md](../.docs/environment.md).
- When you add or rename an environment variable, update **all three**: `.env.example`,
  the env-variable table in [../.docs/environment.md](../.docs/environment.md), and the local `.env`.
- This is a Vite app: only variables prefixed with `VITE_` are exposed to client code via
  `import.meta.env`. Anything without that prefix stays out of the browser bundle — keep
  secrets unprefixed.

## While working
- Keep changes small and incremental; verify each increment (typecheck, build, run).
- Match existing code style. Comments explain *why*, not *what*.
- New files go where [../.docs/module-map.md](../.docs/module-map.md) and
  [../.docs/architecture/ARCHITECTURE.md](../.docs/architecture/ARCHITECTURE.md) say they belong.
- When you make a major architectural decision (new dependency, new pattern, new
  boundary, a new top-level structure), record it in the architecture folder:
  update [../.docs/architecture/ARCHITECTURE.md](../.docs/architecture/ARCHITECTURE.md)
  and add an ADR in [../.docs/architecture/adr/](../.docs/architecture/adr/) (copy the
  format of the existing ADRs). Larger specs also live in `../.docs/architecture/`.

## Before you finish
1. Run the build (`npm run build`) and fix anything it surfaces.
2. Apply the documentation policy — this is mandatory, not optional. Update every
   document your kind of change requires:

   | When you… | Update |
   | --- | --- |
   | Fix a non-obvious bug | Inline comment on the *why* |
   | Add a feature | [../.docs/architecture/ARCHITECTURE.md](../.docs/architecture/ARCHITECTURE.md); README if user-facing |
   | Add/move/delete files or folders | [KNOWLEDGE_MAP.md](KNOWLEDGE_MAP.md) (folder map, key files + diagram); [../.docs/module-map.md](../.docs/module-map.md) if a `src/` component type moved |
   | Add a dependency | [../.docs/architecture/ARCHITECTURE.md](../.docs/architecture/ARCHITECTURE.md); [KNOWLEDGE_MAP.md](KNOWLEDGE_MAP.md); a new ADR if significant |
   | Change architecture, boundaries, or patterns | [../.docs/architecture/ARCHITECTURE.md](../.docs/architecture/ARCHITECTURE.md) + a new ADR in [../.docs/architecture/adr/](../.docs/architecture/adr/); [KNOWLEDGE_MAP.md](KNOWLEDGE_MAP.md) and [../.docs/module-map.md](../.docs/module-map.md) |
   | Add/rename an environment variable | [../.docs/environment.md](../.docs/environment.md) env table, `.env.example`, and local `.env` |
   | Add/change an npm script or command | [../.docs/environment.md](../.docs/environment.md) |

   **Any structural change — files/folders added, moved, or removed; new dependencies;
   changed module boundaries — must update [KNOWLEDGE_MAP.md](KNOWLEDGE_MAP.md) in the
   same change, plus [../.docs/architecture/ARCHITECTURE.md](../.docs/architecture/ARCHITECTURE.md)
   and a new ADR. Bump the "Last updated" date on the knowledge map. The work is not done
   until all reflect reality.**
3. Summarize what you did, what you verified, and which docs you updated.

## Definition of "notable change"
Any of: new feature; changed user-facing behavior; new/moved/deleted file or folder;
new dependency; changed build/dev workflow; new environment variable; architectural
decision; bug fix that reveals a misunderstanding worth documenting.
Typo fixes and pure formatting are not notable.
