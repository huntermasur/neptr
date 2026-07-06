# Architecture — {{projectName}}

## Stack

- **Build tool:** Vite (template `{{template}}`)
- **Language/framework:** {{stack}}
{{stackExtras}}

## Structure

The project follows the standard Vite layout: application code in `src/`, static assets
in `public/`, entry point wired through `index.html`. See the folder map and key files in
[../../.agents/KNOWLEDGE_MAP.md](../../.agents/KNOWLEDGE_MAP.md), and where each type of
component lives inside `src/` in [../module-map.md](../module-map.md).

### Module boundaries

<!-- Describe how src/ is organized as it grows: features vs shared code, where state
lives, how modules may depend on each other. Update this section BEFORE introducing a
new top-level folder in src/, and keep it in sync with the component map. -->

_Not yet defined — the project is freshly scaffolded. When `src/` gains its first real
structure, document the boundaries here (and in [../module-map.md](../module-map.md)) and
record the decision as an ADR._

## Data flow

<!-- Describe how data moves: user input → state → rendering; API calls; persistence. -->

_Not yet defined._

## Environment & configuration

How to run this project — prerequisites, install/build/run commands, and the full
environment-variable reference — lives in [../environment.md](../environment.md). Keep
that file authoritative; document each new variable there and in `.env.example`.

## Decisions

Significant choices are recorded as ADRs in [adr/](adr/). Current decisions:

- [0001 — Record architecture decisions](adr/0001-record-architecture-decisions.md)
