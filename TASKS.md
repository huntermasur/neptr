# NEPTR — Development Task Checklist

Milestone checklist for building the NEPTR CLI. Check items off as they land.
Full plan context lives in the project README and CLAUDE.md.

## M0 — Bootstrap
- [x] git repo, package.json, tsconfig, tsup config, .gitignore
- [x] TASKS.md, CLAUDE.md, README.md for the NEPTR repo itself
- [x] `src/cli.ts` + `src/theme.ts`: `neptr` prints NEPTR banner, `neptr --help` works
- [x] Verified: `npm run build && npm link && neptr --help`

## M1 — Core scaffold
- [x] Wizard skeleton (`src/wizard.ts`, `src/config.ts`): project name + Vite template
- [x] `steps/vite.ts` — wraps `npm create vite@latest`
- [x] `steps/install.ts` — npm install in the new project
- [x] `steps/git.ts` — git init, .gitignore augmentation, initial commit
- [x] Verified: `neptr new test-app` produces a running Vite app with git history

## M2 — AI & docs layer
- [x] `src/template.ts` — {{var}} renderer + directory copier
- [x] Templates: AGENTS.md, CLAUDE.md, ai/ (CONSTITUTION, DOMAIN_RULES, AI_INSTRUCTIONS)
- [x] Templates: docs/ (COMMANDS, architecture/ARCHITECTURE + adr/0001, domain/DOMAIN_DOCUMENTATION + DOMAIN_INSTRUCTIONS, files/)
- [x] README regeneration for scaffolded projects
- [x] Verified: scaffolded project has full docs tree with placeholders resolved (0 unresolved `{{}}`)

## M3 — MCP + agent adapters
- [x] `.mcp.json` generation from server checklist (codegraph, playwright, context7, github)
- [x] `.cursor/rules/project.mdc` adapter when Cursor selected; GEMINI.md for Gemini; Codex uses AGENTS.md natively
- [x] `steps/agents.ts` — agent picker in the wizard (`--agents`) writes root instruction
      files (CLAUDE.md, .github/copilot-instructions.md, .cursor/rules/neptr.mdc, GEMINI.md);
      AGENTS.md always generated; every file force-reads `.agents/` and skims skills/docs
- [x] Verified: generated .mcp.json is valid JSON with all selected servers

## M4 — Skills
- [x] Curated bundled list of top skills.sh skills (agent-browser, anthropics/skills,
      find-skills, grill-me, impeccable, improve-codebase-architecture,
      vercel-react-best-practices, web-design-guidelines), sorted alphabetically with a
      "Select all" row atop the wizard's multiselect
