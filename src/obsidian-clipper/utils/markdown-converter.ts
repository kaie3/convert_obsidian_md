import type { ElementHandle, Frame, Page } from "playwright";
import { setupTurndownService, TurndownService } from "turndown";
import { MathMLToLaTeX } from "mathml-to-latex";

interface TurndownServiceInstance {
  turndown(html: string): string;
  addRule(name: string, rule: unknown): void;
  remove(names: string[]): void;
  keep(names: string[]): void;
}
declare const MathMLToLaTeX: { convert: (mathml: string) => string };

// processUrls, debugLogは未実装のためダミー関数を用意
function processUrls(content: string, _baseUrl: URL): string {
  return content;
}
function debugLog(..._args: string[]): void {}

const footnotes: { [key: string]: string } = {};

/**
 * HTMLコンテンツをObsidian用Markdownに変換する
 * @param content HTML文字列
 * @param url 変換元ページのURL
 * @returns Markdown文字列
 * @example
 * const md = createMarkdownContent('<h1>Hello</h1>', 'https://example.com');
 * // => '# Hello'
 */
export function createMarkdownContent(content: string, url: string): string {
  debugLog("Markdown", "Starting markdown conversion for URL:", url);
  debugLog("Markdown", "Content length:", content.length);

  const baseUrl = new URL(url);
  const processedContent = processUrls(content, baseUrl);

  const turndownService = setupTurndownService();
  addCustomTurndownRules(turndownService);

  let markdown: string;
  try {
    markdown = turndownService.turndown(processedContent);
    debugLog("Markdown", "Markdown conversion successful");

    // タイトル除去
    const titleMatch = markdown.match(/^# .+\n+/);
    if (titleMatch) {
      markdown = markdown.slice(titleMatch[0].length);
    }

    // 空リンク除去（画像除く）
    markdown = markdown.replace(/\n*(?<!!)\[]\([^)]+\)\n*/g, "");

    // 3行以上の連続改行を2行に
    markdown = markdown.replace(/\n{3,}/g, "\n\n");

    // フットノート追加
    if (Object.keys(footnotes).length > 0) {
      markdown += "\n\n---\n\n";
      for (const [id, content] of Object.entries(footnotes)) {
        markdown += `[^${id}]: ${content}\n\n`;
      }
    }
    Object.keys(footnotes).forEach((key) => delete footnotes[key]);
    return markdown.trim();
  } catch (error) {
    console.error("Error converting HTML to Markdown:", error);
    console.log(
      "Problematic content:",
      processedContent.substring(0, 1000) + "...",
    );
    return `Partial conversion completed with errors. Original HTML:\n\n${processedContent}`;
  }
}

/**
 * TurndownServiceにカスタムルールを追加する
 */
