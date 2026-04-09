import React from 'react';
import { AbsoluteFill } from 'remotion';

interface Overlay {
    text: string;
    style: 'comic-box' | 'speech-bubble';
}

export const Subtitle: React.FC<{ overlays?: Overlay[] }> = ({ overlays }) => {
    if (!overlays || overlays.length === 0) return null;

    return (
        <AbsoluteFill>
            {overlays.map((overlay, index) => {
                const offset = index * 20;
                const isTopLeft = index === 0;
                
                const positionStyle: React.CSSProperties = isTopLeft 
                    ? { top: `${40 + offset}px`, left: `${40 + offset}px` }
                    : { bottom: `${60 + offset}px`, right: `${60 + offset}px` };

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
                                transform: `rotate(${(index % 2 === 0 ? -1 : 1)}deg)`,
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
