import { AbsoluteFill, Audio, Img, interpolate, useCurrentFrame, useVideoConfig, Sequence, Loop } from 'remotion';
import { Video as MediaVideo } from '@remotion/media';
import { Subtitle } from './Subtitle';

const LOCALIZED_TEXT = {
    English: {
        introTitle: "AI MATCH ENGINE",
        introSubtitle: "10,000 RUNS CALCULATED",
        outroTitle: "SIMULATION CONCLUDED",
        outroCta: "SUBSCRIBE FOR MORE RUNS!",
        outroDesc: "Tell us in the comments which match we should simulate next."
    },
    Turkish: {
        introTitle: "YAPAY ZEKA MAÇ MOTORU",
        introSubtitle: "10.000 SİMÜLASYON HESAPLANDI",
        outroTitle: "SİMÜLASYON TAMAMLANDI",
        outroCta: "DAHA FAZLA SİMÜLASYON İÇİN ABONE OLUN!",
        outroDesc: "Bir sonraki simülasyonu yorumlarda bizimle paylaşın."
    },
    Spanish: {
        introTitle: "MOTOR DE PARTIDO IA",
        introSubtitle: "10.000 SIMULACIONES CALCULADAS",
        outroTitle: "SIMULACIÓN CONCLUIDA",
        outroCta: "¡SUSCRÍBETE PARA MÁS CONTENIDO!",
        outroDesc: "Dinos en los comentarios qué partido deberíamos simular a continuación."
    },
    French: {
        introTitle: "MOTEUR DE MATCH IA",
        introSubtitle: "10 000 SIMULATIONS CALCULÉES",
        outroTitle: "SIMULATION TERMINÉE",
        outroCta: "ABONNEZ-VOUS POUR PLUS DE MATCHS !",
        outroDesc: "Dites-nous dans les commentaires quel match simuler ensuite."
    },
    German: {
        introTitle: "KI MATCH-ENGINE",
        introSubtitle: "10.000 SIMULATIONEN BERECHNET",
        outroTitle: "SIMULATION BEENDET",
        outroCta: "ABONNIEREN FÜR MEHR SIMULATIONEN!",
        outroDesc: "Schreiben Sie uns in die Kommentare, welches Spiel wir als nächstes simulieren sollen."
    },
    Portuguese: {
        introTitle: "MOTOR DE JOGO IA",
        introSubtitle: "10.000 SIMULAÇÕES CALCULADAS",
        outroTitle: "SIMULAÇÃO CONCLUÍDA",
        outroCta: "INSCREVA-SE PARA MAIS SIMULAÇÕES!",
        outroDesc: "Diga-nos nos comentários qual jogo devemos simular a seguir."
    },
    Arabic: {
        introTitle: "محرك المباراة بالذكاء الاصطناعي",
        introSubtitle: "تم حساب ١٠,٠٠٠ محاكاة",
        outroTitle: "اكتملت المحاكاة",
        outroCta: "اشترك للمزيد من المحاكاة!",
        outroDesc: "أخبرنا في التعليقات ما هي المباراة التي يجب أن نحاكيها بعد ذلك."
    },
    Chinese: {
        introTitle: "AI比赛引擎",
        introSubtitle: "已计算10,000次模拟",
        outroTitle: "模拟结束",
        outroCta: "订阅以观看更多模拟！",
        outroDesc: "在评论中告诉我们您接下来想看哪场比赛的模拟。"
    },
    Japanese: {
        introTitle: "AIマッチエンジン",
        introSubtitle: "10,000回のシミュレーション計算済み",
        outroTitle: "シミュレーション終了",
        outroCta: "チャンネル登録でさらにシミュレーション！",
        outroDesc: "次にシミュレーションしてほしい対戦をコメント欄で教えてください。"
    },
    Hindi: {
        introTitle: "एआई मैच इंजन",
        introSubtitle: "10,000 सिमुलेशन की गणना की गई",
        outroTitle: "सिमुलेशन समाप्त",
        outroCta: "अधिक सिमुलेशन के लिए सदस्यता लें!",
        outroDesc: "हमें टिप्पणियों में बताएं कि हमें अगला सिमुलेशन किस मैच का करना चाहिए।"
    }
};