function addCustomTurndownRules(turndownService: TurndownServiceInstance) {
  turndownService.addRule("list", {
    filter: ["ul", "ol"],
    replacement: function (content: string, node: Element): string {
      content = content.trim();
      const isTopLevel = !(node.parentNode &&
        (node.parentNode.nodeName === "UL" ||
          node.parentNode.nodeName === "OL"));
      return (isTopLevel ? "\n" : "") + content + "\n";
    },
  });

  // Lists with tab indentation
  turndownService.addRule("listItem", {
    filter: "li",
    replacement: function (
      content: string,
      node: Element,
      options: { bulletListMarker: string },
    ): string {
      if (
        !(node && (node as HTMLElement).classList &&
          typeof (node as HTMLElement).classList.contains === "function")
      ) return content;
      const isTaskListItem = (node as HTMLElement).classList.contains(
        "task-list-item",
      );
      const checkbox = (node as HTMLElement).querySelector &&
        (node as HTMLElement).querySelector('input[type="checkbox"]');
      let taskListMarker = "";
      if (isTaskListItem && checkbox) {
        content = content.replace(/<input[^>]*>/, "");
        taskListMarker = (checkbox as HTMLInputElement).checked
          ? "[x] "
          : "[ ] ";
      }
      content = content.replace(/\n+$/, "").split("\n").filter((line: string) =>
        line.length > 0
      ).join("\n\t");
      let prefix = options.bulletListMarker + " ";
      let level = 0;
      let currentParent = node.parentNode;
      while (
        currentParent &&
        (currentParent.nodeName === "UL" || currentParent.nodeName === "OL")
      ) {
        level++;
        currentParent = currentParent.parentNode;
      }
      const indentLevel = Math.max(0, level - 1);
      prefix = "\t".repeat(indentLevel) + prefix;
      const parent = node.parentNode as HTMLElement | null;
      if (
        parent && parent.getAttribute &&
        typeof parent.getAttribute === "function"
      ) {
        const start = parent.getAttribute("start");
        const index = Array.from(parent.children).indexOf(node) + 1;
        prefix = "\t".repeat(level - 1) +
          (start ? Number(start) + index - 1 : index) + ". ";
      }
      return prefix + taskListMarker + content.trim() +
        (node.nextSibling && !/\n$/.test(content) ? "\n" : "");
    },
  });

  turndownService.addRule("figure", {
    filter: "figure",
    replacement: function (content: string, node: Element): string {
      const img = (node as HTMLElement).querySelector &&
        (node as HTMLElement).querySelector("img");
      const figcaption = (node as HTMLElement).querySelector &&
        (node as HTMLElement).querySelector("figcaption");
      if (!img) return content;
      const alt = img.getAttribute("alt") || "";
      const src = img.getAttribute("src") || "";
      const caption = figcaption ? figcaption.textContent : "";
      return `![${alt}](${src})${caption ? `\n> ${caption}` : ""}`;
    },
  });

  turndownService.addRule("embedToMarkdown", {
    filter: function (node: Element): boolean {
      if (node && node.tagName && node.tagName.toLowerCase() === "iframe") {
        const src = (node as HTMLIFrameElement).getAttribute("src");
        return !!src && (
          !!src.match(/(?:youtube\.com|youtu\.be)/) ||
          !!src.match(/(?:twitter\.com|x\.com)/)
        );
      }
      return false;
    },
    replacement: function (content: string, node: Element): string {
      if (node && node.tagName && node.tagName.toLowerCase() === "iframe") {
        const src = (node as HTMLIFrameElement).getAttribute("src");
        if (src) {
          const youtubeMatch = src.match(
            /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:embed\/|watch\?v=)?([a-zA-Z0-9_-]+)/,
          );
          if (youtubeMatch && youtubeMatch[1]) {
            return `![](https://www.youtube.com/watch?v=${youtubeMatch[1]})`;
          }
          const tweetMatch = src.match(
            /(?:twitter\.com|x\.com)\/.*?(?:status|statuses)\/(\d+)/,
          );
          if (tweetMatch && tweetMatch[1]) {
            return `![](https://x.com/i/status/${tweetMatch[1]})`;
          }
        }
      }
      return content;
    },
  });

  turndownService.addRule("highlight", {
    filter: "mark",
    replacement: function (content: string) {
      return "==" + content + "==";
    },
  });

  turndownService.addRule("strikethrough", {
    filter: (node: Element) =>
      node.nodeName === "DEL" ||
      node.nodeName === "S" ||
      node.nodeName === "STRIKE",
    replacement: function (content: string) {
      return "~~" + content + "~~";
    },
  });

  turndownService.addRule("complexLinkStructure", {
    filter: function (node: Element, _options: object) {
      return (
        node.nodeName === "A" &&
        node.childNodes.length > 1 &&
        Array.from(node.childNodes).some((child: Node) =>
          child.nodeName &&
          ["H1", "H2", "H3", "H4", "H5", "H6"].includes(child.nodeName)
        )
      );
    },
    replacement: function (content: string, node: Element, options: object) {
      if (!(node && (node as HTMLElement).getAttribute)) return content;
      const href = (node as HTMLElement).getAttribute("href");
      const title = (node as HTMLElement).getAttribute("title");
      const headingNode = (node as HTMLElement).querySelector &&
        (node as HTMLElement).querySelector("h1, h2, h3, h4, h5, h6");
      const headingContent = headingNode
        ? (turndownService as TurndownServiceInstance).turndown(
          (headingNode as HTMLElement).innerHTML,
        )
        : "";
      if (headingNode) {
        headingNode.remove();
      }
      const remainingContent = (turndownService as TurndownServiceInstance)
        .turndown((node as HTMLElement).innerHTML);
      let markdown = `${headingContent}\n\n${remainingContent}\n\n`;
      if (href) {
        markdown += `[View original](${href})`;
        if (title) {
          markdown += ` "${title}"`;
        }
      }
      return markdown;
    },
  });

  turndownService.addRule("arXivEnumerate", {
    filter: (node: Element) => {
      return node.nodeName === "OL" && (node as HTMLElement).classList &&
        (node as HTMLElement).classList.contains("ltx_enumerate");
    },
    replacement: function (content: string, node: Element) {
      if (!(node && (node as HTMLElement).children)) return content;
      const items = Array.from((node as HTMLElement).children).map(
        (item: Element, index: number) => {
          if (item && (item as HTMLElement).innerHTML) {
            const itemContent = (item as HTMLElement).innerHTML.replace(
              /^<span class="ltx_tag ltx_tag_item">\d+\.<\/span>\s*/,
              "",
            );
            return `${index + 1}. ${
              (turndownService as TurndownServiceInstance).turndown(itemContent)
            }`;
          }
          return "";
        },
      );
      return "\n\n" + items.join("\n\n") + "\n\n";
    },
  });

  turndownService.addRule("removeHiddenElements", {
    filter: function (node: Element) {
      return (
        node && (node as HTMLElement).style &&
        (node as HTMLElement).style.display === "none"
      );
    },
    replacement: function () {
      return "";
    },
  });

  turndownService.addRule("citations", {
    filter: (node: Element): boolean => {
      return (
        node && node.nodeName === "SUP" && (node as HTMLElement).id &&
        typeof (node as HTMLElement).id === "string" &&
        (node as HTMLElement).id.startsWith("fnref:")
      );
    },
    replacement: (content: string, node: Element) => {
      if (
        node && node.nodeName === "SUP" && (node as HTMLElement).id &&
        typeof (node as HTMLElement).id === "string" &&
        (node as HTMLElement).id.startsWith("fnref:")
      ) {
        const id = (node as HTMLElement).id.replace("fnref:", "");
        const primaryNumber = id.split("-")[0];
        return `[^${primaryNumber}]`;
      }
      return content;
    },
  });

  turndownService.addRule("footnotesList", {
    filter: (node: Element): boolean => {
      return (
        node && node.nodeName === "OL" && (node as HTMLElement).parentElement &&
        (node as HTMLElement).parentElement.id === "footnotes"
      );
    },
    replacement: (content: string, node: Element) => {
      if (node && (node as HTMLElement).children) {
        const references = Array.from((node as HTMLElement).children).map(
          (li: Element) => {
            let id;
            if (
              (li as HTMLElement).id &&
              typeof (li as HTMLElement).id === "string" &&
              (li as HTMLElement).id.startsWith("fn:")
            ) {
              id = (li as HTMLElement).id.replace("fn:", "");
            } else {
              const match = (li as HTMLElement).id &&
                  typeof (li as HTMLElement).id === "string"
                ? (li as HTMLElement).id.split("/").pop()?.match(
                  /cite_note-(.+)/,
                )
                : null;
              id = match ? match[1] : (li as HTMLElement).id;
            }
            const supElement = (li as HTMLElement).querySelector &&
              (li as HTMLElement).querySelector("sup");
            if (
              supElement && supElement.textContent &&
              supElement.textContent.trim() === id
            ) {
              supElement.remove();
            }
            const referenceContent =
              (turndownService as TurndownServiceInstance).turndown(
                (li as HTMLElement).innerHTML,
              );
            const cleanedContent = referenceContent.replace(/\s*↩︎$/, "").trim();
            return `[^${(id as string).toLowerCase()}]: ${cleanedContent}`;
          },
        );
        return "\n\n" + references.join("\n\n") + "\n\n";
      }
      return content;
    },
  });

  turndownService.addRule("removals", {
    filter: function (node: Element) {
      if (
        !(node && (node as HTMLElement).getAttribute &&
          (node as HTMLElement).classList)
      ) return false;
      if (
        (node as HTMLElement).getAttribute("href") &&
        (node as HTMLElement).getAttribute("href")!.includes("#fnref")
      ) return true;
      if ((node as HTMLElement).classList.contains("footnote-backref")) {
        return true;
      }
      return false;
    },
    replacement: function (_content: string, _node: Element) {
      return "";
    },
  });

  turndownService.addRule("handleTextNodesInTables", {
    filter: function (node: Node): boolean {
      return node && node.nodeType === 3 && node.parentNode &&
        node.parentNode.nodeName === "TD";
    },
    replacement: function (content: string): string {
      return content;
    },
  });

  turndownService.addRule("preformattedCode", {
    filter: (node: Element) => {
      return node.nodeName === "PRE";
    },
    replacement: (content: string, node: Element) => {
      if (!(node instanceof HTMLElement)) return content;

      const codeElement = node.querySelector("code");
      if (!codeElement) return content;

      const language = codeElement.getAttribute("data-lang") || "";
      const code = codeElement.textContent || "";

      // Clean up the content and escape backticks
      const cleanCode = code
        .trim()
        .replace(/`/g, "\\`");

      return `\n\`\`\`${language}\n${cleanCode}\n\`\`\`\n`;
    },
  });

  turndownService.addRule("MathJax", {
    filter: (node: Element) => {
      const isMjxContainer = node.nodeName.toLowerCase() === "mjx-container";
      return isMjxContainer;
    },
    replacement: (content: string, node: Element) => {
      if (!(node instanceof HTMLElement)) {
        return content;
      }

      const assistiveMml = node.querySelector("mjx-assistive-mml");
      if (!assistiveMml) {
        return content;
      }

      const mathElement = assistiveMml.querySelector("math");
      if (!mathElement) {
        return content;
      }

      let latex: string;
      try {
        latex = MathMLToLaTeX.convert(mathElement.outerHTML);
      } catch (error) {
        console.error("Error converting MathML to LaTeX:", error);
        return content;
      }

      // Check if it's an inline or block math element
      const isBlock = mathElement.getAttribute("display") === "block";

      if (isBlock) {
        return `\n$$\n${latex}\n$$\n`;
      } else {
        return `$${latex}$`;
      }
    },
  });

  turndownService.addRule("math", {
    filter: function (node: Element): boolean {
      return node && node.nodeName && (
        node.nodeName.toLowerCase() === "math" ||
        ((node as HTMLElement).classList &&
          ((node as HTMLElement).classList.contains("mwe-math-element") ||
            (node as HTMLElement).classList.contains(
              "mwe-math-fallback-image-inline",
            ) ||
            (node as HTMLElement).classList.contains(
              "mwe-math-fallback-image-display",
            )))
      );
    },
    replacement: function (content: string, node: Element): string {
      if (!node) return content;
      let latex = extractLatex(node);
      latex = typeof latex === "string" ? latex.trim() : "";
      const isInTable = (node as HTMLElement).closest &&
        (node as HTMLElement).closest("table") !== null;
      if (
        !isInTable && (
          (node as HTMLElement).getAttribute &&
            (node as HTMLElement).getAttribute("display") === "block" ||
          ((node as HTMLElement).classList &&
            (node as HTMLElement).classList.contains(
              "mwe-math-fallback-image-display",
            )) ||
          ((node as HTMLElement).parentElement &&
            (node as HTMLElement).parentElement.classList &&
            (node as HTMLElement).parentElement.classList.contains(
              "mwe-math-element",
            ) &&
            (node as HTMLElement).parentElement.previousElementSibling &&
            (node as HTMLElement).parentElement.previousElementSibling
              .nodeName &&
            (node as HTMLElement).parentElement.previousElementSibling.nodeName
                .toLowerCase() ===
              "p")
        )
      ) {
        return `\n$$\n${latex}\n$$\n`;
      } else {
        const prevNode = node.previousSibling;
        const nextNode = node.nextSibling;
        const prevChar = prevNode && (prevNode as Text).textContent
          ? (prevNode as Text).textContent!.slice(-1)
          : "";
        const nextChar = nextNode && (nextNode as Text).textContent
          ? (nextNode as Text).textContent![0]
          : "";
        const isStartOfLine = !prevNode ||
          (prevNode.nodeType === 3 && (prevNode as Text).textContent &&
            (prevNode as Text).textContent!.trim() === "");
        const isEndOfLine = !nextNode ||
          (nextNode.nodeType === 3 && (nextNode as Text).textContent &&
            (nextNode as Text).textContent!.trim() === "");
        const leftSpace =
          (!isStartOfLine && prevChar && !/[\s$]/.test(prevChar)) ? " " : "";
        const rightSpace = (!isEndOfLine && nextChar && !/[\s$]/.test(nextChar))
          ? " "
          : "";
        return `${leftSpace}$${latex}$${rightSpace}`;
      }
    },
  });

  turndownService.addRule("katex", {
    filter: (node: Element) => {
      return node instanceof HTMLElement &&
        ((node as HTMLElement).classList.contains("math") ||
          (node as HTMLElement).classList.contains("katex"));
    },
    replacement: (content: string, node: Element) => {
      if (!(node instanceof HTMLElement)) return content;

      // Try to find the original LaTeX content
      // 1. Check data-latex attribute
      let latex = node.getAttribute("data-latex");

      // 2. If no data-latex, try to get from .katex-mathml
      if (!latex) {
        const mathml = node.querySelector(
          '.katex-mathml annotation[encoding="application/x-tex"]',
        );
        latex = mathml?.textContent || "";
      }

      // 3. If still no content, use text content as fallback
      if (!latex) {
        latex = node.textContent?.trim() || "";
      }

      // Determine if it's an inline formula
      const mathElement = node.querySelector(".katex-mathml math");
      const isInline = node.classList.contains("math-inline") ||
        (mathElement && mathElement.getAttribute("display") !== "block");

      if (isInline) {
        return `$${latex}$`;
      } else {
        return `\n$$\n${latex}\n$$\n`;
      }
    },
  });

  turndownService.addRule("callout", {
    filter: (node: Element) => {
      return (
        node.nodeName.toLowerCase() === "div" &&
        (node as HTMLElement).classList.contains("markdown-alert")
      );
    },
    replacement: (content: string, node: Element) => {
      const element = node as HTMLElement;

      // Get alert type from the class (e.g., markdown-alert-note -> NOTE)
      const alertClasses = Array.from(element.classList);
      const typeClass = alertClasses.find((c) =>
        c.startsWith("markdown-alert-") && c !== "markdown-alert"
      );
      const type = typeClass
        ? typeClass.replace("markdown-alert-", "").toUpperCase()
        : "NOTE";

      // Find the title element and content
      const titleElement = element.querySelector(".markdown-alert-title");
      const contentElement = element.querySelector(
        "p:not(.markdown-alert-title)",
      );

      // Extract content, removing the title from it if present
      let alertContent = content;
      if (titleElement && titleElement.textContent) {
        alertContent = contentElement?.textContent ||
          content.replace(titleElement.textContent, "");
      }

      // Format as Obsidian callout
      return `\n> [!${type}]\n> ${
        alertContent.trim().replace(/\n/g, "\n> ")
      }\n`;
    },
  });

  turndownService.addRule("table", {
    filter: "table",
    replacement: function (content: string, node: Element): string {
      if (!(node && node.tagName && node.tagName.toLowerCase() === "table")) {
        return content;
      }
      if (
        (node as HTMLElement).classList &&
        ((node as HTMLElement).classList.contains("ltx_equation") ||
          (node as HTMLElement).classList.contains("ltx_eqn_table"))
      ) {
        return handleNestedEquations(node as HTMLTableElement);
      }
      const hasComplexStructure = Array.from(node.querySelectorAll("td, th"))
        .some((cell) =>
          cell instanceof Element &&
          (cell.hasAttribute("colspan") || cell.hasAttribute("rowspan"))
        );
      if (hasComplexStructure) {
        const cleanedTable = cleanupTableHTML(node as HTMLTableElement);
        return "\n\n" + cleanedTable + "\n\n";
      }
      const rows = Array.from((node as HTMLTableElement).rows).map((row) => {
        const cells = Array.from(row.cells).map((cell) => {
          let cellContent = (turndownService as TurndownServiceInstance)
            .turndown(cell.innerHTML)
            .replace(/\n/g, " ")
            .trim();
          cellContent = cellContent.replace(/\|/g, "\\|");
          return cellContent;
        });
        return `| ${cells.join(" | ")} |`;
      });
      const separatorRow = `| ${
        Array(rows[0].split("|").length - 2).fill("---").join(" | ")
      } |`;
      const tableContent = [rows[0], separatorRow, ...rows.slice(1)].join("\n");
      return `\n\n${tableContent}\n\n`;
    },
  });

  turndownService.remove(["style", "script"]);
  turndownService.keep([
    "iframe",
    "video",
    "audio",
    "sup",
    "sub",
    "svg",
    "math",
  ]);
  turndownService.remove(["button"]);
}

