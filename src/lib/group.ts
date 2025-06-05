export function groupByDomain(urls: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const url of urls) {
    try {
      const domain = new URL(url).hostname;
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain)!.push(url);
    } catch {
      console.warn(`無効なURLをスキップ: ${url}`);
      continue;
    }
  }
  return map;
}
