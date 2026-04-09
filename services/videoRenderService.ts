
/// <reference lib="dom" />
import { Scene, AspectRatio } from '../types';
import { AUDIO_LIBRARY } from '../constants';

const FPS = 30;

/**
 * Fetches a URL and converts it to a Blob.
 */
const fetchAsBlob = async (url: string): Promise<Blob> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch asset: ${url}`);
    return await response.blob();
};

/**
 * Measures audio duration using AudioContext and returns it in seconds.
 */
const getAudioDuration = async (blob: Blob): Promise<number> => {
    try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const duration = audioBuffer.duration;
        await audioContext.close();
        return duration;
    } catch (e) {
        console.error("Failed to decode audio duration", e);
        return 5; // Fallback
    }
};

/**
 * Builds the FormData payload for more efficient binary transmission.
 */
export const buildRenderFormData = async (
    scenes: Scene[],
    aspectRatio: AspectRatio,
    resolution: '720p' | '1080p' | '1440p'
): Promise<FormData> => {
    const formData = new FormData();
    let res = { width: 1920, height: 1080 }; // Default 1080p
    
    if (resolution === '720p') res = { width: 1280, height: 720 };
    else if (resolution === '1440p') res = { width: 2560, height: 1440 };
    
    if (aspectRatio === AspectRatio.Portrait) {
        const temp = res.width;
        res.width = res.height;
        res.height = temp;
    }

    const sceneData: any[] = [];

    for (const scene of scenes) {
        if (!scene.imageUrl || !scene.ttsAudioUrl) continue;

        // Fetch Blobs for binary transmission
        const imageBlob = await fetchAsBlob(scene.imageUrl);
        const audioBlob = await fetchAsBlob(scene.ttsAudioUrl);
        
        const duration = await getAudioDuration(audioBlob);
        const durationInFrames = Math.ceil(duration * FPS);

        const imageKey = `img_${scene.id}`;
        const audioKey = `audio_${scene.id}`;
        const videoKey = scene.videoUrl ? `video_${scene.id}` : undefined;
        const musicKey = scene.selectedMusicId ? `music_${scene.id}` : undefined;
        const sfxKey = scene.selectedSfxId ? `sfx_${scene.id}` : undefined;

        formData.append(imageKey, imageBlob, `image_${scene.id}.png`);
        formData.append(audioKey, audioBlob, `audio_${scene.id}.wav`);

        if (scene.videoUrl && videoKey) {
            const videoBlob = await fetchAsBlob(scene.videoUrl);
            formData.append(videoKey, videoBlob, `video_${scene.id}.mp4`);
        }

        // Handle Background Music
        if (scene.selectedMusicId && musicKey) {
            const asset = AUDIO_LIBRARY.find(a => a.id === scene.selectedMusicId);
            if (asset) {
                try {
                    const musicBlob = await fetchAsBlob(asset.url);
                    formData.append(musicKey, musicBlob, `music_${scene.id}.mp3`);
                } catch (e) {
                    console.error("Failed to fetch music", e);
                }
            }
        }

        // Handle SFX
        if (scene.selectedSfxId && sfxKey) {
            const asset = AUDIO_LIBRARY.find(a => a.id === scene.selectedSfxId);
            if (asset) {
                try {
                    const sfxBlob = await fetchAsBlob(asset.url);
                    const ext = asset.url.endsWith('.ogg') ? 'ogg' : 'mp3';
                    formData.append(sfxKey, sfxBlob, `sfx_${scene.id}.${ext}`);
                } catch (e) {
                    console.error("Failed to fetch sfx", e);
                }
            }
        }

        // Ken Burns Config
        let kenBurns = { type: "zoom-in-center", startScale: 1.0, endScale: 1.30 };
        if (scene.animationStyles?.includes('animate-kb-zoom-out')) {
            kenBurns = { type: "zoom-out-center", startScale: 1.30, endScale: 1.0 };
        }

        sceneData.push({
            id: scene.id,
            durationInFrames,
            imageKey,
            audioKey,
            videoKey,
            musicKey,
            sfxKey,
            videoPlacement: scene.videoOptions?.placement || 'end',
            videoDuration: scene.videoOptions?.duration || 6,
            isMuted: scene.isMuted,
            generateAudio: scene.videoOptions?.generateAudio ?? true,
            overlays: scene.overlays || [],
            kenBurns
        });
    }

    const payload = {
        fps: FPS,
        resolution: res,
        scenes: sceneData,
    };

    formData.append('payload', JSON.stringify(payload));
    return formData;
};

export const renderFullVideo = async (
    scenes: Scene[],
    aspectRatio: AspectRatio,
    resolution: '720p' | '1080p',
    onProgress: (msg: string) => void
): Promise<Blob> => {
    onProgress("Packaging assets (Binary Mode)...");
    
    const formData = await buildRenderFormData(scenes, aspectRatio, resolution);
    
    onProgress("Sending request to Remotion Backend...");

    const response = await fetch('http://localhost:3001/api/render', {
        method: 'POST',
        body: formData, // Sending FormData directly is binary-safe and efficient
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.statusText}`);
    }

    onProgress("Server-side rendering in progress...");
    
    const videoBlob = await response.blob();
    return videoBlob;
};
