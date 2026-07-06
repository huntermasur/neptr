# modules/

The main features and capabilities of the project — one folder per feature.

Each module owns its own UI, state, and feature-specific logic. Modules may use
`services/`, `data/`, `integrations/`, and `shared/`, but should not import from each
other; if two modules need the same thing, lift it into a lower layer.

Examples: `auth/`, `billing/`, `dashboard/`, `search/`.