/**
 * TurndownServiceの初期化
 */
function setupTurndownService(): TurndownServiceInstance {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    preformattedCode: true,
  });

  return turndownService;
}

// --- 補助関数群（handleNestedEquations, cleanupTableHTML, extractLatex など） ---
function handleNestedEquations(table: HTMLTableElement): string {
  const mathElements = table.querySelectorAll("math[alttext]");
  if (mathElements.length === 0) return "";
  return Array.from(mathElements).map((mathElement) => {
    const alttext = mathElement.getAttribute("alttext");
    if (alttext) {
      const isInline = mathElement.closest(".ltx_eqn_inline") !== null;
      return isInline ? `$${alttext.trim()}$` : `\n$$\n${alttext.trim()}\n$$`;
    }
    return "";
  }).join("\n\n");
}

function cleanupTableHTML(table: HTMLTableElement): string {
  const allowedAttributes = [
    "src",
    "href",
    "style",
    "align",
    "width",
    "height",
    "rowspan",
    "colspan",
    "bgcolor",
    "scope",
    "valign",
    "headers",
  ];
  const cleanElement = (element: Element) => {
    Array.from(element.attributes).forEach((attr) => {
      if (!allowedAttributes.includes(attr.name)) {
        element.removeAttribute(attr.name);
      }
    });
    element.childNodes.forEach((child) => {
      if (child && child.nodeType === 1) {
        cleanElement(child as Element);
      }
    });
  };
  const tableClone = table.cloneNode(true) as HTMLTableElement;
  cleanElement(tableClone);
  return tableClone.outerHTML;
}

