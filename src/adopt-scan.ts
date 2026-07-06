import fs from "node:fs";
import path from "node:path";

/**
 * Pure detection + inventory builders for `neptr adopt`. Everything here is
 * deterministic and read-only: it scans the project and produces markdown
 * inventories (rendered into the migration workspace's NOTES.md) or detection
 * results consumed by adopt-docker.ts. No file it inspects is ever modified.
 */

export const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"]);
export const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".git"]);

/** Merge dependencies + devDependencies from a parsed package.json. */
function allDeps(pkg: Record<string, unknown>): Record<string, string> {
  return {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };
}

/** Recursively collect files under dir that pass the filter, skipping SKIP_DIRS. */
function walkFiles(dir: string, keep: (name: string) => boolean, skipDot = false): string[] {
  const files: string[] = [];
  const walk = (d: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (skipDot && entry.name.startsWith(".")) continue;
        walk(path.join(d, entry.name));
      } else if (keep(entry.name)) {
        files.push(path.join(d, entry.name));
      }
    }
  };
  walk(dir);
  return files.sort();
}

/** Project-relative path with forward slashes, for stable markdown output. */
function toRel(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join("/");
}

// ---------------------------------------------------------------------------
// Code inventory (src/ → canonical sections)
// ---------------------------------------------------------------------------

/**
 * Heuristic: guess which canonical section an existing file belongs in, purely from
 * its path/name. Deliberately conservative — the planning agent must confirm each.
 * Returns the section and the keyword that triggered the guess.
 */
export function suggestSection(relPath: string): { section: string; why: string } {
  const lower = relPath.toLowerCase();
  const base = path.basename(lower).replace(/\.[^.]+$/, "");

  // Framework entry files live in app/ regardless of other keywords.
  if (["main", "index", "app", "bootstrap", "root", "server"].includes(base)) {
    return { section: "app", why: `entry file "${base}"` };
  }

  // Known third-party vendors → integrations, matched as substrings so glued
  // names like `stripeClient.ts` or `openaiApi.ts` are still caught.
  const vendor = /(stripe|discord|openai|anthropic|github|gitlab|twilio|sendgrid|aws|s3|firebase|supabase|auth0|slack|shopify)/.exec(lower);
  if (vendor) return { section: "integrations", why: `vendor "${vendor[1]}"` };

  const rules: Array<[string, RegExp]> = [
    ["config", /\b(config|settings?|env|feature[-_]?flags?)\b/],
    ["data", /\b(models?|schemas?|entit(y|ies)|repositor(y|ies)|repo|migrations?|db|database|stores?|dao)\b/],
    ["integrations", /\b(integrations?|clients?|sdk|providers?)\b/],
    ["services", /\b(services?|controllers?|use[-_]?cases?|business|domain|handlers?)\b/],
    ["shared", /\b(utils?|helpers?|libs?|types?|constants?|consts?|hooks?|shared|common)\b/],
    ["app", /\b(routes?|router|pages?|layouts?|shell|views?|screens?)\b/],
    ["modules", /\b(components?|features?|modules?|widgets?)\b/],
  ];
  for (const [section, re] of rules) {
    const m = re.exec(lower);
    if (m) return { section, why: `matched "${m[1] ?? m[0]}"` };
  }
  return { section: "modules", why: "unclassified — confirm" };
}

