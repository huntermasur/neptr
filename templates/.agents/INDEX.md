# File Index — {{projectName}}

Direct links to the files that matter most in this repo. Where
[KNOWLEDGE_MAP.md](KNOWLEDGE_MAP.md) maps folders and concepts, this file points at
individual files. **Update this index — together with the knowledge map — whenever
important files are added, moved, or removed.** Last updated: {{date}}.

## Entry points

| File | Role |
| --- | --- |
| [../index.html](../index.html) | HTML entry — Vite serves and builds from here |
| `src/` main module | Application bootstrap (see the Vite `{{template}}` layout) |

## Configuration

| File | Role |
| --- | --- |
| [../package.json](../package.json) | Dependencies and npm scripts |
{{viteConfigRow}}
| `.env` (gitignored) | Environment variables — document each in [../docs/architecture/ARCHITECTURE.md](../docs/architecture/ARCHITECTURE.md) |
| [../.env.example](../.env.example) | Committed template for `.env`; keep every variable in sync here |
{{extraIndexRows}}

## Key source files

<!-- As the project grows, link the files an agent will most often need: state stores,
API clients, routers, shared utilities. Seeded empty by Beemo. -->

- _None recorded yet — add entries as the first real features land._

> Rule of thumb: if you had to hunt for a file more than once, it belongs in this index.
