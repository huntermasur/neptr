# NEPTR 🤖

> "NEPTR, deploy!"

NEPTR is a NEPTR-themed CLI for starting new projects the right way. It scaffolds a
[Vite](https://vitejs.dev) app, then layers on a complete AI-ready setup so every
project begins with the same file structure and the same default behavior for AI
coding agents.

## What it sets up

- **Vite app** — any official framework/variant via `npm create vite`
- **`.agents/` hub** — the **AI constitution** (`CONSTITUTION.md`), **workflow
  instructions** (`AI_INSTRUCTIONS.md`), **knowledge map** (`KNOWLEDGE_MAP.md`), and
  **file index** (`INDEX.md`) — plus a `skills/`
  folder for installed skills.sh skills — with rules that keep the map and index in sync with the code
- **Docs tree** — `COMMANDS.md`, an `architecture/` folder (architecture doc, specs, ADRs),
  a `domain/` folder (documentation guide + domain instructions), and a `files/` folder for user documents
- **MCP config** (`.mcp.json`) — playwright, context7, github (your pick)
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
neptr feature             # start a plan → implement → review feature workspace
neptr skill web design    # find & install security-checked skills from skills.sh
neptr mcp postgres        # find & install security-checked MCP servers from skillful.sh
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

Inside a project, `neptr mcp <search terms>` searches [skillful.sh](https://skillful.sh)
for MCP servers, keeps only those whose security grade clears the bar
(`--min-grade`, default `A`), and lets you pick any number to add to the
project's `.mcp.json` without leaving your editor. npm packages are wired up as
`npx -y <package>` and PyPI packages as `uvx <package>`; existing `.mcp.json`
entries are preserved. Pass `--include-unverified` to also see servers that are
unscanned or below the grade bar (their grade is shown inline).

As with `neptr skill`, `--search-only` lists the grade-passing matches without
installing (for the plan phase) and `--yes` adds every shown server without
prompting (for the implement phase). Servers that aren't npm or PyPI packages
can't be auto-wired — NEPTR lists their repos so you can configure them by hand.

## Feature workflow

Inside a project, `neptr feature` breaks a feature into three agent-driven phases
so you can use a smart (expensive) model to plan and review while a cheaper model
does the coding. It asks for a name and description, scaffolds
`.agents/features/<slug>/` (plan, task list, status, notes, and per-phase agent
instructions), and prints three copy-paste prompts — one per phase. Run each
prompt in a fresh agent session; every phase ends by updating the workspace's
`STATUS.md` and pausing so you stay in control between phases.

## Development

See [CLAUDE.md](CLAUDE.md) for architecture and conventions, and
[TASKS.md](TASKS.md) for the milestone checklist.
