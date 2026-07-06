# NEPTR 🤖

> "NEPTR, deploy!"

NEPTR is a NEPTR-themed CLI for starting new projects the right way. It scaffolds a
[Vite](https://vitejs.dev) app, then layers on a complete AI-ready setup so every
project begins with the same file structure and the same default behavior for AI
coding agents.

## What it sets up

- **Vite app** — any official framework/variant via `npm create vite`
- **`.agents/` hub** — the **AI constitution** (`CONSTITUTION.md`), **workflow
  instructions** (`AI_INSTRUCTIONS.md`), and a single **knowledge map**
  (`KNOWLEDGE_MAP.md`) — plus a `skills/`
  folder for installed skills.sh skills — with rules that keep the map in sync with the code
- **`.docs/` tree** — `environment.md` (how to run the project), `module-map.md` (where
  each component type lives), an `architecture/` folder (architecture doc, specs, ADRs), a
  `feature/` folder for `neptr feature` workspaces, and a `documents/` folder for user documents
- **Repo index for Claude Code** — `neptr index` scans `src/` into `.docs/REPO_MAP.md`
  (a deterministic, greppable per-file map of exports) and keeps the `KNOWLEDGE_MAP.md`
  tables current; auto-refreshed via a Claude Code SessionStart hook and a git pre-commit hook
- **MCP config** (`.mcp.json` for Claude + `.cursor/mcp.json` for Cursor, kept in sync) — context7, docker, git/github, memory, playwright, sequential-thinking (your pick, all selected by default)
- **Skills** — checklist of top [skills.sh](https://skills.sh) skills
- **Docker** — multi-stage Dockerfile + compose for dev and prod
- **Git** — init, .gitignore, initial commit, dependencies installed

## Usage

```bash
npm install
npm run build
npm link        # makes `neptr` available globally

neptr new my-app          # interactive NEPTR wizard
neptr new my-app --yes    # accept all defaults
neptr doctor              # check your environment
neptr adopt               # turn the current existing project into a NEPTR project
neptr feature             # start a plan → implement → review feature workspace
neptr skill web design    # find & install security-checked skills from skills.sh
neptr mcp postgres        # find & install safety-checked MCP servers from the MCP registry
neptr index               # rebuild the repo map Claude Code reads (auto-run by hooks)
```

## Installing skills

Inside a project, `neptr skill <search terms>` searches [skills.sh](https://skills.sh),
keeps only skills with a healthy install count (`--min-installs`, default 1000)
whose security audits **all pass**, and lets you pick any number to install into
`.agents/skills/` without leaving your editor. Pass `--include-unverified` to also
see skills with audit warnings or no audits yet (their status is shown inline).

Two non-interactive modes drive the feature workflow: `--search-only` lists the
audit-passing matches and installs nothing (used by the plan phase to discover
skills), and `--yes` installs every shown skill without prompting (used by the
implement phase to add the skills the plan recommended).

## Installing MCP servers

Inside a project, `neptr mcp <search terms>` searches the [official MCP
registry](https://registry.modelcontextprotocol.io) (the upstream that GitHub's
MCP registry mirrors) and runs its own safety check on each server, showing a
transparent checklist: verified vendor (via the registry's DNS-verified
namespace), repo activity and issue backlog (from the GitHub API — set
`GITHUB_TOKEN` to raise the rate limit), broad-access surface, local/Docker
runnability, and version pinning. Each server gets a **safe / caution / avoid**
verdict; by default only `safe` servers are shown. Pass `--include-unverified` to
also see `caution`/`avoid` servers with their checklists.

Pick any number to add to the project's MCP config without leaving your editor.
Servers are written to **both** `.mcp.json` (read by Claude Code and other
AGENTS.md-era tools) and `.cursor/mcp.json` (read by Cursor), kept in sync so
either editor sees the same servers — always **version-pinned** (npm → `npx -y
<pkg>@<version>`, PyPI → `uvx <pkg>@<version>`, OCI → `docker run`). Existing
entries in either file are preserved, and servers that declare credentials are
flagged so you can fill them in by hand.

As with `neptr skill`, `--search-only` lists the safety-checked matches without
installing (for the plan phase) and `--yes` adds every shown safe server without
prompting (for the implement phase). Remote-only servers with no local package
are wired to their hosted endpoint; anything with no launch command is listed so
you can configure it by hand.

## Indexing for Claude Code

Cursor builds a semantic index of your repo. Claude Code doesn't — it's *agentic*:
it greps, globs, and reads files on demand and auto-loads `CLAUDE.md`. So the thing
that actually helps it is a **fresh, deterministic, greppable map** of the code, not
embeddings.

`neptr index` builds exactly that. It scans `src/` (regex extraction of exported
symbols + each file's top-of-file comment — no LLM, fully deterministic) and writes
`.docs/REPO_MAP.md`: every source file, its exports, and a one-line purpose. It also
refreshes the Folder map / Key files tables inside `.agents/KNOWLEDGE_MAP.md` between
marker comments, leaving your hand-written prose untouched.

You don't run it by hand. New projects get two triggers wired up automatically:

- a **Claude Code SessionStart hook** (`.claude/settings.json`) so the map is fresh
  every time you open Claude Code, and
- a tracked **git pre-commit hook** (`.githooks/pre-commit`, activated via
  `core.hooksPath`) so the committed map always matches the code — which means Cursor
  benefits too.

Both hooks are non-blocking: if `neptr` isn't on your PATH or indexing fails, your
session and commits proceed anyway. To add indexing to a project that predates this
feature, run `neptr index --setup` once inside it; `neptr index --check` is a CI guard
that fails when the map is stale.

## Adopting an existing project

`neptr new` is for greenfield projects; `neptr adopt` retrofits everything onto a
project you already have and plans a **full** refactor into NEPTR's structure —
code, tests, docs, and Docker. Run it from the project root. It works in two
halves, split along the line between what's safe to automate and what isn't:

- **Retrofit (automatic, additive, non-destructive):** it infers the project name
  and stack, then adds the `.agents/` hub, the `.docs/` tree, the root agent
  instruction files, the empty role-based `src/` sections (`app/`, `modules/`,
  `services/`, `data/`, `integrations/`, `shared/`, `config/`) + `tests/`, and the
  code index with its hooks. It also detects servers, databases, and caches from
  your dependencies (Express/Fastify/Nest/…, Postgres/MySQL/Mongo/Redis, Prisma/
  Drizzle dialects) and — if you have no Docker files yet — writes best-effort
  **DRAFT** `Dockerfile` + `docker-compose.yml` files wired up with the detected
  backing services (a plain Vite app gets the same nginx setup `neptr new` ships).
  Any file that already exists is **left untouched** — nothing is overwritten.
- **Restructure (agent-driven plan):** moving files, fixing imports and links,
  and making containers actually run is risky and codebase-specific, so NEPTR
  doesn't do it blindly. Instead it scaffolds a migration workspace at
  `.docs/feature/adopt-neptr-layout/`, pre-fills its notes with inventories of
  your current code, docs, tests, detected services, and env/config files (each
  entry tagged with a *suggested* target), and prints three copy-paste prompts —
  plan → implement → review — for an agent to execute across four ordered
  workstreams (code → tests → docs → docker) and for you to review. The prompts
  are also saved to the workspace's `PROMPTS.md`, so they survive a closed
  terminal; for large migrations the planning agent splits the work into
  milestones (usually one per workstream) and writes one implement prompt per
  milestone there, each run in a fresh session. As with `neptr feature`, NEPTR
  never calls an LLM itself.

Flags: `--name <slug>` (rename the migration workspace), `--agents <list>` (which
agent instruction files to write), `--no-index` (skip the code index/hooks),
`--no-plan` (retrofit the scaffolding only), `--no-docs` / `--no-tests` /
`--no-docker` (skip those workstreams), and `-y, --yes` (no prompts).

## Feature workflow

Inside a project, `neptr feature` breaks a feature into three agent-driven phases
so you can use a smart (expensive) model to plan and review while a cheaper model
does the coding. It asks for a name and description, scaffolds
`.docs/feature/<slug>/` (plan, task list, status, notes, and per-phase agent
instructions), and prints three copy-paste prompts — one per phase. The prompts
are also saved to the workspace's `PROMPTS.md`, so losing the terminal doesn't
lose them. Run each prompt in a fresh agent session; every phase ends by
updating the workspace's `STATUS.md` and pausing so you stay in control between
phases. If the feature is too big for one implement session, the planning agent
groups `TASKS.md` into milestones and replaces the implement prompt in
`PROMPTS.md` with one prompt per milestone — each runs in its own fresh session,
keeping context (and token spend) small.

## Development

See [CLAUDE.md](CLAUDE.md) for architecture and conventions, and
[TASKS.md](TASKS.md) for the milestone checklist.
