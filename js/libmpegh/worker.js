importScripts(`ia_mpeghd_testbench.js?cb=${performance.now()}`);

let decoderInstance = null;

/* Fix up the WAV header's size fields to match actual PCM data */
function fixWavHeaderSizes(header, totalPcmBytes) {
    const patched = new Uint8Array(header);
    const v = new DataView(patched.buffer);
    v.setUint32(4, totalPcmBytes + 36, true);  // RIFF chunk size
    v.setUint32(40, totalPcmBytes, true);       // data chunk size
    return patched;
}

/* Fallback WAV header (used if the C-generated one is unavailable) */
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

onmessage = async function (e) {
    const msg = e.data;

    if (msg.type === 'init') {
        createMpeghDecoder({
            print: function (text) { postMessage({ type: 'stdout', text: text }); },
            printErr: function (text) {
                postMessage({ type: 'stderr', text: text });
                if (/fatal|error/i.test(text) && !text.includes("Warng")) {
                    throw new Error(text);
                }
            }
        }).then(instance => {
            decoderInstance = instance;
            postMessage({ type: 'ready' });
        });
    }
    else if (msg.type === 'decode') {
        if (!decoderInstance) {
            postMessage({ type: 'error', text: "Decoder not initialized" });
            return;
        }

        const inputExt = msg.extension || ".mp4";
        const fileName = "input" + inputExt;
        const outName = "output.wav";

        let accessHandle = null;
        let opfsFileOffset = 44; // Start writing PCM after 44-byte WAV header placeholder

        try {
            // Setup OPFS file write handle
            const root = await navigator.storage.getDirectory();
            const opfsName = `mpegh_out_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.wav`;
            const fileHandle = await root.getFileHandle(opfsName, { create: true });
            accessHandle = await fileHandle.createSyncAccessHandle();

            self.writePcmChunk = function(ptr, len) {
                if (!accessHandle) return;
                const chunk = new Uint8Array(decoderInstance.HEAPU8.buffer, ptr, len).slice();
                accessHandle.write(chunk, { at: opfsFileOffset });
                opfsFileOffset += len;
            };

            decoderInstance.FS.writeFile(fileName, msg.fileData);

            let args = [
                '-ifile:' + fileName,
                '-ofile:' + outName
            ];

            if (msg.options) {
                const opt = msg.options;
                if (opt.cicp) args.push(`-cicp:${opt.cicp}`);
                if (opt.pcm) args.push(`-pcmsz:${opt.pcm}`);
                if (opt.rate) args.push(`-out_fs:${opt.rate}`);
                if (opt.loudness && opt.loudness.trim() !== "") {
                    args.push(`-target_loudness:${opt.loudness}`);
                }
                if (opt.drc) args.push(`-effect:${opt.drc}`);
            }

            postMessage({ type: 'stdout', text: `Running: ${args.join(' ')}` });

            /* callMain() is synchronous. During execution the patched C code
               emits progress and writes PCM chunks directly into the OPFS file
               via self.writePcmChunk. */
            decoderInstance.callMain(args);

            // Clean up global write function
            self.writePcmChunk = null;

            /* The C code still writes the 44-byte WAV header to the output
               file in MEMFS via write_wav_header(). We read ONLY those 44 bytes
               to get the correct format info. */
            let wavHeader = null;
            try {
                wavHeader = decoderInstance.FS.readFile(outName);
                if (wavHeader.byteLength < 44) wavHeader = null;
            } catch (e) { /* file might not exist on error */ }

            // Write final WAV header into the OPFS file at offset 0
            const totalPcmBytes = opfsFileOffset - 44;
            let finalHeader = null;
            if (wavHeader && wavHeader.byteLength >= 44) {
                finalHeader = fixWavHeaderSizes(wavHeader.slice(0, 44), totalPcmBytes);
            } else {
                finalHeader = buildFallbackWavHeader(totalPcmBytes);
            }
            accessHandle.write(finalHeader, { at: 0 });

            accessHandle.flush();
            accessHandle.close();
            accessHandle = null;

            // Get the disk-backed File object
            const file = await fileHandle.getFile();

            const cicpVal = (msg.options && msg.options.cicp) ? msg.options.cicp : "0";
            const base = msg.baseName || "output";
            const finalName = `${base}_CICP${cicpVal}.wav`;

            postMessage({
                type: 'done',
                file: file,
                filename: finalName
            });

            try { decoderInstance.FS.unlink(fileName); } catch (e) { }
            try { decoderInstance.FS.unlink(outName); } catch (e) { }

        } catch (err) {
            self.writePcmChunk = null;
            if (accessHandle) {
                try { accessHandle.close(); } catch (e) { }
            }
            postMessage({ type: 'error', text: err.message || err.toString() });

            try { decoderInstance.FS.unlink(fileName); } catch (e) { }
            try { decoderInstance.FS.unlink(outName); } catch (e) { }
        }
    }
};
