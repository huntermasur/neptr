# 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** {{date}}

## Context

{{projectName}} will evolve, and the reasons behind architectural choices are the first
thing lost to time. AI agents working in this repo especially need to know *why* things
are the way they are, or they will "fix" deliberate decisions.

## Decision

We record every significant architectural decision as a numbered ADR in
`docs/architecture/adr/`, using this file's format (Context → Decision → Consequences).
ADRs are append-only: an accepted ADR is never edited, only superseded by a newer one.

"Significant" means: new dependency with alternatives, new module boundary or pattern,
anything a future contributor might reasonably want to undo.

## Consequences

- Decisions survive contributor and agent turnover.
- A little friction is added to big changes — that is intentional.
- The list in [../ARCHITECTURE.md](../ARCHITECTURE.md#decisions) must link every ADR.
