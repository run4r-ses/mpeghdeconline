import * as dom from './dom.js';
import * as ui from './ui.js';
import * as perf from './perf.js';
import * as dl from './download.js';

let worker = null;
let queue = [];
let qIndex = 0;
let isProcessing = false;
let lastFrameCount = 0;

/* ── PCM streaming state ─────────────────────────────────────────── */
let flushedBlobs = [];      // intermediate Blobs (file-backed by the browser)
let pendingChunks = [];     // small buffer of recent chunks before flush
let pendingSize = 0;
let totalPcmBytes = 0;
const FLUSH_THRESHOLD = 10 * 1024 * 1024; // flush every 10 MB

function flushChunks() {
    if (pendingChunks.length === 0) return;
    flushedBlobs.push(new Blob(pendingChunks));
    pendingChunks = [];     // GC can reclaim the chunk ArrayBuffers
    pendingSize = 0;
}

function resetPcmState() {
    flushedBlobs = [];
    pendingChunks = [];
    pendingSize = 0;
    totalPcmBytes = 0;
}

/* ── Fallback WAV header (used if the C-generated one is unavailable) */
function buildFallbackWavHeader(totalPcmBytes) {
    /* Defaults: 48kHz, stereo, 16-bit — reasonable for MPEG-H output */
    const sampleRate = 48000, numChannels = 2, bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const header = new ArrayBuffer(44);
    const v = new DataView(header);
    v.setUint32(0, 0x52494646, false);   // RIFF
    v.setUint32(4, totalPcmBytes + 36, true);
    v.setUint32(8, 0x57415645, false);   // WAVE
    v.setUint32(12, 0x666d7420, false);  // fmt
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, numChannels, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, byteRate, true);
    v.setUint16(32, blockAlign, true);
    v.setUint16(34, bitsPerSample, true);
    v.setUint32(36, 0x64617461, false);  // data
    v.setUint32(40, totalPcmBytes, true);
    return new Uint8Array(header);
}

/* Fix up the WAV header's size fields to match actual PCM data */
function fixWavHeaderSizes(header, totalPcmBytes) {
    const patched = new Uint8Array(header);
    const v = new DataView(patched.buffer);
    v.setUint32(4, totalPcmBytes + 36, true);  // RIFF chunk size
    v.setUint32(40, totalPcmBytes, true);       // data chunk size
    return patched;
}

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

            /* ── Streaming PCM from the C decoder ─────────────── */
            case 'pcm_chunk':
                pendingChunks.push(msg.data);
                pendingSize += msg.data.byteLength;
                totalPcmBytes += msg.data.byteLength;
                /* Flush to an intermediate Blob every FLUSH_THRESHOLD.
                   Chromium backs Blobs >256KB with temp files on disk,
                   so flushed data is paged out of RAM. */
                if (pendingSize >= FLUSH_THRESHOLD) flushChunks();
                break;

            case 'done': {
                ui.log(`Finished: ${msg.filename}`);

                /* Flush any remaining chunks */
                flushChunks();

                /* Use the C-generated WAV header (44 bytes) if available,
                   with corrected size fields. Fall back to a generic header. */
                let wavHeader;
                if (msg.wavHeader && msg.wavHeader.byteLength >= 44) {
                    wavHeader = fixWavHeaderSizes(
                        msg.wavHeader.slice(0, 44), totalPcmBytes
                    );
                } else {
                    wavHeader = buildFallbackWavHeader(totalPcmBytes);
                }

                /* Compose the final WAV Blob from header + flushed sub-Blobs.
                   The browser composes these without copying — it references
                   the file-backed sub-Blob storage. */
                const blob = new Blob(
                    [wavHeader, ...flushedBlobs],
                    { type: 'audio/wav' }
                );

                /* Free all PCM references */
                resetPcmState();

                dl.addDownload(blob, msg.filename, lastFrameCount);

                ui.updateQueueStatus(qIndex, 'finished');
                qIndex++;

                /* Layer 3: Terminate and re-create worker to release all
                   Emscripten heap memory before the next file. */
                worker.terminate();
                worker = null;
                runQueue();
                break;
            }
            case 'error':
                ui.log(msg.text, 'ERROR');
                dl.addError(queue[qIndex].name, msg.text);

                resetPcmState();

                ui.updateQueueStatus(qIndex, 'finished');
                qIndex++;

                worker.terminate();
                worker = null;
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

    /* Layer 3: Ensure a fresh worker for each file */
    if (!worker) {
        initWorker();
        await new Promise(resolve => {
            const origHandler = worker.onmessage;
            worker.onmessage = (e) => {
                origHandler(e);
                if (e.data.type === 'ready') resolve();
            };
        });
    }

    const file = queue[qIndex];
    ui.updateQueueStatus(qIndex, 'processing');
    ui.log(`Loading ${file.name} (${qIndex + 1}/${queue.length})`);
    ui.setProcessingState(qIndex + 1, queue.length);
    perf.resetMonitor();
    lastFrameCount = 0;
    resetPcmState();

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
    if (worker) worker.terminate();
    worker = null;
    resetPcmState();
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
