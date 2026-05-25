import { renderVideo } from './render';
import fs from 'fs';
import path from 'path';

async function test() {
    console.log("Running mock render test for Football simulation mode...");
    
    // Create dummy image and audio files in temp if they don't exist
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const dummyImgPath = path.join(tempDir, 'dummy.png');
    const dummyAudioPath = path.join(tempDir, 'dummy.wav');
    
    // Write 1-pixel transparent PNG
    const pngHex = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000100000500010d0a2db40000000049454e44ae426082';
    fs.writeFileSync(dummyImgPath, Buffer.from(pngHex, 'hex'));
    
    // Write minimal 44-byte WAV header (silent)
    const wavHex = '524946462400000057415645666d74201000000001000100401f0000401f0000010008006461746100000000';
    fs.writeFileSync(dummyAudioPath, Buffer.from(wavHex, 'hex'));

    const host = 'http://localhost:3001';
    
    const payload = {
        fps: 30,
        resolution: { width: 1920, height: 1080 },
        isAnimatedMode: false,
        scenes: [
            {
                id: 0,
                durationInFrames: 150, // 5 seconds
                imagePath: `${host}/static/dummy.png`,
                audioPath: `${host}/static/dummy.wav`,
                musicPath: 'https://raw.githubusercontent.com/murat-gunay/VideoSoundMusic/main/music_cinematic_thrilling.mp3',
                sfxPath: 'https://actions.google.com/sounds/v1/crowds/crowd_talking.ogg', // The .ogg SFX file
                videoPlacement: 'end',
                videoDuration: 6,
                isMuted: false,
                generateAudio: true,
                overlays: [],
                kenBurns: { type: "zoom-in-center", startScale: 1.0, endScale: 1.30 },
                isAnimated: false
            }
        ]
    };
    
    try {
        const outputPath = await renderVideo(payload);
        console.log("Mock render succeeded! Output path:", outputPath);
    } catch (error) {
        console.error("Mock render failed with error:", error);
    }
}

test();