/** Walk src/ and build the markdown inventory table with suggested target sections. */
export function buildInventory(root: string): string {
  const srcDir = path.join(root, "src");
  if (!fs.existsSync(srcDir)) {
    return "_No `src/` directory found — there is nothing to restructure. If this project keeps its code elsewhere, tell the planning agent where._";
  }

  const files = walkFiles(srcDir, (name) => SOURCE_EXTENSIONS.has(path.extname(name)));
  if (files.length === 0) {
    return "_No source files found under `src/` yet._";
  }

  const rows = files.map((abs) => {
    const rel = toRel(root, abs);
    const { section, why } = suggestSection(rel);
    return `| \`${rel}\` | \`src/${section}/\` | ${why} |`;
  });

  return [
    `Found ${files.length} source file(s) under \`src/\`.`,
    "",
    "| Current path | Suggested section | Why (heuristic) |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Docker / service detection
// ---------------------------------------------------------------------------

export interface DetectedService {
  kind: "server" | "db" | "cache";
  label: string;
  /** The dependency that triggered the detection. */
  dep: string;
  /** Compose service name; absent for servers and file-based dbs (sqlite). */
  composeService?: string;
  image?: string;
  port?: number;
  envVars?: string[];
  note?: string;
}

export interface DockerScan {
  services: DetectedService[];
  /** ORMs found, e.g. "prisma (postgresql)" — informational for the agent. */
  orms: string[];
  /** Docker files already present at the project root — never overwritten. */
  existingFiles: string[];
  /** Resolved app port (env → scripts → framework default → 3000). */
  appPort: number;
  hasVite: boolean;
  hasServer: boolean;
  hasDb: boolean;
}

const SERVER_FRAMEWORKS: Array<[dep: string, label: string]> = [
  ["express", "Express"],
  ["fastify", "Fastify"],
  ["koa", "Koa"],
  ["@nestjs/core", "NestJS"],
  ["hono", "Hono"],
  ["next", "Next.js"],
  ["nuxt", "Nuxt"],
];

interface DbRule {
  deps: string[];
  label: string;
  composeService?: string;
  image?: string;
  port?: number;
  envVars?: string[];
  note?: string;
}

const DB_RULES: DbRule[] = [
  {
    deps: ["pg", "postgres", "pg-promise"],
    label: "PostgreSQL",
    composeService: "postgres",
    image: "postgres:16-alpine",
    port: 5432,
    envVars: ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "DATABASE_URL"],
  },
  {
    deps: ["mysql2", "mysql"],
    label: "MySQL",
    composeService: "mysql",
    image: "mysql:8",
    port: 3306,
    envVars: ["MYSQL_ROOT_PASSWORD", "MYSQL_DATABASE"],
  },
  {
    deps: ["mongodb", "mongoose"],
    label: "MongoDB",
    composeService: "mongo",
    image: "mongo:7",
    port: 27017,
    envVars: ["MONGO_URL"],
  },
  {
    deps: ["better-sqlite3", "sqlite3"],
    label: "SQLite",
    note: "file-based — mount a volume for the db file; no compose service needed",
  },
];

const CACHE_RULES: DbRule[] = [
  {
    deps: ["redis", "ioredis", "@redis/client"],
    label: "Redis",
    composeService: "redis",
    image: "redis:7-alpine",
    port: 6379,
    envVars: ["REDIS_URL"],
  },
];

/** Map an ORM provider/dialect string to the matching DB_RULES entry. */
function dbRuleForDialect(dialect: string): DbRule | undefined {
  const d = dialect.toLowerCase();
  if (d.startsWith("postgres")) return DB_RULES[0];
  if (d.startsWith("mysql") || d.startsWith("maria")) return DB_RULES[1];
  if (d.startsWith("mongo")) return DB_RULES[2];
  if (d.startsWith("sqlite")) return DB_RULES[3];
  return undefined;
}

/** First PORT=<n> found in a file, if any. */
function portFromEnvFile(file: string): number | undefined {
  try {
    const m = /^\s*(?:export\s+)?PORT\s*=\s*(\d+)/m.exec(fs.readFileSync(file, "utf8"));
    if (m) return Number(m[1]);
  } catch {
    /* unreadable env file — fall through */
  }
  return undefined;
}

/**
 * Detect servers, databases and caches from package.json deps + config files,
 * plus any Docker files already at the root. Purely heuristic — feeds the draft
 * Docker generation and the NOTES.md inventory the agent verifies.
 */
export function detectDocker(root: string, pkg: Record<string, unknown>): DockerScan {
  const deps = allDeps(pkg);
  const services: DetectedService[] = [];
  const orms: string[] = [];

  for (const [dep, label] of SERVER_FRAMEWORKS) {
    if (dep in deps) services.push({ kind: "server", label, dep, port: 3000 });
  }

  const addDbRule = (rule: DbRule, dep: string): void => {
    services.push({
      kind: rule === CACHE_RULES[0] ? "cache" : "db",
      label: rule.label,
      dep,
      composeService: rule.composeService,
      image: rule.image,
      port: rule.port,
      envVars: rule.envVars,
      note: rule.note,
    });
  };

  for (const rule of [...DB_RULES, ...CACHE_RULES]) {
    const hit = rule.deps.find((d) => d in deps);
    if (hit) addDbRule(rule, hit);
  }

  // ORMs only add a db when no driver already matched, since most projects
  // install the driver alongside the ORM anyway.
  const hasDbAlready = services.some((s) => s.kind === "db");
  if ("prisma" in deps || "@prisma/client" in deps) {
    const dep = "@prisma/client" in deps ? "@prisma/client" : "prisma";
    let dialect: string | undefined;
    try {
      const schema = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
      dialect = /provider\s*=\s*"(\w+)"/.exec(schema)?.[1];
    } catch {
      /* no schema — dialect unknown */
    }
    orms.push(dialect ? `prisma (${dialect})` : "prisma (dialect unknown — check prisma/schema.prisma)");
    const rule = dialect ? dbRuleForDialect(dialect) : undefined;
    if (rule && !hasDbAlready) addDbRule(rule, dep);
  }
  if ("drizzle-orm" in deps) {
    let dialect: string | undefined;
    for (const cfg of walkRootMatches(root, /^drizzle\.config\./)) {
      try {
        dialect = /dialect:\s*["'](\w+)/.exec(fs.readFileSync(cfg, "utf8"))?.[1];
        if (dialect) break;
      } catch {
        /* unreadable config */
      }
    }
    orms.push(dialect ? `drizzle-orm (${dialect})` : "drizzle-orm (dialect unknown — check drizzle.config.*)");
    const rule = dialect ? dbRuleForDialect(dialect) : undefined;
    if (rule && !services.some((s) => s.kind === "db")) addDbRule(rule, "drizzle-orm");
  }
  for (const orm of ["typeorm", "sequelize", "knex"]) {
    if (orm in deps) orms.push(`${orm} (check its config for the dialect)`);
  }

  // Existing docker files at the root — inventoried, never overwritten.
  let existingFiles: string[] = [];
  try {
    existingFiles = fs
      .readdirSync(root)
      .filter((n) => /^dockerfile/i.test(n) || /^(docker-)?compose.*\.ya?ml$/i.test(n))
      .sort();
  } catch {
    /* unreadable root */
  }

  // App port: .env → .env.example → scripts → primary framework default → 3000.
  const scripts = (pkg.scripts as Record<string, string>) ?? {};
  const primary = services.find((s) => s.kind === "server");
  let appPort =
    portFromEnvFile(path.join(root, ".env")) ?? portFromEnvFile(path.join(root, ".env.example"));
  if (appPort === undefined) {
    for (const cmd of Object.values(scripts)) {
      const m = /(?:--port[= ]|-p )(\d+)/.exec(cmd);
      if (m) {
        appPort = Number(m[1]);
        break;
      }
    }
  }
  appPort ??= primary?.port ?? 3000;
  if (primary) primary.port = appPort;

  return {
    services,
    orms,
    existingFiles,
    appPort,
    hasVite: "vite" in deps,
    hasServer: services.some((s) => s.kind === "server"),
    hasDb: services.some((s) => s.kind === "db"),
  };
}

/** Root-level files whose name matches the pattern (absolute paths). */
function walkRootMatches(root: string, re: RegExp): string[] {
  try {
    return fs
      .readdirSync(root)
      .filter((n) => re.test(n))
      .sort()
      .map((n) => path.join(root, n));
  } catch {
    return [];
  }
}

/** Markdown inventory of the docker scan for NOTES.md: detections, existing files, drafts. */
export function buildDockerInventory(scan: DockerScan, drafted: string[], noDraftReason?: string): string {
  const parts: string[] = [];

  if (scan.services.length === 0) {
    parts.push("_No server or database dependencies detected in package.json._");
  } else {
    parts.push(
      "Detected from package.json dependencies (heuristic — verify each):",
      "",
      "| Kind | Service | Trigger dep | Image | Port |",
      "| --- | --- | --- | --- | --- |",
      ...scan.services.map(
        (s) =>
          `| ${s.kind} | ${s.label}${s.note ? ` (${s.note})` : ""} | \`${s.dep}\` | ${s.image ? `\`${s.image}\`` : "—"} | ${s.port ?? "—"} |`,
      ),
    );
  }

  if (scan.orms.length) {
    parts.push("", `ORMs detected: ${scan.orms.join(", ")}. Check for migration commands the containers must run.`);
  }

  if (scan.existingFiles.length) {
    parts.push(
      "",
      `Existing Docker files found (inventoried — \`neptr adopt\` did not touch these): ${scan.existingFiles.map((f) => `\`${f}\``).join(", ")}. The Docker workstream gap-checks them against the detected services instead of starting from drafts.`,
    );
  }

  if (drafted.length) {
    parts.push(
      "",
      `Draft files written by \`neptr adopt\`: ${drafted.map((f) => `\`${f}\``).join(", ")}. Each carries a DRAFT header — the Docker workstream verifies and finishes them; they are generated from dependency names alone and are **not** ready to run.`,
    );
  } else if (noDraftReason) {
    parts.push("", `No draft Docker files were written: ${noDraftReason}`);
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Documentation inventory
// ---------------------------------------------------------------------------

/** Root-level markdown files that should stay at the root, not move into .docs/. */
const ROOT_DOC_EXCLUDES = new Set([
  "readme.md",
  "license.md",
  "changelog.md",
  "contributing.md",
  "code_of_conduct.md",
  "security.md",
  // Agent instruction files are managed by neptr itself.
  "claude.md",
  "agents.md",
  "gemini.md",
]);

const DOC_DIRS = ["docs", "doc", "wiki"];

/** Heuristic: suggest where an existing doc belongs in the .docs/ tree. */
export function suggestDocTarget(relPath: string): { target: string; why: string } {
  const lower = relPath.toLowerCase();
  const base = path.basename(lower);

  if (/\badr\b|decision[-_]?record/.test(lower) || /^\d{3,4}-/.test(base)) {
    return { target: "`.docs/architecture/adr/`", why: "looks like an ADR" };
  }
  if (/architecture|design|diagram|system[-_]?overview/.test(lower)) {
    return { target: "`.docs/architecture/`", why: "architecture doc" };
  }
  if (/setup|install|getting[-_ ]?started|environment|development|running|deploy/.test(lower)) {
    return { target: "merge into `.docs/environment.md`", why: "environment/run doc" };
  }
  if (/\bapi\b|endpoints?|reference|schema|spec/.test(lower)) {
    return { target: "`.docs/documents/`", why: "reference doc" };
  }
  return { target: "`.docs/documents/`", why: "general doc — confirm" };
}

/**
 * Scan docs/, doc/, wiki/ and root-level *.md for documentation to migrate into
 * .docs/. Inventory only — docs are moved/merged by the agent, never by neptr,
 * because consolidation and link fixing need judgment.
 */
export function buildDocsInventory(root: string): string {
  const found: string[] = [];

  for (const dir of DOC_DIRS) {
    const abs = path.join(root, dir);
    if (fs.existsSync(abs)) {
      found.push(...walkFiles(abs, (name) => /\.mdx?$/i.test(name), true));
    }
  }

  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory()) continue;
      if (!/\.md$/i.test(entry.name)) continue;
      if (ROOT_DOC_EXCLUDES.has(entry.name.toLowerCase())) continue;
      found.push(path.join(root, entry.name));
    }
  } catch {
    /* unreadable root */
  }
  found.sort();

  if (found.length === 0) {
    return "_No documentation found outside `.docs/` (root README/LICENSE/CHANGELOG and agent files stay put by design)._";
  }

  const rows = found.map((abs) => {
    const rel = toRel(root, abs);
    const { target, why } = suggestDocTarget(rel);
    return `| \`${rel}\` | ${target} | ${why} |`;
  });

  return [
    `Found ${found.length} doc file(s) to relocate or merge.`,
    "",
    "| Current path | Suggested target | Why (heuristic) |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Tests inventory
// ---------------------------------------------------------------------------

const TEST_DIR_NAMES = new Set(["test", "tests", "__tests__", "spec"]);
const TEST_RUNNER_DEPS = ["vitest", "jest", "mocha", "cypress", "playwright", "@playwright/test"];

/** Strip .test/.spec plus the extension: `foo.test.ts` → `foo`. */
function testSubjectBasename(name: string): string {
  return name.replace(/\.(test|spec)\.[^.]+$/i, "").replace(/\.[^.]+$/, "");
}

/**
 * Heuristic: suggest where an existing test file belongs. NEPTR's convention is
 * unit tests co-located beside their subject, cross-cutting suites in root tests/.
 * `srcFiles` maps src basenames (no extension) → their src-relative path so a
 * matching unit test can follow its subject to that file's target section.
 */
export function suggestTestTarget(relPath: string, srcFiles: Map<string, string>): { target: string; why: string } {
  const lower = relPath.toLowerCase();

  if (lower.startsWith("src/")) {
    return { target: "stays co-located", why: "moves with its source file in the code workstream" };
  }
  if (/(^|\/)(e2e|integration|acceptance|cypress|playwright)([\/._-]|$)/.test(lower)) {
    return { target: "`tests/`", why: "cross-cutting suite" };
  }
  if (/(^|\/)(fixtures?|mocks?|__mocks__|helpers?|setup|utils)([\/._-]|$)/.test(lower)) {
    return { target: "`tests/`", why: "shared helper/fixture" };
  }

  const subject = testSubjectBasename(path.basename(lower));
  const srcPath = srcFiles.get(subject);
  if (srcPath) {
    const { section } = suggestSection(srcPath);
    return { target: `co-locate in \`src/${section}/\``, why: `unit test for \`${srcPath}\`` };
  }
  return { target: "`tests/`", why: "unclassified — confirm" };
}

/**
 * Scan test dirs and `.test.` / `.spec.` files, suggesting a target per NEPTR's
 * convention. Inventory only — moves happen in the agent's tests workstream.
 */
export function buildTestsInventory(root: string, pkg: Record<string, unknown>): string {
  const isTestFile = (name: string): boolean =>
    SOURCE_EXTENSIONS.has(path.extname(name)) || /\.(test|spec)\./i.test(name);

  const found = new Set<string>();
  const walk = (dir: string, inTestDir: boolean): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
        walk(abs, inTestDir || TEST_DIR_NAMES.has(entry.name.toLowerCase()));
      } else if (
        (inTestDir && isTestFile(entry.name)) ||
        /\.(test|spec)\.[^.]+$/i.test(entry.name)
      ) {
        if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) found.add(abs);
      }
    }
  };
  walk(root, false);

  const files = [...found].sort();
  if (files.length === 0) {
    return "_No test files found._";
  }

  // Map src basenames → src-relative paths so unit tests can follow their subject.
  const srcFiles = new Map<string, string>();
  const srcDir = path.join(root, "src");
  if (fs.existsSync(srcDir)) {
    for (const abs of walkFiles(srcDir, (name) => SOURCE_EXTENSIONS.has(path.extname(name)))) {
      const rel = toRel(root, abs);
      if (/\.(test|spec)\.[^.]+$/i.test(abs)) continue;
      srcFiles.set(path.basename(abs).replace(/\.[^.]+$/, ""), rel);
    }
  }

  const deps = allDeps(pkg);
  const runners = TEST_RUNNER_DEPS.filter((d) => d in deps);
  const runnerConfigs = walkRootMatches(root, /^(vitest|jest|playwright|cypress|mocha)\.config\./).map((f) =>
    path.basename(f),
  );

  const lines: string[] = [`Found ${files.length} test file(s).`];
  if (runners.length || runnerConfigs.length) {
    lines.push(
      "",
      `Test runner: ${runners.length ? runners.map((r) => `\`${r}\``).join(", ") : "unknown"}${runnerConfigs.length ? `; config: ${runnerConfigs.map((c) => `\`${c}\``).join(", ")}` : ""} — moving tests may require \`include\`/\`testMatch\` updates there.`,
    );
  }
  lines.push(
    "",
    "| Current path | Suggested target | Why (heuristic) |",
    "| --- | --- | --- |",
    ...files.map((abs) => {
      const rel = toRel(root, abs);
      const { target, why } = suggestTestTarget(rel, srcFiles);
      return `| \`${rel}\` | ${target} | ${why} |`;
    }),
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Env / config inventory + workspace detection
// ---------------------------------------------------------------------------

/**
 * Inventory .env* files and notable root config files. Variable names are read
 * ONLY from .env.example — never from .env, so no secret values can leak into
 * generated files.
 */
export function buildEnvInventory(root: string): string {
  const envFiles = walkRootMatches(root, /^\.env(\..+)?$/).map((f) => path.basename(f));
  const configFiles = walkRootMatches(root, /^(vite|vitest|jest|playwright|cypress|drizzle|tailwind|postcss|eslint)\.config\.[^.]+$|^tsconfig(\..+)?\.json$|^\.eslintrc(\..+)?$/).map(
    (f) => path.basename(f),
  );

  const parts: string[] = [];
  if (envFiles.length === 0) {
    parts.push("_No `.env*` files found at the root._");
  } else {
    parts.push(`Env files found: ${envFiles.map((f) => `\`${f}\``).join(", ")}.`);
    const example = path.join(root, ".env.example");
    if (fs.existsSync(example)) {
      try {
        const names = [...fs.readFileSync(example, "utf8").matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map(
          (m) => m[1],
        );
        if (names.length) {
          parts.push(
            "",
            `Variables declared in \`.env.example\` (names only): ${names.map((n) => `\`${n}\``).join(", ")}.`,
          );
        }
      } catch {
        /* unreadable example */
      }
    } else {
      parts.push("", "No `.env.example` found — create one in the Docker workstream so required variables are documented without values.");
    }
    parts.push("", "Document each variable in `.docs/environment.md` (name, purpose, where to get it — never the value).");
  }

  if (configFiles.length) {
    parts.push(
      "",
      `Root config files worth checking for hardcoded paths during the migration: ${configFiles.map((f) => `\`${f}\``).join(", ")}. These stay at the root — inventory only.`,
    );
  }
  return parts.join("\n");
}

/** Detect monorepo/workspace markers; returns a short reason string when found. */
export function detectWorkspaces(root: string, pkg: Record<string, unknown>): string | undefined {
  const reasons: string[] = [];
  if (pkg.workspaces) reasons.push("npm workspaces in package.json");
  if (fs.existsSync(path.join(root, "pnpm-workspace.yaml"))) reasons.push("pnpm-workspace.yaml");
  if (fs.existsSync(path.join(root, "lerna.json"))) reasons.push("lerna.json");
  if (fs.existsSync(path.join(root, "turbo.json"))) reasons.push("turbo.json");
  return reasons.length ? reasons.join(", ") : undefined;
}
