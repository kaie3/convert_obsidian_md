import browser from "../browser-polyfill";
import { applyFilters } from "../filters";
import { debugLog } from "../debug";

/**
 * セレクタ変数を処理し、要素内容を抽出・フィルタ適用する
 * @param tabId - 対象タブID
 * @param match - セレクタ変数のマッチ文字列
 * @param currentUrl - 現在のURL
 * @returns フィルタ適用済みの値
 * @example
 * ```ts
 * const result = await processSelector(1, '{{selector:.title}}', 'https://example.com');
 * // result: タイトル要素のテキスト
 * ```
 */
export async function processSelector(
  tabId: number,
  match: string,
  currentUrl: string,
): Promise<string> {
  // セレクタ構文解析
  const selectorRegex =
    /{{(selector|selectorHtml):(.*?)(?:\?(.*?))?(?:\|(.*?))?}}/;
  const matches = match.match(selectorRegex);
  if (!matches) {
    console.error("Invalid selector format:", match);
    return match;
  }
  const [, selectorType, rawSelector, attribute, filtersString] = matches;
  const extractHtml = selectorType === "selectorHtml";
  // エスケープ解除
  const selector = rawSelector.replace(/\\"/g, '"');

  try {
    const response = await browser.tabs.sendMessage(tabId, {
      action: "extractContent",
      selector: selector,
      attribute: attribute,
      extractHtml: extractHtml,
    }) as { content: string };

    const content = response ? response.content : "";
    // 配列ならJSON化
    const contentString = Array.isArray(content)
      ? JSON.stringify(content)
      : content;
    debugLog("ContentExtractor", "Applying filters:", {
      selector,
      filterString: filtersString,
    });
    const filteredContent = applyFilters(
      contentString,
      filtersString,
      currentUrl,
    );
    return filteredContent;
  } catch (error) {
    console.error("Error extracting content by selector:", error, {
      selector,
      attribute,
      extractHtml,
    });
    return "";
  }
}
