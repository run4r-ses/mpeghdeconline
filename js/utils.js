export function toggleVisible(el, show, displayType = 'flex') {
    if (show) {
        el.style.display = displayType;
        el.style.opacity = '1';
        el.style.transform = 'none';
    } else {
        el.style.display = 'none';
    }
}

export function formatBytes(bytes) {
    return (bytes / 1024 / 1024).toFixed(2);
}

export function createEl(tag, className, text = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
}
