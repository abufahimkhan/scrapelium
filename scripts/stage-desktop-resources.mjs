import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { stageNodeRuntime } from "./stage-node-runtime.mjs";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (command, args, options = {}) => {
  if (process.platform === "win32" && command.endsWith(".cmd")) {
    return execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command, ...args], { stdio: "inherit", ...options });
  }
  return execFileSync(command, args, { stdio: "inherit", ...options });
};
const serverDir = join("src-tauri", "resources", "server");

run(pnpm, ["build:core"]);
run(pnpm, ["--filter", "@scrapelium/server", "build"]);
rmSync(serverDir, { force: true, recursive: true });
mkdirSync(serverDir, { recursive: true });

const serverPackage = JSON.parse(readFileSync(join("apps", "server", "package.json"), "utf8"));
const corePackage = JSON.parse(readFileSync(join("packages", "core", "package.json"), "utf8"));
delete serverPackage.dependencies["@scrapelium/core"];
serverPackage.dependencies = { ...corePackage.dependencies, ...serverPackage.dependencies };
writeFileSync(join(serverDir, "package.json"), `${JSON.stringify(serverPackage, null, 2)}\n`);
cpSync(join("apps", "server", "dist"), join(serverDir, "dist"), { recursive: true });

// npm creates physical package directories. pnpm's deployment uses junctions,
// which Tauri omits while collecting Windows resources and causes instant exit.
run(npm, ["install", "--omit=dev", "--package-lock=false", "--no-audit", "--no-fund"], { cwd: serverDir });

const coreDir = join(serverDir, "node_modules", "@scrapelium", "core");
mkdirSync(coreDir, { recursive: true });
cpSync(join("packages", "core", "dist"), join(coreDir, "dist"), { recursive: true });
cpSync(join("packages", "core", "package.json"), join(coreDir, "package.json"));

stageNodeRuntime();

const node = resolve("src-tauri", "resources", "node", process.platform === "win32" ? "node.exe" : "node");
run(node, ["--input-type=module", "-e", "import Database from 'better-sqlite3'; import 'express'; import '@scrapelium/core'; new Database(':memory:').close();"], { cwd: serverDir });
