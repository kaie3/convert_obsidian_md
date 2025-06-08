import { Property, SaveToDownloadsOptions } from "../types/types.ts";
import { generateFrontmatter } from "../utils/frontmatter.ts";
import { saveFile } from "../utils/download.ts";
import { incrementStat } from "../utils/storage-utils.ts";
import { createMarkdownContent } from "../utils/markdown.ts";

/**
 * UIエラー表示（popup-ui.tsでのみ利用）
 */
function showError(message: string): void {
  alert(message);
}

/**
 * Obsidian用Markdownファイルを保存する純粋関数（UI依存なし）
 * @example
 * await saveMarkdownToDownloads({
 *   content: '<h1>Hello</h1>',
 *   options: { fileName: 'sample', properties: [{ name: 'url', value: 'https://example.com' }] }
 * });
 */
export async function saveMarkdownToDownloads(params: {
  content: string;
  options?: SaveToDownloadsOptions;
  onError?: (error: Error) => void;
}): Promise<void> {
  const { content, options = {}, onError } = params;
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
    onError,
  });
}

/**
 * Chrome拡張popup UIから呼び出す保存処理
 * @example
 * await handleSaveToDownloadsFromUI();
 */
export async function handleSaveToDownloadsFromUI(): Promise<void> {
  try {
    // UIから値を取得
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
}
