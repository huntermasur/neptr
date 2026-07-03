# Beemo — Development Task Checklist

Milestone checklist for building the Beemo CLI. Check items off as they land.
Full plan context lives in the project README and CLAUDE.md.

## M0 — Bootstrap
- [x] git repo, package.json, tsconfig, tsup config, .gitignore
- [x] TASKS.md, CLAUDE.md, README.md for the Beemo repo itself
- [x] `src/cli.ts` + `src/theme.ts`: `beemo` prints BMO banner, `beemo --help` works
- [x] Verified: `npm run build && npm link && beemo --help`

## M1 — Core scaffold
- [x] Wizard skeleton (`src/wizard.ts`, `src/config.ts`): project name + Vite template
- [x] `steps/vite.ts` — wraps `npm create vite@latest`
- [x] `steps/install.ts` — npm install in the new project
- [x] `steps/git.ts` — git init, .gitignore augmentation, initial commit
- [x] Verified: `beemo new test-app` produces a running Vite app with git history

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
      files (CLAUDE.md, .github/copilot-instructions.md, .cursor/rules/beemo.mdc, GEMINI.md);
      AGENTS.md always generated; every file force-reads `.agents/` and skims skills/docs
- [x] Verified: generated .mcp.json is valid JSON with all selected servers

## M4 — Skills
- [x] Curated bundled list of top skills.sh skills (find-skills, anthropics/skills, vercel react, agent-browser, grill-me)
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
  machine (`beemo doctor` flags this). Run it after installing Docker Desktop.

## M7 — Polish + doctor
- [x] `beemo doctor` — checks node >= 20, npm, git, docker daemon, codegraph, npm registry
- [x] `--yes` non-interactive mode + full flag coverage (--template/--agents/--mcp/--skills/--docker/--no-git/--no-install)
- [x] Failure tolerance: non-critical step failures warn + continue; end summary lists fixes
- [x] Verified: `beemo new full-app --yes` with every option runs clean end to end

## M8 — Final E2E verification
- [x] Scaffolded `full-app` with all options: vite ✔ docs ✔ mcp(4 servers) ✔ docker files ✔
      deps ✔ skills ✔ codegraph ✔ git ✔
- [x] Dev server verified: HTTP 200 with correct title
- [x] TASKS.md fully checked; README/CLAUDE.md current

## M9 — `beemo feature` (plan → implement → review workspaces)
- [x] `src/prompts.ts` — shared `bail`/`ensure` clack helpers (extracted from wizard)
- [x] `src/feature.ts` — `beemo feature` flow: name/description prompts, slugify,
      `.agents/` detection with non-beemo bootstrap confirm, non-clobber guard
- [x] `templates/feature/` — PLAN/TASKS/STATUS/NOTES + `phases/{plan,implement,review}.md`
- [x] `templates/.agents/features/README.md` — folder convention, ships with new scaffolds
- [x] Discovery wiring: AI_INSTRUCTIONS hub row + before-you-start item, KNOWLEDGE_MAP
      folder row, agents.ts read-as-needed bullet
- [x] Side-fix: moved `templates/docs/commands/COMMANDS.md` → `templates/docs/COMMANDS.md`
      so generated `docs/COMMANDS.md` links resolve
- [x] Verified: scaffold + `beemo feature` end to end in a scratchpad project

## Backlog (future ideas)
- [ ] `beemo add <feature>` — retrofit docs/docker/mcp/skills onto an existing project
- [ ] `beemo feature list` — show feature workspaces and their `Status:` lines
- [ ] Live docker compose build verification once Docker Desktop is installed
- [ ] Publish to npm so `npx beemo-cli` works without cloning
