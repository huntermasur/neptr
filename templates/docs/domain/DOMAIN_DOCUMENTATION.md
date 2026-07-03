# Documentation Guide — {{projectName}}

How documentation works in this repo: five levels of granularity, and a table saying
exactly which documents each kind of change must update. Agents are required to follow
this (see [../../.agents/AI_INSTRUCTIONS.md](../../.agents/AI_INSTRUCTIONS.md)); humans should too.

## The five levels

| Level | Where | Granularity | Answers |
| --- | --- | --- | --- |
| **L1 — Inline** | Comments, docstrings, types | Line/function | "Why is this line like this?" |
| **L2 — Module** | `README.md` inside a folder of `src/` | Folder/module | "What is this module, how do I use it?" |
| **L3 — Project docs** | `docs/architecture/ARCHITECTURE.md`, feature docs in `docs/` | Cross-module | "How do the pieces fit together?" |
| **L4 — Knowledge map & index** | `.agents/KNOWLEDGE_MAP.md`, `.agents/INDEX.md` | Whole repo | "Where is everything, where do I start?" |
| **L5 — Decisions** | `docs/architecture/adr/NNNN-*.md` | Point-in-time | "Why was it done this way?" |

Rules of thumb:

- **L1**: comment the *why*, never the *what*. If a comment restates the code, delete it.
- **L2**: a `src/` folder earns a README once it has ~3+ files or a non-obvious contract.
  Keep it under a screenful: purpose, public surface, gotchas.
- **L3**: prose about how things work *now*. When it describes the past, fix it.
- **L4**: pure index + map. Content lives elsewhere; the map and index only point.
  The two move together: a structural change that touches one touches both.
- **L5**: append-only. Never edit an accepted ADR — supersede it with a new one.

## Change-type → documents to update

| When you… | L1 | L2 | L3 | L4 | L5 | README |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Fix a bug (non-obvious cause) | ✅ | — | — | — | — | — |
| Add/change a function's tricky logic | ✅ | if contract changed | — | — | — | — |
| Add a feature | as needed | ✅ | ✅ | — | — | if user-facing |
| Add/move/delete files or folders | — | ✅ | — | ✅ (map **and** index) | — | — |
| Add a dependency | — | — | ✅ | ✅ (map **and** index) | if significant | — |
| Change architecture, boundaries, or patterns | — | — | ✅ | ✅ (map **and** index) | ✅ | — |
| Add an environment variable | — | — | ✅ (env section) | — | — | ✅ |
| Change build/dev/deploy workflow | — | — | ✅ | — | — | ✅ + `docs/COMMANDS.md` |
| Add/change an npm script or tooling command | — | — | — | — | — | → `docs/COMMANDS.md` |

## ADR format

Copy [../architecture/adr/0001-record-architecture-decisions.md](../architecture/adr/0001-record-architecture-decisions.md).
Number sequentially, use status `Proposed` / `Accepted` / `Superseded by NNNN`.
Keep each ADR under a page: Context → Decision → Consequences.
