# app/

App startup, routing, main entrypoints, server setup, and the UI shell.

This is where the application wires itself together — the composition root. Code here
reaches into every other section, but nothing else should import from `app/`.

Examples: `main` / bootstrap files, the root router, top-level layout / shell,
server setup, dependency wiring.
