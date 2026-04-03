
/// <reference lib="dom" />
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { Scene, AspectRatio } from '../types';
import { AUDIO_LIBRARY } from '../constants';

// Helper to manually decode Data URI to Uint8Array for stability
const dataUriToUint8Array = (dataUri: string): Uint8Array => {
    try {
        const split = dataUri.split(',');
        const base64 = split.length > 1 ? split[1] : dataUri;
        const binary_string = atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes;
    } catch (e) {
        console.error("Failed to decode Data URI", e);
        throw new Error("Failed to process image or audio data.");
    }
};

const getAssetPath = (id: string | undefined): string | null => {
    if (!id) return null;
    const asset = AUDIO_LIBRARY.find(a => a.id === id);
    if (!asset) return null;
    return asset.url; // Returns the full remote URL now
};

// Fetch buffer from public URL
const fetchAssetBuffer = async (url: string): Promise<Uint8Array> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load asset: ${url}`);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
};

const getAudioDuration = async (data: Uint8Array): Promise<number> => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(data.buffer.slice(0));
        const duration = audioBuffer.duration;
        await audioContext.close();
        return duration;
    } catch (e) {
        console.error("Failed to decode audio duration", e);
        return 5; // Fallback
    }
};

export const renderFullVideo = async (
    scenes: Scene[],
    aspectRatio: AspectRatio,
    resolution: '720p' | '1080p' | '1440p',
    onProgress: (msg: string) => void
): Promise<Blob> => {

    console.log("Starting Render Service with Multi-Track Audio...");
    onProgress("Initializing video engine...");

    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => { console.log('[FFmpeg]', message); });

    try {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
    } catch (e: any) {
        console.error("FFmpeg Load Error:", e);
        throw new Error(`Failed to load video engine: ${e.message || JSON.stringify(e)}`);
    }

    onProgress("Engine loaded. Preparing assets...");

    // Resolution Config
    let width = 1280;
    let height = 720;

    if (resolution === '1080p') {
        width = 1920;
        height = 1080;
    } else if (resolution === '1440p') {
        width = 2560;
        height = 1440;
    }

    if (aspectRatio === AspectRatio.Portrait) { const temp = width; width = height; height = temp; }

    // Ensure even dimensions for h264
    if (width % 2 !== 0) width -= 1;
    if (height % 2 !== 0) height -= 1;

    // --- PHASE 1: Render Segments ---
    const segmentBuffers: Uint8Array[] = [];

    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        if (!scene.imageUrl || !scene.ttsAudioUrl) continue;

        onProgress(`Rendering Scene ${i + 1}/${scenes.length} (Mixing Audio & Video)...`);
        await new Promise(r => setTimeout(r, 10));

        const imgName = `img_${i}.png`;
        const ttsName = `tts_${i}.wav`;
        const musicName = `music_${i}.mp3`;
        const sfxName = `sfx_${i}.mp3`;
        const outName = `seg_${i}.mp4`;

        // 1. Write core assets
        const ttsData = dataUriToUint8Array(scene.ttsAudioUrl);
        const duration = await getAudioDuration(ttsData);
        const FPS = 30;
        const totalFrames = Math.ceil(duration * FPS);

        await ffmpeg.writeFile(imgName, dataUriToUint8Array(scene.imageUrl));
        await ffmpeg.writeFile(ttsName, ttsData);

        // 2. Fetch and write auxiliary audio
        const musicUrl = getAssetPath(scene.selectedMusicId);
        const sfxUrl = getAssetPath(scene.selectedSfxId);

        let hasMusic = false;
        let hasSfx = false;

        if (musicUrl) {
            try {
                const musicBuf = await fetchAssetBuffer(musicUrl);
                await ffmpeg.writeFile(musicName, musicBuf);
                hasMusic = true;
            } catch (e) { console.warn("Missing music asset", musicUrl); }
        }

        if (sfxUrl) {
            try {
                const sfxBuf = await fetchAssetBuffer(sfxUrl);
                await ffmpeg.writeFile(sfxName, sfxBuf);
                hasSfx = true;
            } catch (e) { console.warn("Missing sfx asset", sfxUrl); }
        }

        // 3. Build Filter Complex
        // Logic: 
        // - [0:v] Image Loop
        // - [1:a] TTS (Main)
        // - [2:a] Music (Volume 0.15, Loop)
        // - [3:a] SFX (Volume 0.4, Seek 5s input to skip intro)

        const inputs = [
            '-loop', '1', '-i', imgName, // [0] Video
            '-i', ttsName,               // [1] TTS
        ];
        if (hasMusic) inputs.push('-stream_loop', '-1', '-i', musicName); // [2] Music looped
        if (hasSfx) {
            inputs.push('-i', sfxName); // [3] SFX - No seek for safety
        }

        // Build Audio Mix Filter
        let audioFilter = '';
        let inputCount = 1; // TTS is always there

        // Prepare streams for mixing
        let mixInputs = '[1:a]'; // Start with TTS

        if (hasMusic) {
            // Manual Music Volume (0.15)
            audioFilter += `[2:a]volume=0.15[music];`;
            mixInputs += '[music]';
            inputCount++;
        }
        if (hasSfx) {
            // Manual SFX Volume (0.4)
            audioFilter += `[3:a]volume=0.4[sfx];`;
            mixInputs += '[sfx]';
            inputCount++;
        }

        // Final Mix (with normalize=0 since we handle volumes manually)
        audioFilter += `${mixInputs}amix=inputs=${inputCount}:duration=first:dropout_transition=2:normalize=0[aout]`;

        // Video Filter (Zoompan)
        // Fix 1: Super-sampling calculation relative to OUTPUT dimensions (prevents distortion/squashing)
        const superWidth = width * 2;
        const superHeight = height * 2;

        // Fix 2: Added 'fps=${FPS}' to zoompan to sync animation smoothness
        const videoFilter = `[0:v]scale=${superWidth}:${superHeight},zoompan=z='1+0.3*(on/${totalFrames})':d=${totalFrames}:fps=${FPS}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}[vout]`;

        await ffmpeg.exec([
            ...inputs,
            '-filter_complex', `${videoFilter};${audioFilter}`,
            '-map', '[vout]',
            '-map', '[aout]',
            '-c:v', 'libx264',
            '-tune', 'stillimage',
            '-preset', 'medium', // Improved motion estimation
            '-crf', '23',        // CRF 23
            '-pix_fmt', 'yuv420p',
            '-shortest',
            '-t', duration.toString(),  // Exact duration limit
            '-r', FPS.toString(),
            outName
        ]);

        const data = await ffmpeg.readFile(outName);
        if (!data || data.length === 0) throw new Error(`Scene ${i} render empty.`);
        segmentBuffers.push(typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data));

        // Cleanup
        try {
            await ffmpeg.deleteFile(imgName);
            await ffmpeg.deleteFile(ttsName);
            if (hasMusic) await ffmpeg.deleteFile(musicName);
            if (hasSfx) await ffmpeg.deleteFile(sfxName);
            await ffmpeg.deleteFile(outName);
        } catch (e) { }
    }

    if (segmentBuffers.length === 0) throw new Error("No scenes rendered.");

    // --- PHASE 2: Stitching ---
    // (Same as before)
    let currentBuffers = [...segmentBuffers];
    const BATCH_SIZE = 5;
    let batchIteration = 1;

    while (currentBuffers.length > 1) {
        onProgress(`Stitching Pass ${batchIteration}...`);
        await new Promise(r => setTimeout(r, 10));
        const nextPass: Uint8Array[] = [];

        for (let i = 0; i < currentBuffers.length; i += BATCH_SIZE) {
            const batch = currentBuffers.slice(i, i + BATCH_SIZE);
            if (batch.length === 1) { nextPass.push(batch[0]); continue; }

            const concatList: string[] = [];
            for (let j = 0; j < batch.length; j++) {
                const f = `c_${i}_${j}.mp4`;
                await ffmpeg.writeFile(f, batch[j]);
                concatList.push(`file '${f}'`);
            }
            await ffmpeg.writeFile('list.txt', concatList.join('\n'));
            const out = `batch_${i}.mp4`;

            await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', out]);

            const d = await ffmpeg.readFile(out);
            nextPass.push(typeof d === 'string' ? new TextEncoder().encode(d) : new Uint8Array(d));

            // cleanup
            await ffmpeg.deleteFile('list.txt');
            await ffmpeg.deleteFile(out);
            for (let j = 0; j < batch.length; j++) await ffmpeg.deleteFile(`c_${i}_${j}.mp4`);
        }
        currentBuffers = nextPass;
        batchIteration++;
    }

    onProgress("Finalizing...");
    return new Blob([currentBuffers[0] as BlobPart], { type: 'video/mp4' });
};
