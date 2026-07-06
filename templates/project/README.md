# {{projectName}}

{{stack}} app scaffolded with [NEPTR](https://github.com/huntermasur/neptr) on {{date}}.

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # production build
npm run preview   # preview the production build
{{dockerCommands}}```

## Project layout

- `src/` — application code
- `public/` — static assets
- `.agents/` — AI agent hub: [constitution](.agents/CONSTITUTION.md), [workflow](.agents/AI_INSTRUCTIONS.md), [knowledge map](.agents/KNOWLEDGE_MAP.md), and `skills/` for installed skills.sh skills
- `.docs/` — documentation: [environment](.docs/environment.md), [module map](.docs/module-map.md), [architecture](.docs/architecture/ARCHITECTURE.md) + ADRs, [feature workspaces](.docs/feature/), and [user documents](.docs/documents/)

## Working with AI agents

This project is AI-ready. Agents should start at [.agents/AI_INSTRUCTIONS.md](.agents/AI_INSTRUCTIONS.md); it enforces a
documentation policy (its "Before you finish" section) so the docs stay trustworthy as the
code evolves.
{{aiExtras}}
