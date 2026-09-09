import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const targetDir = join("src-tauri", "resources", "node");
const target = join(targetDir, process.platform === "win32" ? "node.exe" : "node");

export function stageNodeRuntime() {
  rmSync(targetDir, { force: true, recursive: true });
  mkdirSync(targetDir, { recursive: true });
  cpSync(process.execPath, target);

  if (!existsSync(target)) {
    throw new Error(`Unable to stage Node runtime from ${dirname(process.execPath)}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  stageNodeRuntime();
}