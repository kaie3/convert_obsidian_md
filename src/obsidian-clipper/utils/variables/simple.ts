import { applyFilters } from "../filters";


/**
 * シンプルな変数（特殊プレフィックスなし）を処理する
 * @param variableString - 変数名やパス
 * @param variables - 変数辞書
 * @param currentUrl - 現在のURL
 * @returns フィルタ適用済みの値
 * @example
 * ```ts
 * const result = await processSimpleVariable("foo", {foo: "bar"}, "https://example.com");
 * // result === "bar"
 * ```
 */
export async function processSimpleVariable(
  variableString: string,
  variables: SimpleVariables,
  currentUrl: string,
): Promise<string> {
  // 変数名とフィルタを分割
  const [variablePath, ...filterParts] = variableString.split("|").map((part) => part.trim());
  let value: unknown;

  // ドットやブラケット記法ならネスト取得
  if (variablePath.includes(".") || variablePath.includes("[")) {
    value = getNestedValue(variables, variablePath);
  } else {
    // 波括弧付き優先
    value = variables[`{{${variablePath}}}`];
    if (value === undefined) {
      value = variables[variablePath];
    }
  }

  // 文字列化
  const stringValue = value === undefined || value === null
    ? ""
    : typeof value === "object"
    ? JSON.stringify(value)
    : String(value);

  const filtersString = filterParts.join("|");
  return applyFilters(stringValue, filtersString, currentUrl);
}

/**
 * シンプル変数辞書の型
 */
export interface SimpleVariables {
  [key: string]: unknown;
}

/**
 * ネストした値を安全に取得
 * @param obj - 任意のオブジェクト
 * @param path - ドット区切りパス
 * @returns 値 or undefined
 * @example
 * getNestedValue({foo: {bar: 1}}, "foo.bar") //=> 1
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  return keys.reduce((value: unknown, key: string) => {
    if (value === undefined || value === null) return undefined;
    if (key.includes("[") && key.includes("]")) {
      const [arrayKey, indexStr] = key.split(/[\[\]]/);
      if (
        typeof value === "object" &&
        value !== null &&
        Object.hasOwn(value, arrayKey) &&
        Array.isArray((value as Record<string, unknown>)[arrayKey])
      ) {
        const index = parseInt(indexStr, 10);
        return ((value as Record<string, unknown>)[arrayKey] as unknown[])[index];
      }
      return undefined;
    }
    if (typeof value === "object" && value !== null && Object.hasOwn(value, key)) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// Helper function to get nested value from an object
function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  return keys.reduce((value: unknown, key: string) => {
    if (value === undefined || value === null) return undefined;
    if (key.includes("[") && key.includes("]")) {
      const [arrayKey, indexStr] = key.split(/[\[\]]/);
      if (
        typeof value === "object" &&
        value !== null &&
        arrayKey in value &&
        Array.isArray((value as Record<string, unknown>)[arrayKey])
      ) {
        const index = parseInt(indexStr, 10);
        return ((value as Record<string, unknown>)[arrayKey] as unknown[])[index];
      }
      return undefined;
    }
    if (typeof value === "object" && value !== null && key in value) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
}