const RenderSlideshow: React.FC<{
    allScenes: any[];
    durationInFrames: number;
    fps: number;
    frame: number;
}> = ({ allScenes, durationInFrames, fps, frame }) => {
    if (!allScenes || allScenes.length === 0) return null;

    const indices = [
        0,
        Math.min(1, allScenes.length - 1),
        Math.min(2, allScenes.length - 1),
        Math.min(Math.floor(allScenes.length / 2), allScenes.length - 1),
        Math.max(0, allScenes.length - 2)
    ];

    const uniqueIndices: number[] = [];
    for (const idx of indices) {
        if (!uniqueIndices.includes(idx)) {
            uniqueIndices.push(idx);
        }
    }

    const slideshowScenes = uniqueIndices.map(idx => allScenes[idx]);
    const totalSlides = slideshowScenes.length;
    const slotDuration = durationInFrames / totalSlides;

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {slideshowScenes.map((slideScene, idx) => {
                const start = Math.round(idx * slotDuration);
                const end = Math.round((idx + 1) * slotDuration);
                
                const renderStart = idx === 0 ? 0 : start - 6;
                const renderEnd = idx === totalSlides - 1 ? durationInFrames : end + 6;
                
                if (frame < renderStart || frame > renderEnd) return null;

                let opacity = 1;
                if (idx > 0) {
                    opacity = interpolate(frame, [start - 6, start + 6], [0, 1], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    });
                }
                if (idx < totalSlides - 1) {
                    const fadeOut = interpolate(frame, [end - 6, end + 6], [1, 0], {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    });
                    opacity = Math.min(opacity, fadeOut);
                }

                const relativeFrame = frame - start;
                const slideDurationFrames = end - start;
                const scale = interpolate(relativeFrame, [0, slideDurationFrames], [1.0, 1.15], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                });

                const seed = (slideScene.imagePath || slideScene.videoPath)?.length || 0;
                const panX = interpolate(relativeFrame, [0, slideDurationFrames], [0, (seed % 10 - 5) * 15], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                });
                const panY = interpolate(relativeFrame, [0, slideDurationFrames], [0, (seed % 7 - 3.5) * 15], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                });

                const useVideo = slideScene.isAnimated && slideScene.videoPath;
                
                return (
                    <div
                        key={`slide-${idx}-${slideScene.id}`}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            opacity,
                            transform: `scale(${scale}) translate(${panX}px, ${panY}px)`,
                            transformOrigin: 'center center',
                        }}
                    >
                        {useVideo ? (
                            <MediaVideo
                                src={slideScene.videoPath}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                }}
                                volume={0}
                                loop
                            />
                        ) : (
                            <Img
                                src={slideScene.imagePath}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                }}
                            />
                        )}
                    </div>
                );
            })}
        </AbsoluteFill>
    );
};

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
    sfxPath,
    isAnimated = false,
    isContinuousAudio = false,
    isFirst = false,
    isLast = false,
    matchMinute,
    language,
    teamA,
    teamB,
    voiceover,
    allScenes
}) => {
    const { fps } = useVideoConfig();
    const frame = useCurrentFrame();

    // Map language parameter to target translations
    let mappedLang = language || 'English';
    if (mappedLang.toLowerCase().includes('portuguese')) mappedLang = 'Portuguese';
    const langKey = LOCALIZED_TEXT[mappedLang as keyof typeof LOCALIZED_TEXT] ? mappedLang : 'English';
    const texts = LOCALIZED_TEXT[langKey as keyof typeof LOCALIZED_TEXT];

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

    // Ken Burns Calculation (Scale) — only used in static mode
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

    // Intro/Outro animation timings
    const introOpacity = interpolate(frame, [45, 60], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const introScale = interpolate(frame, [0, 60], [1.0, 1.06], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    const outroStartFrame = Math.max(0, durationInFrames - 90);
    const outroOpacity = interpolate(frame, [outroStartFrame, outroStartFrame + 30], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });
    const outroTranslateY = interpolate(frame, [outroStartFrame, outroStartFrame + 30], [120, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    // Pulse effect for LIVE indicator dot
    const pulseOpacity = 0.3 + 0.7 * Math.abs(Math.sin((frame / fps) * Math.PI));

    return (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
            {/* Background Layer: Slideshow for the Hook (Scene 0) or regular media loop/image */}
            {isFirst && allScenes && allScenes.length > 0 ? (
                <RenderSlideshow 
                    allScenes={allScenes} 
                    durationInFrames={durationInFrames} 
                    fps={fps} 
                    frame={frame} 
                />
            ) : isAnimated && finalVideoUrl ? (
                <Sequence from={0} durationInFrames={durationInFrames}>
                    <Loop durationInFrames={videoFrames}>
                        <MediaVideo
                            src={finalVideoUrl}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                            volume={isMuted || !generateAudio ? 0 : (isAnimated ? 0.2 : 1.0)}
                        />
                    </Loop>
                </Sequence>
            ) : (
                /* Static Mode: Base Image with Ken Burns */
                <>
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
                                volume={isMuted || !generateAudio ? 0 : (isAnimated ? 0.2 : 1.0)}
                            />
                        </Sequence>
                    )}
                </>
            )}

            {/* Simulated Live Match Scoreboard / Minute Tracker */}
            {matchMinute !== undefined && (
                <div style={{
                    position: 'absolute',
                    top: '40px',
                    left: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(10px)',
                    border: '2px solid rgba(16, 185, 129, 0.4)', // emerald outline
                    padding: '10px 20px',
                    borderRadius: '40px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                    zIndex: 50,
                }}>
                    <span style={{
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#10b981', // emerald pulse
                        borderRadius: '50%',
                        boxShadow: '0 0 12px #10b981',
                        opacity: pulseOpacity,
                    }} />
                    <span style={{
                        color: 'white',
                        fontSize: '24px',
                        fontFamily: '"Bangers", "Arial Black", sans-serif',
                        fontWeight: 'bold',
                        letterSpacing: '1.5px',
                        textTransform: 'uppercase',
                    }}>
                        SIMULATION MINUTE: {matchMinute}'
                    </span>
                </div>
            )}

            {/* Intro Visual Transition Overlay (Scene 0 first 2 seconds) */}
            {isFirst && frame < 60 && (
                <AbsoluteFill style={{
                    backgroundColor: 'black',
                    opacity: introOpacity,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                }}>
                    <div style={{
                        position: 'absolute',
                        width: '800px',
                        height: '800px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
                        transform: `scale(${introScale})`,
                    }} />
                    <div style={{
                        borderTop: '6px solid #10b981',
                        borderBottom: '6px solid #10b981',
                        padding: '30px 60px',
                        textAlign: 'center',
                        transform: `scale(${introScale})`,
                    }}>
                        <h1 style={{
                            color: 'white',
                            fontSize: '84px',
                            fontFamily: '"Bangers", "Arial Black", sans-serif',
                            textTransform: 'uppercase',
                            letterSpacing: '4px',
                            margin: 0,
                            textShadow: '0 0 30px rgba(16, 185, 129, 0.6)',
                        }}>
                            {texts.introTitle}
                        </h1>
                        <p style={{
                            color: '#34d399',
                            fontSize: '28px',
                            fontFamily: '"Inter", sans-serif',
                            fontWeight: 'bold',
                            letterSpacing: '8px',
                            margin: '12px 0 0 0',
                            textTransform: 'uppercase',
                        }}>
                            {texts.introSubtitle}
                        </p>
                    </div>
                </AbsoluteFill>
            )}

            {/* Outro Subscribe CTA Overlay (Final 3 seconds of last scene) */}
            {isLast && frame >= outroStartFrame && (
                <AbsoluteFill style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.88)',
                    opacity: outroOpacity,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                }}>
                    <div style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '8px solid black',
                        borderRadius: '40px',
                        padding: '50px 70px',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        transform: `translateY(${outroTranslateY}px)`,
                        maxWidth: '85%',
                    }}>
                        <h2 style={{
                            color: '#34d399',
                            fontSize: '36px',
                            fontFamily: '"Bangers", "Arial Black", sans-serif',
                            letterSpacing: '3px',
                            textTransform: 'uppercase',
                            margin: 0,
                        }}>
                            {texts.outroTitle}
                        </h2>
                        <div style={{
                            height: '6px',
                            width: '120px',
                            backgroundColor: '#10b981',
                            margin: '25px 0',
                            borderRadius: '3px',
                        }} />
                        <h1 style={{
                            color: 'white',
                            fontSize: '72px',
                            fontFamily: '"Bangers", "Arial Black", sans-serif',
                            letterSpacing: '2px',
                            textAlign: 'center',
                            margin: 0,
                            textTransform: 'uppercase',
                            lineHeight: '1.1',
                        }}>
                            {texts.outroCta}
                        </h1>
                        <p style={{
                            color: '#94a3b8',
                            fontSize: '24px',
                            fontFamily: '"Inter", sans-serif',
                            margin: '20px 0 0 0',
                            textAlign: 'center',
                            fontWeight: '500',
                        }}>
                            {texts.outroDesc}
                        </p>
                    </div>
                </AbsoluteFill>
            )}

            {/* Main TTS Voiceover */}
            {audioPath && <Audio src={finalAudioUrl} volume={1.0} />}

            {/* Background Music - Continuous handled by Composition if isContinuousAudio is true */}
            {musicPath && !isContinuousAudio && <Audio src={finalMusicUrl} volume={isAnimated ? 0.037 : 0.075} />}

            {/* Sound Effects / Ambience */}
            {sfxPath && !isContinuousAudio && <Audio src={finalSfxUrl} volume={isAnimated ? 0.15 : 0.25} />}

            <Subtitle 
                overlays={overlays} 
                durationInFrames={durationInFrames} 
                teamA={teamA} 
                teamB={teamB} 
                voiceoverText={audioPath ? voiceover : undefined}
                language={language}
            />
        </AbsoluteFill>
    );
};
