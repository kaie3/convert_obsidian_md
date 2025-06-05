/// <reference lib="dom" />
import { Property, SaveToDownloadsOptions } from "../types/types.ts";
import { generateFrontmatter } from "../utils/obsidian-note-creator.ts";
import { saveFile } from "../utils/file-utils.ts";
import { incrementStat } from "../utils/storage-utils.ts";
import { createMarkdownContent } from "../utils/markdown-converter.ts";

function showError(message: string): void {
  alert(message);
}

/**
 * HTML文字列をObsidian用Markdownに変換し、frontmatter付きでダウンロード保存する
 *
 * @example
 * // Playwright等で取得したHTMLを保存
 * await handleSaveToDownloads(html, { fileName: "sample", properties: [{name: "url", value: "https://example.com"}] });
 *
 * // 既存UIから呼び出し（引数なし）
 * await handleSaveToDownloads();
 */
export async function handleSaveToDownloads(
  contentOrOptions: string | SaveToDownloadsOptions,
  maybeOptions?: SaveToDownloadsOptions,
) {
  // UIからの呼び出し（引数なし）
  if (typeof contentOrOptions === "undefined") {
    try {
      const noteNameField = document.getElementById(
        "note-name-field",
      ) as HTMLInputElement;
      const pathField = document.getElementById(
        "path-name-field",
      ) as HTMLInputElement;
      const vaultDropdown = document.getElementById(
        "vault-select",
      ) as HTMLSelectElement;
      const fileName = noteNameField?.value || "untitled";
      const path = pathField?.value || "";
      const vault = vaultDropdown?.value || "";
      const properties = Array.from(
        document.querySelectorAll(".metadata-property input"),
      ).map((input) => {
        const inputElement = input as HTMLInputElement;
        return {
          id: inputElement.dataset.id ||
            Date.now().toString() + Math.random().toString(36).slice(2, 11),
          name: inputElement.id,
          value: inputElement.type === "checkbox"
            ? inputElement.checked
            : inputElement.value,
        };
      }) as Property[];
      const noteContentField = document.getElementById(
        "note-content-field",
      ) as HTMLTextAreaElement;
      const frontmatter = await generateFrontmatter(properties);
      const fileContent = frontmatter + noteContentField.value;
      await saveFile({
        content: fileContent,
        fileName,
        mimeType: "text/markdown",
        tabId: undefined,
        onError: (error) => showError("failedToSaveFile"),
      });
      await incrementStat("saveFile", vault, path);
      const moreDropdown = document.getElementById("more-dropdown");
      if (moreDropdown) {
        moreDropdown.classList.remove("show");
      }
    } catch (error) {
      showError("failedToSaveFile");
    }
    return;
  }

  // CLI/自動化用途: HTML文字列を受けて保存
  const content = typeof contentOrOptions === "string"
    ? contentOrOptions
    : undefined;
  const options: SaveToDownloadsOptions =
    (typeof contentOrOptions === "object" ? contentOrOptions : maybeOptions) ||
    {};
  if (!content) throw new Error("content(HTML)が必要です");

  // Markdown変換
  const markdown = createMarkdownContent(
    content,
    options.properties?.find((p) => p.name === "url")?.value || "",
  );
  const frontmatter = await generateFrontmatter(options.properties || []);
  const fileContent = frontmatter + markdown;
  const fileName = options.fileName || "untitled";
  await saveFile({
    content: fileContent,
    fileName,
    mimeType: "text/markdown",
    tabId: undefined,
    onError: (error) => showError("failedToSaveFile"),
  });
}
