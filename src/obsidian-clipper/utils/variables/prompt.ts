import { generalSettings } from "../storage-utils";

/**
 * プロンプト変数をそのまま返す（UI用）
 * @param match - プロンプト変数のマッチ文字列
 * @param variables - 変数辞書
 * @param currentUrl - 現在のURL
 * @returns 入力欄で表示するための値
 * @example
 * ```ts
 * const result = await processPrompt('{{prompt:"foo"}}', {}, 'https://example.com');
 * // result === '{{prompt:"foo"}}'
 * ```
 */
export function processPrompt(
  match: string,
  _variables: PromptVariables,
  _currentUrl: string,
): string {
  if (generalSettings.interpreterEnabled) {
    const promptRegex = /{{(?:prompt:)?"(.*?)"(\|.*?)?}}/;
    const matches = match.match(promptRegex);
    if (!matches) {
      console.error("Invalid prompt format:", match);
      return match;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [, _promptText, _filters = ""] = matches;
    return match;
  } else {
    return "";
  }
}

/**
 * プロンプト変数辞書の型
 */
export interface PromptVariables {
  [key: string]: string;
}
