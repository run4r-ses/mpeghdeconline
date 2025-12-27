import { perfWidget, perfPrimary } from './dom.js';
import { toggleVisible } from './utils.js';

let lastFrame = 0;
let lastTime = 0;

export function resetMonitor() {
    lastFrame = 0;
    lastTime = performance.now();
    perfPrimary.textContent = "...";
    perfWidget.style.display = "flex";
}

export function updateStats(currentFrame) {
    const now = performance.now();
    const delta = now - lastTime;

    if (delta >= 500) {
        const fps = ((currentFrame - lastFrame) / (delta / 1000)).toFixed(1);
        perfPrimary.textContent = `${fps} fps`;
        lastFrame = currentFrame;
        lastTime = now;
    }
}

export function stopMonitor() {
    toggleVisible(perfWidget, false);
}