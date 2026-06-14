import * as dom from './dom.js';
import { createEl, formatBytes, toggleVisible } from './utils.js';

let downloadCache = [];

function updateButtons() {
    const hasItems = downloadCache.length > 0;
    const hasAnyContent = dom.downloadArea.children.length > 0;

    dom.clearAllBtn.style.display = hasAnyContent ? 'inline-flex' : 'none';
    dom.dlAllBtn.style.display = (hasItems && downloadCache.length > 1) ? 'inline-flex' : 'none';
}

/**
 * @param {Blob} blob - The WAV blob (NOT raw Uint8Array)
 * @param {string} filename
 * @param {number} frameCount
 */
export function addDownload(blob, filename, frameCount = 0) {
    if (dom.downloadArea.style.display === 'none') {
        toggleVisible(dom.downloadArea, true, 'block');
    }

    const url = URL.createObjectURL(blob);

    /* Store only the blob URL and name — NOT the raw data.
       The Blob is held alive by the object URL; the raw Uint8Array
       chunks that composed it can be GC'd. */
    downloadCache.push({ name: filename, blobURL: url, size: blob.size });

    const item = document.createElement('m3e-card');
    item.variant = 'outlined';

    const contentDiv = document.createElement('div');
    contentDiv.slot = 'content';
    contentDiv.className = 'card-content';

    const header = createEl('div', 'download-header');

    const textWrapper = createEl('div', '');
    textWrapper.style.display = 'flex';
    textWrapper.style.flexDirection = 'column';
    textWrapper.style.overflow = 'hidden';
    textWrapper.style.flex = '1';
    textWrapper.style.gap = '4px';

    const nameSpan = createEl('span', 'download-filename', filename);
    nameSpan.style.flex = 'none';

    const metaSpan = createEl('small', '', `${frameCount} frames`);
    metaSpan.style.color = 'var(--md-sys-color-on-surface-variant)';
    metaSpan.style.fontSize = '12px';

    textWrapper.append(nameSpan, metaSpan);

    const btn = document.createElement('m3e-button');
    btn.variant = 'tonal';
    btn.style.flexShrink = "0";
    btn.onclick = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    };

    const icon = document.createElement('m3e-icon');
    icon.slot = "icon";
    icon.setAttribute('name', 'download');

    btn.append(icon, document.createTextNode(`Download \u2022 ${formatBytes(blob.size)} MB`));

    header.append(textWrapper, btn);

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = url;

    contentDiv.append(header, audio);
    item.append(contentDiv);
    dom.downloadArea.appendChild(item);

    updateButtons();
}

export function addError(filename, msg) {
    if (dom.downloadArea.style.display === 'none') {
        toggleVisible(dom.downloadArea, true, 'block');
    }

    const item = document.createElement('m3e-card');
    item.variant = 'filled';
    item.style.setProperty('--m3e-card-container-color', 'var(--md-sys-color-error-container)');
    item.style.color = 'var(--md-sys-color-on-error-container)';

    const contentDiv = document.createElement('div');
    contentDiv.slot = 'content';
    contentDiv.className = 'card-content';

    const header = createEl('div', 'download-header');

    const textWrapper = createEl('div', '');
    textWrapper.style.flex = '1';

    const titleRow = createEl('div', '');
    titleRow.style.display = 'flex';
    titleRow.style.alignItems = 'center';
    titleRow.style.gap = '8px';

    const iconEl = document.createElement('m3e-icon');
    iconEl.setAttribute('name', 'error');
    iconEl.style.color = 'var(--md-sys-color-error)';

    const nameSpan = createEl('span', 'download-filename', filename);
    nameSpan.style.color = 'var(--md-sys-color-on-surface)';

    titleRow.append(iconEl, nameSpan);

    const errorMsg = createEl('div', '', msg);
    errorMsg.style.fontSize = '12px';
    errorMsg.style.marginTop = '4px';
    errorMsg.style.fontFamily = 'monospace';
    errorMsg.style.opacity = '0.8';

    textWrapper.append(titleRow, errorMsg);
    header.append(textWrapper);
    contentDiv.append(header);
    item.append(contentDiv);

    dom.downloadArea.appendChild(item);
    updateButtons();
}

export async function clearAll() {
    toggleVisible(dom.downloadArea, false);

    setTimeout(() => {
        dom.downloadArea.innerHTML = '';
        updateButtons();
    }, 150);

    // Clear OPFS files
    for (const entry of downloadCache) {
        URL.revokeObjectURL(entry.blobURL);
    }
    downloadCache = [];
    try {
        const root = await navigator.storage.getDirectory();
        for await (const name of root.keys()) {
            await root.removeEntry(name, { recursive: true });
        }
    } catch (e) {
        console.error("Failed to clear OPFS files:", e);
    }
}

export async function downloadZip() {
    if (downloadCache.length === 0) return;

    const zip = new JSZip();

    /* Fetch each Blob from its URL — avoids keeping raw data in memory */
    for (const file of downloadCache) {
        const response = await fetch(file.blobURL);
        const data = await response.arrayBuffer();
        zip.file(file.name, data);
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);

    const a = document.createElement('a');
    a.href = url;
    a.download = `decoded_files_${Date.now()}.zip`;
    a.click();

    URL.revokeObjectURL(url);
}

(async function cleanupStartupOPFS() {
    try {
        const root = await navigator.storage.getDirectory();
        for await (const name of root.keys()) {
            await root.removeEntry(name, { recursive: true });
        }
    } catch (e) {
        console.error("Startup OPFS cleanup failed:", e);
    }
})();
