import * as dom from './dom.js';
import { createEl, formatBytes, toggleAnim } from './utils.js';

let downloadCache = [];

function updateButtons() {
    const hasItems = downloadCache.length > 0;
    dom.clearAllBtn.style.display = hasItems ? 'inline-flex' : 'none';
    dom.dlAllBtn.style.display = (hasItems && downloadCache.length > 1) ? 'inline-flex' : 'none';
}

export function addDownload(data, filename, frameCount = 0) {
    if (downloadCache.length === 0) {
        if (dom.downloadArea.style.display === 'none') {
            toggleAnim(dom.downloadArea, true, 'block');
        }
    }

    downloadCache.push({ name: filename, data: data });

    const url = URL.createObjectURL(new Blob([data], { type: 'audio/wav' }));

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

    btn.append(icon, document.createTextNode(`Download \u2022 ${formatBytes(data.byteLength)} MB`));

    header.append(textWrapper, btn);

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = url;

    item.append(header, audio);
    dom.downloadArea.appendChild(item);

    updateButtons();
}

export function clearAll() {
    toggleAnim(dom.downloadArea, false);

    setTimeout(() => {
        dom.downloadArea.innerHTML = '';
    }, 150);

    downloadCache = [];
    updateButtons();
}

export async function downloadZip() {
    if (downloadCache.length === 0) return;

    const zip = new JSZip();

    downloadCache.forEach(file => {
        zip.file(file.name, file.data);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);

    const a = document.createElement('a');
    a.href = url;
    a.download = `decoded_files_${Date.now()}.zip`;
    a.click();

    URL.revokeObjectURL(url);
}
