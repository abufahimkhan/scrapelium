import { execSync } from "node:child_process";

const command = process.argv[2];
if (command !== "dev" && command !== "build") {
  throw new Error("Usage: node scripts/run-tauri.mjs <dev|build>");
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
execSync(`${pnpm} build:desktop:resources`, { stdio: "inherit" });
execSync(`${pnpm} exec tauri ${command}`, { stdio: "inherit" });