import { chromium } from "playwright";
import { extractInoreaderCanonicalHrefs } from "./lib/inoreader.ts";
import { groupByDomain } from "./lib/group.ts";
import { processDomainsInTab } from "./lib/crawler.ts";

const MAX_TABS = 5;
const DELAY_MS = 2000;

const urls = await extractInoreaderCanonicalHrefs();
const grouped = groupByDomain(urls);
const domainQueue = Array.from(grouped.entries());

const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  ],
});

const tabWorkers: Promise<void>[] = [];
const domainQueueShared = [...domainQueue];
for (let i = 0; i < Math.min(MAX_TABS, domainQueue.length); i++) {
  tabWorkers.push(
    processDomainsInTab(i + 1, domainQueueShared, browser, DELAY_MS),
  );
}

await Promise.all(tabWorkers);
await browser.close();
