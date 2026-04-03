
/// <reference lib="dom" />
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Scene, AspectRatio, TTSTone, Overlay, AnimationConfigEntry, VoiceOption } from '../types';
import { editImage, refineContent } from '../services/geminiService';
import { KenBurnsPlayer } from './KenBurnsPlayer';
import { TTS_TONES, ANIMATION_GROUPS, VOICE_OPTIONS, AUDIO_LIBRARY } from '../constants';

interface SceneCardProps {
  scene: Scene;
  aspectRatio: AspectRatio;
  durationMinutes: number;
  onGenerateImage: (id: number, prompt: string) => void;
  onGenerateVideo: (id: number) => void;
  onGenerateVideoPrompt: (id: number) => void;
  onGenerateTTS: (id: number, tone: TTSTone) => void;
  onUpdatePrompt: (id: number, newPrompt: string) => void;
  onUpdateScript: (id: number, newScript: string) => void;
  onUpdateImage: (id: number, newImageUrl: string) => void;
  onUpdateTone: (id: number, tone: TTSTone) => void;
  onUpdateVoice: (id: number, voice: VoiceOption) => void;
  onUpdateOverlays: (id: number, overlays: Overlay[]) => void;
  onUpdateAnimationStyle: (id: number, styles: string[], config?: Record<string, AnimationConfigEntry>) => void;
  onUpdateAudioSelection: (id: number, type: 'music' | 'sfx', audioId: string) => void;
  onUpdateVideoOptions: (id: number, updates: Partial<Scene['videoOptions']>) => void;
  onUpdateVideoPrompt: (id: number, newPrompt: string) => void;
  onUpdateShortVideoToggle: (id: number, hasShortVideo: boolean) => void;
  onPreviewVideo: (id: number) => void;
  onUpdateMute: (id: number, isMuted: boolean) => void;
  videoOptions?: Scene['videoOptions'];
}

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  aspectRatio,
  durationMinutes,
  onGenerateImage,
  onGenerateVideo,
  onGenerateVideoPrompt,
  onGenerateTTS,
  onUpdatePrompt,
  onUpdateScript,
  onUpdateImage,
  onUpdateTone,
  onUpdateVoice,
  onUpdateOverlays,
  onUpdateAnimationStyle,
  onUpdateAudioSelection,
  onUpdateVideoOptions,
  onUpdateVideoPrompt,
  onUpdateShortVideoToggle,
  onPreviewVideo,
  onUpdateMute,
  videoOptions
}) => {
  const [editImagePrompt, setEditImagePrompt] = useState("");
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [showAnimMenu, setShowAnimMenu] = useState(false);

  // State for enrichment
  const [enrichInput, setEnrichInput] = useState<{ show: boolean, type: 'voiceover' | 'visual', loading: boolean }>({ show: false, type: 'visual', loading: false });
  const [enrichInstruction, setEnrichInstruction] = useState("");

  // Preview Key state to force re-render of KenBurnsPlayer on replay
  const [previewKey, setPreviewKey] = useState(0);

  const handleEditImage = async () => {
    if (!scene.imageUrl || !editImagePrompt) return;
    setIsEditingImage(true);
    try {
      const newImage = await editImage(scene.imageUrl, editImagePrompt);
      onUpdateImage(scene.id, newImage);
      setEditImagePrompt("");
    } catch (e: any) {
      console.error(e);
      alert(`Failed to edit image: ${e.message}`);
    } finally {
      setIsEditingImage(false);
    }
  };

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

  const handleOverlayChange = (index: number, newText: string) => {
    const updated = [...scene.overlays];
    if (updated[index]) {
      updated[index] = { ...updated[index], text: newText };
      onUpdateOverlays(scene.id, updated);
    }
  };

  const handleReplayPreview = () => {
    setPreviewKey(prev => prev + 1);
  };

  const toggleAnimationStyle = (value: string, type: 'movement' | 'effect') => {
    let currentStyles = scene.animationStyles || [];
    const isSelected = currentStyles.includes(value);

    if (type === 'movement') {
      const movementGroup = ANIMATION_GROUPS.find(g => g.type === 'movement')?.options.map(o => o.value) || [];
      currentStyles = currentStyles.filter(c => !movementGroup.includes(c));
      if (!isSelected) currentStyles.push(value);
      if (currentStyles.length === 0 && !isSelected) currentStyles.push('animate-kb-zoom-in');
    } else {
      if (isSelected) {
        currentStyles = currentStyles.filter(c => c !== value);
      } else {
        currentStyles = [...currentStyles, value];
      }
    }

    // Initialize config for new items if needed
    const currentConfig = scene.animationConfig || {};

    onUpdateAnimationStyle(scene.id, currentStyles, currentConfig);
    handleReplayPreview();
  };

  const updateConfig = (value: string, field: 'start' | 'duration', amount: number) => {
    const currentConfig = { ...(scene.animationConfig || {}) };

    if (!currentConfig[value]) {
      currentConfig[value] = { start: 0, duration: 100 };
    }

    currentConfig[value] = {
      ...currentConfig[value],
      [field]: amount
    };

    onUpdateAnimationStyle(scene.id, scene.animationStyles || [], currentConfig);
    handleReplayPreview();
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case AspectRatio.Square: return "aspect-square";
      case AspectRatio.Standard: return "aspect-[4/3]";
      case AspectRatio.Landscape: return "aspect-video";
      case AspectRatio.Portrait: return "aspect-[9/16]";
      case AspectRatio.Cinematic: return "aspect-[21/9]";
      default: return "aspect-video";
    }
  };

  // Helper to generate time options
  const timeOptions = Array.from({ length: 21 }, (_, i) => i); // 0 to 20

  const musicOptions = AUDIO_LIBRARY.filter(a => a.category === 'music');
  const sfxOptions = AUDIO_LIBRARY.filter(a => a.category !== 'music');

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col shadow-lg transition-all hover:border-slate-600 relative group/card">

      {/* Timeline Strip Header */}
      <div className="bg-slate-900/80 p-3 border-b border-slate-700 flex flex-wrap justify-between items-center backdrop-blur-sm gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-xs font-bold px-2 py-1 rounded text-white shadow-sm">
            SCENE {scene.id + 1}
          </div>
          <span className="text-slate-400 font-mono text-xs">{scene.timeRange}</span>
        </div>

        {/* Audio Tools */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={scene.selectedVoice}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdateVoice(scene.id, e.target.value as VoiceOption)}
            className="bg-slate-800 text-xs text-slate-300 border border-slate-600 rounded px-2 py-1 outline-none focus:border-indigo-500 max-w-[100px]"
            title="Select Voice"
          >
            {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          <select
            value={scene.selectedTone}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdateTone(scene.id, e.target.value as TTSTone)}
            className="bg-slate-800 text-xs text-slate-300 border border-slate-600 rounded px-2 py-1 outline-none focus:border-indigo-500"
            title="Select Voice Tone"
          >
            {TTS_TONES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {scene.ttsAudioUrl && !scene.isGeneratingTTS && (
            <button
              onClick={() => onGenerateTTS(scene.id, scene.selectedTone)}
              className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded transition-colors"
              title="Regenerate Audio"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          )}

          {!scene.ttsAudioUrl && (
            <button
              onClick={() => onGenerateTTS(scene.id, scene.selectedTone)}
              disabled={scene.isGeneratingTTS}
              className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition-colors disabled:opacity-50 border border-slate-600"
              title="Generate Audio"
            >
              {scene.isGeneratingTTS ? (
                <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
              ) : (
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              )}
              <span>Voiceover</span>
            </button>
          )}

          {scene.ttsAudioUrl && (
            <div className="flex items-center gap-2 bg-slate-900 rounded-full px-2 py-1 border border-slate-700">
              <audio key={scene.ttsAudioUrl} src={scene.ttsAudioUrl} controls className="h-6 w-24" />
              <button
                onClick={() => handleDownload(scene.ttsAudioUrl!, `scene_${scene.id + 1}_audio.wav`)}
                className="text-slate-400 hover:text-white"
                title="Download Audio"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </button>
            </div>
          )}

          {/* Add Short Video Toggle */}
          <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Short Video</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={scene.hasShortVideo}
                onChange={(e) => onUpdateShortVideoToggle(scene.id, e.target.checked)}
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row h-full divide-y md:divide-y-0 md:divide-x divide-slate-700">

        {/* Visual Asset Side */}
        <div className="w-full md:w-5/12 bg-black flex flex-col divide-y divide-slate-800">

          {/* Main Visual / Preview (Start Frame) */}
          <div className={`relative w-full overflow-hidden ${getAspectRatioClass()}`}>
            {scene.imageUrl ? (
              <div className="relative w-full h-full group" onMouseLeave={() => {/* Don't auto close */ }}>

                {/* Animation Button */}
                <div className="absolute top-2 left-2 z-40">
                  <button
                    onClick={() => setShowAnimMenu(true)}
                    className="flex items-center gap-2 bg-black/70 backdrop-blur-sm text-white text-[10px] uppercase font-bold border border-white/20 rounded px-3 py-1.5 hover:bg-black/90 transition-colors shadow-lg"
                  >
                    <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                    Reference Frame
                  </button>
                  {/* ... (Animation Modal Portal remains the same) ... */}
                </div>

                {/* (Rest of Start Frame logic remains same but I'll optimize for brevity) */}
                <KenBurnsPlayer
                  key={`${scene.id}-${previewKey}-${(scene.animationStyles || []).join(',')}`}
                  imageUrl={scene.imageUrl}
                  durationMinutes={durationMinutes}
                  animationStyles={scene.animationStyles}
                  animationConfig={scene.animationConfig}
                  overlays={scene.overlays}
                  videoUrl={scene.videoUrl}
                  videoPlacement={scene.videoOptions?.placement}
                  videoOptions={scene.videoOptions}
                  isMuted={scene.isMuted}
                  onToggleMute={(muted) => onUpdateMute(scene.id, muted)}
                />

                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30">
                  <button onClick={() => onGenerateImage(scene.id, scene.visualPrompt)} disabled={scene.isGeneratingImage} className="bg-black/60 text-white p-2 rounded hover:bg-black/80 backdrop-blur-sm disabled:opacity-50">
                    {scene.isGeneratingImage ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full block"></span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 bg-slate-800/50 h-full">
                <button onClick={() => onGenerateImage(scene.id, scene.visualPrompt)} disabled={scene.isGeneratingImage} className="bg-indigo-600 px-4 py-2 rounded text-white text-xs">
                  {scene.isGeneratingImage ? "Generating..." : "Generate Reference Frame"}
                </button>
              </div>
            )}
          </div>

          {/* Video Studio & End Frame Section (Conditional) */}
          {scene.hasShortVideo && (
            <>
              {/* Video Studio Config */}
              <div className="bg-slate-800 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Video Studio (Veo 3.1)</h4>
                  {scene.videoUrl && (
                    <button
                      onClick={() => onPreviewVideo(scene.id)}
                      className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 text-[9px] uppercase font-bold px-2 py-0.5 rounded border border-indigo-400/30 flex items-center gap-1 transition-all"
                    >
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                      Play Preview
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] uppercase text-slate-500 font-bold">Duration</label>
                    <select
                      value={scene.videoOptions?.duration || 6}
                      onChange={(e) => onUpdateVideoOptions(scene.id, { duration: parseInt(e.target.value) as any })}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-1"
                    >
                      <option value={4}>4 Seconds</option>
                      <option value={6}>6 Seconds</option>
                      <option value={8}>8 Seconds</option>
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

                <div className="flex items-center justify-between">
                  <label className="text-[9px] uppercase text-slate-500 font-bold flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scene.videoOptions?.generateAudio ?? true}
                      onChange={(e) => onUpdateVideoOptions(scene.id, { generateAudio: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900"
                    />
                    Gen Audio
                  </label>
                  <label className="text-[9px] uppercase text-indigo-400 font-bold flex items-center gap-1 cursor-pointer" title="Exclude video audio from final render/playback">
                    <input
                      type="checkbox"
                      checked={!!scene.isMuted}
                      onChange={(e) => onUpdateMute(scene.id, e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 accent-indigo-500"
                    />
                    Mute Video
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onUpdateVideoOptions(scene.id, { aspectRatio: '16:9' })}
                      className={`text-[9px] px-2 py-0.5 rounded ${scene.videoOptions?.aspectRatio !== '9:16' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}
                    >16:9</button>
                    <button
                      onClick={() => onUpdateVideoOptions(scene.id, { aspectRatio: '9:16' })}
                      className={`text-[9px] px-2 py-0.5 rounded ${scene.videoOptions?.aspectRatio === '9:16' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}
                    >9:16</button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-700/50">
                  <label className="text-[9px] uppercase text-slate-500 font-bold">Video Placement</label>
                  <div className="flex bg-slate-900 rounded p-0.5 border border-slate-700">
                    <button
                      onClick={() => onUpdateVideoOptions(scene.id, { placement: 'start' })}
                      className={`px-3 py-0.5 text-[8px] uppercase font-bold rounded transition-colors ${scene.videoOptions?.placement === 'start' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Start
                    </button>
                    <button
                      onClick={() => onUpdateVideoOptions(scene.id, { placement: 'end' })}
                      className={`px-3 py-0.5 text-[8px] uppercase font-bold rounded transition-colors ${scene.videoOptions?.placement === 'end' || !scene.videoOptions?.placement ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      End
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] uppercase text-slate-500 font-bold">Video Prompt</label>
                    <button onClick={() => onGenerateVideoPrompt(scene.id)} disabled={scene.isGeneratingVideoPrompt} className="text-[9px] text-indigo-400 uppercase font-bold hover:underline">
                      {scene.isGeneratingVideoPrompt ? "Thinking..." : "Auto-Generate"}
                    </button>
                  </div>
                  <textarea
                    value={scene.videoPrompt || ""}
                    onChange={(e) => onUpdateVideoPrompt(scene.id, e.target.value)}
                    className="w-full h-12 bg-slate-900 border border-slate-700 rounded p-1.5 text-[10px] text-slate-300 focus:border-indigo-500 outline-none resize-none"
                    placeholder="Describe movement..."
                  />
                </div>

                <button
                  onClick={() => onGenerateVideo(scene.id)}
                  disabled={scene.isGeneratingVideo || !scene.imageUrl}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-2 rounded font-bold text-xs shadow-lg disabled:opacity-50"
                >
                  {scene.isGeneratingVideo ? "Creating Movie..." : scene.videoUrl ? "🎥 Regenerate Video" : "🎬 Generate Video"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Editors Side */}
        <div className="w-full md:w-7/12 p-4 flex flex-col gap-4 bg-slate-800/30">

          {/* Visual Prompt Editor */}
          <div className="relative group">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">Visual Prompt</label>
              <button onClick={() => openEnrich('visual')} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 px-2 py-1 rounded border border-slate-700">AI Enhance</button>
            </div>
            <textarea value={scene.visualPrompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdatePrompt(scene.id, e.target.value)} className="w-full h-16 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 focus:border-indigo-500 outline-none resize-none scrollbar-thin transition-colors font-mono leading-relaxed" placeholder="Describe the scene..." />
          </div>

          {/* Dual Overlay Editor */}
          <div className="grid grid-cols-2 gap-3">
            {(scene.overlays || []).map((overlay, idx) => (
              <div key={idx} className="relative">
                <label className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1 block">{idx === 0 ? "Overlay 1 (Context)" : "Overlay 2 (Dialogue)"}</label>
                <textarea value={overlay.text} onChange={(e) => handleOverlayChange(idx, e.target.value)} className={`w-full h-16 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-black focus:border-indigo-500 outline-none resize-none scrollbar-thin ${overlay.style === 'comic-box' ? 'bg-[#fdfcdc]' : 'bg-white'}`} placeholder={idx === 0 ? "Narration..." : "Dialogue..."} />
              </div>
            ))}
          </div>

          {/* Audio Selection Section (New) */}
          <div className="grid grid-cols-2 gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                Background Music
              </label>
              <select
                value={scene.selectedMusicId}
                onChange={(e) => onUpdateAudioSelection(scene.id, 'music', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 px-2 py-1 outline-none"
              >
                {musicOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                Ambience / SFX
              </label>
              <select
                value={scene.selectedSfxId}
                onChange={(e) => onUpdateAudioSelection(scene.id, 'sfx', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 px-2 py-1 outline-none"
              >
                {sfxOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
            </div>
          </div>

          {/* Voiceover Editor */}
          <div className="flex-1 relative group">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">Voiceover Script</label>
              <button onClick={() => openEnrich('voiceover')} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 px-2 py-1 rounded border border-slate-700">AI Rewrite</button>
            </div>
            <textarea value={scene.voiceoverScript} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdateScript(scene.id, e.target.value)} className="w-full h-full min-h-[80px] bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-indigo-500 outline-none resize-none scrollbar-thin transition-colors leading-relaxed" placeholder="Enter script..." />
            <div className="absolute bottom-2 right-2 text-[10px] text-slate-500">~{scene.voiceoverScript.split(' ').length} words</div>
          </div>
        </div>
      </div>

      {/* Enrich Modal */}
      {enrichInput.show && (
        <div className="absolute inset-0 bg-slate-900/95 z-20 flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-sm">
          {/* ... Enrich modal content (same as before) ... */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-600 shadow-2xl w-full max-w-lg">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><span className="text-indigo-400">✨</span>{enrichInput.type === 'visual' ? 'Enhance Visual Prompt' : 'Rewrite Script'}</h3>
            <input autoFocus type="text" value={enrichInstruction} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnrichInstruction(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleEnrichSubmit()} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white mb-4 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Your instruction..." />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEnrichInput(prev => ({ ...prev, show: false }))} className="px-4 py-2 rounded text-slate-400 hover:text-white text-sm">Cancel</button>
              <button onClick={handleEnrichSubmit} disabled={enrichInput.loading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 text-sm shadow-lg shadow-indigo-500/20">{enrichInput.loading ? 'Working Magic...' : 'Apply Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
