# services/

Reusable logic that does real work — the business rules, not tied to any one feature.

Services are framework-agnostic and side-effect-aware: they orchestrate `data/` and
`integrations/` to get things done. Keep them pure of UI concerns.

Examples: `pricing`, `notifications`, `permissions`, `reporting`.
