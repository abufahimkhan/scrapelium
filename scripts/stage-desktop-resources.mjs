import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { stageNodeRuntime } from "./stage-node-runtime.mjs";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const run = (command) => execSync(command, { stdio: "inherit" });

run(`${pnpm} build:core`);
run(`${pnpm} --filter @scrapelium/server build`);
rmSync("src-tauri/resources/server", { force: true, recursive: true });
run(`${pnpm} --filter @scrapelium/server deploy src-tauri/resources/server --prod`);
stageNodeRuntime();