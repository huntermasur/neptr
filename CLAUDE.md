# NEPTR CLI — Agent Instructions

NEPTR is a NEPTR (Adventure Time)-themed CLI that scaffolds new Vite projects with an
AI-ready setup: a `.agents/` hub (constitution, AI instructions, knowledge map, file
index, plus a `skills/` folder for installed skills), a docs tree
(COMMANDS.md, an `architecture/` folder with ARCHITECTURE.md + ADRs, a `domain/` folder
with DOMAIN_DOCUMENTATION.md + DOMAIN_INSTRUCTIONS.md, and a `files/` folder for user
documents), MCP config,
skills.sh skills, codegraph indexing, and Docker.

## Commands
- `npm run build` — bundle `src/cli.ts` to `dist/cli.js` via tsup
- `npm run typecheck` — tsc --noEmit (run before committing)
- `npm link` — make the `neptr` command available globally for testing
- Test scaffolds go in a throwaway directory (scratchpad), never inside this repo

## Architecture
- `src/cli.ts` — commander entry point; subcommands: `new`, `doctor`, `feature`, `skill`, `mcp`
- `src/theme.ts` — NEPTR ASCII art, palette, quotes; all user-facing output goes through this
- `src/wizard.ts` — @clack/prompts flow producing a `NEPTRConfig`
- `src/prompts.ts` — shared clack helpers (`bail`, `ensure` cancel handling)
- `src/feature.ts` — `neptr feature`: scaffolds a plan → implement → review workspace
  at `.agents/features/<slug>/` in the current project (from `templates/feature/`)
  and prints per-phase copy-paste agent prompts; never calls an LLM itself. The plan
  phase discovers reusable skills with `neptr skill --search-only`; the implement
  phase installs them with `neptr skill --yes` (both defined in `src/skill.ts`).
- `src/skill.ts` / `src/skills-registry.ts` — `neptr skill`: searches skills.sh,
  filters to popular skills whose security audits all pass, and installs the
  selected ones into `.agents/skills/` via `npx skills add`.
- `src/mcp.ts` / `src/mcp-registry.ts` — `neptr mcp`: searches skillful.sh's public
  JSON API for MCP servers, filters by security grade (`--min-grade`, default A),
  and merges the selected ones into the project's `.mcp.json` (npm → `npx -y`,
  PyPI → `uvx`). Mirrors `neptr skill`'s `--search-only`/`--yes` planning modes.
- `src/config.ts` — `NEPTRConfig` type, flag merging, `--yes` defaults
- `src/template.ts` — copies `templates/` trees, replacing `{{var}}` placeholders
- `src/run.ts` — execa wrapper with themed spinners
- `src/steps/*.ts` — one module per scaffold step, each exporting `run(config)`
  (`steps/agents.ts` generates root agent instruction files — CLAUDE.md, AGENTS.md
  (always), copilot/cursor/gemini — that force-read `.agents/` and skim skills/docs)
- `templates/` — every file generated into scaffolded projects; ships in the npm package

## Conventions
- ESM only (`"type": "module"`); Node >= 20
- Scaffold steps must be failure-tolerant: a failing step warns (in NEPTR voice), skips,
  and is listed in the end-of-run summary with a manual-fix command. Never abort the
  whole scaffold because one network-dependent step failed.
- Keep NEPTR's personality in user-facing strings, but never in generated project files
  other than the README credit line.

## Process
- TASKS.md is the milestone checklist — update it whenever a milestone lands.
- Update this file and README.md when architecture or commands change notably.
