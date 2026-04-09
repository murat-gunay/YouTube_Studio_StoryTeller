import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

export async function renderVideo(payload: any): Promise<string> {
    const entry = path.join(process.cwd(), 'src', 'Root.tsx');
    const bundleLocation = await bundle(entry);

    const compositionId = 'MainComposition';
    const outputPath = path.join(process.cwd(), 'dist', `${Date.now()}-output.mp4`);

    const composition = await selectComposition({
        id: compositionId,
        inputProps: payload,
        serveUrl: bundleLocation,
    });

    console.log(`Starting Remotion render for Composition: ${compositionId}...`);

    await renderMedia({
        composition,
        serveUrl: bundleLocation,
        outputLocation: outputPath,
        inputProps: payload,
        codec: 'h264',
    });

    console.log(`Render complete: ${outputPath}`);
    return outputPath;
}
