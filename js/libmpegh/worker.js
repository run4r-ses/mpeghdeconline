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

            decoderInstance.callMain(args);

            try {
                const stat = decoderInstance.FS.stat(outName);
                if (stat.size < 44) throw new Error("Output file is empty or invalid (0 bytes)");
            } catch (e) {
                throw new Error("Decoder finished but no valid output file was generated");
            }

            const cicpVal = (msg.options && msg.options.cicp) ? msg.options.cicp : "0";
            const base = msg.baseName || "output";
            const finalName = `${base}_CICP${cicpVal}.wav`;

            const wavData = decoderInstance.FS.readFile(outName);

            postMessage({
                type: 'done',
                data: wavData,
                filename: finalName
            }, [wavData.buffer]);

            try { decoderInstance.FS.unlink(fileName); } catch (e) { }
            try { decoderInstance.FS.unlink(outName); } catch (e) { }

        } catch (err) {
            postMessage({ type: 'error', text: err.message || err.toString() });

            try { decoderInstance.FS.unlink(fileName); } catch (e) { }
            try { decoderInstance.FS.unlink(outName); } catch (e) { }
        }
    }
};
