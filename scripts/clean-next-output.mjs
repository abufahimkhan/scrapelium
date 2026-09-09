import { rmSync } from "node:fs";
import { resolve } from "node:path";

const outputDir = resolve(process.cwd(), ".next");
rmSync(outputDir, { force: true, recursive: true });
