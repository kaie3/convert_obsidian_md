import { Browser, Page } from "playwright";
import { handleSaveToDownloads } from "../obsidian-clipper/core/popup.ts";
import { SaveToDownloadsOptions } from "../obsidian-clipper/types/types.ts";
import { delay } from "./utils.ts";

async function crawlUrl(page: Page, url: string) {
  const res = await page.goto(url);
  if (res === null) throw new Error("resが空です");
  console.log(res.status(), page.url());
  if (res.status() !== 200) {
    await delay(6000);
    await page.screenshot({ path: "1.png", fullPage: true });
  }
  const html = await page.content();
  const options: SaveToDownloadsOptions = {
    fileName: "page-clip",
    properties: [
      { name: "url", value: url },
      { name: "date", value: new Date().toISOString() },
    ],
  };
  await handleSaveToDownloads(html, options);
}

export async function processDomainsInTab(
  tabId: number,
  queue: [string, string[]][],
  browser: Browser,
  DELAY_MS: number,
) {
  const page = await browser.newPage();
  while (true) {
    const entry = queue.shift();
    if (!entry) break;
    const [domain, urls] = entry;
    console.log(`[Tab ${tabId}] Processing domain: ${domain}`);
    for (const url of urls) {
      try {
        await crawlUrl(page, url);
      } catch (e) {
        console.error(`[Tab ${tabId}] Failed to crawl ${url}:`, e);
      } finally {
        await delay(DELAY_MS);
      }
    }
  }
  await page.close();
}
