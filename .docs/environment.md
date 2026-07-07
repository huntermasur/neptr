# Environment — neptr-cli

Everything you need to run this project from a fresh clone on a new machine:
prerequisites, commands, and the environment variables it reads. Agents: prefer these
commands over improvising; if you add or change a script in `package.json` or an
environment variable, update this file in the same change.

## Prerequisites

- **Node.js ≥ 20** and npm (this is a Vite `vanilla-ts` / Vanilla + TypeScript + Vite project).
- A copy of the repo and, if the project needs secrets, the values for `.env` (see below).

## First-time setup

```bash
npm install        # install dependencies
cp .env.example .env   # then fill in real values (see "Environment variables")
```

## Everyday commands

```bash
npm run dev        # start the Vite dev server (HMR)
npm run build      # typecheck (if TS) + production build to dist/
npm run preview    # serve the production build locally
```

## Verification

Run before declaring any task done:

```bash
npm run build      # must pass — treat warnings as suspect
```

<!-- Add test/lint/format commands here as they are introduced, e.g.:
npm test           # unit tests
npm run lint       # eslint
-->

## Environment variables

- Configuration and secrets live in `.env` at the project root. **`.env` is gitignored —
  never commit it, and never hardcode secrets, tokens, or credentials in source.**
- `.env.example` is the committed template. Every variable the app reads must be listed
  there with a safe placeholder, and documented in the table below.
- This is a Vite app: only variables prefixed with `VITE_` are exposed to client code via
  `import.meta.env`. Anything without that prefix stays out of the browser bundle — keep
  secrets unprefixed.

| Variable | Required | Purpose |
| --- | --- | --- |
| _None yet_ | — | Add each variable here as the app grows. |

## One-offs & maintenance

<!-- Record non-obvious commands as they come up: migrations, codegen, deployments,
cache resets. If a command needed explaining once, it belongs here. -->

```bash
neptr clear        # remove `.docs/feature/<slug>/` workspaces created by `neptr feature`
neptr clear --yes  # same, without a confirmation prompt
```

Adoption workspaces from `neptr adopt` are left alone.