function extractLatex(element: Element): string {
  if (element.nodeName && element.nodeName.toLowerCase() === "math") {
    const latex = (element as HTMLElement).getAttribute("data-latex");
    const alttext = (element as HTMLElement).getAttribute("alttext");
    if (latex) {
      return latex.trim();
    } else if (alttext) {
      return alttext.trim();
    }
  }
  const mathElement = (element as HTMLElement).querySelector &&
    (element as HTMLElement).querySelector("math[alttext]");
  if (mathElement) {
    const alttext = mathElement.getAttribute("alttext");
    if (alttext) {
      return alttext.trim();
    }
  }
  const annotation = (element as HTMLElement).querySelector &&
    (element as HTMLElement).querySelector(
      'annotation[encoding="application/x-tex"]',
    );
  if (annotation && annotation.textContent) {
    return annotation.textContent.trim();
  }
  const mathNode = element.nodeName && element.nodeName.toLowerCase() === "math"
    ? element
    : ((element as HTMLElement).querySelector &&
      (element as HTMLElement).querySelector("math"));
  if (mathNode) {
    return MathMLToLaTeX.convert((mathNode as HTMLElement).outerHTML);
  }
  const imgNode = (element as HTMLElement).querySelector &&
    (element as HTMLElement).querySelector("img");
  return imgNode && imgNode.getAttribute("alt") || "";
}
