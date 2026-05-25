import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface Overlay {
    text: string;
    style: 'comic-box' | 'speech-bubble';
    startSecond?: number;
    duration?: number;
}

export const Subtitle: React.FC<{ overlays?: Overlay[] }> = ({ overlays }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    if (!overlays || overlays.length === 0) return null;

    return (
        <AbsoluteFill>
            {overlays.map((overlay, index) => {
                if (!overlay.text) return null;

                const startS = overlay.startSecond || 0;
                const durS = overlay.duration || 5;

                const startFrame = startS * fps;
                const endFrame = (startS + durS) * fps;

                // Scale Intro
                const scaleIn = spring({
                    frame: frame - startFrame,
                    fps,
                    config: { damping: 12, mass: 0.5, stiffness: 100 }
                });

                // Scale Outro
                const scaleOut = spring({
                    frame: frame - endFrame,
                    fps,
                    config: { damping: 12, mass: 0.5, stiffness: 100 }
                });

                // If before start frame, hide it entirely
                if (frame < startFrame) return null;

                const scale = frame < endFrame ? scaleIn : interpolate(scaleOut, [0, 1], [1, 0]);
                if (scale <= 0) return null;

                let positionStyle: React.CSSProperties = {};
                if (index === 0) {
                    positionStyle = { top: '40px', left: '40px' };
                } else if (index === 1) {
                    positionStyle = { bottom: '60px', right: '60px' };
                } else {
                    positionStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
                }
                
                const rotation = index % 2 === 0 ? '-1deg' : '1deg';
                const transformStyle = index === 2 
                    ? `translate(-50%, -50%) scale(${scale}) rotate(${rotation})` 
                    : `scale(${scale}) rotate(${rotation})`;

                if (overlay.style === 'comic-box') {
                    return (
                        <div
                            key={index}
                            style={{
                                position: 'absolute',
                                ...positionStyle,
                                backgroundColor: '#FEF9C3', // Light yellow
                                border: '4px solid black',
                                padding: '10px 20px',
                                maxWidth: '40%',
                                boxShadow: '8px 8px 0px rgba(0,0,0,0.2)',
                                transform: transformStyle,
                                transformOrigin: 'center center',
                                zIndex: 10 + index,
                            }}
                        >
                            <span style={{
                                color: 'black',
                                fontSize: '32px',
                                fontFamily: '"Bangers", "Arial Black", sans-serif',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                lineHeight: '1.2',
                            }}>
                                {overlay.text}
                            </span>
                        </div>
                    );
                }

                if (overlay.style === 'speech-bubble') {
                    const isTopLeft = index === 0;
                    return (
                        <div
                            key={index}
                            style={{
                                position: 'absolute',
                                ...positionStyle,
                                backgroundColor: 'white',
                                border: '4px solid black',
                                borderRadius: '30px',
                                padding: '15px 25px',
                                maxWidth: '45%',
                                boxShadow: '8px 8px 0px rgba(0,0,0,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transform: transformStyle,
                                transformOrigin: 'center center',
                                zIndex: 10 + index,
                            }}
                        >
                            <span style={{
                                color: 'black',
                                fontSize: '28px',
                                fontFamily: '"Inter", sans-serif',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                lineHeight: '1.3',
                            }}>
                                {overlay.text}
                            </span>
                            {/* Speech Bubble Tail - Adapts based on position */}
                            <div style={{
                                position: 'absolute',
                                ...(isTopLeft ? { top: '-20px', left: '40px' } : { bottom: '-20px', right: '40px' }),
                                width: '0',
                                height: '0',
                                borderLeft: '20px solid transparent',
                                borderRight: '20px solid transparent',
                                ...(isTopLeft ? { borderBottom: '20px solid black' } : { borderTop: '20px solid black' }),
                            }} />
                            <div style={{
                                position: 'absolute',
                                ...(isTopLeft ? { top: '-12px', left: '42px' } : { bottom: '-12px', right: '42px' }),
                                width: '0',
                                height: '0',
                                borderLeft: '18px solid transparent',
                                borderRight: '18px solid transparent',
                                ...(isTopLeft ? { borderBottom: '18px solid white' } : { borderTop: '18px solid white' }),
                            }} />
                        </div>
                    );
                }

                return null;
            })}
        </AbsoluteFill>
    );
};
