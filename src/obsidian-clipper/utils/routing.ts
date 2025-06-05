import { initializeToggles } from "./ui-utils.ts";

export function updateUrl(section: string, templateId?: string): void {
  let url = `${globalThis.location.pathname}?section=${section}`;
  if (templateId) {
    url += `&template=${templateId}`;
  }
  globalThis.history.pushState({}, "", url);
}

export function getUrlParameters(): {
  section: string | null;
  templateId: string | null;
} {
  const urlParams = new URLSearchParams(globalThis.location.search);
  return {
    section: urlParams.get("section"),
    templateId: urlParams.get("template"),
  };
}
