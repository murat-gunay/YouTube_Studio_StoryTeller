import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface Overlay {
    text: string;
    style: 'comic-box' | 'speech-bubble' | 'tactical-card' | 'goal-banner' | 'scoreboard' | 'stats-board';
    startSecond?: number;
    duration?: number;
}

const parseNumericValue = (valStr: string): number => {
    const clean = valStr.replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
};

const parseStats = (text: string) => {
    if (!text) return [];
    const parts = text.split('|');
    return parts.map(part => {
        const colonIndex = part.indexOf(':');
        if (colonIndex === -1) return null;
        const label = part.substring(0, colonIndex).trim();
        const valuesStr = part.substring(colonIndex + 1).trim();

        let dashIndex = valuesStr.indexOf(' - ');
        let dividerLength = 3;
        if (dashIndex === -1) {
            dashIndex = valuesStr.indexOf('-');
            dividerLength = 1;
        }
        if (dashIndex === -1) return null;
        const valAStr = valuesStr.substring(0, dashIndex).trim();
        const valBStr = valuesStr.substring(dashIndex + dividerLength).trim();
        return { label, valAStr, valBStr };
    }).filter((item): item is { label: string, valAStr: string, valBStr: string } => item !== null);
};

interface SpeakerTurn {
    speakerId: 'Speaker 1' | 'Speaker 2';
    speakerName: string;
    text: string;
    words: {
        word: string;
        startFrame: number;
        endFrame: number;
    }[];
    startFrame: number;
    endFrame: number;
}

const getSpeakerName = (speakerId: string, language?: string) => {
    const lang = (language || 'English').toLowerCase();
    if (lang.includes('turkish') || lang.includes('turkce') || lang.includes('tr')) {
        return speakerId === 'Speaker 1' ? 'Mert' : 'Selin';
    }
    if (lang.includes('spanish') || lang.includes('espanol') || lang.includes('es')) {
        return speakerId === 'Speaker 1' ? 'Mateo' : 'Sofía';
    }
    if (lang.includes('portuguese') || lang.includes('portugues') || lang.includes('pt')) {
        return speakerId === 'Speaker 1' ? 'Lucas' : 'Camila';
    }
    return speakerId === 'Speaker 1' ? 'Leo' : 'Sarah';
};

const parseVoiceoverToTiming = (
    voiceoverText: string,
    durationInFrames: number,
    language?: string
): SpeakerTurn[] => {
    if (!voiceoverText) return [];

    const speakerRegex = /(Speaker\s*[12])\s*:/gi;
    const rawTurns: { speakerId: 'Speaker 1' | 'Speaker 2'; rawText: string }[] = [];

    const matches: { speakerId: 'Speaker 1' | 'Speaker 2'; index: number; length: number }[] = [];
    let match;
    while ((match = speakerRegex.exec(voiceoverText)) !== null) {
        const id = match[1].toLowerCase().includes('1') ? 'Speaker 1' : 'Speaker 2';
        matches.push({
            speakerId: id,
            index: match.index,
            length: match[0].length
        });
    }

    if (matches.length === 0) {
        // Fallback: If no speaker tags were found, treat everything as Speaker 1
        const cleanedText = voiceoverText.replace(/\[.*?\]/g, '').trim();
        return [{
            speakerId: 'Speaker 1',
            speakerName: getSpeakerName('Speaker 1', language),
            text: cleanedText,
            words: [],
            startFrame: 0,
            endFrame: durationInFrames
        }];
    }

    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index + matches[i].length;
        const end = (i + 1 < matches.length) ? matches[i + 1].index : voiceoverText.length;
        const rawText = voiceoverText.substring(start, end).trim();
        rawTurns.push({
            speakerId: matches[i].speakerId,
            rawText
        });
    }

    const turns = rawTurns.map(t => {
        const cleanedText = t.rawText.replace(/\[.*?\]/g, '').trim();
        return {
            speakerId: t.speakerId,
            speakerName: getSpeakerName(t.speakerId, language),
            text: cleanedText,
            charCount: cleanedText.length,
        };
    }).filter(t => t.charCount > 0);

    const totalChars = turns.reduce((acc, t) => acc + t.charCount, 0);
    if (totalChars === 0) return [];

    let currentFrame = 0;
    const speakerTurns: SpeakerTurn[] = [];

    for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];
        const turnDuration = Math.round((turn.charCount / totalChars) * durationInFrames);
        const startFrame = currentFrame;
        const endFrame = i === turns.length - 1 ? durationInFrames : startFrame + turnDuration;
        currentFrame = endFrame;

        const rawWords = turn.text.split(/\s+/).filter(w => w.length > 0);
        const wordCharCounts = rawWords.map(w => w.length);
        const turnTotalWordChars = wordCharCounts.reduce((acc, c) => acc + c, 0);

        let wordStart = startFrame;
        const words = rawWords.map((word, wIdx) => {
            const wordChars = wordCharCounts[wIdx];
            const wordDuration = turnTotalWordChars > 0
                ? Math.round((wordChars / turnTotalWordChars) * (endFrame - startFrame))
                : 0;
            const wordEnd = wIdx === rawWords.length - 1 ? endFrame : wordStart + wordDuration;
            const item = {
                word,
                startFrame: wordStart,
                endFrame: wordEnd,
            };
            wordStart = wordEnd;
            return item;
        });

        speakerTurns.push({
            speakerId: turn.speakerId,
            speakerName: turn.speakerName,
            text: turn.text,
            words,
            startFrame,
            endFrame,
        });
    }

    return speakerTurns;
};

