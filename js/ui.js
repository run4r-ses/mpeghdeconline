import * as dom from './dom.js';
import { toggleAnim, createEl } from './utils.js';

let autoScroll = true;

export function log(msg, type = 'INFO') {
    const text = type === 'RAW' ? msg : `[${type}] ${msg}`;
    
    switch (type) {
        case 'ERROR':
            console.error(text);
            break;
        case 'WARN':
            console.warn(text);
            break;
        case 'DEBUG':
            console.debug(text);
            break;
        default:
            console.log(text);
    }
}
export function setReadyState() {
    dom.fileInput.disabled = false;
    dom.fileArea.classList.remove('disabled');
    dom.fileAreaIcon.textContent = "upload_file";

    toggleAnim(dom.startBtn, false);
    toggleAnim(dom.queueList, false);
    toggleAnim(dom.optionsCard, true);

    dom.fileAreaText.style.display = "block";
    dom.fileAreaText.textContent = "Drag & drop or click to browse";
    dom.fileNameDisplay.textContent = "Select input files";
    dom.fileNameDisplay.style.color = "";
}

export function renderQueue(files, onRemove) {
    if (files.length === 0) {
        if (dom.queueList.style.display !== 'none') {
            toggleAnim(dom.queueList, false);
            toggleAnim(dom.startBtn, false, 'inline-flex');
        } else {
            dom.queueList.style.display = 'none';
            dom.startBtn.style.display = 'none';
        }
        setReadyState();
        return;
    }

    if (dom.queueList.style.display === 'none') {
        toggleAnim(dom.queueList, true, 'flex');
        toggleAnim(dom.startBtn, true, 'inline-flex');
    }

    dom.queueList.innerHTML = '';
    dom.fileNameDisplay.textContent = `${files.length} file${files.length > 1 ? 's' : ''} selected`;
    dom.fileAreaIcon.innerHTML = 'checklist';
    dom.fileAreaText.style.display = "none";

    files.forEach((file, index) => {
        const item = createEl('div', 'queue-item idle');
        item.dataset.index = index;

        const leftGroup = createEl('div', 'queue-left');
        const icon = createEl('span', 'material-symbols-outlined queue-icon', 'audio_file');
        const name = createEl('span', 'queue-filename', file.name);

        leftGroup.append(icon, name);
        item.append(leftGroup, createEl('div', 'queue-right'));

        item.onmouseenter = () => item.classList.contains('idle') && (icon.textContent = 'cancel');
        item.onmouseleave = () => item.classList.contains('idle') && (icon.textContent = 'audio_file');
        item.onclick = (e) => {
            if (item.classList.contains('idle')) {
                e.stopPropagation();
                onRemove(index);
            }
        };

        dom.queueList.appendChild(item);
    });
}

export function updateQueueStatus(index, state) {
    const item = dom.queueList.querySelector(`.queue-item[data-index="${index}"]`);
    if (!item) return;

    const icon = item.querySelector('.queue-icon');
    const text = item.querySelector('.queue-right');
    item.classList.remove('idle', 'finished');

    const states = {
        pending: { icon: 'pending', spin: false, text: 'Waiting to process' },
        processing: { icon: 'progress_activity', spin: true, text: 'Processing' },
        finished: { icon: 'check', spin: false, text: 'Finished' }
    };

    const s = states[state];
    icon.textContent = s.icon;
    icon.classList.toggle('spin', s.spin);
    text.textContent = s.text;
    if (state === 'finished') item.classList.add('finished');
}

export function setProcessingState(idx, total) {
    dom.fileArea.style.display = 'none';
    dom.optionsCard.classList.add('disabled-card');
    dom.fileInput.disabled = true;
    dom.fileArea.classList.add('disabled');
    dom.clearAllBtn.disabled = true;
    dom.dlAllBtn.style.display = 'none';
    dom.queueList.style.display = 'flex';

    dom.fileNameDisplay.textContent = "Processing queue...";
    toggleAnim(dom.startBtn, false);

    dom.statusArea.style.display = "block";
    dom.statusText.textContent = `Processing file ${idx} of ${total}`;
    dom.statusText.style.color = "var(--md-sys-color-on-surface)";

    dom.progressText.style.display = "block";

    dom.cancelBtn.style.display = "inline-flex";
    dom.fileAreaIcon.textContent = "audiotrack";
    dom.progressBar.indeterminate = true;
    dom.progressBar.value = 0;
}

export function updateProgress(frame) {
    dom.progressText.textContent = `${frame} frames processed`;
}

export function finishJob(msg, success = true, queueComplete = true) {
    if (!queueComplete && success) return;

    dom.statusText.textContent = msg;
    dom.progressBar.indeterminate = false;
    dom.progressBar.value = success ? 1 : dom.progressBar.value;
    if (!success) dom.statusText.style.color = "var(--md-sys-color-error)";

    if (queueComplete) {
        toggleAnim(dom.progressText, false);
    }

    dom.fileInput.disabled = false;
    dom.fileArea.classList.remove('disabled');
    toggleAnim(dom.fileArea, true);
    dom.optionsCard.classList.remove('disabled-card');
    toggleAnim(dom.cancelBtn, false);

    if (success) dom.clearAllBtn.disabled = false;
}

document.querySelectorAll('details').forEach(d => {
    const summary = d.querySelector('summary');
    summary.addEventListener('click', (e) => {
        if (d.hasAttribute('open')) {
            e.preventDefault();
            d.classList.add('closing');
            d.querySelector('.advanced-grid').addEventListener('animationend', () => {
                d.removeAttribute('open');
                d.classList.remove('closing');
            }, { once: true });
        }
    });
});