- [x] `npx skills add <repo> --yes --skill * --agent <agents>` per selection, per-skill success/fail reporting
- [x] Verified: mattpocock/skills installed into `.claude/skills/` in a scaffolded project
- Note: live leaderboard fetch dropped — skills.sh has no public JSON API (client-rendered
  Next.js app; /api/* returns 404). The curated list is the maintained source; edit
  `CURATED_SKILLS` in `src/config.ts` to change it.

## M5 — codegraph
- [x] Detect codegraph binary; auto-install `@colbymchenry/codegraph` globally when missing
- [x] Run `codegraph init` in new project; `.codegraph/` gitignored via git step
- [x] Graceful skip on failure (step orchestrator warns + continues + prints manual fix)
- [x] Verified: `.codegraph/codegraph.db` exists after scaffold

## M6 — Docker
- [x] Multi-stage Dockerfile (dev / build / nginx prod), docker-compose.yml, .dockerignore, nginx.conf
- [x] Optional `docker compose build` offer at end when daemon detected (interactive mode)
- [x] Verified: files generated correctly with project name substituted
- Note: a live `docker compose build` was NOT verified — Docker is not installed on this
  machine (`neptr doctor` flags this). Run it after installing Docker Desktop.

## M7 — Polish + doctor
- [x] `neptr doctor` — checks node >= 20, npm, git, docker daemon, codegraph, npm registry
- [x] `--yes` non-interactive mode + full flag coverage (--template/--agents/--mcp/--skills/--docker/--no-git/--no-install)
- [x] Failure tolerance: non-critical step failures warn + continue; end summary lists fixes
- [x] Verified: `neptr new full-app --yes` with every option runs clean end to end

## M8 — Final E2E verification
- [x] Scaffolded `full-app` with all options: vite ✔ docs ✔ mcp(4 servers) ✔ docker files ✔
      deps ✔ skills ✔ codegraph ✔ git ✔
- [x] Dev server verified: HTTP 200 with correct title
- [x] TASKS.md fully checked; README/CLAUDE.md current

## M9 — `neptr feature` (plan → implement → review workspaces)
- [x] `src/prompts.ts` — shared `bail`/`ensure` clack helpers (extracted from wizard)
- [x] `src/feature.ts` — `neptr feature` flow: name/description prompts, slugify,
      `.agents/` detection with non-neptr bootstrap confirm, non-clobber guard
- [x] `templates/feature/` — PLAN/TASKS/STATUS/NOTES + `phases/{plan,implement,review}.md`
- [x] `templates/.agents/features/README.md` — folder convention, ships with new scaffolds
- [x] Discovery wiring: AI_INSTRUCTIONS hub row + before-you-start item, KNOWLEDGE_MAP
      folder row, agents.ts read-as-needed bullet
- [x] Side-fix: moved `templates/docs/commands/COMMANDS.md` → `templates/docs/COMMANDS.md`
      so generated `docs/COMMANDS.md` links resolve
- [x] Verified: scaffold + `neptr feature` end to end in a scratchpad project

## M10 — `neptr mcp` (security-checked MCP servers) — original skillful.sh version, superseded by M12
- [x] `src/mcp-registry.ts` — skillful.sh REST client: `/api/v1/items?type=mcp_server`
      search + `/api/v1/items/:slug` security-score lookup, grade→verdict mapping,
      npm→`npx -y` / PyPI→`uvx` launch-config derivation (browser-like UA to clear the WAF)
- [x] `src/mcp.ts` — `neptr mcp` flow mirroring `neptr skill`: search, `--min-grade`
      filter (default A), multiselect, merge into project `.mcp.json` (preserving
      existing entries); `--search-only` + `--yes` planning modes
- [x] `neptr mcp` registered in `src/cli.ts`; `test/mcp-registry.test.ts` added
- [x] Verified: live search-only + `--yes` install writes a valid `.mcp.json` in a scratchpad

## M11 — `.docs/` rework (hidden docs tree + single knowledge map)
- [x] Renamed scaffolded `docs/` → `.docs/`; reshaped to `architecture/`, `feature/`,
      `documents/`, plus new `module-map.md` (src/ component-type map) and `environment.md`
      (run-on-a-new-machine + commands, absorbing `COMMANDS.md` and the env section)
- [x] Dropped `docs/domain/`; folded the doc-update policy table into `AI_INSTRUCTIONS.md`
- [x] Removed `.agents/INDEX.md`; folded its key-files section into `KNOWLEDGE_MAP.md`
      (now the single guide) and repointed every reference (agents.ts, constitution, README)
- [x] `neptr feature` now writes to `.docs/feature/<slug>/` (`src/feature.ts`, `src/cli.ts`)
- [ ] Verified: scaffold a demo + `neptr feature` end to end in a scratchpad project

## M12 — `neptr mcp` re-sourced to the official MCP registry + feature-phase discovery
- [x] `src/mcp-registry.ts` rewritten as a client for `registry.modelcontextprotocol.io`
      (`/v0/servers` search) + a transparent verifier: verified-vendor namespace,
      GitHub repo activity/issues (with `GITHUB_TOKEN` support, degrading to unknown),
      broad-access keyword scan, local/Docker runnability, version pinning → safe/caution/avoid
- [x] `src/mcp.ts` — verdict-based filtering (default `safe`, `--include-unverified` shows
      caution/avoid), per-server checklist, **version-pinned** `.mcp.json` entries, secret flagging;
      dropped `--min-grade` (updated `src/cli.ts` help)
- [x] `neptr feature` phases discover/install MCP servers: `phases/plan.md` +
      `PLAN.md` "Recommended MCP servers" section; `phases/implement.md` install step
- [x] `test/mcp-registry.test.ts` rewritten for the new client + verifier
- [ ] Verified: live `--search-only` + `--yes` install writes a valid, version-pinned `.mcp.json`

## M13 — `neptr index` (deterministic repo index for Claude Code)
- [x] `src/indexer.ts` — deterministic scan of `src/` (regex export + top-of-file purpose
      extraction) → `.docs/REPO_MAP.md`; marker-based refresh of the Folder map / Key files
      tables in `.agents/KNOWLEDGE_MAP.md`; `runIndex` (`--quiet`/`--setup`/`--check`)
- [x] `templates/.agents/KNOWLEDGE_MAP.md` — `neptr:foldermap`/`neptr:keyfiles` markers +
      REPO_MAP.md row in the documentation index
- [x] `templates/.githooks/pre-commit` — non-blocking `neptr index --quiet` + stage
- [x] `src/steps/indexing.ts` (`indexingStep`) wired into `STEPS` before git; `.claude/settings.json`
      SessionStart hook + `.githooks/pre-commit` installed; `git.ts` sets `core.hooksPath`
- [x] `neptr index` registered in `src/cli.ts`
- [ ] Verified: scaffold + `neptr index` refresh + determinism + retrofit in a scratchpad project

## M14 — `neptr adopt` (turn an existing project into a NEPTR project)
- [x] `src/adopt.ts` — Part A retrofit (infer name/stack, non-destructive `.agents/`,
      `.docs/`, agent files, `src/` sections, `tests/`, code index) reusing
      `renderDir`/`writeAgentInstructions`/`installIndexing` with `{ overwrite: false }`
- [x] `src/template.ts` — `RenderOptions` (`overwrite`/`onSkip`) on `renderFile`/`renderDir`;
      `steps/agents.ts` — extracted `writeAgentInstructions` with the same options
- [x] Part B: `templates/adopt/` (PLAN/TASKS/STATUS/NOTES + `phases/{plan,implement,review}.md`)
      rendered into `.docs/feature/<slug>/`; NOTES pre-filled by `buildInventory()` +
      `suggestSection()` heuristic mapping; plan → implement → review prompts printed
- [x] `neptr adopt` registered in `src/cli.ts` (`--name/--agents/--no-index/--no-plan/--yes`)
- [x] `test/adopt.test.ts` — suggestSection / inferTemplate / buildInventory
- [x] Verified: `neptr adopt --yes` retrofits + plans in a scratchpad; re-run leaves 22 files untouched

## M15 — `neptr adopt` full-project refactor (code + tests + docs + Docker)
- [x] `src/adopt-scan.ts` — moved `suggestSection`/`buildInventory` out of adopt.ts; added
      `buildDocsInventory`/`suggestDocTarget`, `buildTestsInventory`/`suggestTestTarget`,
      `detectDocker` (server/db/cache deps, Prisma/Drizzle dialects, port resolution,
      existing-Docker detection), `buildDockerInventory`, `buildEnvInventory` (names only),
      `detectWorkspaces`
- [x] `src/adopt-docker.ts` + `templates/adopt-docker/` — DRAFT-headed Dockerfile/compose
      drafts; compose service blocks string-built in code; Vite SPA reuses `templates/docker/`
- [x] `src/adopt.ts` — up-front scans in the confirm summary, Part A.5 draft step
      (failure-tolerant), new NOTES.md inventory vars, broadened prompts;
      `src/cli.ts` — `--no-docs`/`--no-tests`/`--no-docker`
- [x] `templates/adopt/` — PLAN (3 mapping tables + Docker plan), NOTES (5 inventory
      sections + monorepo note), TASKS, and all three phases reworked around the
      code → tests → docs → docker workstreams
- [x] `test/adopt-scan.test.ts`, `test/adopt-docker.test.ts`; `test/adopt.test.ts` imports fixed
- [x] Verified: fixture adopts in a scratchpad (express+pg+redis, Vite SPA, docs/tests
      project, existing-Dockerfile project) + skip-flag run; `docker compose config`
      parses the drafted compose clean; no secrets leak, 0 unresolved `{{}}`

## M16 — Persisted phase prompts + milestone breakdown
- [x] `src/phase-prompts.ts` — single source of truth for the plan/implement/review
      copy-paste prompts (`featurePhasePrompts`/`adoptPhasePrompts`), console printer
      (`printPhasePrompts`), and template vars (`phasePromptVars`)
- [x] `templates/feature/PROMPTS.md` + `templates/adopt/PROMPTS.md` — prompts persisted
      into every workspace with `neptr:implement-prompts` markers for milestone rewrites
- [x] `src/feature.ts` / `src/adopt.ts` wired to the shared prompts (adopt writes
      PROMPTS.md only when the migration workspace is created)
- [x] Milestone breakdown in phase templates: plan phases split large work into
      `## Milestone N` TASKS.md groups + per-milestone implement prompts in PROMPTS.md;
      implement phases gained milestone scoping/status gates; review phases verify
      all milestones (adopt milestones default to the code → tests → docs → docker
      workstreams)
- [x] `test/phase-prompts.test.ts` — prompt order/content, template vars, PROMPTS.md
      render contract (no unresolved `{{}}`, markers present)
- [x] Verified: `neptr feature` + `neptr adopt` in scratchpad projects write PROMPTS.md
      matching the console output; `--no-plan` writes none

## M17 — `.agents/CAPABILITIES.md` (skills & MCP manifest + usage policy)
- [x] `templates/.agents/CAPABILITIES.md` — hand-written usage policy (list-to-use,
      prefer fewest tools, one capability/one tool, human-curated precedence) + generated
      `neptr:skills`/`neptr:mcp` inventory markers
- [x] `src/indexer.ts` — `refreshCapabilities`: scans `.agents/skills/*/SKILL.md`
      frontmatter + parses `.mcp.json` into byte-stable tables; wired into `installIndexing`
      and `runIndex`; `.agents/CAPABILITIES.md` added to `KNOWN_KEY_FILES`
- [x] `templates/.githooks/pre-commit` stages `.agents/CAPABILITIES.md`
- [x] Required-reading wiring: `steps/agents.ts` agentBody, `templates/.agents/AI_INSTRUCTIONS.md`
      step 4, `templates/.agents/KNOWLEDGE_MAP.md` doc-index row, skills README; feature/adopt
      implement phases point overlaps at the precedence list
- [x] Docs: ADR 0002, ARCHITECTURE.md decisions list, CLAUDE.md, README.md
- [ ] Verified: scaffold a demo, install a skill + MCP server, confirm the tables refresh
      deterministically in a scratchpad project

## M-prod — Production-readiness review pass (2026-07-06)
- [x] Repo hygiene: removed committed `undefined/src/**` scaffold artifact and the
      dogfooded root `tests/README.md`
- [x] Bug fixes (each with a regression test): CRLF-tolerant indexer markers and
      line-ending-normalized `--check`/rewrite comparisons; `--check` also validates the
      KNOWLEDGE_MAP/CAPABILITIES marker tables; registry skill ids validated against an
      `owner/repo[@slug]` allowlist before reaching the shell; adopt code inventory
      excludes test files; `neptr.warn`/`error` go to stderr; short vendor tokens (aws, s3)
      need word boundaries; package.json with a UTF-8 BOM no longer parses as empty
- [x] Dead code removed (SRC_SECTIONS, toolingNotes, adopt stack var, unused imports);
      run() quoting corrected (whitespace-bearing literals quoted, dynamic args
      allowlist-validated) and its docs fixed
- [x] Generated projects: `.gitattributes` pins the three generated docs to LF;
      Dockerfile drafts keep `# syntax=` on line 1; `--search-only` prints exact
      `owner/repo@slug` install commands and `neptr skill <exact-arg>` installs directly;
      rate-limited audit fetches no longer masquerade as "unaudited"
- [x] `.agents/` hub templates deduplicated — each rule lives in exactly one file
- [x] Biome lint/format added (`npm run lint`, `lint:fix`, and `check` = typecheck +
      lint + test); repo `.gitattributes` keeps `templates/**` LF
- [x] Verified end-to-end in a scratchpad: scaffold (no `{{}}` leftovers, `index --check`
      green incl. CRLF working copies, stale tables detected), adopt (test files excluded
      from code inventory, Docker drafts correct, re-run non-destructive), live skill search

## Backlog (future ideas)
- [ ] `neptr feature list` — show feature workspaces and their `Status:` lines
- [ ] Live docker compose build verification once Docker Desktop is installed
- [ ] Publish to npm so `npx neptr-cli` works without cloning
