import { escapeDoubleQuotes } from "./string-utils.ts";
import { Property } from "../types/types.ts";
import { generalSettings } from "./storage-utils.ts";

/**
 * Obsidian用frontmatterを生成する
 * @param properties frontmatterに含めるプロパティ配列
 * @returns frontmatter文字列
 * @example
 * generateFrontmatter([{ name: "url", value: "https://example.com" }])
 */
export function generateFrontmatter(properties: Property[]): string {
  let frontmatter = "---\n";
  for (const property of properties) {
    frontmatter += `${property.name}:`;

    const propertyType = generalSettings.propertyTypes.find((p) =>
      p.name === property.name
    )?.type || "text";

    switch (propertyType) {
      case "multitext": {
        let items: string[];
        try {
          items = JSON.parse(property.value);
        } catch (_e) {
          // If parsing fails, fall back to splitting by comma (wikilinks考慮)
          items = property.value.split(/,(?![^\[]*\]\])/).map((item) =>
            item.trim()
          );
        }
        items = items.filter((item) => item !== "");
        if (items.length > 0) {
          frontmatter += "\n";
          items.forEach((item) => {
            frontmatter += `  - "${escapeDoubleQuotes(item)}"\n`;
          });
        } else {
          frontmatter += "\n";
        }
        break;
      }
      case "number": {
        const numericValue = property.value.replace(/[^\d.-]/g, "");
        frontmatter += numericValue ? ` ${parseFloat(numericValue)}\n` : "\n";
        break;
      }
      case "checkbox": {
        const isChecked = typeof property.value === "boolean"
          ? property.value
          : property.value === "true";
        frontmatter += ` ${isChecked}\n`;
        break;
      }
      case "date":
      case "datetime": {
        if (property.value.trim() !== "") {
          frontmatter += ` ${property.value}\n`;
        } else {
          frontmatter += "\n";
        }
        break;
      }
      default: { // Text
        frontmatter += property.value.trim() !== ""
          ? ` "${escapeDoubleQuotes(property.value)}"\n`
          : "\n";
        break;
      }
    }
  }
  frontmatter += "---\n";

  // Check if the frontmatter is empty
  if (frontmatter.trim() === "---\n---") {
    return "";
  }

  return frontmatter;
}

// --- 不要なObsidian連携関数(saveToObsidian)を削除し、責務をfrontmatter生成のみに集約 ---
