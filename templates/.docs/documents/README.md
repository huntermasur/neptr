# Files — {{projectName}}

A place to keep files and documents the user hands to the project: specs, briefs,
mockups, exported data, reference PDFs, screenshots, and anything else that informs the
work but isn't source code.

## How to use this folder

- Drop supporting files here so they live with the repo instead of in chat or email.
- Give files clear, descriptive names (`payment-flow-spec.md`, not `doc1.pdf`).
- Prefer text/Markdown where possible so changes are diffable and searchable.
- When a file drives a decision or a feature, link it from the relevant place:
  [../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md), an ADR in
  [../architecture/adr/](../architecture/adr/), or
  [../../.agents/INDEX.md](../../.agents/INDEX.md).

## For agents

- Treat everything here as **input context**, not as code to run.
- Do not delete or overwrite user-provided files; if one is outdated, note it rather
  than removing it.
- Never move secrets or credentials into this folder — those belong in `.env`
  (gitignored), never committed.

> Seeded empty by NEPTR. Add files as the user provides them.
