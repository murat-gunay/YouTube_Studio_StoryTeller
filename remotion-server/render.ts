import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

// Redirect temporary folder to the 1TB external volume
const extTempDir = '/Volumes/Yeni Birim/YouTubeStudio/Football_Simulator/temp';
if (!fs.existsSync(extTempDir)) {
    try {
        fs.mkdirSync(extTempDir, { recursive: true });
    } catch (_) {}
}
process.env.TMPDIR = extTempDir;


export async function renderVideo(payload: any): Promise<string> {
    const entry = path.join(process.cwd(), 'src', 'Root.tsx');
    console.info(`🎬 [RenderService] Entry file path: ${entry}`);
    
    try {
        console.info(`🎬 [RenderService] Step 1: Bundling composition entry...`);
        console.time(`🎬 [RenderService] Bundling Duration`);
        const bundleLocation = await bundle(entry);
        console.timeEnd(`🎬 [RenderService] Bundling Duration`);
        console.info(`🎬 [RenderService] Bundle created at: ${bundleLocation}`);

        const compositionId = 'MainComposition';
        const distDir = '/Volumes/Yeni Birim/YouTubeStudio/Football_Simulator';
        if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir, { recursive: true });
        }
        const outputPath = path.join(distDir, `${Date.now()}-output.mp4`);

        console.info(`🎬 [RenderService] Step 2: Selecting composition "${compositionId}"...`);
        const composition = await selectComposition({
            id: compositionId,
            inputProps: payload,
            serveUrl: bundleLocation,
        });
        console.info(`🎬 [RenderService] Composition selected successfully: fps=${composition.fps}, durationInFrames=${composition.durationInFrames}`);

        console.info(`🎬 [RenderService] Step 3: Rendering media to ${outputPath}...`);
        console.time(`🎬 [RenderService] renderMedia Duration`);
        await renderMedia({
            composition,
            serveUrl: bundleLocation,
            outputLocation: outputPath,
            inputProps: payload,
            codec: 'h264',
        });
        console.timeEnd(`🎬 [RenderService] renderMedia Duration`);

        console.info(`🎬 [RenderService] ✅ Remotion render completed successfully!`);
        return outputPath;
    } catch (err: any) {
        console.error(`❌ [RenderService] FAILED during rendering process:`, err);
        console.error(err.stack || err);
        throw err;
    }
}
