export function toggleAnim(el, show, displayType = 'flex') {
    const anim = el.getAnimations()[0];
    if (anim) anim.cancel();

    if (show) {
        el.style.display = displayType;
        el.animate(
            [{ opacity: 0, transform: 'scale(0.98)' }, { opacity: 1, transform: 'scale(1)' }],
            { duration: 150, easing: 'ease-out', fill: 'forwards' }
        );
    } else {
        el.animate(
            [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.98)' }],
            { duration: 150, easing: 'ease-in', fill: 'forwards' }
        ).onfinish = () => el.style.display = 'none';
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