interface CaptionChunk {
    speakerId: 'Speaker 1' | 'Speaker 2';
    speakerName: string;
    words: {
        word: string;
        startFrame: number;
        endFrame: number;
    }[];
    startFrame: number;
    endFrame: number;
}

const chunkSpeakerTurns = (turns: SpeakerTurn[]): CaptionChunk[] => {
    const chunks: CaptionChunk[] = [];
    const MAX_WORDS = 6;

    for (const turn of turns) {
        if (turn.words.length === 0) continue;

        let currentWords: typeof turn.words = [];
        for (let i = 0; i < turn.words.length; i++) {
            const wordObj = turn.words[i];
            currentWords.push(wordObj);

            const isSentenceEnd = /[.!?]$/.test(wordObj.word.trim());
            const isMaxWordsReached = currentWords.length >= MAX_WORDS;

            if (isSentenceEnd || isMaxWordsReached || i === turn.words.length - 1) {
                chunks.push({
                    speakerId: turn.speakerId,
                    speakerName: turn.speakerName,
                    words: currentWords,
                    startFrame: currentWords[0].startFrame,
                    endFrame: currentWords[currentWords.length - 1].endFrame,
                });
                currentWords = [];
            }
        }
    }
    return chunks;
};

export const Subtitle: React.FC<{
    overlays?: Overlay[],
    durationInFrames?: number,
    teamA?: string,
    teamB?: string,
    voiceoverText?: string,
    language?: string
}> = ({ overlays, durationInFrames, teamA, teamB, voiceoverText, language }) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    const hasOverlays = overlays && overlays.length > 0;
    const hasVoiceover = !!voiceoverText;
    if (!hasOverlays && !hasVoiceover) return null;

    const totalDuration = durationInFrames ? durationInFrames / fps : 8;

    return (
        <AbsoluteFill>
            {hasOverlays && overlays.map((overlay, index) => {
                if (!overlay.text) return null;

                let startS = typeof overlay.startSecond === 'number' ? overlay.startSecond : 0;
                let durS = typeof overlay.duration === 'number' ? overlay.duration : 5;

                const exceeds = (startS + durS) > totalDuration;
                const isDefaultSequential = (index === 1 && startS >= 5.0) || (index === 2 && startS >= 9.0);
                const isDefaultTiming =
                    (index === 0 && startS === 0.5 && durS === 7.0) ||
                    (index === 1 && startS === 3.0 && durS === 4.5) ||
                    (index === 2 && startS === 5.5 && durS === 2.0) ||
                    (index === 0 && startS === 1.5 && durS === 5.0) ||
                    (index === 1 && startS === 6.0 && durS === 5.0) ||
                    (index === 2 && startS === 10.0 && durS === 5.0) ||
                    (startS === 0 && durS === 5.0);

                if (overlay.style === 'tactical-card' || overlay.style === 'scoreboard') {
                    if (index === 0) {
                        startS = 0.5;
                        durS = Math.min(totalDuration - startS - 0.2, 6.0);
                    } else if (index === 2) {
                        startS = Math.max(0.5, totalDuration * 0.35);
                        durS = Math.min(totalDuration - startS - 0.2, 5.0);
                    }
                } else if (overlay.style === 'stats-board') {
                    startS = 0.5;
                    durS = Math.min(totalDuration - startS - 0.2, 14.0);
                } else if (exceeds || isDefaultSequential || isDefaultTiming) {
                    const count = overlays.length;
                    if (index === 0) {
                        startS = 0.5;
                        durS = Math.min(2.5, totalDuration * 0.35);
                    } else if (index === 1) {
                        startS = totalDuration * 0.35;
                        durS = Math.min(2.5, totalDuration * 0.3);
                    } else if (index === 2) {
                        startS = totalDuration * 0.65;
                        durS = Math.min(2.5, totalDuration - startS - 0.5);
                    } else {
                        const slot = totalDuration / count;
                        startS = slot * index + (slot * 0.1);
                        durS = slot * 0.8;
                    }
                }

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

                // Custom positioning styles based on overlay style rather than index only
                let positionStyle: React.CSSProperties = {};
                if (overlay.style === 'tactical-card') {
                    positionStyle = { bottom: '40px', left: '40px' };
                } else if (overlay.style === 'scoreboard') {
                    positionStyle = { top: '40px', right: '40px' };
                } else if (overlay.style === 'goal-banner') {
                    positionStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
                } else {
                    if (index === 0) {
                        positionStyle = { top: '160px', left: '60px' };
                    } else if (index === 1) {
                        positionStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
                    } else {
                        positionStyle = { bottom: '100px', right: '60px' };
                    }
                }

                const rotation = index % 2 === 0 ? '-1.5deg' : '1.5deg';
                const transformStyle = (index === 1 || overlay.style === 'goal-banner')
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
                                border: '10px solid black',
                                padding: '24px 48px',
                                maxWidth: '85%',
                                boxShadow: '20px 20px 0px rgba(0,0,0,0.25)',
                                transform: transformStyle,
                                transformOrigin: 'center center',
                                zIndex: 10 + index,
                            }}
                        >
                            <span style={{
                                color: 'black',
                                fontSize: '76px',
                                fontFamily: '"Bangers", "Impact", "Arial Black", sans-serif',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                lineHeight: '1.1',
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
                                border: '10px solid black',
                                borderRadius: '80px',
                                padding: '35px 60px',
                                maxWidth: '90%',
                                boxShadow: '20px 20px 0px rgba(0,0,0,0.25)',
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
                                fontSize: '68px',
                                fontFamily: '"Inter", "Impact", sans-serif',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                lineHeight: '1.2',
                            }}>
                                {overlay.text}
                            </span>
                            {/* Speech Bubble Tail - Adapts based on position */}
                            <div style={{
                                position: 'absolute',
                                ...(isTopLeft ? { top: '-50px', left: '100px' } : { bottom: '-50px', right: '100px' }),
                                width: '0',
                                height: '0',
                                borderLeft: '50px solid transparent',
                                borderRight: '50px solid transparent',
                                ...(isTopLeft ? { borderBottom: '50px solid black' } : { borderTop: '50px solid black' }),
                            }} />
                            <div style={{
                                position: 'absolute',
                                ...(isTopLeft ? { top: '-32px', left: '104px' } : { bottom: '-32px', right: '104px' }),
                                width: '0',
                                height: '0',
                                borderLeft: '46px solid transparent',
                                borderRight: '46px solid transparent',
                                ...(isTopLeft ? { borderBottom: '46px solid white' } : { borderTop: '46px solid white' }),
                            }} />
                        </div>
                    );
                }

                if (overlay.style === 'tactical-card') {
                    return (
                        <div
                            key={index}
                            style={{
                                position: 'absolute',
                                ...positionStyle,
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                backdropFilter: 'blur(24px)',
                                border: '12px solid #10b981', // double border glow
                                borderRadius: '60px', // double border radius
                                padding: '60px 80px', // double padding
                                maxWidth: '85%', // wider to prevent unnecessary wrapping with large text
                                boxShadow: '0 50px 100px rgba(16, 185, 129, 0.35)',
                                transform: transformStyle,
                                transformOrigin: 'left bottom',
                                zIndex: 10 + index,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '24px', // double gap
                            }}
                        >
                            <span style={{
                                color: '#34d399',
                                fontSize: '44px', // double font size
                                fontFamily: '"Inter", sans-serif',
                                fontWeight: 850,
                                letterSpacing: '8px', // double letter spacing
                                textTransform: 'uppercase',
                            }}>
                                📊 SIMULATION INSIGHT
                            </span>
                            <span style={{
                                color: 'white',
                                fontSize: '96px', // double font size
                                fontFamily: '"Inter", sans-serif',
                                fontWeight: 900,
                                lineHeight: '1.2',
                            }}>
                                {overlay.text}
                            </span>
                        </div>
                    );
                }

                if (overlay.style === 'goal-banner') {
                    const shake = Math.sin((frame - startFrame) * 0.4) * 4;
                    const lowerText = (overlay.text || '').toLowerCase();
                    const isYellowCard = lowerText.includes('yellow') || lowerText.includes('sarı') || lowerText.includes('sari') || lowerText.includes('amaril') || lowerText.includes('jaune') || lowerText.includes('gelb') || lowerText.includes('amarel');
                    const isRedCard = lowerText.includes('red') || lowerText.includes('kırmızı') || lowerText.includes('kirmizi') || lowerText.includes('roja') || lowerText.includes('rouge') || lowerText.includes('rot') || lowerText.includes('vermelh');

                    const bgColor = isYellowCard ? '#fbbf24' : (isRedCard ? '#ef4444' : '#10b981');
                    const textColor = isYellowCard ? 'black' : 'white';
                    const textShadowStyle = isYellowCard ? '0 0 20px rgba(0,0,0,0.2)' : '0 0 40px rgba(255,255,255,0.7)';

                    return (
                        <div
                            key={index}
                            style={{
                                position: 'absolute',
                                ...positionStyle,
                                transform: `translate(-50%, -50%) scale(${scale * 1.1}) rotate(${shake}deg)`,
                                backgroundColor: bgColor,
                                border: '12px solid black',
                                padding: '35px 80px',
                                boxShadow: '25px 25px 0px rgba(0,0,0,0.3)',
                                transformOrigin: 'center center',
                                zIndex: 10 + index,
                                textAlign: 'center',
                            }}
                        >
                            <h1 style={{
                                color: textColor,
                                fontSize: '120px',
                                fontFamily: '"Bangers", "Impact", "Arial Black", sans-serif',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                lineHeight: '0.9',
                                letterSpacing: '6px',
                                textShadow: textShadowStyle,
                                margin: 0,
                            }}>
                                {overlay.text}
                            </h1>
                        </div>
                    );
                }

                if (overlay.style === 'scoreboard') {
                    return (
                        <div
                            key={index}
                            style={{
                                position: 'absolute',
                                ...positionStyle,
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                backdropFilter: 'blur(24px)',
                                border: '12px solid #ef4444', // double red border
                                borderRadius: '40px', // double border radius
                                padding: '40px 64px', // double padding
                                boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
                                transform: transformStyle,
                                transformOrigin: 'right top',
                                zIndex: 10 + index,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '40px', // double gap
                            }}
                        >
                            <span style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                fontSize: '40px', // double font size
                                fontFamily: '"Inter", sans-serif',
                                fontWeight: 'bold',
                                padding: '12px 28px', // double padding
                                borderRadius: '20px', // double border radius
                                textTransform: 'uppercase',
                            }}>
                                LIVE DATA
                            </span>
                            <span style={{
                                color: 'white',
                                fontSize: '72px', // double font size
                                fontFamily: '"Bangers", "Impact", "Arial Black", sans-serif',
                                fontWeight: 'bold',
                                letterSpacing: '3px', // double letter spacing
                                textTransform: 'uppercase',
                            }}>
                                {overlay.text}
                            </span>
                        </div>
                    );
                }

                if (overlay.style === 'stats-board') {
                    const stats = parseStats(overlay.text);

                    const scoreStat = stats.find(s =>
                        s.label.toLowerCase() === 'score' ||
                        s.label.toLowerCase() === 'skor' ||
                        s.label.toLowerCase() === 'score final' ||
                        s.label.toLowerCase() === 'final score' ||
                        s.label.toLowerCase() === 'resultado' ||
                        s.label.toLowerCase() === 'placar' ||
                        s.label.toLowerCase() === 'ergebnis' ||
                        s.label.toLowerCase() === 'marcador'
                    );

                    const possessionStat = stats.find(s =>
                        s.label.toLowerCase().includes('possession') ||
                        s.label.toLowerCase().includes('topla oynama') ||
                        s.label.toLowerCase().includes('posesión') ||
                        s.label.toLowerCase().includes('posse') ||
                        s.label.toLowerCase().includes('ballbesitz')
                    );

                    const compareStat = stats.find(s =>
                        s.label.toLowerCase() === 'compare' ||
                        s.label.toLowerCase() === 'karşılaştır' ||
                        s.label.toLowerCase() === 'karşilaştir' ||
                        s.label.toLowerCase() === 'karsilastir' ||
                        s.label.toLowerCase() === 'comparar' ||
                        s.label.toLowerCase() === 'comparación' ||
                        s.label.toLowerCase() === 'comparacion' ||
                        s.label.toLowerCase() === 'comparação' ||
                        s.label.toLowerCase() === 'comparacao' ||
                        s.label.toLowerCase() === 'comparer' ||
                        s.label.toLowerCase() === 'vergleich'
                    );

                    const headerA = compareStat ? compareStat.valAStr : (teamA || "TEAM A");
                    const headerB = compareStat ? compareStat.valBStr : (teamB || "TEAM B");

                    const otherStats = stats.filter(s => s !== possessionStat && s !== scoreStat && s !== compareStat);

                    // Spring animation specifically for progress bar & donut chart growth
                    const progressSpring = spring({
                        frame: frame - (startFrame + 15),
                        fps,
                        config: { damping: 18, mass: 0.8, stiffness: 80 }
                    });

                    // Pulse/Breathing glow effects
                    const pulse = Math.sin((frame / fps) * Math.PI * 0.8);
                    const breathingScale = 1.0 + 0.012 * pulse;
                    const breathingGlowBlur = 25 + 15 * pulse;
                    const breathingGlowOpacity = 0.35 + 0.2 * pulse;

                    // Parse possession values
                    let possValA = 50;
                    let possValB = 50;
                    let possValAStr = '50%';
                    let possValBStr = '50%';
                    if (possessionStat) {
                        possValA = parseNumericValue(possessionStat.valAStr);
                        possValB = parseNumericValue(possessionStat.valBStr);
                        possValAStr = possessionStat.valAStr;
                        possValBStr = possessionStat.valBStr;
                    }
                    const totalPoss = possValA + possValB;
                    const targetPossRatioA = totalPoss > 0 ? (possValA / totalPoss) * 100 : 50;
                    const animatedPossRatioA = interpolate(progressSpring, [0, 1], [50, targetPossRatioA]);

                    const scaleFactor = width / 1920;
                    const isPortrait = width < height;
                    const boxWidth = Math.min(1300, Math.round(width * 0.92));
                    const statsTransform = `translate(-50%, -50%) scale(${scale * breathingScale})`;

                    return (
                        <div
                            key={index}
                            style={{
                                position: 'absolute',
                                ...positionStyle,
                                background: 'linear-gradient(135deg, rgba(10, 15, 30, 0.96) 0%, rgba(20, 25, 45, 0.98) 100%)',
                                backdropFilter: 'blur(24px)',
                                border: `2px solid rgba(255, 255, 255, 0.12)`,
                                borderRadius: `${Math.round(24 * scaleFactor)}px`,
                                padding: `${Math.round(40 * scaleFactor)}px ${Math.round(50 * scaleFactor)}px`,
                                width: `${boxWidth}px`,
                                boxShadow: `0 40px 100px rgba(0,0,0,0.85), 0 0 ${breathingGlowBlur}px rgba(16, 185, 129, ${breathingGlowOpacity * 0.5})`,
                                transform: statsTransform,
                                transformOrigin: 'center center',
                                zIndex: 10 + index,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: `${Math.round(24 * scaleFactor)}px`,
                                overflow: 'hidden',
                                fontFamily: '"Inter", sans-serif',
                            }}
                        >
                            {/* Font Loading inside the component to ensure Chrome resolves it */}
                            <style>{`
                                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                            `}</style>

                            {/* Tactical Blueprint Pitch Outline */}
                            <svg
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    opacity: 0.035,
                                    zIndex: -1,
                                    pointerEvents: 'none'
                                }}
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                            >
                                <rect x="4" y="4" width="92" height="92" fill="none" stroke="white" strokeWidth="0.8" />
                                <line x1="50" y1="4" x2="50" y2="96" stroke="white" strokeWidth="0.8" />
                                <circle cx="50" cy="50" r="14" fill="none" stroke="white" strokeWidth="0.8" />
                                <circle cx="50" cy="50" r="0.8" fill="white" />
                                <rect x="4" y="24" width="14" height="52" fill="none" stroke="white" strokeWidth="0.8" />
                                <rect x="4" y="36" width="5" height="28" fill="none" stroke="white" strokeWidth="0.8" />
                                <rect x="82" y="24" width="14" height="52" fill="none" stroke="white" strokeWidth="0.8" />
                                <rect x="91" y="36" width="5" height="28" fill="none" stroke="white" strokeWidth="0.8" />
                                <path d="M 4 8 A 4 4 0 0 0 8 4" fill="none" stroke="white" strokeWidth="0.8" />
                                <path d="M 4 92 A 4 4 0 0 1 8 96" fill="none" stroke="white" strokeWidth="0.8" />
                                <path d="M 96 8 A 4 4 0 0 1 92 4" fill="none" stroke="white" strokeWidth="0.8" />
                                <path d="M 96 92 A 4 4 0 0 0 92 96" fill="none" stroke="white" strokeWidth="0.8" />
                            </svg>

                            {/* Header Section */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                paddingBottom: `${Math.round(20 * scaleFactor)}px`,
                                width: '100%',
                                zIndex: 1,
                            }}>
                                <span style={{
                                    color: 'white',
                                    fontSize: `${Math.round(34 * scaleFactor)}px`,
                                    fontFamily: '"Inter", sans-serif',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    textAlign: 'left',
                                    maxWidth: '42%',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    letterSpacing: '0.5px'
                                }}>{headerA}</span>

                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: `${Math.round(6 * scaleFactor)}px`,
                                }}>
                                    <span style={{
                                        color: '#10b981',
                                        fontSize: `${Math.round(14 * scaleFactor)}px`,
                                        fontFamily: '"Inter", sans-serif',
                                        fontWeight: 900,
                                        letterSpacing: `${Math.round(2 * scaleFactor)}px`,
                                        textTransform: 'uppercase',
                                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                        border: '1px solid rgba(16, 185, 129, 0.25)',
                                        padding: `${Math.round(4 * scaleFactor)}px ${Math.round(14 * scaleFactor)}px`,
                                        borderRadius: '12px',
                                        boxShadow: '0 0 10px rgba(16, 185, 129, 0.1)',
                                    }}>VS</span>

                                    {scoreStat && (
                                        <span style={{
                                            color: '#fbbf24',
                                            fontSize: `${Math.round(40 * scaleFactor)}px`,
                                            fontFamily: '"Inter", sans-serif',
                                            fontWeight: 900,
                                            letterSpacing: '1px',
                                            padding: `${Math.round(2 * scaleFactor)}px ${Math.round(20 * scaleFactor)}px`,
                                            backgroundColor: 'rgba(251, 191, 36, 0.05)',
                                            border: '1px solid rgba(251, 191, 36, 0.2)',
                                            borderRadius: `${Math.round(10 * scaleFactor)}px`,
                                            boxShadow: '0 0 12px rgba(251, 191, 36, 0.15)',
                                        }}>
                                            {scoreStat.valAStr.trim()} - {scoreStat.valBStr.trim()}
                                        </span>
                                    )}
                                </div>

                                <span style={{
                                    color: 'white',
                                    fontSize: `${Math.round(34 * scaleFactor)}px`,
                                    fontFamily: '"Inter", sans-serif',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    textAlign: 'right',
                                    maxWidth: '42%',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    letterSpacing: '0.5px'
                                }}>{headerB}</span>
                            </div>

                            {/* Main Statistics Content Grid */}
                            <div style={{
                                display: 'flex',
                                flexDirection: isPortrait ? 'column' : 'row',
                                alignItems: 'stretch',
                                justifyContent: 'space-between',
                                gap: `${Math.round(30 * scaleFactor)}px`,
                                width: '100%',
                                zIndex: 1,
                            }}>
                                {/* Other Stats Column */}
                                <div style={{
                                    flex: 1,
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: `${Math.round(18 * scaleFactor)}px`,
                                }}>
                                    {otherStats.map((stat, sIdx) => {
                                        const sValA = parseNumericValue(stat.valAStr);
                                        const sValB = parseNumericValue(stat.valBStr);
                                        const sTotal = sValA + sValB;
                                        
                                        const isNonNumericLabel = (label: string): boolean => {
                                            const clean = label.toLowerCase().trim();
                                            return (
                                                clean.includes('formation') ||
                                                clean.includes('formasyon') ||
                                                clean.includes('formación') ||
                                                clean.includes('formação') ||
                                                clean.includes('position') ||
                                                clean.includes('pozisyon') ||
                                                clean.includes('posición') ||
                                                clean.includes('posição') ||
                                                clean.includes('style') ||
                                                clean.includes('tarz') ||
                                                clean.includes('estilo') ||
                                                clean.includes('compare') ||
                                                clean.includes('karşılaştır') ||
                                                clean.includes('comparar') ||
                                                clean.includes('comparer') ||
                                                clean.includes('vergleich')
                                            );
                                        };

                                        const getUnavailableDescription = (label: string, lang?: string): string => {
                                            const clean = label.toLowerCase();
                                            const isPlayStyle = clean.includes('style') || clean.includes('tarz') || clean.includes('estilo');
                                            const isPerformance = clean.includes('performance') || clean.includes('performans') || clean.includes('rendimiento') || clean.includes('desempenho') || clean.includes('leistung');
                                            
                                            const lowerLang = (lang || 'english').toLowerCase();
                                            
                                            if (lowerLang.includes('turkish') || lowerLang.includes('turkce') || lowerLang.includes('tr')) {
                                                if (isPlayStyle) return 'Oyun tarzı bilgisi mevcut değil';
                                                if (isPerformance) return 'Oyuncu performans analizi mevcut değil';
                                                return 'Veri mevcut değil';
                                            }
                                            if (lowerLang.includes('spanish') || lowerLang.includes('espanol') || lowerLang.includes('es')) {
                                                if (isPlayStyle) return 'Información de estilo de juego no disponible';
                                                if (isPerformance) return 'Análisis de rendimiento no disponible';
                                                return 'Dato no disponible';
                                            }
                                            if (lowerLang.includes('portuguese') || lowerLang.includes('portugues') || lowerLang.includes('pt')) {
                                                if (isPlayStyle) return 'Estilo de jogo não disponível';
                                                if (isPerformance) return 'Análise de desempenho não disponível';
                                                return 'Dados não disponíveis';
                                            }
                                            if (lowerLang.includes('french') || lowerLang.includes('français') || lowerLang.includes('fr')) {
                                                if (isPlayStyle) return 'Style de jeu non disponible';
                                                if (isPerformance) return 'Analyse de performance non disponible';
                                                return 'Données non disponibles';
                                            }
                                            if (lowerLang.includes('german') || lowerLang.includes('deutsch') || lowerLang.includes('de')) {
                                                if (isPlayStyle) return 'Spielstil nicht verfügbar';
                                                if (isPerformance) return 'Leistungsanalyse nicht verfügbar';
                                                return 'Keine Daten verfügbar';
                                            }
                                            
                                            if (isPlayStyle) return 'Play style details not available';
                                            if (isPerformance) return 'Player performance analysis not available';
                                            return 'Data not available';
                                        };

                                        const formatShortValue = (valStr: string) => {
                                            const clean = valStr.trim();
                                            if (clean.toUpperCase() === 'N/A' || clean.toUpperCase() === 'NA' || clean === '') {
                                                return <span style={{ color: 'rgba(255, 255, 255, 0.25)', fontWeight: 500 }}>—</span>;
                                            }
                                            return valStr;
                                        };

                                        const isValANa = stat.valAStr.trim().toUpperCase() === 'N/A' || stat.valAStr.trim().toUpperCase() === 'NA' || stat.valAStr.trim() === '';
                                        const isValBNa = stat.valBStr.trim().toUpperCase() === 'N/A' || stat.valBStr.trim().toUpperCase() === 'NA' || stat.valBStr.trim() === '';

                                        const isValANumeric = !isNaN(parseFloat(stat.valAStr.replace(/[^0-9.]/g, ''))) && !stat.valAStr.includes('-') && !isValANa;
                                        const isValBNumeric = !isNaN(parseFloat(stat.valBStr.replace(/[^0-9.]/g, ''))) && !stat.valBStr.includes('-') && !isValBNa;
                                        const isNumeric = isValANumeric && isValBNumeric && !isNonNumericLabel(stat.label);

                                        const sRatioA = sTotal > 0 ? (sValA / sTotal) * 100 : 50;
                                        const sRatioB = sTotal > 0 ? (sValB / sTotal) * 100 : 50;

                                        // Staggered Spring Animation for this row
                                        const rowSpring = spring({
                                            frame: frame - (startFrame + 15 + sIdx * 5),
                                            fps,
                                            config: { damping: 16, mass: 0.7, stiffness: 90 }
                                        });

                                        const rowOpacity = interpolate(rowSpring, [0, 1], [0, 1]);
                                        const rowTranslateY = interpolate(rowSpring, [0, 1], [15, 0]);

                                        const animatedSRatioA = interpolate(rowSpring, [0, 1], [0, sRatioA]);
                                        const animatedSRatioB = interpolate(rowSpring, [0, 1], [0, sRatioB]);

                                        // Determine if it's a long description text row
                                        const isLongText =
                                            stat.label.toLowerCase() === 'performance' ||
                                            stat.label.toLowerCase() === 'performans' ||
                                            stat.label.toLowerCase() === 'leistung' ||
                                            stat.label.toLowerCase() === 'rendimiento' ||
                                            stat.label.toLowerCase() === 'desempenho' ||
                                            stat.label.toLowerCase() === 'style' ||
                                            stat.label.toLowerCase() === 'oyun tarzı' ||
                                            stat.label.toLowerCase() === 'spielstil' ||
                                            stat.label.toLowerCase() === 'estilo de juego' ||
                                            stat.label.toLowerCase() === 'estilo de jogo' ||
                                            (stat.valAStr.includes(' ') && stat.valAStr.length > 24);

                                        if (isLongText) {
                                            return (
                                                <div
                                                    key={sIdx}
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: `${Math.round(10 * scaleFactor)}px`,
                                                        width: '100%',
                                                        opacity: rowOpacity,
                                                        transform: `translateY(${rowTranslateY}px)`,
                                                        marginTop: `${Math.round(12 * scaleFactor)}px`,
                                                    }}
                                                >
                                                    {/* Centered Category Subtitle */}
                                                    <div style={{
                                                        textAlign: 'center',
                                                        color: '#10b981',
                                                        fontSize: `${Math.round(14 * scaleFactor)}px`,
                                                        fontFamily: '"Inter", sans-serif',
                                                        fontWeight: 900,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '2px',
                                                        borderBottom: '1px solid rgba(16, 185, 129, 0.15)',
                                                        paddingBottom: `${Math.round(6 * scaleFactor)}px`,
                                                        width: '100%',
                                                        alignSelf: 'center',
                                                    }}>
                                                        {stat.label}
                                                    </div>

                                                    {/* Symmetrical Two-Column Card Design */}
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        width: '100%',
                                                        gap: `${Math.round(20 * scaleFactor)}px`,
                                                    }}>
                                                        {/* Team A description card */}
                                                        <div style={{
                                                            width: '49%',
                                                            background: 'rgba(255, 255, 255, 0.02)',
                                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                                            borderRadius: `${Math.round(12 * scaleFactor)}px`,
                                                            padding: `${Math.round(18 * scaleFactor)}px ${Math.round(20 * scaleFactor)}px`,
                                                            color: isValANa ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
                                                            fontSize: `${Math.round(16 * scaleFactor)}px`,
                                                            lineHeight: '1.6',
                                                            fontFamily: '"Inter", sans-serif',
                                                            textAlign: 'left',
                                                            boxShadow: 'inset 0 0 12px rgba(255, 255, 255, 0.01)',
                                                            fontStyle: isValANa ? 'italic' : 'normal',
                                                        }}>
                                                            {isValANa ? getUnavailableDescription(stat.label, language) : stat.valAStr}
                                                        </div>

                                                        {/* Team B description card */}
                                                        <div style={{
                                                            width: '49%',
                                                            background: 'rgba(255, 255, 255, 0.02)',
                                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                                            borderRadius: `${Math.round(12 * scaleFactor)}px`,
                                                            padding: `${Math.round(18 * scaleFactor)}px ${Math.round(20 * scaleFactor)}px`,
                                                            color: isValBNa ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
                                                            fontSize: `${Math.round(16 * scaleFactor)}px`,
                                                            lineHeight: '1.6',
                                                            fontFamily: '"Inter", sans-serif',
                                                            textAlign: 'left',
                                                            boxShadow: 'inset 0 0 12px rgba(255, 255, 255, 0.01)',
                                                            fontStyle: isValBNa ? 'italic' : 'normal',
                                                        }}>
                                                            {isValBNa ? getUnavailableDescription(stat.label, language) : stat.valBStr}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // Standard short/numeric row
                                        return (
                                            <div
                                                key={sIdx}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: `${Math.round(6 * scaleFactor)}px`,
                                                    width: '100%',
                                                    opacity: rowOpacity,
                                                    transform: `translateY(${rowTranslateY}px)`,
                                                }}
                                            >
                                                {/* Values and center label */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    width: '100%',
                                                }}>
                                                    {/* Team A value */}
                                                    <div style={{
                                                        width: '38%',
                                                        textAlign: 'right',
                                                        color: '#f8fafc',
                                                        fontWeight: 800,
                                                        fontSize: isNumeric ? `${Math.round(30 * scaleFactor)}px` : `${Math.round(22 * scaleFactor)}px`,
                                                        fontFamily: '"Inter", sans-serif',
                                                        wordBreak: 'break-word',
                                                        whiteSpace: 'normal',
                                                    }}>{formatShortValue(stat.valAStr)}</div>

                                                    {/* Stat Label */}
                                                    <div style={{
                                                        width: '24%',
                                                        textAlign: 'center',
                                                        color: '#94a3b8',
                                                        fontSize: `${Math.round(13 * scaleFactor)}px`,
                                                        fontFamily: '"Inter", sans-serif',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '1.5px',
                                                        wordBreak: 'break-word',
                                                        whiteSpace: 'normal',
                                                    }}>{stat.label}</div>

                                                    {/* Team B value */}
                                                    <div style={{
                                                        width: '38%',
                                                        textAlign: 'left',
                                                        color: '#f8fafc',
                                                        fontWeight: 800,
                                                        fontSize: isNumeric ? `${Math.round(30 * scaleFactor)}px` : `${Math.round(22 * scaleFactor)}px`,
                                                        fontFamily: '"Inter", sans-serif',
                                                        wordBreak: 'break-word',
                                                        whiteSpace: 'normal',
                                                    }}>{formatShortValue(stat.valBStr)}</div>
                                                </div>

                                                {/* Comparison Balance Bar */}
                                                {isNumeric && sTotal > 0 && (
                                                    <div style={{
                                                        display: 'flex',
                                                        width: '100%',
                                                        height: `${Math.round(6 * scaleFactor)}px`,
                                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                        borderRadius: '3px',
                                                        overflow: 'hidden',
                                                        marginTop: `${Math.round(2 * scaleFactor)}px`,
                                                    }}>
                                                        {/* Left Bar (Cyan/Teal) */}
                                                        <div style={{
                                                            width: '50%',
                                                            height: '100%',
                                                            display: 'flex',
                                                            justifyContent: 'flex-end',
                                                        }}>
                                                            <div style={{
                                                                width: `${animatedSRatioA}%`,
                                                                height: '100%',
                                                                backgroundColor: '#10b981',
                                                            }} />
                                                        </div>

                                                        {/* Center Gap divider */}
                                                        <div style={{ width: '2px', backgroundColor: 'rgba(10,15,30,0.8)', height: '100%' }} />

                                                        {/* Right Bar (Coral Red) */}
                                                        <div style={{
                                                            width: '50%',
                                                            height: '100%',
                                                            display: 'flex',
                                                            justifyContent: 'flex-start',
                                                        }}>
                                                            <div style={{
                                                                width: `${animatedSRatioB}%`,
                                                                height: '100%',
                                                                backgroundColor: '#ef4444',
                                                            }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Possession Donut Chart Column */}
                                {possessionStat && (
                                    <div style={{
                                        width: isPortrait ? '100%' : `${Math.round(340 * scaleFactor)}px`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: `${Math.round(20 * scaleFactor)}px`,
                                        borderLeft: isPortrait ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
                                        borderTop: isPortrait ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                                        paddingLeft: isPortrait ? '0' : `${Math.round(30 * scaleFactor)}px`,
                                        paddingTop: isPortrait ? `${Math.round(20 * scaleFactor)}px` : '0',
                                    }}>
                                        {/* Donut Chart Inner/Outer */}
                                        <div style={{
                                            position: 'relative',
                                            width: `${Math.round(210 * scaleFactor)}px`,
                                            height: `${Math.round(210 * scaleFactor)}px`,
                                            borderRadius: '50%',
                                            background: `conic-gradient(#10b981 0% ${animatedPossRatioA}%, #ef4444 ${animatedPossRatioA}% 100%)`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 10px 32px rgba(0,0,0,0.4)',
                                        }}>
                                            {/* Donut hole */}
                                            <div style={{
                                                width: `${Math.round(152 * scaleFactor)}px`,
                                                height: `${Math.round(152 * scaleFactor)}px`,
                                                borderRadius: '50%',
                                                backgroundColor: '#0f172a',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <span style={{
                                                    color: '#94a3b8',
                                                    fontSize: `${Math.round(12 * scaleFactor)}px`,
                                                    fontWeight: 'bold',
                                                    fontFamily: '"Inter", sans-serif',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '1px',
                                                }}>{possessionStat.label.toUpperCase()}</span>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'baseline',
                                                    gap: `${Math.round(4 * scaleFactor)}px`,
                                                    marginTop: `${Math.round(6 * scaleFactor)}px`,
                                                }}>
                                                    <span style={{
                                                        color: '#10b981',
                                                        fontSize: `${Math.round(26 * scaleFactor)}px`,
                                                        fontFamily: '"Inter", sans-serif',
                                                        fontWeight: 900,
                                                    }}>{possValAStr}</span>
                                                    <span style={{
                                                        color: '#475569',
                                                        fontSize: `${Math.round(16 * scaleFactor)}px`,
                                                        fontWeight: 'bold',
                                                    }}>/</span>
                                                    <span style={{
                                                        color: '#ef4444',
                                                        fontSize: `${Math.round(26 * scaleFactor)}px`,
                                                        fontFamily: '"Inter", sans-serif',
                                                        fontWeight: 900,
                                                    }}>{possValBStr}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Legends */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            gap: `${Math.round(20 * scaleFactor)}px`,
                                            width: '100%',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: `${Math.round(6 * scaleFactor)}px` }}>
                                                <span style={{
                                                    width: `${Math.round(10 * scaleFactor)}px`,
                                                    height: `${Math.round(10 * scaleFactor)}px`,
                                                    backgroundColor: '#10b981',
                                                    borderRadius: '50%',
                                                }} />
                                                <span style={{
                                                    color: '#cbd5e1',
                                                    fontSize: `${Math.round(13 * scaleFactor)}px`,
                                                    fontFamily: '"Inter", sans-serif',
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase',
                                                    maxWidth: `${Math.round(100 * scaleFactor)}px`,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}>{teamA || "TEAM A"}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: `${Math.round(6 * scaleFactor)}px` }}>
                                                <span style={{
                                                    width: `${Math.round(10 * scaleFactor)}px`,
                                                    height: `${Math.round(10 * scaleFactor)}px`,
                                                    backgroundColor: '#ef4444',
                                                    borderRadius: '50%',
                                                }} />
                                                <span style={{
                                                    color: '#cbd5e1',
                                                    fontSize: `${Math.round(13 * scaleFactor)}px`,
                                                    fontFamily: '"Inter", sans-serif',
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase',
                                                    maxWidth: `${Math.round(100 * scaleFactor)}px`,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}>{teamB || "TEAM B"}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }

                return null;
            })}

            {/* Karaoke Voiceover Subtitle Track */}
            {(() => {
                if (!voiceoverText || !durationInFrames) return null;
                const speakerTurns = parseVoiceoverToTiming(voiceoverText, durationInFrames, language);
                const captionChunks = chunkSpeakerTurns(speakerTurns);
                const activeChunk = captionChunks.find(c => frame >= c.startFrame && frame < c.endFrame);
                if (!activeChunk) return null;

                const badgeColor = activeChunk.speakerId === 'Speaker 1'
                    ? 'linear-gradient(90deg, #3b82f6, #4f46e5)'
                    : 'linear-gradient(90deg, #f43f5e, #e11d48)';

                const activeWordColor = activeChunk.speakerId === 'Speaker 1'
                    ? '#fbbf24' // Yellow/Amber for Speaker 1
                    : '#ff4b72'; // Rose/Pink for Speaker 2

                return (
                    <div style={{
                        position: 'absolute',
                        bottom: '50px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 150,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        maxWidth: '95%',
                        width: 'auto',
                        justifyContent: 'center',
                        textAlign: 'center',
                        pointerEvents: 'none',
                    }}>
                        <div style={{
                            background: badgeColor,
                            color: 'white',
                            fontSize: '22px',
                            fontWeight: '900',
                            fontFamily: '"Inter", sans-serif',
                            padding: '4px 14px',
                            borderRadius: '20px',
                            textTransform: 'uppercase',
                            letterSpacing: '1.5px',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                            whiteSpace: 'nowrap',
                        }}>
                            {activeChunk.speakerName}
                        </div>
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px 12px',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            {activeChunk.words.map((wordObj, wIdx) => {
                                const isActive = frame >= wordObj.startFrame && frame < wordObj.endFrame;
                                const wordFrame = frame - wordObj.startFrame;
                                const springScale = spring({
                                    frame: wordFrame,
                                    fps,
                                    config: { damping: 10, mass: 0.2, stiffness: 150 },
                                });
                                const wordScale = isActive
                                    ? interpolate(springScale, [0, 1], [1.0, 1.15])
                                    : 1.0;

                                return (
                                    <span
                                        key={`word-${wIdx}`}
                                        style={{
                                            color: isActive ? activeWordColor : '#ffffff',
                                            fontSize: '40px',
                                            fontWeight: isActive ? '900' : '700',
                                            fontFamily: '"Inter", sans-serif',
                                            transform: `scale(${wordScale})`,
                                            textShadow: isActive
                                                ? `0 2px 4px rgba(0,0,0,0.9), 0 0 12px ${activeWordColor}80, 0 0 4px rgba(0,0,0,0.9)`
                                                : '0 2px 4px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.9)',
                                            transition: 'color 0.1s ease, transform 0.1s ease',
                                            display: 'inline-block',
                                        }}
                                    >
                                        {wordObj.word}
                                    </span>
                                );
                            })}
                        </div>

                    </div>
                );
            })()}
        </AbsoluteFill>
    );
};
