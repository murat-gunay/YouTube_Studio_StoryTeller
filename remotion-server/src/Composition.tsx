import { AbsoluteFill, Sequence, Audio, useVideoConfig } from 'remotion';
import { Scene } from './Scene';

export const MainComposition: React.FC<any> = ({ scenes, globalAudioPath }) => {
    const { fps } = useVideoConfig();
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
                        <Scene {...scene} />
                    </Sequence>
                );
            })}
            
            {globalAudioPath && (
                <Audio src={globalAudioPath} volume={0.1} />
            )}
        </AbsoluteFill>
    );
};
