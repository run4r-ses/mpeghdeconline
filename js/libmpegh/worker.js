importScripts(`ia_mpeghd_testbench.js?cb=${performance.now()}`);

let decoderInstance = null;

onmessage = function (e) {
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

        try {
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
               emits pcm_chunk and progress messages via EM_ASM postMessage
               directly to the main thread. The worker never accumulates
               decoded data — each chunk is transferred immediately. */
            decoderInstance.callMain(args);

            /* The C code still writes the 44-byte WAV header to the output
               file via write_wav_header(). We read ONLY those 44 bytes
               (no PCM data was written) to get the correct format info. */
            let wavHeader = null;
            try {
                wavHeader = decoderInstance.FS.readFile(outName);
                if (wavHeader.byteLength < 44) wavHeader = null;
            } catch (e) { /* file might not exist on error */ }

            const cicpVal = (msg.options && msg.options.cicp) ? msg.options.cicp : "0";
            const base = msg.baseName || "output";
            const finalName = `${base}_CICP${cicpVal}.wav`;

            postMessage({
                type: 'done',
                wavHeader: wavHeader,
                filename: finalName
            }, wavHeader ? [wavHeader.buffer] : []);

            try { decoderInstance.FS.unlink(fileName); } catch (e) { }
            try { decoderInstance.FS.unlink(outName); } catch (e) { }

        } catch (err) {
            postMessage({ type: 'error', text: err.message || err.toString() });

            try { decoderInstance.FS.unlink(fileName); } catch (e) { }
            try { decoderInstance.FS.unlink(outName); } catch (e) { }
        }
    }
};
