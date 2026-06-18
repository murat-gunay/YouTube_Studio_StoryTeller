import { AbsoluteFill, Sequence, Audio, useVideoConfig, interpolate, useCurrentFrame } from 'remotion';
import { Scene } from './Scene';

/**
 * Wrapper that applies fade-in/fade-out opacity for animated scene transitions.
 */
const TransitionWrapper: React.FC<{
    children: React.ReactNode;
    durationInFrames: number;
    transitionFrames: number;
    isFirst: boolean;
    isLast: boolean;
}> = ({ children, durationInFrames, transitionFrames, isFirst, isLast }) => {
    const frame = useCurrentFrame();

    // Fade-in at the start (except for the first scene)
    const fadeIn = isFirst ? 1 : interpolate(frame, [0, transitionFrames], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Fade-out at the end (except for the last scene)
    const fadeOut = isLast ? 1 : interpolate(
        frame,
        [durationInFrames - transitionFrames, durationInFrames],
        [1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    const opacity = Math.min(fadeIn, fadeOut);

    return (
        <AbsoluteFill style={{ opacity }}>
            {children}
        </AbsoluteFill>
    );
};

export const MainComposition: React.FC<any> = ({ scenes, globalAudioPath, isAnimatedMode = false, transitionFrames = 0 }) => {
    const { fps } = useVideoConfig();

    if (isAnimatedMode && transitionFrames > 0) {
        // === ANIMATED MODE with crossfade transitions ===
        // Scenes overlap by transitionFrames to create smooth crossfades
        let currentFrame = 0;

        return (
            <AbsoluteFill style={{ backgroundColor: 'black' }}>
                {(() => {
                    // 1. Calculate Absolute Timings for each scene
                    let scenePointer = 0;
                    const sceneTimings = scenes.map((scene: any, index: number) => {
                        const start = scenePointer;
                        const duration = scene.durationInFrames;
                        scenePointer += duration - (index < scenes.length - 1 ? transitionFrames : 0);
                        return { 
                            start, 
                            duration, 
                            musicPath: scene.musicPath, 
                            musicId: scene.musicId, 
                            sfxPath: scene.sfxPath, 
                            sfxId: scene.sfxId 
                        };
                    });

                    // 2. Identify Continuous Audio Groups (Music)
                    const musicTracks: any[] = [];
                    let currentMusicGroup: any = null;

                    sceneTimings.forEach((timing: any, idx: number) => {
                        if (timing.musicPath && timing.musicId) {
                            if (currentMusicGroup && currentMusicGroup.id === timing.musicId) {
                                currentMusicGroup.end = timing.start + timing.duration;
                            } else {
                                if (currentMusicGroup) musicTracks.push(currentMusicGroup);
                                currentMusicGroup = { 
                                    id: timing.musicId,
                                    path: timing.musicPath, 
                                    start: timing.start, 
                                    end: timing.start + timing.duration 
                                };
                            }
                        } else {
                            if (currentMusicGroup) musicTracks.push(currentMusicGroup);
                            currentMusicGroup = null;
                        }
                        if (idx === sceneTimings.length - 1 && currentMusicGroup) {
                            musicTracks.push(currentMusicGroup);
                        }
                    });

                    // 3. Identify Continuous Audio Groups (SFX)
                    const sfxTracks: any[] = [];
                    let currentSfxGroup: any = null;

                    sceneTimings.forEach((timing: any, idx: number) => {
                        if (timing.sfxPath && timing.sfxId) {
                            if (currentSfxGroup && currentSfxGroup.id === timing.sfxId) {
                                currentSfxGroup.end = timing.start + timing.duration;
                            } else {
                                if (currentSfxGroup) sfxTracks.push(currentSfxGroup);
                                currentSfxGroup = { 
                                    id: timing.sfxId,
                                    path: timing.sfxPath, 
                                    start: timing.start, 
                                    end: timing.start + timing.duration 
                                };
                            }
                        } else {
                            if (currentSfxGroup) sfxTracks.push(currentSfxGroup);
                            currentSfxGroup = null;
                        }
                        if (idx === sceneTimings.length - 1 && currentSfxGroup) {
                            sfxTracks.push(currentSfxGroup);
                        }
                    });

                    return (
                        <>
                            {musicTracks.map((t, i) => (
                                <Sequence key={`music-${i}`} from={t.start} durationInFrames={t.end - t.start}>
                                    <Audio src={t.path} volume={0.037} />
                                </Sequence>
                            ))}
                            {sfxTracks.map((t, i) => (
                                <Sequence key={`sfx-${i}`} from={t.start} durationInFrames={t.end - t.start}>
                                    <Audio src={t.path} volume={0.15} />
                                </Sequence>
                            ))}
                        </>
                    );
                })()}

                {scenes.map((scene: any, index: number) => {
                    const { durationInFrames } = scene;
                    const startFrame = currentFrame;
                    currentFrame += durationInFrames - (index < scenes.length - 1 ? transitionFrames : 0);

                    return (
                        <Sequence
                            key={scene.id}
                            from={startFrame}
                            durationInFrames={durationInFrames}
                        >
                            <TransitionWrapper
                                durationInFrames={durationInFrames}
                                transitionFrames={transitionFrames}
                                isFirst={index === 0}
                                isLast={index === scenes.length - 1}
                            >
                                <Scene 
                                    {...scene} 
                                    allScenes={scenes}
                                    isContinuousAudio={true} 
                                    isFirst={index === 0} 
                                    isLast={index === scenes.length - 1} 
                                />
                            </TransitionWrapper>
                        </Sequence>
                    );
                })}

                {globalAudioPath && (
                    <Audio src={globalAudioPath} volume={0.05} />
                )}
            </AbsoluteFill>
        );
    }

    // === STATIC MODE (unchanged original logic) ===
    let currentFrame = 0;

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {scenes.map((scene: any, index: number) => {
                const { durationInFrames } = scene;
                const startFrame = currentFrame;
                currentFrame += durationInFrames;

                return (
                    <Sequence
                        key={scene.id}
                        from={startFrame}
                        durationInFrames={durationInFrames}
                    >
                        <Scene 
                            {...scene} 
                            allScenes={scenes}
                            isFirst={index === 0} 
                            isLast={index === scenes.length - 1} 
                        />
                    </Sequence>
                );
            })}
            
            {globalAudioPath && (
                <Audio src={globalAudioPath} volume={0.05} />
            )}
        </AbsoluteFill>
    );
};
