# Module Map — neptr-cli

Where each **type** of component lives inside `src/`. When you add a new kind of thing
(a store, a route, a service), put it in the right place and record it here so the next
agent finds it in one hop. For the whole-repo folder layout and key files, see
[../.agents/KNOWLEDGE_MAP.md](../.agents/KNOWLEDGE_MAP.md); for *why* the boundaries are
what they are, see [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md).

## Sections

`src/` is organized by role, not by file type. Each section ships a `README.md`
describing its purpose. Put new code in the section that matches what it *does*.

| Section | What lives here |
| --- | --- |
| `src/app/` | App startup, routing, main entrypoints, server setup, UI shell |
| `src/modules/` | Main features / capabilities — one folder per feature |
| `src/services/` | Reusable logic that does real work (business rules) |
| `src/data/` | Database, storage, repositories, models, migrations |
| `src/integrations/` | External APIs — Discord, Stripe, OpenAI, GitHub, email, etc. |
| `src/shared/` | Utils, types, schemas, constants, hooks, common helpers |
| `src/config/` | Environment variables, settings, feature flags |

Tests live in `tests/` at the **project root** (helpers, mocks, fixtures, and
cross-cutting integration/e2e suites); unit tests can instead sit next to the code they
cover as `*.test.ts` inside `src/`.

> Seeded for a Vanilla + TypeScript + Vite project. The Vite template's own entry files (main, App, styles)
> stay where the template put them — move them under `src/app/` as the shell grows. Adjust
> these rows to match the folders that actually exist, and keep this table in sync with the
> section READMEs.

## Module boundaries

<!-- Keep this in sync with the "Module boundaries" section of
architecture/ARCHITECTURE.md as the rules get more specific. -->

Dependencies flow downward; nothing imports upward:

- `app/` wires everything together — nothing else imports from `app/`.
- `modules/` may use `services/`, `data/`, `integrations/`, `shared/`, and `config/`,
  but modules should not import from each other.
- `services/` orchestrate `data/` and `integrations/`; they stay free of UI concerns.
- `data/` is the only section that talks to the persistence layer directly.
- `shared/` and `config/` are the lowest layers — they import from nothing else in `src/`.
