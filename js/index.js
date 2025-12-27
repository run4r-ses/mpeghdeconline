import * as dom from './dom.js';
import * as ui from './ui.js';
import * as perf from './perf.js';
import * as dl from './download.js';

let worker = null;
let queue = [];
let qIndex = 0;
let isProcessing = false;
let lastFrameCount = 0;

function initWorker() {
    if (worker) worker.terminate();
    worker = new Worker('js/libmpegh/worker.js');

    worker.onmessage = (e) => {
        const msg = e.data;
        switch (msg.type) {
            case 'ready':
                ui.setReadyState();
                ui.log('Worker is ready');
                break;
            case 'progress':
                lastFrameCount = msg.frame;
                ui.updateProgress(msg.frame);
                perf.updateStats(msg.frame);
                break;
            case 'stdout':
            case 'stderr':
                if (dom.config.stderr.selected) ui.log(msg.text, 'RAW');
                break;
            case 'done':
                ui.log(`Finished: ${msg.filename}`);
                dl.addDownload(msg.data, msg.filename, lastFrameCount);

                ui.updateQueueStatus(qIndex, 'finished');
                qIndex++;
                runQueue();
                break;
            case 'error':
                ui.log(msg.text, 'ERROR');
                dl.addError(queue[qIndex].name, msg.text);
                ui.updateQueueStatus(qIndex, 'finished'); 
                qIndex++;
                runQueue();
                break;
        }
    };
    worker.postMessage({ type: 'init' });
}

function refreshQueue() {
    ui.renderQueue(queue, (idx) => {
        if (isProcessing) return;
        queue.splice(idx, 1);
        refreshQueue();
    });
}

async function runQueue() {
    if (qIndex >= queue.length) {
        isProcessing = false;
        perf.stopMonitor();
        ui.finishJob("All files processed!", true, true);
        queue = [];
        refreshQueue();
        return;
    }

    const file = queue[qIndex];
    ui.updateQueueStatus(qIndex, 'processing');
    ui.log(`Loading ${file.name} (${qIndex + 1}/${queue.length})`);
    ui.setProcessingState(qIndex + 1, queue.length);
    perf.resetMonitor();
    lastFrameCount = 0;

    try {
        const buf = await file.arrayBuffer();
        const u8 = new Uint8Array(buf);

        worker.postMessage({
            type: 'decode',
            fileData: u8,
            options: {
                cicp: dom.config.cicp.value,
                pcm: dom.config.pcm.value,
                rate: dom.config.rate.value,
                loudness: dom.config.loudness.value,
                drc: dom.config.drc.value,
            },
            extension: file.name.substring(file.name.lastIndexOf('.')),
            baseName: file.name.substring(0, file.name.lastIndexOf('.')) || file.name
        }, [u8.buffer]);

    } catch (err) {
        ui.log(`Load failed: ${err}`, 'ERROR');
        dl.addError(file.name, `Load failed: ${err}`);
        qIndex++;
        runQueue();
    }
}

if (dom.erudaBtn) {
    dom.erudaBtn.addEventListener('click', () => {
        const script = document.createElement('script');
        script.src = "//cdn.jsdelivr.net/npm/eruda";
        script.onload = () => {
            eruda.init();
            const status = dom.erudaBtn.querySelector('.erudaStatus');
            status.textContent = "Eruda is loaded";
            dom.erudaBtn.disabled = true;
            ui.log("Eruda initialized", "INFO");
        };
        document.body.appendChild(script);
    });
}

dom.clearAllBtn.addEventListener('click', dl.clearAll);

dom.dlAllBtn.addEventListener('click', async () => {
    dom.dlAllBtn.disabled = true;
    try {
        await dl.downloadZip();
    } catch (e) {
        ui.log(`Zip error: ${e}`, 'ERROR');
    }
    dom.dlAllBtn.disabled = false;
});

dom.cancelBtn.addEventListener('click', () => {
    ui.log('Queue cancelled', 'WARN');
    worker.terminate();
    perf.stopMonitor();
    ui.finishJob("Cancelled", false, true);
    initWorker();
    queue = [];
    qIndex = 0;
    isProcessing = false;
    refreshQueue();
});

dom.fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    queue = [...queue, ...files];
    refreshQueue();
    dom.fileInput.value = '';
});

dom.startBtn.addEventListener('click', () => {
    if (!queue.length) return ui.log("No files in queue", "ERROR");

    isProcessing = true;
    qIndex = 0;

    const confObj = Object.fromEntries(
        Object.entries(dom.config).map(([key, el]) => [
            key,
            el.value ?? 'Def'
        ])
    );
    ui.log(`\n[INFO] Starting job with ${queue.length} files`, 'RAW');
    ui.log(`${JSON.stringify(confObj)}`, 'DEBUG');

    queue.forEach((_, i) => ui.updateQueueStatus(i, 'pending'));
    runQueue();
});

initWorker();
