import { scrapeSite } from "./index.js";
import { toJSON, toCSV, toXLSX } from "../export/index.js";
import { mkdirSync, writeFileSync } from "node:fs";

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error(
    "Usage: pnpm test:scrape <url> [maxPages] [--upload-images] [--export=json|csv|xlsx]",
  );
  process.exit(1);
}

const maxPages = Number(process.argv[3] ?? 15);
const uploadImages = process.argv.includes("--upload-images");
const exportFlag = process.argv.find((arg) => arg.startsWith("--export="));
const exportFormat = exportFlag?.split("=")[1];

const result = await scrapeSite({
  baseUrl,
  maxPages,
  dbPath: "../../data/app.db",
  uploadImages,
});

console.log(`Source: ${result.source}`);
console.log(`Pages visited: ${result.pagesVisited}`);
console.log(`Products found: ${result.products.length}`);
console.log(JSON.stringify(result.products.slice(0, 5), null, 2));

if (exportFormat) {
  const outputDir = "../../output";
  mkdirSync(outputDir, { recursive: true });
  const outPath = `${outputDir}/products.${exportFormat}`;

  if (exportFormat === "json") {
    writeFileSync(outPath, toJSON(result.products));
  } else if (exportFormat === "csv") {
    writeFileSync(outPath, toCSV(result.products));
  } else if (exportFormat === "xlsx") {
    writeFileSync(outPath, toXLSX(result.products));
  } else {
    console.error(
      `Unknown export format "${exportFormat}". Use json, csv, or xlsx.`,
    );
    process.exit(1);
  }

  console.log(`Exported ${result.products.length} products to ${outPath}`);
}
