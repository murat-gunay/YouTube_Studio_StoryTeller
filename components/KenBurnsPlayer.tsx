
import React, { useEffect, useState, useRef } from 'react';
import { Overlay, AnimationConfigEntry } from '../types';
import { ANIMATION_GROUPS } from '../constants';

interface KenBurnsProps {
  imageUrl: string;
  imageUrlEnd?: string; // New: Frame to transition to after video
  durationMinutes?: number;
  animationStyle?: string; // Legacy
  animationStyles?: string[]; // New multi-layer
  animationConfig?: Record<string, AnimationConfigEntry>;
  overlays?: Overlay[];
  caption?: string;
  videoUrl?: string; // New: Short video from Veo 3.1
  videoPlacement?: 'start' | 'end'; // New: Control when video plays
  videoOptions?: { duration: number }; // Pass video options for accurate timing
  currentTime?: number; // Current playback time from parent
  actualDuration?: number; // The real duration of the scene (TTS length)
  onVideoEnded?: () => void; // Callback when video finishes
  isCleanMode?: boolean;
  isLargePlayer?: boolean;
  isPlaying?: boolean;
  isMuted?: boolean;
  onToggleMute?: (muted: boolean) => void;
}

export const KenBurnsPlayer: React.FC<KenBurnsProps> = ({
  imageUrl,
  imageUrlEnd,
  animationStyle,
  animationStyles,
  animationConfig = {},
  overlays = [],
  caption,
  videoUrl,
  videoPlacement,
  videoOptions,
  currentTime,
  actualDuration,
  onVideoEnded,
  durationMinutes,
  isCleanMode = false,
  isLargePlayer = false,
  isPlaying = true,
  isMuted: isMutedProp = false,
}) => {

  // State to track if we are currently playing the video
  const [showVideo, setShowVideo] = useState(false);
  const [shouldPlayVideo, setShouldPlayVideo] = useState(false);

  // Sync video state based on placement and progress
  useEffect(() => {
    if (!videoUrl || !isPlaying) {
      // If we are paused or no video, we don't necessarily want to HIDE the video if it's already showing
      // but we should definitely stop it from playing if it was pending.
      if (!isPlaying) setShouldPlayVideo(false);
      return;
    }

    if (!videoPlacement || videoPlacement === 'start') {
      setShowVideo(true);
      setShouldPlayVideo(true);
    } else {
      // placement === 'end'
      // Trigger when currentTime reaches the "end zone"
      const videoDur = videoOptions?.duration || 6;
      const sceneDur = actualDuration || (durationMinutes || 0.16) * 60;
      const startTime = Math.max(0, sceneDur - videoDur);

      // Only trigger if we have a valid progress and reach the point
      if (currentTime !== undefined && currentTime >= startTime) {
        if (!showVideo) {
          console.log(`Video Triggered (End): Current=${currentTime.toFixed(2)}s, StartTarget=${startTime.toFixed(2)}s`);
          setShowVideo(true);
          setShouldPlayVideo(true);
        }
      } else if (currentTime === undefined) {

        // Fallback for when currentTime isn't synced (e.g. single scene preview without track)
        const delay = startTime * 1000;
        const id = window.setTimeout(() => {
          setShowVideo(true);
          setShouldPlayVideo(true);
        }, delay);
        timersRef.current.push(id);
      }
    }
  }, [videoUrl, videoPlacement, isPlaying, currentTime, actualDuration, videoOptions?.duration]);

  useEffect(() => {
    // Reset video state if videoUrl changes
    if (!videoUrl) {
      setShowVideo(false);
      setShouldPlayVideo(false);
    }
  }, [videoUrl]);


  // Normalize input: Prefer animationStyles array, fallback to legacy string
  const activeStyles = animationStyles || (animationStyle ? [animationStyle] : ['animate-kb-zoom-in']);

  // Use imageUrlEnd if provided and video has finished, otherwise fallback to imageUrl
  const currentImageUrl = (showVideo === false && imageUrlEnd) ? imageUrlEnd : imageUrl;

  // Separate styles into layers
  const movementAnimations = new Set(ANIMATION_GROUPS.find(g => g.type === 'movement')?.options.map(o => o.value));

  // Movement is always layer 1
  const movementClass = activeStyles.filter(s => movementAnimations.has(s)).pop() || 'animate-kb-zoom-in';

  // Effects are layer 2+
  const allFxClasses = activeStyles.filter(s => !movementAnimations.has(s));

  // State to track which effects are currently active based on timing
  const [activeFx, setActiveFx] = useState<Set<string>>(new Set());

  // Refs for timers
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    // Clear existing timers
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    setActiveFx(new Set()); // Reset

    if (!isPlaying) return;

    const newActiveFx = new Set<string>();

    allFxClasses.forEach(fx => {
      const config = animationConfig[fx] || { start: 0, duration: 100 }; // Default: start 0, long duration

      // If start is 0, add immediately
      if (config.start === 0) {
        newActiveFx.add(fx);
        // Schedule removal
        if (config.duration < 100) {
          const id = window.setTimeout(() => {
            setActiveFx(prev => {
              const next = new Set(prev);
              next.delete(fx);
              return next;
            });
          }, config.duration * 1000);
          timersRef.current.push(id);
        }
      } else {
        // Schedule start
        const startId = window.setTimeout(() => {
          setActiveFx(prev => {
            const next = new Set(prev);
            next.add(fx);
            return next;
          });

          // Schedule removal relative to start
          if (config.duration < 100) {
            const endId = window.setTimeout(() => {
              setActiveFx(prev => {
                const next = new Set(prev);
                next.delete(fx);
                return next;
              });
            }, config.duration * 1000);
            timersRef.current.push(endId);
          }
        }, config.start * 1000);
        timersRef.current.push(startId);
      }
    });

    // Set initial state
    setActiveFx(newActiveFx);

    return () => {
      timersRef.current.forEach(window.clearTimeout);
    };
  }, [isPlaying, allFxClasses.join(','), animationConfig]);
  // Dependency note: stringifying the array ensures deep comparison for the list of styles

  // Merge legacy caption into overlays
  const activeOverlays = overlays.length > 0 ? overlays : (caption ? [{ text: caption, style: 'comic-box' } as Overlay] : []);

  const getPositionClass = (index: number) => {
    if (index === 0) return isLargePlayer ? "top-6 left-6 md:top-8 md:left-8" : "top-4 left-4";
    return isLargePlayer ? "bottom-6 right-6 md:bottom-8 md:right-8" : "bottom-4 right-4";
  };

  const getBoxClasses = () => ({
    container: isLargePlayer
      ? "px-6 py-4 border-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
      : "px-3 py-2 border-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]",
    text: isLargePlayer
      ? "text-xl md:text-2xl lg:text-3xl leading-tight"
      : "text-xs md:text-sm leading-snug",
    bubbleContainer: isLargePlayer
      ? "px-6 py-4 rounded-[2.5rem] border-4"
      : "px-4 py-2 rounded-[1.5rem] border-2",
    tail: isLargePlayer
      ? "w-8 h-8 -bottom-4 right-10 border-r-4 border-b-4"
      : "w-4 h-4 -bottom-2.5 right-6 border-r-2 border-b-2"
  });

  const styles = getBoxClasses();

  const renderComicBox = (text: string, index: number) => (
    <div key={index} className={`absolute ${getPositionClass(index)} z-20 max-w-[85%] md:max-w-[60%] animate-fade-in`}>
      <div className={`bg-[#fdfcdc] border-black ${styles.container} transform rotate-[-1deg]`}>
        <p className={`font-sans font-bold text-black uppercase tracking-wide ${styles.text}`}>
          {text}
        </p>
      </div>
    </div>
  );

  const renderSpeechBubble = (text: string, index: number) => (
    <div key={index} className={`absolute ${getPositionClass(index)} z-20 max-w-[85%] md:max-w-[60%] animate-fade-in`}>
      <div className={`relative bg-white text-black border-black shadow-lg ${styles.bubbleContainer}`}>
        <p className={`font-comic font-medium text-black text-center ${styles.text}`}>
          {text}
        </p>
        <div className={`absolute bg-white border-black transform rotate-45 ${styles.tail}`}></div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full overflow-hidden relative bg-black group select-none animate-scene-fade">
      {/* Layer 0: Short Video (Veo 3.1) */}
      {showVideo && videoUrl && shouldPlayVideo && (
        <video
          src={videoUrl}
          autoPlay
          preload="auto"
          muted={isMutedProp} // Controlled by parent checkbox
          onEnded={() => {
            setShowVideo(false);
            setShouldPlayVideo(false);
            onVideoEnded?.();
          }}
          onError={() => {
            setShowVideo(false);
            setShouldPlayVideo(false);
            onVideoEnded?.(); // Fail gracefully
          }}
          className="absolute inset-0 w-full h-full object-cover z-30"
          style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
        />
      )}

      {/* Layer 1: Base Movement (Pan/Zoom) - Applies to container */}
      <div
        className={`w-full h-full ${movementClass}`}
        style={{
          animationDuration: '24s',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
          animationDirection: 'alternate',
          animationPlayState: isPlaying ? 'running' : 'paused'
        }}
      >
        {/* Layer 2+: Effects - Nested Divs approach */}
        {/* We create a nest for every selected FX, but only apply the class if it's active */}
        {/* To handle N effects, we recursively wrap? No, just loop.
              However, react loops usually produce siblings. Effects need nesting to combine transforms correctly (e.g. Shake AND Tilt).
              We can reduce the list of ALL selected effects into a nested structure.
          */}

        {allFxClasses.reduce((content, fxClass) => {
          // Only apply the class if it is currently active according to timing
          const isActive = activeFx.has(fxClass);
          return (
            <div className={`w-full h-full ${isActive ? fxClass : ''}`}>
              {content}
            </div>
          );
        }, (
          <img
            src={currentImageUrl}
            alt="Scene"
            className="w-full h-full object-cover will-change-transform"
            style={{
              imageRendering: 'high-quality' as any,
            }}
          />
        ))}
      </div>

      {/* Vignette & Grain */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_50%,rgba(0,0,0,0.6)_100%)] z-10"></div>
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-10"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      ></div>

      {/* Overlays */}
      {activeOverlays.map((overlay, idx) => {
        if (overlay.style === 'speech-bubble') return renderSpeechBubble(overlay.text, idx);
        return renderComicBox(overlay.text, idx);
      })}

      {!isCleanMode && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded text-[10px] text-white/50 font-mono tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity z-30">
          Preview
        </div>
      )}
    </div>
  );
};
