# Notes — adopt NEPTR layout for neptr-cli

## Current `src/` inventory (auto-generated 2026-07-06)

Every source file found under `src/`, with a **heuristic** suggested target
section. These are guesses from filenames and paths — the planning agent must
verify each one against what the file actually does before committing to the
mapping in [PLAN.md](PLAN.md).

Found 26 source file(s) under `src/`.

| Current path | Suggested section | Why (heuristic) |
| --- | --- | --- |
| `src/adopt.ts` | `src/modules/` | unclassified — confirm |
| `src/cli.ts` | `src/modules/` | unclassified — confirm |
| `src/config.ts` | `src/config/` | matched "config" |
| `src/doctor.ts` | `src/modules/` | unclassified — confirm |
| `src/feature.ts` | `src/modules/` | matched "feature" |
| `src/indexer.ts` | `src/modules/` | unclassified — confirm |
| `src/mcp-registry.ts` | `src/modules/` | unclassified — confirm |
| `src/mcp.ts` | `src/modules/` | unclassified — confirm |
| `src/prompts.ts` | `src/modules/` | unclassified — confirm |
| `src/run.ts` | `src/modules/` | unclassified — confirm |
| `src/skill.ts` | `src/modules/` | unclassified — confirm |
| `src/skills-registry.ts` | `src/modules/` | unclassified — confirm |
| `src/steps/agents.ts` | `src/modules/` | unclassified — confirm |
| `src/steps/ai-docs.ts` | `src/modules/` | unclassified — confirm |
| `src/steps/docker.ts` | `src/modules/` | unclassified — confirm |
| `src/steps/env.ts` | `src/config/` | matched "env" |
| `src/steps/git.ts` | `src/modules/` | unclassified — confirm |
| `src/steps/indexing.ts` | `src/modules/` | unclassified — confirm |
| `src/steps/install.ts` | `src/modules/` | unclassified — confirm |
| `src/steps/mcp.ts` | `src/modules/` | unclassified — confirm |
| `src/steps/skills.ts` | `src/modules/` | unclassified — confirm |
| `src/steps/src-layout.ts` | `src/app/` | matched "layout" |
| `src/steps/vite.ts` | `src/modules/` | unclassified — confirm |
| `src/template.ts` | `src/modules/` | unclassified — confirm |
| `src/theme.ts` | `src/modules/` | unclassified — confirm |
| `src/wizard.ts` | `src/modules/` | unclassified — confirm |

## Decisions made while implementing

<!-- Deviations from the plan and why. -->

## Gotchas / surprises

<!-- Imports that were hard to fix, config that hardcoded paths, files left in place. -->

## For the reviewer

<!-- What to look at hardest; how behaviour was confirmed unchanged. -->
