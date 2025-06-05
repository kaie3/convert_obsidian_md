import { Property } from '../types/types';
import { generateFrontmatter } from '../utils/obsidian-note-creator';
import { saveFile } from '../utils/file-utils';
import { incrementStat } from '../utils/storage-utils';

function showError(message: string): void {
    alert(message);
}

export async function handleSaveToDownloads() {
    try {
        const noteNameField = document.getElementById('note-name-field') as HTMLInputElement;
        const pathField = document.getElementById('path-name-field') as HTMLInputElement;
        const vaultDropdown = document.getElementById('vault-select') as HTMLSelectElement;

        let fileName = noteNameField?.value || 'untitled';
        const path = pathField?.value || '';
        const vault = vaultDropdown?.value || '';

        const properties = Array.from(document.querySelectorAll('.metadata-property input')).map(input => {
            const inputElement = input as HTMLInputElement;
            return {
                id: inputElement.dataset.id || Date.now().toString() + Math.random().toString(36).slice(2, 11),
                name: inputElement.id,
                value: inputElement.type === 'checkbox' ? inputElement.checked : inputElement.value
            };
        }) as Property[];

        const noteContentField = document.getElementById('note-content-field') as HTMLTextAreaElement;
        const frontmatter = await generateFrontmatter(properties);
        const fileContent = frontmatter + noteContentField.value;

        await saveFile({
            content: fileContent,
            fileName,
            mimeType: 'text/markdown',
            tabId: undefined,
            onError: (error) => showError('failedToSaveFile')
        });

        await incrementStat('saveFile', vault, path);

        const moreDropdown = document.getElementById('more-dropdown');
        if (moreDropdown) {
            moreDropdown.classList.remove('show');
        }
    } catch (error) {
        showError('failedToSaveFile');
    }
}
