import * as fs from "@std/fs";
import * as path from "@std/path";
import { BlobReader, Entry, Uint8ArrayWriter, ZipReader } from "@zip-js/zip-js";

export async function extractInoreaderCanonicalHrefs(): Promise<string[]> {
  const inoreaderDir = path.resolve("inoreader");
  const files = [];
  for await (const entry of fs.walk(inoreaderDir, { maxDepth: 1 })) {
    if (
      entry.isFile &&
      entry.name.endsWith(".zip") &&
      entry.name.includes("Inoreader export")
    ) {
      files.push(entry.path);
    }
  }
  if (files.length !== 1) {
    throw new Error(
      `inoreaderディレクトリ内に"Inoreader export"を含むzipファイルが1つだけ存在する必要があります (見つかった数: ${files.length})`,
    );
  }
  const zipPath = files[0];
  const absZipPath = path.resolve(zipPath);
  const zipBuffer = await Deno.readFile(absZipPath);
  const blob = new Blob([zipBuffer]);
  const zipReader = new ZipReader(new BlobReader(blob));
  const entries: Entry[] = await zipReader.getEntries();
  const hrefs: string[] = [];
  if (entries.length === 0) {
    throw new Error("zipファイルにエントリがありません");
  }
  for (const entry of entries) {
    if (entry.filename.endsWith(".json")) {
      const content = await entry.getData?.(new Uint8ArrayWriter());
      if (content) {
        try {
          const json = JSON.parse(new TextDecoder().decode(content));
          if (Array.isArray(json.items)) {
            for (const item of json.items) {
              if (item.canonical && Array.isArray(item.canonical)) {
                for (const c of item.canonical) {
                  if (c && typeof c.href === "string") {
                    hrefs.push(c.href);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error(`Error parsing JSON from ${entry.filename}:`, e);
        }
      }
    }
  }
  await zipReader.close();
  return Array.from(new Set(hrefs));
}
