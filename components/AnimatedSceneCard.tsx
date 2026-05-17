/// <reference lib="dom" />
import React, { useState } from 'react';
import { Scene, AspectRatio, TTSTone, VoiceOption, Overlay, AnimationConfigEntry } from '../types';
import { refineContent } from '../services/geminiService';
import { TTS_TONES, VOICE_OPTIONS, AUDIO_LIBRARY } from '../constants';

interface AnimatedSceneCardProps {
  scene: Scene;
  aspectRatio: AspectRatio;
  durationMinutes: number;
  onGenerateImage: (id: number, prompt: string) => void;
  onGenerateVideo: (id: number) => void;
  onGenerateVideoPrompt: (id: number) => void;
  onGenerateTTS: (id: number, tone: TTSTone) => void;
  onUpdatePrompt: (id: number, newPrompt: string) => void;
  onUpdateScript: (id: number, newScript: string) => void;
  onUpdateTone: (id: number, tone: TTSTone) => void;
  onUpdateVoice: (id: number, voice: VoiceOption) => void;
  onUpdateAudioSelection: (id: number, type: 'music' | 'sfx', audioId: string) => void;
  onUpdateVideoOptions: (id: number, updates: Partial<Scene['videoOptions']>) => void;
  onUpdateVideoPrompt: (id: number, newPrompt: string) => void;
  onPreviewVideo: (id: number) => void;
  onUpdateMute: (id: number, isMuted: boolean) => void;
  onUpdateImageOverlayText?: (id: number, text: string) => void;
  
  // These props are here to satisfy the same interface as SceneCard in App.tsx
  // even if they aren't fully utilized in this simplified component.
  onUpdateImage?: (id: number, newImageUrl: string) => void;
  onUpdateOverlays?: (id: number, overlays: Overlay[]) => void;
  onUpdateAnimationStyle?: (id: number, styles: string[], config?: Record<string, AnimationConfigEntry>) => void;
  onUpdateShortVideoToggle?: (id: number, hasShortVideo: boolean) => void;
  videoOptions?: Scene['videoOptions'];
}

