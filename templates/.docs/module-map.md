# Module Map — {{projectName}}

Where each **type** of component lives inside `src/`. When you add a new kind of thing
(a store, a route, a service), put it in the right place and record it here so the next
agent finds it in one hop. For the whole-repo folder layout and key files, see
[../.agents/KNOWLEDGE_MAP.md](../.agents/KNOWLEDGE_MAP.md); for *why* the boundaries are
what they are, see [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md).

## Component types

| Type | Where it lives | Notes |
| --- | --- | --- |
| UI components | `src/components/` | Reusable presentational pieces |
| Routes / pages | `src/routes/` or `src/pages/` | Top-level views wired to the router |
| State / stores | `src/stores/` or `src/state/` | Shared application state |
| Hooks / composables | `src/hooks/` or `src/composables/` | Reusable stateful logic |
| Services / API clients | `src/services/` or `src/api/` | Talking to the outside world |
| Utilities | `src/utils/` or `src/lib/` | Pure helpers, no framework coupling |
| Types | `src/types/` | Shared type declarations |
| Styles / assets | `src/styles/`, `src/assets/` | Global CSS, fonts, images |

> Seeded with common {{stack}} conventions. This project is freshly scaffolded — adjust
> the rows to match the folders that actually exist, and delete the ones you don't use.
> Every top-level folder under `src/` should map to a row here.

## Module boundaries

<!-- Rules for how these pieces may depend on each other as the project grows, e.g.
"components never import from services directly; routes wire them together." Keep this in
sync with the "Module boundaries" section of architecture/ARCHITECTURE.md. -->

- _None defined yet — add the first rule when `src/` gains real structure._
