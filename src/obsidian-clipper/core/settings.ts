import {
  cleanupTemplateStorage,
  deleteTemplate,
  duplicateTemplate,
  findTemplateById,
  getEditingTemplateIndex,
  loadTemplates,
  rebuildTemplateList,
  saveTemplateSettings,
  templates,
} from "../managers/template-manager";
import {
  initializeAddPropertyButton,
  showTemplateEditor,
  updateTemplateList,
} from "../managers/template-ui";
import { initializeGeneralSettings } from "../managers/general-settings";
import {
  initializeSidebar,
  showSettingsSection,
} from "../managers/settings-section-ui";
import { initializeReaderSettings } from "../managers/reader-settings";
import { initializeAutoSave } from "../utils/auto-save";
import {
  handleTemplateDrag,
  initializeDragAndDrop,
} from "../utils/drag-and-drop";
import {
  copyTemplateToClipboard,
  exportTemplate,
  showTemplateImportModal,
} from "../utils/import-export";
import { createIcons } from "lucide";
import { icons } from "../icons/icons";
import { getUrlParameters, updateUrl } from "../utils/routing";
import { addBrowserClassToHtml } from "../utils/browser-detection";
import { initializeMenu } from "../managers/menu";
import { addMenuItemListener } from "../managers/menu";
import {
  getAvailableLanguages,
  getCurrentLanguage,
  getMessage,
  setLanguage,
  setupLanguageAndDirection,
  translatePage,
} from "../utils/i18n";

declare global {
  interface Window {
    cleanupTemplateStorage: () => Promise<void>;
    rebuildTemplateList: () => Promise<void>;
  }
}

globalThis.cleanupTemplateStorage = cleanupTemplateStorage;
globalThis.rebuildTemplateList = rebuildTemplateList;

document.addEventListener("DOMContentLoaded", async () => {
  const newTemplateBtn = document.getElementById(
    "new-template-btn",
  ) as HTMLButtonElement;

  async function initializeSettings(): Promise<void> {
    await translatePage();

    await initializeGeneralSettings();
    await initializeReaderSettings();
    const loadedTemplates = await loadTemplates();
    updateTemplateList(loadedTemplates);
    initializeTemplateListeners();
    await handleUrlParameters();
    initializeSidebar();
    initializeAutoSave();
    initializeMenu("more-actions-btn", "template-actions-menu");

    createIcons({ icons });

    // Initialize language selector
    const languageSelect = document.getElementById(
      "language-select",
    ) as HTMLSelectElement;
    if (languageSelect) {
      await initializeLanguageSelector(languageSelect);
    }
  }

  async function initializeLanguageSelector(
    languageSelect: HTMLSelectElement,
  ): Promise<void> {
    try {
      await setupLanguageAndDirection();
      await translatePage();

      // Populate language options
      const languages = getAvailableLanguages();
      const currentLanguage = await getCurrentLanguage();

      languageSelect.innerHTML = languages.map(
        (lang: { code: string; name: string }) => {
          const displayName = lang.code === ""
            ? getMessage("systemDefault")
            : lang.name;
          return `<option value="${lang.code}" ${
            lang.code === currentLanguage ? "selected" : ""
          }>${displayName}</option>`;
        },
      ).join("");

      // Add change listener
      languageSelect.addEventListener("change", async () => {
        try {
          await setLanguage(languageSelect.value);
          globalThis.location.reload(); // Force reload the current page
        } catch (error) {
          console.error("Failed to change language:", error);
        }
      });
    } catch (error) {
      console.error("Failed to initialize language selector:", error);
    }
  }

  function initializeTemplateListeners(): void {
    if (newTemplateBtn) {
      newTemplateBtn.addEventListener("click", () => {
        showTemplateEditor(null);
      });
    }

    addMenuItemListener(
      "#duplicate-template-btn",
      "template-actions-menu",
      duplicateCurrentTemplate,
    );
    addMenuItemListener(
      "#delete-template-btn",
      "template-actions-menu",
      deleteCurrentTemplate,
    );
    addMenuItemListener(
      ".export-template-btn",
      "template-actions-menu",
      exportTemplate,
    );
    addMenuItemListener(
      ".import-template-btn",
      "template-actions-menu",
      showTemplateImportModal,
    );
    addMenuItemListener(
      "#copy-template-json-btn",
      "template-actions-menu",
      copyCurrentTemplateToClipboard,
    );
  }

  function duplicateCurrentTemplate(): void {
    const editingTemplateIndex = getEditingTemplateIndex();
    if (editingTemplateIndex !== -1) {
      const currentTemplate = templates[editingTemplateIndex];
      const newTemplate = duplicateTemplate(currentTemplate.id);
      saveTemplateSettings().then(() => {
        updateTemplateList();
        showTemplateEditor(newTemplate);
        updateUrl("templates", newTemplate.id);
      }).catch((error) => {
        console.error("Failed to duplicate template:", error);
        alert(getMessage("failedToDuplicateTemplate"));
      });
    }
  }

  async function deleteCurrentTemplate(): Promise<void> {
    const editingTemplateIndex = getEditingTemplateIndex();
    if (editingTemplateIndex !== -1) {
      const currentTemplate = templates[editingTemplateIndex];
      if (
        confirm(getMessage("confirmDeleteTemplate", [currentTemplate.name]))
      ) {
        const success = await deleteTemplate(currentTemplate.id);
        if (success) {
          // Reload templates after deletion
          await loadTemplates();
          updateTemplateList();
          if (templates.length > 0) {
            showTemplateEditor(templates[0]);
          } else {
            showSettingsSection("general");
          }
        } else {
          alert(getMessage("failedToDeleteTemplate"));
        }
      }
    }
  }

  async function handleUrlParameters(): Promise<void> {
    const { section, templateId } = getUrlParameters();

    if (
      section === "general" || section === "interpreter" ||
      section === "properties" || section === "highlighter" ||
      section === "reader"
    ) {
      showSettingsSection(section);
    } else if (templateId) {
      const template = findTemplateById(templateId);
      if (template) {
        showTemplateEditor(template);
      } else {
        console.error(`Template with id ${templateId} not found`);
        showSettingsSection("general");
      }
    } else {
      showSettingsSection("general");
    }
  }

  function copyCurrentTemplateToClipboard(): void {
    const editingTemplateIndex = getEditingTemplateIndex();
    if (editingTemplateIndex !== -1) {
      const currentTemplate = templates[editingTemplateIndex];
      copyTemplateToClipboard(currentTemplate);
    }
  }

  const templateForm = document.getElementById("template-settings-form");
  if (templateForm) {
    initializeAddPropertyButton();
    initializeDragAndDrop();
    handleTemplateDrag();
  }

  await addBrowserClassToHtml();
  await initializeSettings();
});
