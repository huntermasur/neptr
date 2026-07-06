# config/

Environment variables, settings, and feature flags.

Centralizes and validates configuration so the rest of the app reads typed values from
here instead of reaching into `process.env` / `import.meta.env` directly.

Examples: `env` loader/validator, `settings`, `feature-flags`.
