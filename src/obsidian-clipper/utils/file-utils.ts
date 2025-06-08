import { ensureDir } from "@std/fs/ensure-dir";
import { dirname } from "@std/path/dirname";

export interface SaveFileOptions {
  content: string;
  fileName: string;
  mimeType?: string;
}

// export function base64EncodeUnicode(str: string): string {
//   const utf8Bytes = encodeURIComponent(str).replace(
//     /%([0-9A-F]{2})/g,
//     (match, p1) => String.fromCharCode(parseInt(p1, 16)),
//   );
//   return btoa(utf8Bytes);
// }

export async function saveFile({
  content,
  fileName,
  mimeType = "text/markdown",
}: SaveFileOptions): Promise<void> {
  const dir = dirname("dist/md");

  if (
    mimeType === "text/markdown" && !fileName.toLowerCase().endsWith(".md")
  ) {
    fileName = `${fileName}.md`;
  }

  await ensureDir(dir);
  await Deno.writeTextFile(fileName, content);
  return;
}