export const AnimatedSceneCard: React.FC<AnimatedSceneCardProps> = ({
  scene,
  aspectRatio,
  onGenerateImage,
  onGenerateVideo,
  onGenerateVideoPrompt,
  onGenerateTTS,
  onUpdatePrompt,
  onUpdateScript,
  onUpdateTone,
  onUpdateVoice,
  onUpdateAudioSelection,
  onUpdateVideoOptions,
  onUpdateVideoPrompt,
  onPreviewVideo,
  onUpdateMute,
  onUpdateImageOverlayText,
}) => {
  const [enrichInput, setEnrichInput] = useState<{ show: boolean, type: 'voiceover' | 'visual', loading: boolean }>({ show: false, type: 'visual', loading: false });
  const [enrichInstruction, setEnrichInstruction] = useState("");

  const handleDownload = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openEnrich = (type: 'voiceover' | 'visual') => {
    setEnrichInput({ show: true, type, loading: false });
    setEnrichInstruction("");
  };

  const handleEnrichSubmit = async () => {
    if (!enrichInstruction) return;
    setEnrichInput(prev => ({ ...prev, loading: true }));
    try {
      const currentText = enrichInput.type === 'voiceover' ? scene.voiceoverScript : scene.visualPrompt;
      const refined = await refineContent(currentText, enrichInstruction, enrichInput.type);

      if (enrichInput.type === 'voiceover') {
        onUpdateScript(scene.id, refined);
      } else {
        onUpdatePrompt(scene.id, refined);
      }
      setEnrichInput({ show: false, type: 'visual', loading: false });
    } catch (e: any) {
      alert(`Refinement failed: ${e.message}`);
      setEnrichInput(prev => ({ ...prev, loading: false }));
    }
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case AspectRatio.Square: return "aspect-square";
      case AspectRatio.Standard: return "aspect-[4/3]";
      case AspectRatio.Landscape: return "aspect-video";
      case AspectRatio.Portrait: return "aspect-[9/16]";
      case AspectRatio.Cinematic: return "aspect-[21/9]";
      default: return "aspect-[9/16]";
    }
  };

  const musicOptions = AUDIO_LIBRARY.filter(a => a.category === 'music');
  const sfxOptions = AUDIO_LIBRARY.filter(a => a.category !== 'music');

  const containerStyle = getAspectRatioClass();

  return (
    <div className="bg-slate-800 rounded-xl border border-pink-500/50 overflow-hidden flex flex-col shadow-lg transition-all relative group/card">
      {/* Timeline Strip Header */}
      <div className="bg-slate-900/80 p-3 border-b border-pink-500/30 flex flex-wrap justify-between items-center backdrop-blur-sm gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-pink-600 text-xs font-bold px-2 py-1 rounded text-white shadow-sm">
            ANIMATED SCENE {scene.id + 1}
          </div>
          <span className="text-slate-400 font-mono text-xs">{scene.timeRange}</span>
        </div>

        {/* Audio Tools - Synced with Static Mode */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={scene.selectedVoice}
            onChange={(e) => onUpdateVoice(scene.id, e.target.value as VoiceOption)}
            className="bg-slate-800 text-xs text-slate-300 border border-slate-700 rounded px-2 py-1 outline-none focus:border-pink-500 max-w-[100px]"
            title="Select Voice"
          >
            {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          <select
            value={scene.selectedTone}
            onChange={(e) => onUpdateTone(scene.id, e.target.value as TTSTone)}
            className="bg-slate-800 text-xs text-slate-300 border border-slate-700 rounded px-2 py-1 outline-none focus:border-pink-500"
            title="Select Voice Tone"
          >
            {TTS_TONES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {!scene.ttsAudioUrl || scene.isGeneratingTTS ? (
            <button
              onClick={() => onGenerateTTS(scene.id, scene.selectedTone)}
              disabled={scene.isGeneratingTTS}
              className="flex items-center gap-1 text-xs bg-pink-600 hover:bg-pink-500 text-white px-3 py-1 rounded transition-colors disabled:opacity-50 border border-pink-500/30 shadow-lg shadow-pink-500/20"
              title="Generate Audio"
            >
              {scene.isGeneratingTTS ? (
                <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full font-bold"></span>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              )}
              <span className="font-bold">Generate TTS</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-slate-900 rounded-full px-2 py-1 border border-pink-500/20">
              <audio key={scene.ttsAudioUrl} src={scene.ttsAudioUrl} controls className="h-6 w-24 pink-audio-player" />
              <button
                onClick={() => onGenerateTTS(scene.id, scene.selectedTone)}
                className="p-1 text-pink-400 hover:text-pink-300 transition-colors"
                title="Regenerate TTS"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <button
                onClick={() => handleDownload(scene.ttsAudioUrl!, `scene_${scene.id + 1}_audio.wav`)}
                className="text-slate-400 hover:text-white"
                title="Download Audio"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row h-full divide-y md:divide-y-0 md:divide-x divide-slate-700">
        
        {/* Visual Asset Side */}
        <div className="w-full md:w-5/12 bg-black flex flex-col divide-y divide-slate-800 overflow-hidden">
          
          <div className="flex flex-col p-2 gap-4 bg-black overflow-y-auto max-h-[700px] scrollbar-thin">
            
            {/* 1. Video Preview (Top) */}
            {scene.videoUrl && (
              <div className="relative w-full rounded-lg overflow-hidden border border-pink-500/30 shadow-2xl">
                <video 
                  src={scene.videoUrl} 
                  muted={!!scene.isMuted} 
                  controls 
                  loop 
                  className="w-full h-auto" 
                  style={{ objectFit: 'contain' }}
                />
                <div className="absolute top-2 right-2 flex gap-2 z-30">
                  <button 
                    onClick={() => handleDownload(scene.videoUrl!, `scene_${scene.id + 1}_video.mp4`)}
                    className="bg-black/80 text-white p-2 rounded backdrop-blur hover:bg-black"
                    title="Download Video"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 bg-pink-600/80 text-white text-[8px] px-1.5 py-0.5 rounded font-bold uppercase">Animated Video</div>
              </div>
            )}

            {/* 2. Reference Image Preview (Bottom) */}
            <div className={`relative w-full rounded-lg overflow-hidden border border-slate-800 bg-slate-900/50 flex items-center justify-center min-h-[200px] ${containerStyle}`}>
              {scene.imageUrl ? (
                <>
                  <img src={scene.imageUrl} className="w-full h-full object-contain" alt="Reference Frame" />
                  <div className="absolute top-2 right-2 flex gap-2 z-30">
                    <button 
                      onClick={() => onGenerateImage(scene.id, scene.visualPrompt)} 
                      disabled={scene.isGeneratingImage} 
                      className="bg-black/80 text-white p-2 rounded backdrop-blur hover:bg-black flex items-center gap-1 text-[10px] font-bold border border-white/10"
                    >
                       {scene.isGeneratingImage ? "..." : "🔄 Regenerate"}
                    </button>
                    <button 
                      onClick={() => handleDownload(scene.imageUrl!, `scene_${scene.id + 1}_image.png`)}
                      className="bg-black/80 text-white p-2 rounded backdrop-blur hover:bg-black border border-white/10"
                      title="Download Image"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 h-full w-full">
                  <button 
                    onClick={() => onGenerateImage(scene.id, scene.visualPrompt)} 
                    disabled={scene.isGeneratingImage} 
                    className="bg-pink-600 hover:bg-pink-500 px-4 py-2 rounded text-white text-xs font-bold transition-colors shadow-lg flex items-center gap-2"
                  >
                    {scene.isGeneratingImage ? (
                      <>
                        <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
                        Generating...
                      </>
                    ) : (
                      <>🖌️ Generate Reference Frame</>
                    )}
                  </button>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-slate-800/80 text-slate-400 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase">Reference Frame</div>
            </div>
          </div>

          <div className="bg-slate-800 p-4 space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-[10px] uppercase font-bold text-pink-400 tracking-wider">Veo 3.1 Studio</h4>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase text-slate-500 font-bold">Duration</label>
                <select
                  value={scene.videoOptions?.duration || 8}
                  onChange={(e) => onUpdateVideoOptions(scene.id, { duration: parseInt(e.target.value) as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-1"
                >
                  <option value={4}>4 Seconds</option>
                  <option value={6}>6 Seconds</option>
                  <option value={8}>8 Seconds</option>
                  <option value={10}>10 Seconds</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase text-slate-500 font-bold">Res</label>
                <select
                  value={scene.videoOptions?.resolution || '1080p'}
                  onChange={(e) => onUpdateVideoOptions(scene.id, { resolution: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-1"
                >
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between mt-2">
              <label className="text-[9px] uppercase text-slate-500 font-bold flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scene.videoOptions?.generateAudio ?? true}
                  onChange={(e) => onUpdateVideoOptions(scene.id, { generateAudio: e.target.checked })}
                  className="rounded bg-slate-900"
                />
                Gen Audio
              </label>
              <label className="text-[9px] uppercase text-pink-400 font-bold flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!scene.isMuted}
                  onChange={(e) => onUpdateMute(scene.id, e.target.checked)}
                  className="rounded bg-slate-900 accent-pink-500"
                />
                Mute Video
              </label>
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex justify-between items-center">
                <label className="text-[9px] uppercase text-slate-500 font-bold">Animation Prompt</label>
                <button onClick={() => onGenerateVideoPrompt(scene.id)} disabled={scene.isGeneratingVideoPrompt} className="text-[9px] text-pink-400 hover:underline font-bold">
                  {scene.isGeneratingVideoPrompt ? "Thinking..." : "Auto-Generate"}
                </button>
              </div>
              <textarea
                value={scene.videoPrompt || ""}
                onChange={(e) => onUpdateVideoPrompt(scene.id, e.target.value)}
                className="w-full h-12 bg-slate-900 border border-slate-700 rounded p-1.5 text-[10px] text-slate-300 focus:border-pink-500 outline-none resize-none"
                placeholder="Describe movement (e.g. seamless loop...)"
              />
            </div>

            <button
              onClick={() => onGenerateVideo(scene.id)}
              disabled={scene.isGeneratingVideo || !scene.imageUrl}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white py-2 rounded font-bold text-xs shadow-lg disabled:opacity-50 mt-2"
            >
              {scene.isGeneratingVideo ? "🎬 Animating Frame..." : scene.videoUrl ? "🎥 Regenerate Video" : "🎬 Generate Animation"}
            </button>
          </div>

        </div>

        {/* Editors Side */}
        <div className="w-full md:w-7/12 p-4 flex flex-col gap-4 bg-slate-800/30">
          
            <div className="relative group">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Visual Concept (Gemini Imagen)</label>
              <button onClick={() => openEnrich('visual')} className="text-xs text-pink-400 hover:text-pink-300 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 px-2 py-1 rounded">AI Enhance</button>
            </div>
            <textarea 
              value={scene.visualPrompt} 
              onChange={(e) => onUpdatePrompt(scene.id, e.target.value)} 
              className="w-full h-20 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 focus:border-pink-500 outline-none resize-none" 
              placeholder="Visual description..." 
            />
          </div>

          <div className="relative group">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs uppercase tracking-wider text-pink-400 font-bold flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                Image Text Overlay (Summary)
              </label>
            </div>
            <textarea 
              value={scene.imageOverlayText || ""} 
              onChange={(e) => onUpdateImageOverlayText?.(scene.id, e.target.value)} 
              className="w-full h-16 bg-slate-900/50 border border-pink-500/20 rounded-lg p-3 text-xs text-slate-300 focus:border-pink-500 outline-none resize-none italic" 
              placeholder="Short attractive summary for the image..." 
            />
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Background Music</label>
              <select
                value={scene.selectedMusicId}
                onChange={(e) => onUpdateAudioSelection(scene.id, 'music', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 px-2 py-1 outline-none"
              >
                {musicOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Ambience / SFX</label>
              <select
                value={scene.selectedSfxId}
                onChange={(e) => onUpdateAudioSelection(scene.id, 'sfx', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 px-2 py-1 outline-none"
              >
                {sfxOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
            </div>
          </div>

          {/* Voiceover Editor - Synced with Static Mode */}
          <div className="flex-1 relative group">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">Voiceover Script (Background Narration)</label>
              <button onClick={() => openEnrich('voiceover')} className="text-xs text-pink-400 hover:text-pink-300 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 px-2 py-1 rounded border border-slate-700">AI Rewrite</button>
            </div>
            <textarea 
              value={scene.voiceoverScript} 
              onChange={(e) => onUpdateScript(scene.id, e.target.value)} 
              className="w-full h-full min-h-[80px] bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-pink-500 outline-none resize-none scrollbar-thin transition-colors leading-relaxed" 
              placeholder="Enter narration script..." 
            />
            <div className="absolute bottom-2 right-2 text-[10px] text-slate-500">~{scene.voiceoverScript.split(' ').length} words</div>
          </div>

        </div>
      </div>

      {/* Enrich Modal */}
      {enrichInput.show && (
        <div className="absolute inset-0 bg-slate-900/95 z-20 flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-600 shadow-2xl w-full max-w-lg">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><span className="text-pink-400">✨</span>{enrichInput.type === 'visual' ? 'Enhance Visual Prompt' : 'Rewrite Script'}</h3>
            <input autoFocus type="text" value={enrichInstruction} onChange={(e) => setEnrichInstruction(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleEnrichSubmit()} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white mb-4 outline-none focus:ring-2 focus:ring-pink-500" placeholder="Your instruction..." />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEnrichInput(prev => ({ ...prev, show: false }))} className="px-4 py-2 rounded text-slate-400 hover:text-white text-sm">Cancel</button>
              <button onClick={handleEnrichSubmit} disabled={enrichInput.loading} className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium disabled:opacity-50 text-sm">{enrichInput.loading ? 'Working Magic...' : 'Apply Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
