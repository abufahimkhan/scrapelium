import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";

function systemChromeCandidates(): string[] {
  if (process.platform === "win32") {
    return [
      join(
        process.env.PROGRAMFILES ?? String.raw`C:\Program Files`,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
      join(
        process.env["PROGRAMFILES(X86)"] ?? String.raw`C:\Program Files (x86)`,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
    ];
  }
  if (process.platform === "darwin") {
    return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
}

export async function launchScraperBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true });
  } catch (bundledBrowserError) {
    const executablePath = systemChromeCandidates().find(existsSync);
    if (!executablePath) {
      throw new Error(
        "Playwright Chromium is unavailable and no system Chrome installation was found. Install Google Chrome or configure Playwright Chromium before scraping.",
        { cause: bundledBrowserError },
      );
    }
    return chromium.launch({ headless: true, executablePath });
  }
}
