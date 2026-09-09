// Minimal robots.txt parser: only the rules relevant to a same-origin crawl.
export interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelayMs?: number;
}

export async function fetchRobotsRules(origin: string): Promise<RobotsRules> {
  const rules: RobotsRules = { disallow: [], allow: [] };
  try {
    const res = await fetch(`${origin}/robots.txt`, { redirect: "follow" });
    if (!res.ok) return rules;
    const text = await res.text();

    let appliesToUs = false;
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) continue;
      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();

      if (key === "user-agent") {
        appliesToUs = value === "*";
      } else if (appliesToUs && key === "disallow" && value) {
        rules.disallow.push(value);
      } else if (appliesToUs && key === "allow" && value) {
        rules.allow.push(value);
      } else if (appliesToUs && key === "crawl-delay" && value) {
        const seconds = Number(value);
        if (!Number.isNaN(seconds)) rules.crawlDelayMs = seconds * 1000;
      }
    }
  } catch {
    // robots.txt unreachable — proceed without restrictions
  }
  return rules;
}

export function isPathAllowed(pathname: string, rules: RobotsRules): boolean {
  const disallowRule = rules.disallow
    .filter((rule) => rule && pathname.startsWith(rule))
    .sort((a, b) => b.length - a.length)[0];
  if (!disallowRule) return true;

  const allowRule = rules.allow
    .filter((rule) => rule && pathname.startsWith(rule))
    .sort((a, b) => b.length - a.length)[0];
  return !!allowRule && allowRule.length >= disallowRule.length;
}
