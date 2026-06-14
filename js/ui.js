import * as dom from './dom.js';
import { toggleVisible, createEl } from './utils.js';

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
export function setInitializingState() {
    dom.fileInput.disabled = true;
    dom.fileArea.classList.add('disabled');
    dom.optionsCard.classList.add('disabled-card');

    dom.fileAreaText.style.display = "block";
    dom.fileAreaText.textContent = "Worker is initializing...";
    dom.fileNameDisplay.textContent = "Select input files";
    dom.fileNameDisplay.style.color = "var(--md-sys-color-on-surface-variant)";
}

export function setReadyState() {
    dom.fileInput.disabled = false;
    dom.fileArea.classList.remove('disabled');
    dom.optionsCard.classList.remove('disabled-card');
    dom.fileAreaIcon.setAttribute('name', 'upload_file');

    toggleVisible(dom.startBtn, false);
    toggleVisible(dom.queueList, false);
    toggleVisible(dom.optionsCard, true);

    dom.fileAreaText.style.display = "block";
    dom.fileAreaText.textContent = "Drag & drop or click to browse";
    dom.fileNameDisplay.textContent = "Select input files";
    dom.fileNameDisplay.style.color = "";
}

export function renderQueue(files, onRemove) {
    if (files.length === 0) {
        if (dom.queueList.style.display !== 'none') {
            toggleVisible(dom.queueList, false);
            toggleVisible(dom.startBtn, false, 'inline-flex');
        } else {
            dom.queueList.style.display = 'none';
            dom.startBtn.style.display = 'none';
        }
        setReadyState();
        return;
    }

    if (dom.queueList.style.display === 'none') {
        toggleVisible(dom.queueList, true, 'flex');
        toggleVisible(dom.startBtn, true, 'inline-flex');
    }

    dom.queueList.innerHTML = '';
    dom.fileNameDisplay.textContent = `${files.length} file${files.length > 1 ? 's' : ''} selected`;
    dom.fileAreaIcon.setAttribute('name', 'checklist');
    dom.fileAreaText.style.display = "none";

    files.forEach((file, index) => {
        const item = document.createElement('m3e-list-item');
        item.className = 'queue-item idle';
        item.dataset.index = index;

        const icon = document.createElement('m3e-icon');
        icon.slot = 'leading';
        icon.className = 'queue-icon';
        icon.setAttribute('name', 'audio_file');

        const fileSpan = document.createElement('span');
        fileSpan.className = 'queue-filename';
        fileSpan.textContent = file.name;

        const trailing = document.createElement('div');
        trailing.slot = 'trailing';
        trailing.className = 'queue-trailing';

        const statusEl = document.createElement('div');
        statusEl.className = 'queue-status';
        statusEl.textContent = 'Waiting to process';

        const framesEl = document.createElement('div');
        framesEl.className = 'queue-frames';
        framesEl.textContent = '';

        trailing.append(statusEl, framesEl);
        item.append(icon, fileSpan, trailing);

        item.onmouseenter = () => item.classList.contains('idle') && (icon.setAttribute('name', 'cancel'));
        item.onmouseleave = () => item.classList.contains('idle') && (icon.setAttribute('name', 'audio_file'));
        item.onclick = (e) => {
            if (item.classList.contains('idle')) {
                e.stopPropagation();
                onRemove(index);
            }
        };

        dom.queueList.appendChild(item);
    });
}

export function updateQueueStatus(index, state, extraInfo = null) {
    const item = dom.queueList.querySelector(`.queue-item[data-index="${index}"]`);
    if (!item) return;

    const icon = item.querySelector('.queue-icon');
    const statusEl = item.querySelector('.queue-status');
    const framesEl = item.querySelector('.queue-frames');
    item.classList.remove('idle', 'finished', 'error-state');
    if (state === 'finished' || state === 'error') {
        item.disabled = true;
    }

    const states = {
        pending: { icon: 'pending', text: 'Waiting to process' },
        processing: { icon: 'progress_activity', text: 'Processing' },
        finished: { icon: 'check', text: 'Finished' },
        error: { icon: 'error', text: 'Error' }
    };

    const s = states[state];

    if (state === 'processing') {
        if (icon.tagName !== 'M3E-CIRCULAR-PROGRESS-INDICATOR') {
            const prog = document.createElement('m3e-circular-progress-indicator');
            prog.variant = 'wavy';
            prog.indeterminate = true;
            prog.slot = 'leading';
            prog.className = 'queue-icon';
            icon.replaceWith(prog);
        }
    } else {
        if (icon.tagName !== 'M3E-ICON') {
            const newIcon = document.createElement('m3e-icon');
            newIcon.slot = 'leading';
            newIcon.className = 'queue-icon';
            newIcon.setAttribute('name', s.icon);
            icon.replaceWith(newIcon);
        } else {
            icon.setAttribute('name', s.icon);
        }
    }

    if (statusEl) {
        statusEl.textContent = s.text;
    }

    if (state === 'finished') {
        if (framesEl) {
            framesEl.textContent = extraInfo ? `${extraInfo} frames` : '';
        }
        item.classList.add('finished');
    } else if (state === 'error') {
        if (framesEl) {
            framesEl.textContent = extraInfo || 'Error';
        }
        item.classList.add('error-state');
    } else if (state === 'processing') {
        if (framesEl) {
            framesEl.textContent = '0 frames';
        }
    } else {
        if (framesEl) {
            framesEl.textContent = '';
        }
    }
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
    toggleVisible(dom.startBtn, false);
    toggleVisible(dom.cancelBtn, true, 'inline-flex');
}

export function updateProgress(frame) {
    const activeItem = dom.queueList.querySelector('.queue-item:not(.idle):not(.finished)');
    if (activeItem) {
        const framesEl = activeItem.querySelector('.queue-frames');
        if (framesEl) {
            framesEl.textContent = `${frame} frames`;
        }
    }
}

export function finishJob(msg, success = true, queueComplete = true) {
    if (!queueComplete && success) return;

    dom.fileInput.disabled = false;
    dom.fileArea.classList.remove('disabled');
    toggleVisible(dom.fileArea, true);
    dom.optionsCard.classList.remove('disabled-card');
    toggleVisible(dom.cancelBtn, false);

    if (success) dom.clearAllBtn.disabled = false;
}


