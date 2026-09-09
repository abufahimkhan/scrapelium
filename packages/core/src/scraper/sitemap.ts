// Sitemap discovery: handles both plain sitemaps and sitemap indexes.
async function fetchXml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi), (m) => m[1]);
}

export async function discoverSitemapUrls(
  origin: string,
  maxUrls: number,
): Promise<string[]> {
  const seenSitemaps = new Set<string>();
  const queue = [`${origin}/sitemap.xml`];
  const results: string[] = [];

  while (queue.length && results.length < maxUrls) {
    const sitemapUrl = queue.shift()!;
    if (seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);

    const xml = await fetchXml(sitemapUrl);
    if (!xml) continue;

    const locs = extractLocs(xml);
    if (/<sitemapindex/i.test(xml)) {
      queue.push(...locs);
    } else {
      results.push(...locs);
    }
  }

  return results.slice(0, maxUrls);
}
