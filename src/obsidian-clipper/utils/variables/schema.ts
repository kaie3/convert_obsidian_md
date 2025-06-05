import { applyFilters } from "../filters/index.ts";

/**
 * Obsidian用スキーマ変数の値を抽出・加工する
 * @param match - 変数展開対象のマッチ文字列 (例: {{schema:foo}})
 * @param variables - 変数辞書
 * @param currentUrl - 現在のURL
 * @returns フィルタ適用済みの値
 * @example
 * ```ts
 * const result = await processSchema("{{schema:foo}}", {"{{schema:foo}}": "bar"}, "https://example.com");
 * // result === "bar"
 * ```
 */
export async function processSchema(
  match: string,
  variables: SchemaVariables,
  currentUrl: string,
): Promise<string> {
  // スキーマ変数のキーとフィルタを分解
  const [, fullSchemaKey] = match.match(/{{schema:(.*?)}}/) || [];
  const [schemaKey, ...filterParts] = fullSchemaKey.split("|");
  const filtersString = filterParts.join("|");

  let schemaValue = "";

  // 配列アクセス構文かどうか判定
  const nestedArrayMatch = schemaKey.match(/(.*?)\[(\*|\d+)\](.*)/);
  if (nestedArrayMatch) {
    const [, arrayKey, indexOrStar, propertyKey] = nestedArrayMatch;

    // @type {string} 配列アクセス時の実際のキーを決定
    let fullArrayKey = arrayKey;
    if (!arrayKey.includes("@")) {
      const matchingKey = Object.keys(variables).find((key) =>
        key.includes("@") && key.endsWith(`:${arrayKey}}}`)
      );
      if (matchingKey) {
        fullArrayKey = matchingKey.replace("{{schema:", "").replace("}}", "");
      }
    }

    try {
      const rawValue = variables[`{{schema:${fullArrayKey}}}`] || "[]";

      // リスト文字列か判定
      if (rawValue.trim().match(/^(?:\d+\.|[-*•]\s)/m)) {
        const list = splitListString(rawValue);
        if (indexOrStar === "*") {
          schemaValue = JSON.stringify(list);
        } else {
          const index = parseInt(indexOrStar, 10);
          schemaValue = list[index] || "";
        }
      } else {
        // JSON配列として処理
        const arrayValue = JSON.parse(rawValue) as unknown[];
        if (Array.isArray(arrayValue)) {
          if (indexOrStar === "*") {
            schemaValue = JSON.stringify(
              arrayValue.map((item) =>
                getNestedProperty(item, propertyKey.slice(1))
              ).filter(Boolean),
            );
          } else {
            const index = parseInt(indexOrStar, 10);
            const element = arrayValue[index];
            schemaValue = element
              ? String(getNestedProperty(element, propertyKey.slice(1)) ?? "")
              : "";
          }
        }
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.error("Error processing schema array:", error);
      console.error("Raw value:", variables[`{{schema:${fullArrayKey}}}`]);
      return "";
    }
  } else {
    // 通常のスキーマ変数
    if (!schemaKey.includes("@")) {
      const matchingKey = Object.keys(variables).find((key) =>
        key.includes("@") && key.endsWith(`:${schemaKey}}}`)
      );
      if (matchingKey) {
        schemaValue = variables[matchingKey];
      }
    }
    // マッチしなければそのまま
    if (!schemaValue) {
      schemaValue = variables[`{{schema:${schemaKey}}}`] || "";
    }
  }

  return applyFilters(schemaValue, filtersString, currentUrl);
}

/**
 * スキーマ変数辞書の型
 */
export interface SchemaVariables {
  [key: string]: string;
}

/**
 * ネストしたプロパティを安全に取得する
 * @param obj - 任意のオブジェクト
 * @param path - ドット区切りのパス
 * @returns プロパティ値 or undefined
 * @example
 * ```ts
 * getNestedProperty({foo: {bar: 1}}, "foo.bar") //=> 1
 * getNestedProperty({foo: {bar: 1}}, "foo.baz") //=> undefined
 * ```
 */
function getNestedProperty(obj: unknown, path: string): unknown {
  return path.split(".").reduce((prev: unknown, curr: string) => {
    if (
      prev && typeof prev === "object" && prev !== null &&
      Object.hasOwn(prev, curr)
    ) {
      return (prev as Record<string, unknown>)[curr];
    }
    return undefined;
  }, obj);
}

/**
 * 番号付きリストや箇条書き文字列を配列に変換
 * @param str - リスト文字列
 * @returns 配列
 * @example
 * splitListString("1. foo\n2. bar") //=> ["foo", "bar"]
 */
function splitListString(str: string): string[] {
  return str
    .split(/(?=\d+\.|[-*•]\s)/)
    .map((item) => item.replace(/^(?:\d+\.|[-*•])\s*/, "").trim())
    .filter((item) => item.length > 0);
}
