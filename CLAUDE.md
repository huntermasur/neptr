# NEPTR CLI — Agent Instructions

NEPTR is a NEPTR (Adventure Time)-themed CLI that scaffolds new Vite projects with an
AI-ready setup: a `.agents/` hub (constitution, AI instructions, a single knowledge map,
a capabilities manifest for installed skills/MCP servers, plus a `skills/` folder for
installed skills), a `.docs/` tree
(`environment.md` for how to run the project, `module-map.md` for where component types
live, an `architecture/` folder with ARCHITECTURE.md + ADRs, a `feature/` folder for
`neptr feature` workspaces, and a `documents/` folder for user documents), a canonical
role-based `src/` layout (`app/`, `modules/`, `services/`, `data/`, `integrations/`,
`shared/`, `config/`) plus a root `tests/` folder, MCP config, skills.sh skills, and
Docker.

## Commands
- `npm run build` — bundle `src/cli.ts` to `dist/cli.js` via tsup
- `npm run check` — typecheck + lint + tests in one go (run before committing)
- `npm run typecheck` — tsc --noEmit
- `npm run lint` / `npm run lint:fix` — Biome lint + format (`biome.json`; templates/ and dist/ excluded)
- `npm test` — vitest suite in `test/`
- `npm link` — make the `neptr` command available globally for testing
- Test scaffolds go in a throwaway directory (scratchpad), never inside this repo

## Architecture
- `src/cli.ts` — commander entry point; subcommands: `new`, `doctor`, `adopt`, `feature`, `skill`, `mcp`, `index`
- `src/theme.ts` — NEPTR ASCII art, palette, quotes; all user-facing output goes through this
- `src/wizard.ts` — @clack/prompts flow producing a `NEPTRConfig`
- `src/prompts.ts` — shared clack helpers (`bail`, `ensure` cancel handling)
- `src/feature.ts` — `neptr feature`: scaffolds a plan → implement → review workspace
  at `.docs/feature/<slug>/` in the current project (from `templates/feature/`)
  and prints per-phase copy-paste agent prompts; never calls an LLM itself. The plan
  phase discovers reusable skills and MCP servers with `neptr skill --search-only`
  and `neptr mcp --search-only`; the implement phase installs them with
  `neptr skill --yes` / `neptr mcp --yes`. This discovery/install behavior lives in
  the phase templates (`templates/feature/phases/*.md`), not in `feature.ts`.
- `src/phase-prompts.ts` — single source of truth for the copy-paste prompts of both
  `neptr feature` and `neptr adopt`: the same `PhasePrompt[]` data drives the console
  output (`printPhasePrompts`, plain `console.log` so copies don't capture clack
  gutters) and the template vars (`phasePromptVars`) rendered into the workspace's
  `PROMPTS.md` — so terminal and file can never drift. `PROMPTS.md` persists the
  prompts past a closed terminal; its implement prompt sits between
  `<!-- neptr:implement-prompts:start/end -->` markers, which the plan-phase agent
  replaces with one prompt per `## Milestone N` group when it splits large work in
  TASKS.md (milestone rules live in the `phases/{plan,implement,review}.md`
  templates, not in TS; adopt milestones default to the workstreams).
