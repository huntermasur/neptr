# tests/

Test helpers, mocks, fixtures, and cross-cutting integration tests.

Shared testing infrastructure and the tests that span multiple sections of `src/` live
here at the project root. Unit tests can instead sit next to the code they cover inside
`src/` (`*.test.ts`); this folder is for the setup and the broader suites.

Examples: `fixtures/`, `mocks/`, `helpers/`, integration/e2e suites.
