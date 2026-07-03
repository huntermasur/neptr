# Commands — {{projectName}}

The commands and scripts used to work on this project. Agents: prefer these over
improvising; if you add or change a script in `package.json`, update this file in the
same change.

## Everyday

```bash
npm install        # install dependencies
npm run dev        # start the Vite dev server (HMR)
npm run build      # typecheck (if TS) + production build to dist/
npm run preview    # serve the production build locally
{{extraCommands}}```

## Verification

Run before declaring any task done:

```bash
npm run build      # must pass — treat warnings as suspect
```

<!-- Add test/lint/format commands here as they are introduced, e.g.:
npm test           # unit tests
npm run lint       # eslint
-->

## One-offs & maintenance

<!-- Record non-obvious commands as they come up: migrations, codegen, deployments,
cache resets. If a command needed explaining once, it belongs here. -->

- _None recorded yet._
