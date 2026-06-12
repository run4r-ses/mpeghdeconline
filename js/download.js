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

    const item = createEl('div', 'download-item');
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

    const btn = document.createElement('md-filled-tonal-button');
    btn.style.flexShrink = "0";
    btn.onclick = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    };

    const icon = document.createElement('md-icon');
    icon.slot = "icon";
    icon.textContent = "download";

    btn.append(icon, document.createTextNode(`Download \u2022 ${formatBytes(blob.size)} MB`));

    header.append(textWrapper, btn);

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = url;

    item.append(header, audio);
    dom.downloadArea.appendChild(item);

    updateButtons();
}

export function addError(filename, msg) {
    if (dom.downloadArea.style.display === 'none') {
        toggleVisible(dom.downloadArea, true, 'block');
    }

    const item = createEl('div', 'download-item');
    item.style.borderColor = 'var(--md-sys-color-error-container)';
    item.style.backgroundColor = 'var(--md-sys-color-error-container)';
    item.style.color = 'var(--md-sys-color-on-error-container)';

    const header = createEl('div', 'download-header');

    const textWrapper = createEl('div', '');
    textWrapper.style.flex = '1';

    const titleRow = createEl('div', '');
    titleRow.style.display = 'flex';
    titleRow.style.alignItems = 'center';
    titleRow.style.gap = '8px';

    const iconEl = createEl('span', 'material-symbols-outlined', 'error');
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
    item.append(header);

    dom.downloadArea.appendChild(item);
    updateButtons();
}

export async function clearAll() {
    toggleVisible(dom.downloadArea, false);

    setTimeout(() => {
        dom.downloadArea.innerHTML = '';
        updateButtons();
    }, 150);

    /* Revoke all blob URLs to release the underlying Blob memory */
    for (const entry of downloadCache) {
        URL.revokeObjectURL(entry.blobURL);
    }
    downloadCache = [];

    // Clear OPFS files
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

// Clean up any leftover temp files in OPFS from previous aborted sessions on startup
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
