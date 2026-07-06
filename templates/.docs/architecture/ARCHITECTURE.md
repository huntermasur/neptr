# Architecture — {{projectName}}

## Stack

- **Build tool:** Vite (template `{{template}}`)
- **Language/framework:** {{stack}}
{{stackExtras}}

## Structure

The project follows the standard Vite layout: application code in `src/`, static assets
in `public/`, entry point wired through `index.html`. See the folder map in
[../../.agents/KNOWLEDGE_MAP.md](../../.agents/KNOWLEDGE_MAP.md) and the file links in
[../../.agents/INDEX.md](../../.agents/INDEX.md).

### Module boundaries

<!-- Describe how src/ is organized as it grows: features vs shared code, where state
lives, how modules may depend on each other. Update this section BEFORE introducing a
new top-level folder in src/. -->

_Not yet defined — the project is freshly scaffolded. When `src/` gains its first real
structure, document the boundaries here and record the decision as an ADR._

## Data flow

<!-- Describe how data moves: user input → state → rendering; API calls; persistence. -->

_Not yet defined._

## Environment & configuration

- Environment variables go in `.env` (gitignored); document each variable here and
  provide a safe default in `.env.example`.
- Vite exposes only variables prefixed with `VITE_` to client code.

## Decisions

Significant choices are recorded as ADRs in [adr/](adr/). Current decisions:

- [0001 — Record architecture decisions](adr/0001-record-architecture-decisions.md)
