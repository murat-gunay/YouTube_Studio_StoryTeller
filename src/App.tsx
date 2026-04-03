/// <reference lib="dom" />
import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { AppStep, UserInput, VoiceOption, ArtStyle, Scene, AspectRatio, TTSTone, Character, Overlay, Language } from './types';
import { DEFAULT_DURATION, DEFAULT_INTERVAL, ART_STYLES, VOICE_OPTIONS, ASPECT_RATIOS, AUDIO_LIBRARY, LANGUAGES } from './constants';
import { AudioRecorder } from './components/AudioRecorder';
import { SceneCard } from './components/SceneCard';
import { LiveAssistant } from './components/LiveAssistant';
import { KenBurnsPlayer } from './components/KenBurnsPlayer';
import { transcribeAudio, generateStoryScript, generateImage, generateVideo, generateTTS, generateThumbnail, generateCharacterReference, generateTitle } from './services/geminiService';
import { renderFullVideo } from './services/videoRenderService';

const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
};

const App = () => {
  // --- Auth State ---
  const [hasCheckedKey, setHasCheckedKey] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  // --- App State ---
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [inputs, setInputs] = useState<UserInput>({
    title: '',
    instructions: '',
    durationMinutes: DEFAULT_DURATION,
    imageIntervalMinutes: DEFAULT_INTERVAL,
    voice: VoiceOption.Kore,
    artStyle: ArtStyle.Cinematic,
    aspectRatio: AspectRatio.Landscape,
    useSearchGrounding: false,
    targetLanguage: Language.English,
  });
  
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recorderKey, setRecorderKey] = useState(0); 
  const [manualStoryText, setManualStoryText] = useState<string>("");
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  const [transcription, setTranscription] = useState<string>("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]); 
  const [storyContext, setStoryContext] = useState<string>(""); 
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  
  // Asset Gen Loading States
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [isGeneratingAllAudio, setIsGeneratingAllAudio] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Thumbnail
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailTitleText, setThumbnailTitleText] = useState("");
  const [thumbnailSubtitleText, setThumbnailSubtitleText] = useState("");
  const [thumbnailPrompt, setThumbnailPrompt] = useState(""); 
  const [thumbnailStyle, setThumbnailStyle] = useState<ArtStyle | string>("");

  // Video Rendering State
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderProgress, setRenderProgress] = useState("");
  const [renderResolution, setRenderResolution] = useState<'720p' | '1080p'>('720p'); 
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  // Preview Mode State
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(true);
  const [isCleanMode, setIsCleanMode] = useState(false); 
  
  // Audio Refs for Multi-track playback
  const previewTtsRef = useRef<HTMLAudioElement>(null);
  const previewMusicRef = useRef<HTMLAudioElement>(null);
  const previewSfxRef = useRef<HTMLAudioElement>(null);
  
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Blocking Check
  const hasCharacters = characters.length > 0;
  const isReadyForSceneGeneration = characters.every(c => !!c.referenceImageUrl);

  // --- Auth Effect ---
  useEffect(() => {
    const checkKey = async () => {
      try {
        if ((window as any).aistudio?.hasSelectedApiKey) {
          const has = await (window as any).aistudio.hasSelectedApiKey();
          setHasApiKey(has);
        } else {
          // If checking isn't available (e.g. local dev), assume true or handle via env
          setHasApiKey(true);
        }
      } catch (e) {
        console.error("Failed to check API key status", e);
        setHasApiKey(false);
      } finally {
        setHasCheckedKey(true);
      }
    };
    checkKey();
  }, []);

  const handleConnectKey = async () => {
      if ((window as any).aistudio?.openSelectKey) {
          try {
            await (window as any).aistudio.openSelectKey();
            setHasApiKey(true);
          } catch (e) {
            console.error("Key selection failed", e);
            alert("Failed to select API key. Please try again.");
          }
      } else {
          alert("API Key selection not available in this environment.");
      }
  };

  // --- Handlers ---

  const handleAudioComplete = (blob: Blob) => {
    setAudioBlob(blob);
  };
  
  const clearRecording = () => {
    setAudioBlob(null);
    setRecorderKey(prev => prev + 1);
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const executeWithAuthHandler = async (action: () => Promise<void>) => {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        await action();
        return; 
      } catch (error: any) {
        attempt++;
        console.error(`Attempt ${attempt} failed:`, error);
      
        const status = error?.status || error?.error?.code || error?.code;
        const message = error?.message || error?.error?.message || JSON.stringify(error);
        const isRateLimit = status === 429 || String(status).includes('429') || String(message).includes('quota') || String(message).includes('RESOURCE_EXHAUSTED');
        const isPermissionError = status === 403 || String(status).includes('403') || String(message).includes('permission');

        if (isPermissionError) {
            const win = window as any;
            if (win.aistudio?.openSelectKey) {
                if (confirm(`Access Denied (403): ${message}\n\nYou likely need a paid API key for this feature (Veo/Imagen). Would you like to select a different API key now?`)) {
                    await win.aistudio.openSelectKey();
                    attempt--; // Don't count this as a retry failure
                    continue; // Retry logic
                }
            } else {
               alert(`Access Denied: ${message}. Check your API Key permissions.`);
            }
            return;
        }

        if (isRateLimit) {
            if (attempt < maxRetries) {
                const backoffTime = 2000 * Math.pow(2, attempt); 
                console.warn(`Rate limit hit. Retrying in ${backoffTime}ms...`);
                await delay(backoffTime);
                continue;
            } else {
                alert(`Operation failed after retries due to rate limits. Please try again later.\nError: ${message}`);
                return;
            }
        }
        
        alert(`Error: ${message}`);
        return;
      }
    }
  };

  const handleAutoGenerateTitle = async () => {
     if (!manualStoryText.trim()) return;
     setIsGeneratingTitle(true);
     await executeWithAuthHandler(async () => {
         try {
             // Pass user language preference to title generator
             const title = await generateTitle(manualStoryText, inputs.targetLanguage);
             setInputs(prev => ({ ...prev, title }));
         } finally {
             setIsGeneratingTitle(false);
         }
     });
  };

  const startProcessing = async () => {
    if (!audioBlob && !manualStoryText.trim()) return alert("Please record your story OR enter text to continue.");
    
    await executeWithAuthHandler(async () => {
      setStep(AppStep.PROCESSING_SCRIPT);
      setIsProcessing(true);

      try {
        let textSource = "";

        if (audioBlob) {
             setLoadingMessage("Transcribing audio and translating to English...");
             textSource = await transcribeAudio(audioBlob);
        } else {
             textSource = manualStoryText;
             setLoadingMessage("Processing your text...");
        }
        
        setTranscription(textSource);

        let finalTitle = inputs.title;
        if (!finalTitle.trim()) {
             setLoadingMessage("Analyzing content and generating a catchy title...");
             // Pass user language preference to title generator
             finalTitle = await generateTitle(textSource, inputs.targetLanguage);
             setInputs(prev => ({ ...prev, title: finalTitle }));
        }

        setLoadingMessage(`Analyzing story and generating script in ${inputs.targetLanguage}...`);
        const sceneCount = Math.ceil(inputs.durationMinutes / inputs.imageIntervalMinutes);
        
        const result = await generateStoryScript(
          textSource, 
          finalTitle, 
          inputs.instructions, 
          sceneCount,
          inputs.durationMinutes, 
          inputs.useSearchGrounding,
          inputs.voice,
          inputs.targetLanguage
        );
        
        setScenes(result.scenes);
        setCharacters(result.characters);
        setStoryContext(result.storyContext);

        // Initialize Thumbnail Settings
        setThumbnailStyle(inputs.artStyle);

        setStep(AppStep.ASSET_GENERATION); 
      } catch (err) {
        // Go back to input if it fails
        setStep(AppStep.INPUT);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    });
  };

  const updateScene = (id: number, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // --- Character Logic ---

  const updateCharacter = (id: string, updates: Partial<Character>) => {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addCustomCharacter = () => {
    const newChar: Character = {
        id: `custom_${Date.now()}`,
        name: "New Character",
        description: "Describe the character's face, body, and general style here...",
        isCustom: true
    };
    setCharacters(prev => [...prev, newChar]);
  };

  const deleteCharacter = (id: string) => {
    if (confirm("Are you sure you want to remove this character?")) {
        setCharacters(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleGenerateCharacterRef = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    updateCharacter(charId, { isGenerating: true });
    await executeWithAuthHandler(async () => {
        try {
            const url = await generateCharacterReference(char, inputs.artStyle, storyContext);
            updateCharacter(charId, { referenceImageUrl: url, isGenerating: false });
        } catch(e) {
            updateCharacter(charId, { isGenerating: false });
            throw e;
        }
    });
  };

  // --- Scene Asset Logic ---

  const handleGenerateImage = async (id: number, prompt: string) => {
    updateScene(id, { isGeneratingImage: true });
    await executeWithAuthHandler(async () => {
      try {
        const imageUrl = await generateImage(prompt, inputs.artStyle, inputs.aspectRatio, storyContext, characters);
        updateScene(id, { imageUrl, isGeneratingImage: false });
      } catch (e) {
        updateScene(id, { isGeneratingImage: false });
        throw e;
      }
    });
  };

  const handleGenerateAllImages = async () => {
    const scenesToProcess = scenes.filter(s => !s.imageUrl && !s.isGeneratingImage);
    if (scenesToProcess.length === 0) return;

    setIsGeneratingAllImages(true);
    for (const scene of scenesToProcess) {
       await handleGenerateImage(scene.id, scene.visualPrompt);
       await delay(2500); 
    }
    setIsGeneratingAllImages(false);
  };

  const handleGenerateVideo = async (id: number) => {
    const scene = scenes.find(s => s.id === id);
    if (!scene?.imageUrl) return;
    updateScene(id, { isGeneratingVideo: true });
    await executeWithAuthHandler(async () => {
        try {
           const videoUrl = await generateVideo(scene.imageUrl, inputs.aspectRatio);
           updateScene(id, { videoUrl, isGeneratingVideo: false });
        } catch (e) {
           updateScene(id, { isGeneratingVideo: false });
           throw e;
        }
    });
  };

  const handleGenerateTTS = async (id: number, tone: TTSTone) => {
    const scene = scenes.find(s => s.id === id);
    if (!scene?.voiceoverScript) return;
    updateScene(id, { isGeneratingTTS: true });
    await executeWithAuthHandler(async () => {
      try {
        const voiceToUse = scene.selectedVoice || inputs.voice;
        const ttsAudioUrl = await generateTTS(scene.voiceoverScript, voiceToUse, tone);
        updateScene(id, { ttsAudioUrl, isGeneratingTTS: false });
      } catch (e) {
        updateScene(id, { isGeneratingTTS: false });
        throw e;
      }
    });
  };

  const handleGenerateAllAudio = async () => {
    const scenesToProcess = scenes.filter(s => !s.ttsAudioUrl && !s.isGeneratingTTS);
    if (scenesToProcess.length === 0) return;

    setIsGeneratingAllAudio(true);
    for (const scene of scenesToProcess) {
       await handleGenerateTTS(scene.id, scene.selectedTone);
       await delay(2000); 
    }
    setIsGeneratingAllAudio(false);
  };

  const handleGenerateThumbnail = async () => {
      if(!inputs.title) return;
      setIsGeneratingThumbnail(true);
      await executeWithAuthHandler(async () => {
          try {
             const url = await generateThumbnail(
                inputs.title, 
                thumbnailStyle as string, 
                storyContext, 
                characters, 
                thumbnailTitleText, 
                thumbnailSubtitleText,
                thumbnailPrompt
             );
             setThumbnailUrl(url);
          } catch(e) {
             console.error(e);
             alert("Thumbnail gen failed");
          } finally {
             setIsGeneratingThumbnail(false);
          }
      });
  };

  const handleRenderFullVideo = async () => {
    if (scenes.some(s => !s.imageUrl || !s.ttsAudioUrl)) {
        alert("Please generate all Images and Audio for every scene before rendering the final movie.");
        return;
    }
    setIsRenderingVideo(true);
    setRenderedVideoUrl(null); 
    setRenderProgress("Initializing...");
    try {
        const videoBlob = await renderFullVideo(
            scenes, 
            inputs.aspectRatio, 
            renderResolution, 
            setRenderProgress
        );
        const url = URL.createObjectURL(videoBlob);
        setRenderedVideoUrl(url);
    } catch(e: any) {
        console.error("Render failed in App:", e);
        alert(`Video rendering failed!\n\nDetails: ${e.message || "Unknown error"}`);
    } finally {
        setIsRenderingVideo(false);
        setRenderProgress("");
    }
  };

  // --- Export Functionality (Zip) ---
  const handleExportProject = async () => {
    if (scenes.length === 0) return;
    setIsExporting(true);
    try {
        const zip = new JSZip();
        let folderName = inputs.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        if (!folderName) folderName = "project";
        
        const root = zip.folder(folderName);
        if (!root) throw new Error("Zip error");

        const projectState = {
            inputs,
            storyContext,
            characters,
            scenes: scenes.map(s => ({
                ...s,
                imageUrl: s.imageUrl ? `images/scene_${s.id}_image.png` : null,
                ttsAudioUrl: s.ttsAudioUrl ? `audio/scene_${s.id}_audio.wav` : null,
                characterRefId: s.characterRefId,
                overlays: s.overlays || [],
                selectedMusicId: s.selectedMusicId,
                selectedSfxId: s.selectedSfxId
            })),
            thumbnailPath: thumbnailUrl ? `images/thumbnail.png` : null,
            charactersData: characters.map(c => ({
                ...c,
                referenceImageUrl: c.referenceImageUrl ? `images/char_${c.id}.png` : null
            }))
        };
        root.file("project_data.json", JSON.stringify(projectState, null, 2));

        // Create readable script
        const fullScript = scenes.map(s => 
        `SCENE ${s.id + 1} (${s.timeRange})\nVISUAL: ${s.visualPrompt}\nAUDIO: ${s.voiceoverScript}\nMUSIC: ${s.selectedMusicId}\nSFX: ${s.selectedSfxId}\n`
        ).join('\n-------------------\n');
        root.file("script.txt", fullScript);
        root.file("story_bible.txt", storyContext);

        const audioFolder = root.folder("audio");
        const imageFolder = root.folder("images");

        const dataUrlToBlob = async (dataUrl: string) => {
            const res = await fetch(dataUrl);
            return await res.blob();
        };

        for (const scene of scenes) {
            if (scene.imageUrl && imageFolder) {
                const blob = await dataUrlToBlob(scene.imageUrl);
                imageFolder.file(`scene_${scene.id}_image.png`, blob);
            }
            if (scene.ttsAudioUrl && audioFolder) {
                const blob = await dataUrlToBlob(scene.ttsAudioUrl);
                audioFolder.file(`scene_${scene.id}_audio.wav`, blob);
            }
        }
        for (const char of characters) {
            if (char.referenceImageUrl && imageFolder) {
                const blob = await dataUrlToBlob(char.referenceImageUrl);
                imageFolder.file(`char_${char.id}.png`, blob);
            }
        }
        if (thumbnailUrl && imageFolder) {
            const blob = await dataUrlToBlob(thumbnailUrl);
            imageFolder.file("thumbnail.png", blob);
        }

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${folderName}_complete_project.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch(e) {
        console.error(e);
        alert("Export failed.");
    } finally {
        setIsExporting(false);
    }
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const recoverFromScript = async (zip: JSZip, scriptPath: string, allFiles: string[]) => {
      const scriptFile = zip.file(scriptPath);
      if (!scriptFile) throw new Error("Cannot read script.txt");
      const scriptText = await scriptFile.async("string");
      
      const prefixEndIndex = scriptPath.toLowerCase().lastIndexOf('script.txt');
      const rootPrefix = scriptPath.substring(0, prefixEndIndex);

      const findFile = (name: string) => {
        const target = (rootPrefix + name).toLowerCase();
        return allFiles.find(f => f.toLowerCase() === target || f.toLowerCase().endsWith(name.toLowerCase()));
      };

      const blocks = scriptText.split(/-------------------[\r\n]+/).map(b => b.trim()).filter(b => b);
      
      const newScenes: Scene[] = [];
      
      for(let i=0; i<blocks.length; i++) {
           const block = blocks[i];
           const timeRangeMatch = block.match(/SCENE \d+ \((.*?)\)/);
           const timeRange = timeRangeMatch ? timeRangeMatch[1] : "0:00";
           
           let overlays: Overlay[] = [];
           const overlayMatch = block.match(/OVERLAYS: (\[.*\])/);
           if (overlayMatch) {
             try { overlays = JSON.parse(overlayMatch[1]); } catch(e) {}
           }
           
           const visualMatch = block.match(/VISUAL: (.*)/);
           const visualPrompt = visualMatch ? visualMatch[1] : "";
           
           const audioMatch = block.match(/AUDIO: (.*)/);
           const voiceoverScript = audioMatch ? audioMatch[1] : "";
           
           // Simple regex for music/sfx in legacy recovery
           const musicMatch = block.match(/MUSIC: (.*)/);
           const sfxMatch = block.match(/SFX: (.*)/);

           const scene: Scene = {
               id: i,
               timeRange,
               voiceoverScript,
               overlays: overlays,
               visualPrompt,
               animationStyles: ['animate-kb-zoom-in'],
               isGeneratingImage: false,
               isGeneratingVideo: false,
               isGeneratingTTS: false,
               selectedTone: TTSTone.Neutral,
               selectedVoice: inputs.voice,
               selectedMusicId: musicMatch ? musicMatch[1] : 'music_mystical',
               selectedSfxId: sfxMatch ? sfxMatch[1] : 'ambience_interior'
           };

           const imgPath = findFile(`images/scene_${i}_image.png`);
           if (imgPath) {
               const b = await zip.file(imgPath)?.async('blob');
               if(b) scene.imageUrl = await blobToDataUrl(b);
           }
           
           const audioPath = findFile(`audio/scene_${i}_audio.wav`);
           if (audioPath) {
               const b = await zip.file(audioPath)?.async('blob');
               if(b) scene.ttsAudioUrl = await blobToDataUrl(b);
           }
           
           newScenes.push(scene);
      }

      setScenes(newScenes);
      setStep(AppStep.ASSET_GENERATION);
      
      const biblePath = findFile('story_bible.txt');
      if (biblePath) {
          const bible = await zip.file(biblePath)?.async("string");
          setStoryContext(bible || "");
      }
      
      const thumbPath = findFile('images/thumbnail.png') || findFile('youtube_thumbnail.png');
      if (thumbPath) {
           const b = await zip.file(thumbPath)?.async('blob');
           if(b) setThumbnailUrl(await blobToDataUrl(b));
      }

      setInputs({
          ...inputs,
          title: scriptPath.split('/')[0] || "Imported Project",
          targetLanguage: Language.English, // Default for recovery
      } as UserInput);
      
      alert("Notice: Project recovered from script files. Some settings have been reset.");
  };

  const handleImportProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsImporting(true);
    
    try {
        const zip = await JSZip.loadAsync(file);
        
        const files = Object.keys(zip.files);
        const jsonPath = files.find(f => 
             f.toLowerCase().endsWith('project_data.json') && 
             !f.includes('__MACOSX') &&
             !zip.files[f].dir
        );

        if (!jsonPath) {
             const scriptPath = files.find(f => f.toLowerCase().endsWith('script.txt') && !f.includes('__MACOSX'));
             if (scriptPath) {
                 await recoverFromScript(zip, scriptPath, files);
                 return; 
             }
             throw new Error(`Invalid project file: missing project_data.json.`);
        }

        const jsonFile = zip.file(jsonPath);
        if (!jsonFile) throw new Error("Could not read project_data.json content");

        const jsonStr = await jsonFile.async("string");
        const data = JSON.parse(jsonStr);
        const prefixEndIndex = jsonPath.toLowerCase().lastIndexOf('project_data.json');
        const rootPrefix = jsonPath.substring(0, prefixEndIndex);

        const loadBlobUrl = async (relativePath: string | null) => {
            if (!relativePath) return undefined;
            const fullPath = rootPrefix + relativePath;
            let fileData = zip.file(fullPath);
            if (!fileData) {
                const foundPath = files.find(f => f.toLowerCase() === fullPath.toLowerCase());
                if (foundPath) fileData = zip.file(foundPath);
            }
            if (!fileData) return undefined;

            const blob = await fileData.async("blob");
            return await blobToDataUrl(blob);
        };

        setInputs(data.inputs);
        setStoryContext(data.storyContext || "");
        
        const restoredChars: Character[] = await Promise.all(data.charactersData.map(async (c: any) => ({
            ...c,
            referenceImageUrl: await loadBlobUrl(c.referenceImageUrl)
        })));
        setCharacters(restoredChars);

        const restoredScenes: Scene[] = await Promise.all(data.scenes.map(async (s: any) => ({
            ...s,
            imageUrl: await loadBlobUrl(s.imageUrl),
            ttsAudioUrl: await loadBlobUrl(s.ttsAudioUrl),
            overlays: s.overlays || [], 
            animationStyles: s.animationStyles || (s.animationStyle ? [s.animationStyle] : ['animate-kb-zoom-in']),
            animationConfig: s.animationConfig || {},
            selectedVoice: s.selectedVoice || data.inputs.voice,
            selectedMusicId: s.selectedMusicId,
            selectedSfxId: s.selectedSfxId
        })));
        setScenes(restoredScenes);

        if (data.thumbnailPath) {
            const thumb = await loadBlobUrl(data.thumbnailPath);
            setThumbnailUrl(thumb || null);
        }

        setStep(AppStep.ASSET_GENERATION);

    } catch(err: any) {
        console.error(err);
        alert("Failed to import project: " + err.message);
    } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- Preview Player Logic ---
  
  const getAudioSrc = (id?: string) => {
      if (!id) return undefined;
      const asset = AUDIO_LIBRARY.find(a => a.id === id);
      return asset ? asset.url : undefined;
  };

  const startPreview = () => {
    if (scenes.length === 0) return;
    setIsPreviewing(true);
    setCurrentPreviewIndex(0);
    setIsPreviewPlaying(true);
    setIsCleanMode(false);
  };
  
  const startPresentation = async () => {
    if (scenes.length === 0) return;
    
    try {
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
            await (document.documentElement as any).webkitRequestFullscreen();
        }
    } catch(e) {
        console.warn("Fullscreen request failed", e);
    }

    setIsPreviewing(true);
    setCurrentPreviewIndex(0);
    setIsPreviewPlaying(false);
    setIsCleanMode(true); 
    
    setTimeout(() => {
        setIsPreviewPlaying(true); 
    }, 7000);
  };

  const handlePreviewNext = useCallback(() => {
    if (currentPreviewIndex < scenes.length - 1) {
      setCurrentPreviewIndex(prev => prev + 1);
    } else {
      setIsPreviewPlaying(false); 
    }
  }, [currentPreviewIndex, scenes.length]);

  const handlePreviewPrev = useCallback(() => {
    if (currentPreviewIndex > 0) {
        setCurrentPreviewIndex(prev => prev - 1);
    }
  }, [currentPreviewIndex]);

  const togglePreviewPlay = () => {
    setIsPreviewPlaying(!isPreviewPlaying);
  };

  // Sync Audio Playback
  useEffect(() => {
      if (!isPreviewing) {
          previewTtsRef.current?.pause();
          previewMusicRef.current?.pause();
          previewSfxRef.current?.pause();
          return;
      }
      
      const tts = previewTtsRef.current;
      const music = previewMusicRef.current;
      const sfx = previewSfxRef.current;

      if (isPreviewPlaying) {
          tts?.play().catch(() => {});
          music?.play().catch(() => {});
          
          if (sfx) {
             // Handle "Trim 30%" logic for SFX
             if (sfx.paused && sfx.currentTime === 0) {
                 const duration = sfx.duration;
                 if (duration && !isNaN(duration)) {
                     sfx.currentTime = duration * 0.3; // Jump to 30%
                 }
             }
             sfx.play().catch(() => {});
          }

      } else {
          tts?.pause();
          music?.pause();
          sfx?.pause();
      }
  }, [isPreviewing, isPreviewing, currentPreviewIndex]); // Re-run when index changes to re-trigger play on new sources

  const toggleCleanMode = useCallback(async () => {
    if (!isCleanMode) {
      setIsCleanMode(true);
      try {
        if (previewContainerRef.current) {
           await previewContainerRef.current.requestFullscreen();
        } else if (document.documentElement) {
           await document.documentElement.requestFullscreen();
        }
      } catch(e) { console.warn(e); }
    } else {
      setIsCleanMode(false);
      if (document.fullscreenElement) {
         try { await document.exitFullscreen(); } catch(e) {}
      }
    }
  }, [isCleanMode]);

  useEffect(() => {
    if (isPreviewing) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isPreviewing]);

  useEffect(() => {
    if (!isPreviewing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
             if (isCleanMode && !document.fullscreenElement) setIsCleanMode(false);
             else if (!isCleanMode && !document.fullscreenElement) setIsPreviewing(false);
        }
        if (e.key === 'ArrowRight') handlePreviewNext();
        if (e.key === 'ArrowLeft') handlePreviewPrev();
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault(); 
            togglePreviewPlay();
        }
        if (e.key === 'f') toggleCleanMode();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewing, handlePreviewNext, handlePreviewPrev, isPreviewPlaying, isCleanMode, toggleCleanMode]);

  const activeScene = scenes[currentPreviewIndex];

  // --- Renders ---

  const renderInputStep = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="flex justify-end">
          <input type="file" accept=".zip" ref={fileInputRef} className="hidden" onChange={handleImportProject} />
          <button onClick={triggerImport} disabled={isImporting} className="text-indigo-400 hover:text-white text-sm flex items-center gap-2 border border-indigo-500/30 px-3 py-1 rounded-full transition-colors">
             {isImporting ? <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}
             Import Existing Project (Zip)
          </button>
      </div>

      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">1. Story Input</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
           <div className={`transition-opacity duration-300 ${manualStoryText ? 'opacity-50' : 'opacity-100'}`}>
              <div className="flex justify-between items-center mb-2">
                 <label className="block text-sm font-medium text-indigo-400">Option A: Record Voice</label>
                 {audioBlob && (
                    <button onClick={clearRecording} className="text-xs text-red-400 hover:text-red-300 underline">Remove Recording</button>
                 )}
              </div>
              <AudioRecorder key={recorderKey} onRecordingComplete={handleAudioComplete} />
              <p className="text-xs text-slate-500 mt-2">Record your story naturally. We'll transcribe it.</p>
           </div>
           <div className="hidden md:flex absolute inset-y-0 left-1/2 -translate-x-1/2 items-center justify-center pointer-events-none">
                <div className="h-full w-px bg-slate-700/50"></div>
                <div className="absolute bg-slate-800 px-2 py-1 text-xs font-bold text-slate-500 rounded border border-slate-700">OR</div>
           </div>
           <div className={`flex flex-col h-full transition-opacity duration-300 ${audioBlob ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <label className="block text-sm font-medium text-cyan-400 mb-2">Option B: Write Text</label>
              <textarea
                  value={manualStoryText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setManualStoryText(e.target.value)}
                  className="flex-1 min-h-[180px] w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-cyan-500 outline-none resize-none transition-all hover:border-slate-500"
                  placeholder="Paste your story, article, or rough notes here..."
                  disabled={!!audioBlob}
                />
                <p className="text-xs text-slate-500 mt-2">Paste any text. We'll adapt it into a script.</p>
           </div>
        </div>
        <div className="border-t border-slate-700 my-8"></div>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Project Title</label>
              <div className="flex gap-2">
                  <input type="text" value={inputs.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({...inputs, title: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-600" placeholder="Auto-generated if left blank..." />
                  <button onClick={handleAutoGenerateTitle} disabled={!manualStoryText.trim() || isGeneratingTitle} className="px-3 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded-lg border border-indigo-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    {isGeneratingTitle ? <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full block"></span> : <span className="text-lg">✨</span>}
                  </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Special Instructions</label>
              <input type="text" value={inputs.instructions} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({...inputs, instructions: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Make it spooky, add dragons..." />
            </div>
          </div>
          <div>
             <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-indigo-500/50 transition-colors">
                <input type="checkbox" checked={inputs.useSearchGrounding} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({...inputs, useSearchGrounding: e.target.checked})} className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm font-medium text-slate-300">Enrich story with Google Search data (Facts/News)</span>
             </label>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">2. Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Duration (mins)</label>
              <input type="number" value={inputs.durationMinutes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({...inputs, durationMinutes: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-purple-500 outline-none" />
           </div>
           <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Image Interval (mins)</label>
              <input type="number" value={inputs.imageIntervalMinutes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({...inputs, imageIntervalMinutes: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-purple-500 outline-none" />
           </div>
           <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Target Language</label>
              <select value={inputs.targetLanguage} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({...inputs, targetLanguage: e.target.value as Language})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none">
                {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
              </select>
           </div>
           <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Aspect Ratio</label>
              <select value={inputs.aspectRatio} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({...inputs, aspectRatio: e.target.value as AspectRatio})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none">
                {ASPECT_RATIOS.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
              </select>
           </div>
           <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Visual Style</label>
              <select value={inputs.artStyle} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({...inputs, artStyle: e.target.value as ArtStyle})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none">
                {ART_STYLES.map(style => <option key={style.label} value={style.value}>{style.label}</option>)}
              </select>
           </div>
           <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Narrator Voice</label>
              <select value={inputs.voice} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({...inputs, voice: e.target.value as VoiceOption})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none">
                {VOICE_OPTIONS.map(voice => <option key={voice} value={voice}>{voice}</option>)}
              </select>
           </div>
        </div>
      </div>

      <button onClick={startProcessing} disabled={!audioBlob && !manualStoryText.trim()} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-bold text-lg hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all transform hover:scale-[1.01]">
        Transform Story
      </button>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
      <div className="relative w-24 h-24 mb-8">
         <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
         <div className="absolute inset-0 border-t-4 border-indigo-500 rounded-full animate-spin"></div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Magic in Progress</h2>
      <p className="text-slate-400">{loadingMessage}</p>
    </div>
  );

  const renderAssetGenerationStep = () => (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-24">
      
      {/* Control Bar */}
      <div className="flex flex-wrap gap-4 justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 sticky top-4 z-40 shadow-xl backdrop-blur-md bg-opacity-90">
         <div>
             <h2 className="text-xl font-bold text-white">Production Studio</h2>
             <div className="text-xs text-slate-400">Total Scenes: {scenes.length}</div>
         </div>
         
         <div className="flex gap-2 flex-wrap">
            <button onClick={handleGenerateAllImages} disabled={isGeneratingAllImages} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {isGeneratingAllImages ? <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div> : null}
              Generate All Images
            </button>
            <button onClick={handleGenerateAllAudio} disabled={isGeneratingAllAudio} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-600 flex items-center gap-2">
              {isGeneratingAllAudio ? <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div> : null}
              Generate All Audio
            </button>
            <div className="w-px h-8 bg-slate-600 mx-2 hidden md:block"></div>
            <button onClick={startPreview} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-indigo-500/30 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
              Play Movie
            </button>
            <button onClick={startPresentation} className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-pink-500/30 flex items-center gap-2" title="Fullscreen Mode for Screen Recording (No UI)">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Present (Record)
            </button>
            <button onClick={handleExportProject} disabled={isExporting} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-500/30 flex items-center gap-2">
              {isExporting ? <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
              Export Zip
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 lg:col-span-1">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-indigo-400">📖 Story Bible</h3>
            </div>
            <textarea value={storyContext} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStoryContext(e.target.value)} className="w-full h-32 bg-slate-900 border border-slate-700 rounded p-3 text-sm text-slate-300 focus:border-indigo-500 outline-none resize-none scrollbar-thin" placeholder="Detailed setting description..." />
          </div>

          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 lg:col-span-2">
             <div className="flex justify-between items-center mb-4">
                <div>
                   <h3 className="text-lg font-bold text-pink-400">👤 Character Consistency Studio</h3>
                   <div className="text-xs text-slate-500 mt-1">Characters must have reference sheets to be consistent. {!isReadyForSceneGeneration && hasCharacters && <span className="text-red-400 font-bold ml-2">⚠️ Generate all character sheets before creating scenes!</span>}</div>
                </div>
                <button onClick={addCustomCharacter} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 border border-slate-600 transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Character
                </button>
             </div>
             <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
                {characters.length === 0 && <div className="text-slate-500 text-sm p-4 w-full text-center border-2 border-dashed border-slate-700 rounded-lg">No characters extracted. Add one manually.</div>}
                {characters.map(char => (
                    <div key={char.id} className="min-w-[240px] w-[240px] bg-slate-900 rounded-lg p-3 border border-slate-700 flex flex-col gap-2 relative shadow-md">
                        <div className="flex justify-between items-start mb-1">
                            <input type="text" value={char.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCharacter(char.id, { name: e.target.value })} className="bg-transparent border-b border-slate-700 focus:border-indigo-500 text-sm font-bold text-white w-[85%] outline-none pb-1" placeholder="Name" />
                            <button onClick={() => deleteCharacter(char.id)} className="text-slate-600 hover:text-red-400" title="Delete Character"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="aspect-video bg-black rounded overflow-hidden relative group border border-slate-800">
                            {char.referenceImageUrl ? (<img src={char.referenceImageUrl} className="w-full h-full object-cover" onClick={() => window.open(char.referenceImageUrl, '_blank')} />) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 text-xs text-center p-2 bg-slate-800/50">
                                    {char.isGenerating ? (<div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full mb-2"></div>) : (<svg className="w-8 h-8 opacity-20 mb-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 11-14 0 7 7 0 0114 0z" clipRule="evenodd" /></svg>)}
                                    <span className="text-[10px] mt-1">No Reference</span>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-800">
                            <span className="text-[10px] text-slate-500">{char.referenceImageUrl ? 'Ready' : 'Draft'}</span>
                            <button onClick={() => handleGenerateCharacterRef(char.id)} disabled={char.isGenerating} className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded disabled:opacity-50">{char.isGenerating ? '...' : (char.referenceImageUrl ? 'Regenerate' : 'Generate')}</button>
                        </div>
                    </div>
                ))}
             </div>
          </div>
      </div>

      <div className="space-y-8">
          {scenes.map((scene) => (
             <SceneCard 
                key={scene.id}
                scene={scene}
                aspectRatio={inputs.aspectRatio}
                durationMinutes={inputs.durationMinutes / Math.max(scenes.length, 1)}
                onGenerateImage={handleGenerateImage}
                onGenerateVideo={handleGenerateVideo}
                onGenerateTTS={handleGenerateTTS}
                onUpdatePrompt={(id, val) => updateScene(id, { visualPrompt: val })}
                onUpdateScript={(id, val) => updateScene(id, { voiceoverScript: val })}
                onUpdateImage={(id, val) => updateScene(id, { imageUrl: val })}
                onUpdateTone={(id, val) => updateScene(id, { selectedTone: val })}
                onUpdateVoice={(id, val) => updateScene(id, { selectedVoice: val })}
                onUpdateOverlays={(id, val) => updateScene(id, { overlays: val })}
                onUpdateAnimationStyle={(id, styles, config) => updateScene(id, { animationStyles: styles, animationConfig: config })}
                onUpdateAudioSelection={(id, type, val) => updateScene(id, type === 'music' ? { selectedMusicId: val } : { selectedSfxId: val })}
             />
          ))}
      </div>

      {/* Thumbnail Section */}
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl mt-8">
         <h2 className="text-xl font-bold text-white mb-4">YouTube Thumbnail</h2>
         <div className="flex flex-col md:flex-row gap-6">
             <div className="w-full md:w-1/3 space-y-4">
                 <div className="flex gap-2">
                     <select value={thumbnailStyle} onChange={(e) => setThumbnailStyle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none">
                        <option value="" disabled>Select Style</option>
                        {ART_STYLES.map(style => <option key={style.label} value={style.value}>{style.label}</option>)}
                     </select>
                 </div>
                 <input type="text" value={thumbnailTitleText} onChange={(e) => setThumbnailTitleText(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none" placeholder="Main Title Text (e.g. MYSTERY REVEALED)" />
                 <input type="text" value={thumbnailSubtitleText} onChange={(e) => setThumbnailSubtitleText(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none" placeholder="Subtitle (e.g. You won't believe it)" />
                 <textarea value={thumbnailPrompt} onChange={(e) => setThumbnailPrompt(e.target.value)} className="w-full h-24 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white resize-none focus:border-indigo-500 outline-none" placeholder="Custom visual description for thumbnail (optional)..." />
                 <button onClick={handleGenerateThumbnail} disabled={isGeneratingThumbnail} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded font-bold disabled:opacity-50">{isGeneratingThumbnail ? 'Generating...' : 'Generate Thumbnail'}</button>
             </div>
             <div className="w-full md:w-2/3 bg-black rounded-lg aspect-video flex items-center justify-center overflow-hidden border border-slate-700 relative group">
                 {thumbnailUrl ? (
                    <>
                      <img src={thumbnailUrl} className="w-full h-full object-cover" />
                      <a href={thumbnailUrl} download="thumbnail.png" className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity">Download</a>
                    </>
                 ) : (
                    <div className="text-slate-500 text-sm">Thumbnail Preview</div>
                 )}
             </div>
         </div>
      </div>
      
      {/* Final Render Section */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-8 rounded-2xl border border-slate-700 text-center space-y-6 mt-12">
          <h2 className="text-3xl font-bold text-white">Final Production</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">Ready to bake your movie? This will stitch all images and audio into a final MP4 video.</p>
          <div className="flex justify-center gap-4">
             <select value={renderResolution} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRenderResolution(e.target.value as any)} className="bg-slate-900 border border-slate-600 text-white px-4 py-2 rounded-lg">
                <option value="720p">720p (Fast)</option>
                <option value="1080p">1080p (HD)</option>
             </select>
             <button onClick={handleRenderFullVideo} disabled={isRenderingVideo} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold text-lg shadow-[0_0_20px_rgba(220,38,38,0.4)] disabled:opacity-50 transition-all hover:scale-105">
               {isRenderingVideo ? 'Rendering Video...' : 'Render Movie (MP4)'}
             </button>
          </div>
          {isRenderingVideo && (<div className="max-w-md mx-auto mt-4"><div className="w-full bg-slate-700 rounded-full h-2 mb-2"><div className="bg-red-500 h-2 rounded-full animate-pulse w-full"></div></div><p className="text-indigo-300 text-sm animate-pulse">{renderProgress}</p></div>)}
          {renderedVideoUrl && (<div className="mt-8 animate-fade-in"><video controls src={renderedVideoUrl} className="max-w-full rounded-lg shadow-2xl border border-slate-700 mx-auto max-h-[70vh]" /><a href={renderedVideoUrl} download={`${inputs.title.replace(/\s+/g, '_')}_final.mp4`} className="inline-block mt-4 text-indigo-400 hover:text-white underline">Download MP4</a></div>)}
      </div>
    </div>
  );
};

export default App;