import { AbsoluteFill, Audio, Img, interpolate, useCurrentFrame, useVideoConfig, Sequence } from 'remotion';
import { Video as MediaVideo } from '@remotion/media';
import { Subtitle } from './Subtitle';

export const Scene: React.FC<any> = ({ 
    imagePath, 
    audioPath, 
    videoPath,
    durationInFrames, 
    overlays,
    kenBurns,
    videoPlacement = 'end',
    videoDuration = 6,
    isMuted = false,
    generateAudio = true,
    musicPath,
    sfxPath
}) => {
    const { fps, width, height } = useVideoConfig();
    const frame = useCurrentFrame();

    // The server now provides full HTTP URLs for static assets
    const finalImageUrl = imagePath;
    const finalAudioUrl = audioPath;
    const finalVideoUrl = videoPath;
    const finalMusicUrl = musicPath;
    const finalSfxUrl = sfxPath;

    // Calculate timings
    const videoFrames = Math.ceil(videoDuration * fps);
    const videoStartFrame = videoPlacement === 'start' 
        ? 0 
        : Math.max(0, durationInFrames - videoFrames);

    // Ken Burns Calculation (Scale)
    const startScale = kenBurns?.startScale || 1.0;
    const endScale = kenBurns?.endScale || 1.30;
    const scale = interpolate(frame, [0, durationInFrames], [startScale, endScale], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Ken Burns Calculation (Pan) - deterministic random based on image path
    const seed = imagePath?.length || 0;
    const panX = interpolate(frame, [0, durationInFrames], [0, (seed % 10 - 5) * 20], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const panY = interpolate(frame, [0, durationInFrames], [0, (seed % 7 - 3.5) * 20], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
            {/* Base Image with Ken Burns */}
            <Img
                src={finalImageUrl}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: `scale(${scale}) translate(${panX}px, ${panY}px)`,
                }}
            />

            {/* Video Overlay if exists */}
            {finalVideoUrl && (
                <Sequence from={videoStartFrame} durationInFrames={videoFrames}>
                    <MediaVideo
                        src={finalVideoUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                        volume={isMuted || !generateAudio ? 0 : 1}
                    />
                </Sequence>
            )}

            {/* Main TTS Voiceover */}
            {audioPath && <Audio src={finalAudioUrl} />}

            {/* Background Music - Lower volume to not overpower TTS */}
            {musicPath && <Audio src={finalMusicUrl} volume={0.15} />}

            {/* Sound Effects / Ambience */}
            {sfxPath && <Audio src={finalSfxUrl} volume={0.5} />}

            <Subtitle overlays={overlays} />
        </AbsoluteFill>
    );
};
