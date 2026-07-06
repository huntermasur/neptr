import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectDocker } from "../src/adopt-scan.js";
import { buildComposeBlocks, writeDockerDrafts } from "../src/adopt-docker.js";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "neptr-adopt-docker-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("buildComposeBlocks", () => {
  it("builds postgres + redis blocks with depends_on, volumes, and env interpolation", () => {
    const scan = detectDocker(dir, { dependencies: { express: "^4", pg: "^8", redis: "^4" } });
    const blocks = buildComposeBlocks(scan, "my-app");
    expect(blocks.services).toContain("postgres:");
    expect(blocks.services).toContain("image: postgres:16-alpine");
    expect(blocks.services).toContain("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-change-me}");
    expect(blocks.services).toContain("POSTGRES_DB: ${POSTGRES_DB:-my-app}");
    expect(blocks.services).toContain("redis:7-alpine");
    expect(blocks.dependsOn).toContain("- postgres");
    expect(blocks.dependsOn).toContain("- redis");
    expect(blocks.volumes).toContain("pgdata:");
  });

  it("returns empty blocks when there are no backing services", () => {
    const scan = detectDocker(dir, { dependencies: { express: "^4" } });
    expect(buildComposeBlocks(scan, "my-app")).toEqual({ services: "", dependsOn: "", volumes: "" });
  });
});

describe("writeDockerDrafts", () => {
  it("writes DRAFT-headed server drafts for an express + postgres project", () => {
    fs.writeFileSync(path.join(dir, ".env.example"), "PORT=4000\n");
    const pkg = {
      dependencies: { express: "^4", pg: "^8" },
      scripts: { start: "node dist/server.js", build: "tsc" },
    };
    const scan = detectDocker(dir, pkg);
    const result = writeDockerDrafts(dir, "my-app", pkg, scan);
    expect(result.written).toEqual(["Dockerfile", "docker-compose.yml", ".dockerignore"]);

    const dockerfile = fs.readFileSync(path.join(dir, "Dockerfile"), "utf8");
    expect(dockerfile).toContain("# DRAFT");
    expect(dockerfile).toContain("EXPOSE 4000");
    expect(dockerfile).toContain("RUN npm run build");
    expect(dockerfile).toContain('CMD ["npm", "run", "start"]');

    const compose = fs.readFileSync(path.join(dir, "docker-compose.yml"), "utf8");
    expect(compose).toContain("name: my-app");
    expect(compose).toContain('"4000:4000"');
    expect(compose).toContain("postgres:");
    expect(compose).toContain("depends_on:");
    expect(compose).not.toContain("{{");
  });

  it("drops the build line and flags the entrypoint when scripts are missing", () => {
    const pkg = { dependencies: { fastify: "^4" } };
    const result = writeDockerDrafts(dir, "my-app", pkg, detectDocker(dir, pkg));
    expect(result.written).toContain("Dockerfile");
    const dockerfile = fs.readFileSync(path.join(dir, "Dockerfile"), "utf8");
    expect(dockerfile).not.toContain("RUN npm run build");
    expect(dockerfile).toContain('CMD ["node", "dist/index.js"]');
    expect(dockerfile).toContain("TODO");
  });

  it("uses the SPA (nginx) variant for a plain Vite project", () => {
    const pkg = { devDependencies: { vite: "^5" } };
    const result = writeDockerDrafts(dir, "my-spa", pkg, detectDocker(dir, pkg));
    expect(result.written).toEqual(["Dockerfile", "docker-compose.yml", "nginx.conf", ".dockerignore"]);
    const dockerfile = fs.readFileSync(path.join(dir, "Dockerfile"), "utf8");
    expect(dockerfile).toContain("# DRAFT");
    expect(dockerfile).toContain("nginx:alpine");
  });

  it("writes nothing when docker files already exist", () => {
    fs.writeFileSync(path.join(dir, "docker-compose.yml"), "services: {}");
    const pkg = { dependencies: { express: "^4" } };
    const result = writeDockerDrafts(dir, "my-app", pkg, detectDocker(dir, pkg));
    expect(result.written).toEqual([]);
    expect(fs.existsSync(path.join(dir, "Dockerfile"))).toBe(false);
  });

  it("writes nothing for a library with no server, db, or vite", () => {
    const result = writeDockerDrafts(dir, "my-lib", {}, detectDocker(dir, {}));
    expect(result.written).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it("skips individual files that already exist", () => {
    fs.writeFileSync(path.join(dir, ".dockerignore"), "node_modules\n");
    const pkg = { dependencies: { express: "^4" }, scripts: { start: "node ." } };
    const result = writeDockerDrafts(dir, "my-app", pkg, detectDocker(dir, pkg));
    expect(result.written).toEqual(["Dockerfile", "docker-compose.yml"]);
    expect(result.skipped).toEqual([".dockerignore"]);
    expect(fs.readFileSync(path.join(dir, ".dockerignore"), "utf8")).toBe("node_modules\n");
  });
});
