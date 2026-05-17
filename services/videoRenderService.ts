
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
    console.info(`📦 [VideoRender] Building FormData payload for ${scenes.length} scenes. Resolution: ${resolution}`);
    console.time('📦 [VideoRender] FormData Build Duration');
    try {
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
            kenBurns,
            isAnimated: scene.isAnimated
        });
    }

    const payload = {
        fps: FPS,
        resolution: res,
        scenes: sceneData,
    };

    console.debug(`📦 [VideoRender] Payload config generated:`, payload);
    formData.append('payload', JSON.stringify(payload));
    console.info(`📦 [VideoRender] FormData built successfully with ${sceneData.length} valid scenes.`);
    return formData;
    } finally {
        console.timeEnd('📦 [VideoRender] FormData Build Duration');
    }
};

/**
 * Builds the FormData payload specifically for Animated Video mode.
 * Duration is driven by TTS voiceover. The generated video loops to fill that duration.
 * Includes transition configuration for crossfade between scenes.
 */
export const buildAnimatedRenderFormData = async (
    scenes: Scene[],
    aspectRatio: AspectRatio,
    resolution: '720p' | '1080p' | '1440p'
): Promise<FormData> => {
    console.info(`📦 [AnimatedRender] Building FormData payload for ${scenes.length} animated scenes. Resolution: ${resolution}`);
    console.time('📦 [AnimatedRender] FormData Build Duration');
    try {
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
        const TRANSITION_FRAMES = 15; // ~0.5s crossfade between scenes

        for (const scene of scenes) {
            // Animated scenes require: videoUrl (looping animation) + ttsAudioUrl (voiceover)
            if (!scene.videoUrl || !scene.ttsAudioUrl) {
                console.warn(`📦 [AnimatedRender] Skipping scene ${scene.id}: missing videoUrl or ttsAudioUrl`);
                continue;
            }

            // Fetch Blobs for binary transmission
            const videoBlob = await fetchAsBlob(scene.videoUrl);
            const audioBlob = await fetchAsBlob(scene.ttsAudioUrl);

            // Duration is driven by TTS voiceover
            const ttsDuration = await getAudioDuration(audioBlob);
            const durationInFrames = Math.ceil(ttsDuration * FPS);

            const videoKey = `video_${scene.id}`;
            const audioKey = `audio_${scene.id}`;
            const musicKey = scene.selectedMusicId ? `music_${scene.id}` : undefined;
            const sfxKey = scene.selectedSfxId ? `sfx_${scene.id}` : undefined;

            // Image is optional reference frame for animated mode — include if available
            const imageKey = scene.imageUrl ? `img_${scene.id}` : undefined;
            if (scene.imageUrl && imageKey) {
                try {
                    const imageBlob = await fetchAsBlob(scene.imageUrl);
                    formData.append(imageKey, imageBlob, `image_${scene.id}.png`);
                } catch (e) {
                    console.warn(`📦 [AnimatedRender] Could not fetch reference image for scene ${scene.id}`, e);
                }
            }

            formData.append(videoKey, videoBlob, `video_${scene.id}.mp4`);
            formData.append(audioKey, audioBlob, `audio_${scene.id}.wav`);

            // Handle Background Music
            if (scene.selectedMusicId && musicKey) {
                const asset = AUDIO_LIBRARY.find(a => a.id === scene.selectedMusicId);
                if (asset && asset.url) {
                    try {
                        const musicBlob = await fetchAsBlob(asset.url);
                        formData.append(musicKey, musicBlob, `music_${scene.id}.mp3`);
                    } catch (e) {
                        console.error("Failed to fetch music for animated scene", e);
                    }
                }
            }

            // Handle SFX
            if (scene.selectedSfxId && sfxKey) {
                const asset = AUDIO_LIBRARY.find(a => a.id === scene.selectedSfxId);
                if (asset && asset.url) {
                    try {
                        const sfxBlob = await fetchAsBlob(asset.url);
                        const ext = asset.url.endsWith('.ogg') ? 'ogg' : 'mp3';
                        formData.append(sfxKey, sfxBlob, `sfx_${scene.id}.${ext}`);
                    } catch (e) {
                        console.error("Failed to fetch sfx for animated scene", e);
                    }
                }
            }

            sceneData.push({
                id: scene.id,
                durationInFrames,
                imageKey,
                audioKey,
                videoKey,
                musicKey,
                sfxKey,
                musicId: scene.selectedMusicId,
                sfxId: scene.selectedSfxId,
                videoDuration: scene.videoOptions?.duration || 8,
                isMuted: scene.isMuted,
                generateAudio: scene.videoOptions?.generateAudio ?? true,
                overlays: scene.overlays || [],
                isAnimated: true,
            });
        }

        const payload = {
            fps: FPS,
            resolution: res,
            scenes: sceneData,
            isAnimatedMode: true,
            transitionFrames: TRANSITION_FRAMES,
        };

        console.debug(`📦 [AnimatedRender] Payload config generated:`, payload);
        formData.append('payload', JSON.stringify(payload));
        console.info(`📦 [AnimatedRender] FormData built successfully with ${sceneData.length} valid animated scenes.`);
        return formData;
    } finally {
        console.timeEnd('📦 [AnimatedRender] FormData Build Duration');
    }
};

export const renderFullVideo = async (
    scenes: Scene[],
    aspectRatio: AspectRatio,
    resolution: '720p' | '1080p',
    onProgress: (msg: string) => void,
    isAnimated: boolean = false
): Promise<Blob> => {
    const modeLabel = isAnimated ? 'Animated' : 'Static';
    onProgress(`Packaging ${modeLabel} assets (Binary Mode)...`);
    console.info(`🚀 [VideoRender:${modeLabel}] Starting Full Video Render Process...`);
    console.time(`🚀 [VideoRender:${modeLabel}] Total Render Service Duration`);
    try {
        const formData = isAnimated
            ? await buildAnimatedRenderFormData(scenes, aspectRatio, resolution)
            : await buildRenderFormData(scenes, aspectRatio, resolution);
        
        onProgress(`Sending ${modeLabel} request to Remotion Backend...`);
        console.info(`🚀 [VideoRender:${modeLabel}] Sending POST request to Remotion API (http://localhost:3001/api/render)...`);
        console.time(`🚀 [VideoRender:${modeLabel}] Remotion API Call Duration`);

        const response = await fetch('http://localhost:3001/api/render', {
            method: 'POST',
            body: formData, 
        });

        console.timeEnd(`🚀 [VideoRender:${modeLabel}] Remotion API Call Duration`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.statusText}`);
        }

        onProgress("Server-side rendering in progress...");
        console.info(`🚀 [VideoRender:${modeLabel}] API returned success. Downloading video blob...`);
        
        const videoBlob = await response.blob();
        console.info(`🚀 [VideoRender:${modeLabel}] Render complete and Blob received (${Math.round(videoBlob.size / 1024 / 1024)} MB)`);
        return videoBlob;
    } catch (e) {
        console.error(`❌ [VideoRender:${modeLabel}] Render Full Video failed:`, e);
        throw e;
    } finally {
        console.timeEnd(`🚀 [VideoRender:${modeLabel}] Total Render Service Duration`);
    }
};
