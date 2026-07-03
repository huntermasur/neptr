# AI Working Instructions

Workflow rules for agents in {{projectName}}. The constitution
([CONSTITUTION.md](CONSTITUTION.md)) always wins over anything here. The root agent
file (AGENTS.md / CLAUDE.md / etc.) lists the required reading; this file defines the
workflow to follow once you have read it.

Build and run commands live in [../docs/COMMANDS.md](../docs/COMMANDS.md), architecture
docs in [../docs/architecture/](../docs/architecture/), and the documentation policy in
[../docs/domain/DOMAIN_DOCUMENTATION.md](../docs/domain/DOMAIN_DOCUMENTATION.md).

## Before you start any task
1. Orient yourself with [KNOWLEDGE_MAP.md](KNOWLEDGE_MAP.md), and use
   [INDEX.md](INDEX.md) to jump to the files involved.
   {{codegraphOrientation}}
2. Check [../docs/COMMANDS.md](../docs/COMMANDS.md) for how to run things.
3. If [features/](features/) contains feature folders, check each one's `STATUS.md` —
   a task that relates to an in-flight feature must follow that folder's `phases/`
   instructions.
4. If a skill in [skills/](skills/) matches the task, read it and apply it.
5. Look for existing utilities/patterns before writing new ones.

## Environment variables & secrets
- Configuration and secrets live in `.env` at the project root. **`.env` is gitignored —
  never commit it, and never hardcode secrets, tokens, or credentials in source.**
- `.env.example` is the committed template. Every variable the app reads must be listed
  there with a safe placeholder (no real secrets), and documented in
  [../docs/architecture/ARCHITECTURE.md](../docs/architecture/ARCHITECTURE.md).
- When you add or rename an environment variable, update **all three**: `.env.example`,
  the architecture doc's env section, and the local `.env`.
- This is a Vite app: only variables prefixed with `VITE_` are exposed to client code via
  `import.meta.env`. Anything without that prefix stays out of the browser bundle — keep
  secrets unprefixed.

## While working
- Keep changes small and incremental; verify each increment (typecheck, build, run).
- Match existing code style. Comments explain *why*, not *what*.
- New files go where [../docs/architecture/ARCHITECTURE.md](../docs/architecture/ARCHITECTURE.md) says they belong.
- When you make a major architectural decision (new dependency, new pattern, new
  boundary, a new top-level structure), record it in the architecture folder:
  update [../docs/architecture/ARCHITECTURE.md](../docs/architecture/ARCHITECTURE.md)
  and add an ADR in [../docs/architecture/adr/](../docs/architecture/adr/) (copy the
  format of the existing ADRs). Larger specs also live in `../docs/architecture/`.

## Before you finish
1. Run the build (`npm run build`) and fix anything it surfaces.
2. Apply the documentation policy — this is mandatory, not optional:
   - Consult the change-type table in [../docs/domain/DOMAIN_DOCUMENTATION.md](../docs/domain/DOMAIN_DOCUMENTATION.md).
   - Update every document that table requires for your kind of change.
   - **Architectural or structural changes — files/folders added, moved, or removed;
     new dependencies; changed module boundaries — must update both
     [KNOWLEDGE_MAP.md](KNOWLEDGE_MAP.md) (folder map + diagram) and
     [INDEX.md](INDEX.md) (file links) in the same change, plus
     [../docs/architecture/ARCHITECTURE.md](../docs/architecture/ARCHITECTURE.md) and a
     new ADR. Bump the "Last updated" date on any map/index you touch. The work is not
     done until all reflect reality.**
   - If you added or changed a script, update [../docs/COMMANDS.md](../docs/COMMANDS.md).
3. Summarize what you did, what you verified, and which docs you updated.

## Definition of "notable change"
Any of: new feature; changed user-facing behavior; new/moved/deleted file or folder;
new dependency; changed build/dev workflow; new environment variable; architectural
decision; bug fix that reveals a misunderstanding worth documenting.
Typo fixes and pure formatting are not notable.
