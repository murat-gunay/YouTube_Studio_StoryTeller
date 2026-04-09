import { Composition, registerRoot } from 'remotion';
import { MainComposition } from './Composition';

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="MainComposition"
                component={MainComposition}
                durationInFrames={1} // Will be overwritten by inputProps
                fps={30}
                width={1920}
                height={1080}
                defaultProps={{
                    scenes: [],
                    fps: 30,
                    resolution: { width: 1920, height: 1080 }
                }}
                calculateMetadata={({ props }) => {
                    const res = (props as any).resolution || { width: 1920, height: 1080 };
                    const sceneList = (props as any).scenes || [];
                    const totalDuration = sceneList.reduce((acc: number, scene: any) => acc + (scene.durationInFrames || 0), 0) || 1;
                    return {
                        durationInFrames: totalDuration,
                        width: res.width,
                        height: res.height,
                    };
                }}
            />
        </>
    );
};

registerRoot(RemotionRoot);
