import pc from "picocolors";
import { neptr } from "./theme.js";
import { commandExists, run } from "./run.js";

interface Check {
  name: string;
  required: boolean;
  run: () => Promise<{ ok: boolean; detail: string }>;
}

async function versionOf(command: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await run(command, ["--version"], { stdio: "pipe", timeout: 15_000 });
    const out = String(res.stdout ?? "").trim().split("\n")[0] ?? "";
    return { ok: true, detail: out };
  } catch {
    return { ok: false, detail: "not found" };
  }
}

const CHECKS: Check[] = [
  {
    name: "Node.js >= 20",
    required: true,
    run: async () => {
      const major = Number(process.versions.node.split(".")[0]);
      return { ok: major >= 20, detail: `v${process.versions.node}` };
    },
  },
  { name: "npm", required: true, run: () => versionOf("npm") },
  { name: "git", required: true, run: () => versionOf("git") },
  {
    name: "git identity",
    required: false,
    run: async () => {
      try {
        const res = await run("git", ["config", "user.email"], { stdio: "pipe", timeout: 15_000 });
        return { ok: true, detail: String(res.stdout ?? "").trim() };
      } catch {
        return { ok: false, detail: "user.name/user.email not set — the git init step would fail" };
      }
    },
  },
  {
    name: "Docker daemon",
    required: false,
    run: async () => {
      if (!(await commandExists("docker"))) return { ok: false, detail: "docker not installed" };
      const up = await commandExists("docker", ["info"]);
      return { ok: up, detail: up ? "running" : "installed, but the daemon is not running" };
    },
  },
  {
    name: "codegraph",
    required: false,
    run: async () => {
      const found = await commandExists("codegraph");
      return { ok: found, detail: found ? "installed" : "not installed (NEPTR can install it during scaffold)" };
    },
  },
  {
    name: "npm registry reachable",
    required: false,
    run: async () => {
      try {
        const res = await fetch("https://registry.npmjs.org/-/ping", { signal: AbortSignal.timeout(10_000) });
        return { ok: res.ok, detail: res.ok ? "online" : `HTTP ${res.status}` };
      } catch {
        return { ok: false, detail: "offline? skills/vite/codegraph steps need the network" };
      }
    },
  },
];

export async function doctor(): Promise<void> {
  let requiredFailures = 0;
  for (const check of CHECKS) {
    const { ok, detail } = await check.run();
    const icon = ok ? pc.green("✔") : check.required ? pc.red("✘") : pc.yellow("▲");
    console.log(`  ${icon} ${check.name.padEnd(24)} ${pc.dim(detail)}`);
    if (!ok && check.required) requiredFailures++;
  }
  console.log();
  if (requiredFailures) {
    neptr.error(`${requiredFailures} required check(s) failed — fix those before running neptr new.`);
    process.exitCode = 1;
  } else {
    neptr.success("Everything checks out. Ready to bake a new project?");
  }
}