- `src/adopt.ts` — `neptr adopt`: turns an **existing** project into a NEPTR
 project, planning a full refactor across four workstreams: code, tests, docs,
 Docker. Two halves, mirroring the split between what's safe to automate and what
 isn't. **Part A (deterministic, additive, non-destructive):** infers a
 `NEPTRConfig` from the project (name from package.json, stack from deps via
 `inferTemplate`) and retrofits the `.agents/` hub, `.docs/` tree, root agent
 instruction files, the empty role-based `src/` sections + `tests/`, and (unless
 `--no-index`) the code index + hooks — reusing `renderDir`/`writeAgentInstructions`/
 `installIndexing` with `{ overwrite: false }` so it never clobbers existing files.
 Unless `--no-docker`, it also writes **DRAFT-headed** Docker files via
 `adopt-docker.ts` when none exist (see below). **Part B (agent-driven):** scaffolds
 a migration workspace at `.docs/feature/<slug>/` (default slug `adopt-neptr-layout`)
 from `templates/adopt/`, pre-filling NOTES.md with inventories from `adopt-scan.ts`
 (code via `buildInventory`/`suggestSection`, docs, tests, detected services,
 env/config, monorepo note) — then prints the plan → implement → review copy-paste
 prompts (also persisted to the workspace's `PROMPTS.md` via `phase-prompts.ts`),
 whose phase templates work the workstreams in order code → tests → docs →
 docker. Like `feature.ts`, it never calls an LLM; the risky moves, link fixes, and
 Docker verification are the agent's job. Flags: `--name`, `--agents`, `--no-index`,
 `--no-plan`, `--no-docs`, `--no-tests`, `--no-docker`, `--yes`.
- `src/adopt-scan.ts` — pure, read-only detection/inventory functions for adopt:
 `suggestSection`/`buildInventory` (code), `suggestDocTarget`/`buildDocsInventory`
 (docs/, doc/, wiki/, root *.md minus README/LICENSE/agent files),
 `suggestTestTarget`/`buildTestsInventory` (test dirs + `.test./.spec.` files, runner
 config detection), `detectDocker` (server/db/cache deps, Prisma/Drizzle dialect
 parsing, port from .env/scripts, existing Docker files), `buildDockerInventory`,
 `buildEnvInventory` (variable **names** only from `.env.example` — never values),
 `detectWorkspaces` (monorepo warning).
- `src/adopt-docker.ts` — draft Docker generation for adopt (the deterministic half
 of the hybrid Docker workstream): `writeDockerDrafts` picks a shape from the scan
 (server/db → generic Node `templates/adopt-docker/` Dockerfile + compose; plain
 Vite → the `templates/docker/` nginx setup; existing Docker files → nothing) and
 prepends a DRAFT header the agent removes after verifying. Compose service/
 depends_on/volumes blocks are string-built in code (`buildComposeBlocks`) because
 `template.ts` does flat `{{var}}` replacement with no conditionals; db env uses
 `${VAR:-default}` compose interpolation, never literals.
- `src/skill.ts` / `src/skills-registry.ts` — `neptr skill`: searches skills.sh,
  filters to popular skills whose security audits all pass, and installs the
  selected ones into `.agents/skills/` via `npx skills add`.
- `src/indexer.ts` — `neptr index`: deterministically scans `src/` (regex export +
 top-of-file comment extraction, no LLM) into `.docs/REPO_MAP.md`, and refreshes the
 Folder map / Key files tables in `.agents/KNOWLEDGE_MAP.md` between
 `<!-- neptr:foldermap:start/end -->` / `<!-- neptr:keyfiles:start/end -->` markers
 (prose outside the markers is preserved). It also refreshes the **Skills** and **MCP
 servers** inventory tables in `.agents/CAPABILITIES.md` between
 `<!-- neptr:skills:start/end -->` / `<!-- neptr:mcp:start/end -->` markers (scanning
 `.agents/skills/*/SKILL.md` frontmatter and parsing `.mcp.json`), leaving the
 hand-written usage policy around them intact — see ADR 0002. This is the "index" Claude Code consumes —
  it has no vector index; it greps/reads, so a fresh deterministic map is the win.
  Output is byte-stable so the pre-commit hook never makes spurious diffs. Flags:
  `--quiet` (hooks), `--setup` (retrofit: install hooks in an existing project),
  `--check` (CI drift guard). `installIndexing()` is the scaffold entry used by
  `steps/indexing.ts`. Auto-maintained via a `.claude/settings.json` SessionStart hook
  and a tracked `.githooks/pre-commit` (activated by `git.ts` setting `core.hooksPath`).
- `src/mcp.ts` / `src/mcp-registry.ts` — `neptr mcp`: searches the official MCP
  registry (`registry.modelcontextprotocol.io/v0/servers` — the upstream GitHub's
  MCP registry mirrors), then runs its own transparent safety check per server
  (verified-vendor namespace, GitHub repo activity/issues, broad-access keyword
  scan, local/Docker runnability, version pinning) yielding a safe/caution/avoid
  verdict. Merges selected servers (safe by default; caution/avoid only via an
  explicit `--include-unverified` interactive opt-in — `--yes` stays restricted
  to safe) into **both** `.mcp.json` (Claude) and
  `.cursor/mcp.json` (Cursor) — the paths in `MCP_CONFIG_FILES` (config.ts), kept
  in sync so either editor sees the same servers — **version-pinned**
  (npm → `npx -y <pkg>@<ver>`, PyPI → `uvx <pkg>@<ver>`, OCI → `docker run`).
  Mirrors `neptr skill`'s `--search-only`/`--yes` planning modes; honors
  `GITHUB_TOKEN` to raise the GitHub API rate limit, degrading to "unknown" on failure.
- `src/config.ts` — `NEPTRConfig` type, flag merging, `--yes` defaults
- `src/template.ts` — copies `templates/` trees, replacing `{{var}}` placeholders
- `src/run.ts` — execa wrapper (shell on Windows for .cmd shims; whitespace-bearing
  literal args get quoted, dynamic args must be allowlist-validated upstream)
- `src/steps/*.ts` — one module per scaffold step, each exporting `run(config)`
  (`steps/agents.ts` generates root agent instruction files — CLAUDE.md, AGENTS.md
  (always), copilot/cursor/gemini — that force-read `.agents/` (including
  `CAPABILITIES.md` before using any skill/MCP) and skim skills/docs;
  `steps/src-layout.ts` lays the canonical role-based sections under `src/` —
  `app/`, `modules/`, `services/`, `data/`, `integrations/`, `shared/`, `config/` (from
  `templates/src-layout/`) — plus a root `tests/` folder (from `templates/tests/`),
  each seeded with a README; `steps/indexing.ts` runs the initial `neptr index` and
  installs its SessionStart + pre-commit hooks — placed late in `STEPS` (before git) so
  the Key files table sees the MCP/Docker files, and `git.ts` then sets `core.hooksPath`)
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
