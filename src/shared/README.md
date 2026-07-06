# shared/

Utils, types, schemas, constants, hooks, and common helpers used across the app.

The lowest layer: everything may import from `shared/`, and `shared/` imports from
nothing else in `src/`. Keep it dependency-free and side-effect-free.

Examples: `utils/`, `types/`, `schemas/`, `constants/`, `hooks/`.
