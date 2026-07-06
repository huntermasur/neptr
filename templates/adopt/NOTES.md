# Notes — adopt NEPTR layout for {{projectName}}

{{monorepoNote}}

## Current `src/` inventory (auto-generated {{date}})

Every source file found under `src/`, with a **heuristic** suggested target
section. These are guesses from filenames and paths — the planning agent must
verify each one against what the file actually does before committing to the
mapping in [PLAN.md](PLAN.md).

{{inventory}}

## Documentation inventory (auto-generated {{date}})

Docs found outside `.docs/`, with a heuristic suggested target. These are
**moved or merged by the agent, never by neptr** — consolidation and link
fixing need judgment. Root README/LICENSE/CHANGELOG and agent instruction
files stay at the root by design.

{{docsInventory}}

## Test inventory (auto-generated {{date}})

Test files found, with a heuristic suggested target. NEPTR's convention: unit
tests co-located beside their subject, shared helpers/fixtures and
cross-cutting suites in root `tests/`.

{{testsInventory}}

## Docker & services (auto-detected {{date}})

Servers, databases, and caches detected from dependencies, plus any draft
Docker files `neptr adopt` wrote. Drafts carry a DRAFT header and are **not**
ready to run — the Docker workstream verifies and finishes them.

{{dockerInventory}}

## Environment & config files (auto-generated {{date}})

{{envInventory}}

## Decisions made while implementing

<!-- Deviations from the plan and why. -->

## Gotchas / surprises

<!-- Imports that were hard to fix, config that hardcoded paths, files left in place. -->

## For the reviewer

<!-- What to look at hardest; how behaviour was confirmed unchanged. -->
