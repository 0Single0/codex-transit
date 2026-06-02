import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const agentDir = resolve(scriptDir, "..");
const srcTauriDir = resolve(agentDir, "src-tauri");
const targetDir = resolve(srcTauriDir, "target-local");

const [task = "dev"] = process.argv.slice(2);

const isWindows = process.platform === "win32";
const env = {
  ...process.env,
  CARGO_TARGET_DIR: targetDir,
  CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS ?? "1"
};

const commandMap = {
  dev: {
    command: isWindows ? "pnpm.cmd" : "pnpm",
    args: ["exec", "tauri", "dev"]
  },
  build: {
    command: isWindows ? "pnpm.cmd" : "pnpm",
    args: ["exec", "tauri", "build"]
  },
  "typecheck:rust": {
    command: "cargo",
    args: ["check", "--manifest-path", "src-tauri/Cargo.toml"]
  },
  "test:rust": {
    command: "cargo",
    args: ["test", "--manifest-path", "src-tauri/Cargo.toml", "--lib", "--tests", "--jobs", "1"]
  }
};

const selected = commandMap[task];

if (!selected) {
  console.error(`Unknown Rust task: ${task}`);
  process.exit(1);
}

const child = spawn(selected.command, selected.args, {
  cwd: agentDir,
  env,
  stdio: "inherit",
  shell: false
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
