
/// <reference lib="dom" />
import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { GoogleGenAI } from '@google/genai';
import { AppStep, UserInput, VoiceOption, ArtStyle, Scene, AspectRatio, TTSTone, Character, Overlay, Language, AppMode, AnimationConfigEntry, FootballInput, SceneLocalization } from './types';
import { DEFAULT_DURATION, DEFAULT_INTERVAL, ART_STYLES, VOICE_OPTIONS, ASPECT_RATIOS, AUDIO_LIBRARY, LANGUAGES, MODELS } from './constants';
import { AudioRecorder } from './components/AudioRecorder';
import { SceneCard } from './components/SceneCard';
import { AnimatedSceneCard } from './components/AnimatedSceneCard';
import { LiveAssistant } from './components/LiveAssistant';
import { KenBurnsPlayer } from './components/KenBurnsPlayer';
import { transcribeAudio, generateStoryScript, generateAnimatedStoryScript, generateFootballScript, generateImage, generateVideo, generateTTS, generateThumbnail, generateCharacterReference, generateTitle, generateVideoPrompt, localizeScript, generateFootballThumbnailSuggestions, localizeThumbnailMetadata, localizeMetadata } from './services/geminiService';
import { renderFullVideo } from './services/videoRenderService';
import { AssetStorage } from './services/assetStorage';
import { burnThumbnailText } from './services/thumbnailUtils';

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

const App: React.FC = () => {
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
    useSearchGrounding: true,
    targetLanguage: Language.English,
    appMode: AppMode.Static,
  });

  // --- Fixture File States ---
  interface FixtureFile {
    name: string;
    content: string;
  }
  const [fixtureFiles, setFixtureFiles] = useState<FixtureFile[]>(() => {
    const saved = localStorage.getItem('yt_studio_fixture_files');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedFixtureName, setSelectedFixtureName] = useState<string>(() => {
    return localStorage.getItem('yt_studio_selected_fixture') || 'manual';
  });

  // --- Auto Publish States ---
  interface AutoPublishState {
    isRunning: boolean;
    isPaused: boolean;
    currentLineIndex: number;
    currentLangIndex: number;
    currentSubStep: 'idle' | 'script' | 'assets' | 'thumbnail' | 'render' | 'publish' | 'backup';
    statusMessage: string;
    errorLog: string[];
    retries: number;
  }
  const [autoPublishState, setAutoPublishState] = useState<AutoPublishState>(() => {
    const saved = localStorage.getItem('yt_studio_auto_publish_state');
    return saved ? JSON.parse(saved) : {
      isRunning: false,
      isPaused: false,
      currentLineIndex: 0,
      currentLangIndex: 0,
      currentSubStep: 'idle',
      statusMessage: '',
      errorLog: [],
      retries: 0
    };
  });

  // --- Scheduler States ---
  const [schedulerEnabled, setSchedulerEnabled] = useState<boolean>(() => {
    return localStorage.getItem('yt_studio_scheduler_enabled') === 'true';
  });
  const [schedulerFrequency, setSchedulerFrequency] = useState<number>(() => {
    return Number(localStorage.getItem('yt_studio_scheduler_frequency')) || 1;
  });
  const [schedulerTimes, setSchedulerTimes] = useState<string[]>(() => {
    const saved = localStorage.getItem('yt_studio_scheduler_times');
    return saved ? JSON.parse(saved) : ['09:00', '15:00', '21:00'];
  });
  const [lastScheduledTrigger, setLastScheduledTrigger] = useState<string>(() => {
    return localStorage.getItem('yt_studio_last_scheduled_trigger') || '';
  });

  useEffect(() => {
    localStorage.setItem('yt_studio_fixture_files', JSON.stringify(fixtureFiles));
  }, [fixtureFiles]);

  useEffect(() => {
    localStorage.setItem('yt_studio_selected_fixture', selectedFixtureName);
  }, [selectedFixtureName]);

  useEffect(() => {
    localStorage.setItem('yt_studio_auto_publish_state', JSON.stringify(autoPublishState));
  }, [autoPublishState]);

  useEffect(() => {
    localStorage.setItem('yt_studio_scheduler_enabled', String(schedulerEnabled));
  }, [schedulerEnabled]);

  useEffect(() => {
    localStorage.setItem('yt_studio_scheduler_frequency', String(schedulerFrequency));
  }, [schedulerFrequency]);

  useEffect(() => {
    localStorage.setItem('yt_studio_scheduler_times', JSON.stringify(schedulerTimes));
  }, [schedulerTimes]);

  useEffect(() => {
    localStorage.setItem('yt_studio_last_scheduled_trigger', lastScheduledTrigger);
  }, [lastScheduledTrigger]);

  // Load fixtures from server
  useEffect(() => {
    const loadFixtures = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/fixtures');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.fixtures)) {
            setFixtureFiles(prev => {
              const merged = [...prev];
              data.fixtures.forEach((sf: FixtureFile) => {
                const idx = merged.findIndex(f => f.name === sf.name);
                if (idx > -1) {
                  merged[idx] = sf;
                } else {
                  merged.push(sf);
                }
              });
              return merged;
            });
          }
        }
      } catch (err) {
        console.error("⚠️ Failed to load fixtures from backend server:", err);
      }
    };
    loadFixtures();
  }, []);

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recorderKey, setRecorderKey] = useState(0);
  const [manualStoryText, setManualStoryText] = useState<string>("");
  const [footballInput, setFootballInput] = useState<FootballInput>({ teamA: '', teamB: '', competition: '', extraContext: '' });
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
  const [thumbnailTopRightText, setThumbnailTopRightText] = useState("");
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [thumbnailStyle, setThumbnailStyle] = useState<ArtStyle | string>("");

  interface LocalizedThumbnail {
    url: string | null;
    titleText: string;
    subtitleText: string;
    topRightText: string;
    prompt: string;
    style: string;
  }
  const [thumbnailLocalizations, setThumbnailLocalizations] = useState<Partial<Record<Language, LocalizedThumbnail>>>({});
  const [burnedThumbnailUrls, setBurnedThumbnailUrls] = useState<Record<Language, string>>({} as any);

  // YouTube Metadata Localization State
  interface LocalizedMetadata {
    title: string;
    description: string;
    tags: string;
  }
  const [youtubeMetadataLocalizations, setYoutubeMetadataLocalizations] = useState<Record<Language, LocalizedMetadata>>({} as any);

  // Video Rendering State
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderProgress, setRenderProgress] = useState("");
  const [renderResolution, setRenderResolution] = useState<'720p' | '1080p' | '1440p'>('720p');
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);

  // YouTube API State
  const [isYoutubeConnected, setIsYoutubeConnected] = useState(false);
  const [youtubeChannel, setYoutubeChannel] = useState<{ title: string; avatar: string; customUrl: string } | null>(null);
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeDescription, setYoutubeDescription] = useState("");
  const [youtubeTags, setYoutubeTags] = useState("story, AI");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishSuccessUrl, setPublishSuccessUrl] = useState<string | null>(null);
  const [serverVideoFilename, setServerVideoFilename] = useState<string | null>(null);
  const [autoPublishToYoutube, setAutoPublishToYoutube] = useState(false);

  // Localization State
  const [currentEditorLanguage, setCurrentEditorLanguage] = useState<Language>(Language.English);
  const [isLocalizing, setIsLocalizing] = useState(false);

  // Preview Mode State
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(true);
  const [isCleanMode, setIsCleanMode] = useState(false);
  const [isPreviewSingleVideo, setIsPreviewSingleVideo] = useState(false);
  const [ttsDuration, setTtsDuration] = useState<number>(0);
  const [videoEnded, setVideoEnded] = useState(false);
  const [audioEnded, setAudioEnded] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);


  // Audio Refs for Multi-track playback
  const previewTtsRef = useRef<HTMLAudioElement>(null);
  const previewMusicRef = useRef<HTMLAudioElement>(null);
  const previewSfxRef = useRef<HTMLAudioElement>(null);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const localizedScenes = React.useMemo(() => {
    return scenes.map(s => {
      if (currentEditorLanguage === Language.English) return s;
      const loc = s.localizations?.[currentEditorLanguage];
      if (loc) {
        return {
          ...s,
          voiceoverScript: loc.voiceoverScript || s.voiceoverScript,
          overlays: loc.overlays || s.overlays,
          imageOverlayText: loc.imageOverlayText || s.imageOverlayText,
          ttsAudioUrl: loc.ttsAudioUrl !== undefined ? loc.ttsAudioUrl : undefined,
          isGeneratingTTS: loc.isGeneratingTTS || false
        };
      }
      return s;
    });
  }, [scenes, currentEditorLanguage]);

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
        const title = await generateTitle(manualStoryText);
        setInputs(prev => ({ ...prev, title }));
      } finally {
        setIsGeneratingTitle(false);
      }
    });
  };

  const startProcessing = async () => {
    if (inputs.appMode !== AppMode.Football && !audioBlob && !manualStoryText.trim())
      return alert("Please record your story OR enter text to continue.");
    if (inputs.appMode === AppMode.Football && (!footballInput.teamA.trim() || !footballInput.teamB.trim()))
      return alert("⚽ Please enter both Team A and Team B names.");

    await executeWithAuthHandler(async () => {
      setStep(AppStep.PROCESSING_SCRIPT);
      setIsProcessing(true);

      try {
        let textSource = "";

        if (inputs.appMode === AppMode.Football) {
          textSource = [footballInput.teamA, 'vs', footballInput.teamB, footballInput.competition, footballInput.extraContext].filter(Boolean).join(' ');
          setLoadingMessage(`⚽ Analyzing ${footballInput.teamA} vs ${footballInput.teamB}...`);
        } else if (audioBlob) {
          setLoadingMessage("Transcribing audio and translating to English...");
          textSource = await transcribeAudio(audioBlob);
        } else {
          textSource = manualStoryText;
          setLoadingMessage("Processing your text...");
        }

        setTranscription(textSource);

        let finalTitle = inputs.title;
        if (!finalTitle.trim()) {
          if (inputs.appMode === AppMode.Football) {
            let baseTournament = footballInput.competition.trim() || 'FIFA-2026 World Cup';
            if (baseTournament.includes(',')) {
              baseTournament = baseTournament.split(',')[0].trim();
            }
            finalTitle = `${footballInput.teamA} vs ${footballInput.teamB} | ${baseTournament}, AI-Simulated 10K Times`;
          } else {
            setLoadingMessage("Analyzing content and generating a catchy title...");
            finalTitle = await generateTitle(textSource);
          }
          setInputs(prev => ({ ...prev, title: finalTitle }));
        }

        setLoadingMessage(inputs.appMode === AppMode.Football ? `⚽ Running AI Simulation in ${inputs.targetLanguage}...` : `Analyzing story and generating script in ${inputs.targetLanguage}...`);
        const storyScenes = Math.floor(inputs.durationMinutes / Math.max(0.1, inputs.imageIntervalMinutes));
        const totalSceneCount = storyScenes + 1;

        console.info(`🚀 [App:Processing] Starting generation. Mode: ${inputs.appMode}, Scenes: ${totalSceneCount}, Duration: ${inputs.durationMinutes}`);

        let result;
        if (inputs.appMode === AppMode.Animated) {
          result = await generateAnimatedStoryScript(
            textSource,
            finalTitle,
            inputs.instructions,
            totalSceneCount,
            inputs.durationMinutes,
            inputs.useSearchGrounding,
            inputs.voice,
            inputs.targetLanguage,
            inputs.artStyle
          );
        } else if (inputs.appMode === AppMode.Football) {
          result = await generateFootballScript(
            footballInput.teamA,
            footballInput.teamB,
            footballInput.competition,
            footballInput.extraContext,
            totalSceneCount,
            inputs.durationMinutes,
            inputs.useSearchGrounding,
            inputs.voice,
            inputs.targetLanguage
          );
        } else {
          result = await generateStoryScript(
            textSource,
            finalTitle,
            inputs.instructions,
            totalSceneCount,
            inputs.durationMinutes,
            inputs.useSearchGrounding,
            inputs.voice,
            inputs.targetLanguage
          );
        }

        console.info(`🚀 [App:Processing] Generation complete. Received ${result.scenes.length} scenes.`);

        setScenes(result.scenes);
        setCharacters(result.characters);
        setStoryContext(result.storyContext);
        setYoutubeTitle(finalTitle);
        const initialDesc = inputs.appMode === AppMode.Football
          ? (() => {
              let baseTournament = footballInput.competition.trim() || 'FIFA-2026 World Cup';
              let groupText = 'Group Stage Matches';
              if (baseTournament.includes(',')) {
                const parts = baseTournament.split(',');
                baseTournament = parts[0].trim();
                const secondPart = parts[1].trim();
                if (secondPart.toLowerCase().startsWith('group-') || secondPart.toLowerCase().startsWith('group ')) {
                  const groupLetter = secondPart.replace(/group[- ]/i, '').trim();
                  groupText = `Group Stage Matches, Group ${groupLetter}`;
                } else {
                  groupText = secondPart;
                }
              }
              return `🎬 AI Cinematic Story: ${footballInput.teamA} vs ${footballInput.teamB} | ${baseTournament}, ${groupText}\nTactical simulation analysis of ${footballInput.teamA} vs ${footballInput.teamB} in ${baseTournament}, ${groupText}.\nGenerated with AI Creator Studio.\nWe don’t guess; we calculate. Football Simulator is a digital laboratory that leverages advanced data models and cutting-edge algorithms to generate the world’s most accurate and realistic football match simulations.\nWe simulate every single fixture 10,000 times in our proprietary data engine. Current team form, player heat maps, xG (expected goals) metrics, injuries, and off-pitch breaking news are directly fed into our algorithm. The result? Not just a random score prediction, but an in-depth, cinematic football documentary that reveals the flow of the game, tactical breaking points, and the most probable scenarios.`;
            })()
          : `🎬 AI Cinematic Story: ${finalTitle}\n\n${result.storyContext}\n\nGenerated with AI Creator Studio.`;
        setYoutubeDescription(initialDesc);

        const initialMetadata = {
          title: finalTitle,
          description: initialDesc,
          tags: inputs.appMode === AppMode.Football
            ? `AI, football, soccer, football simulator, world cup, fifa, fifa 2026, ${footballInput.teamA.toLowerCase()} football team, ${footballInput.teamB.toLowerCase()} football team`
            : "story, AI"
        };
        setYoutubeMetadataLocalizations(prev => ({
          ...prev,
          [inputs.targetLanguage]: initialMetadata
        }));

        // Initialize Thumbnail Settings
        setThumbnailStyle(inputs.artStyle);

        // Pre-populate high-CTR Thumbnail Localizations using AI
        if (inputs.appMode === AppMode.Football) {
          setLoadingMessage("⚽ Designing high-CTR YouTube thumbnail suggestions...");
          try {
            const suggestions = await generateFootballThumbnailSuggestions(
              footballInput.teamA,
              footballInput.teamB,
              footballInput.competition,
              footballInput.extraContext,
              result.characters || [],
              inputs.targetLanguage
            );

            setThumbnailLocalizations({
              [inputs.targetLanguage]: {
                url: null,
                titleText: suggestions.titleText,
                subtitleText: suggestions.subtitleText,
                topRightText: suggestions.topRightText,
                prompt: suggestions.customVisualPrompt,
                style: inputs.artStyle
              }
            });
            
            // Also sync the default single-language states
            setThumbnailTitleText(suggestions.titleText);
            setThumbnailSubtitleText(suggestions.subtitleText);
            setThumbnailTopRightText(suggestions.topRightText);
            setThumbnailPrompt(suggestions.customVisualPrompt);
          } catch (thumbErr) {
            console.error("⚠️ Failed to auto-populate thumbnail suggestions:", thumbErr);
          }
        }

        setStep(AppStep.ASSET_GENERATION);
      } catch (err) {
        console.error("❌ [App:Processing] Core processing pipeline failed:", err);
        setStep(AppStep.INPUT);
        throw err;
      } finally {
        console.info(`✅ [App:Processing] Completed core prompt processing.`);
        setIsProcessing(false);
      }
    });
  };

  const updateScene = (id: number, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => {
      if (s.id !== id) return s;
      if (currentEditorLanguage !== Language.English) {
        const isLocUpdate = updates.voiceoverScript !== undefined || updates.overlays !== undefined || updates.imageOverlayText !== undefined || updates.ttsAudioUrl !== undefined || updates.isGeneratingTTS !== undefined;
        if (isLocUpdate) {
          const newLoc = { ...(s.localizations?.[currentEditorLanguage] || { voiceoverScript: s.voiceoverScript, overlays: s.overlays }), ...updates };
          return {
            ...s,
            localizations: {
              ...s.localizations,
              [currentEditorLanguage]: newLoc as any
            }
          };
        }
      }
      return { ...s, ...updates };
    }));
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
      } catch (e) {
        updateCharacter(charId, { isGenerating: false });
        throw e;
      }
    });
  };

  const handleUploadCharacterRef = async (charId: string, file: File) => {
    if (!file) return;
    updateCharacter(charId, { isGenerating: true });
    try {
      const storedUrl = await AssetStorage.saveAsset(`char_ref_${charId}_${Date.now()}`, file);
      updateCharacter(charId, { referenceImageUrl: storedUrl, isGenerating: false });
    } catch (e) {
      console.error("Upload failed", e);
      alert("Failed to upload character reference image.");
      updateCharacter(charId, { isGenerating: false });
    }
  };

  // --- Scene Asset Logic ---

  const handleGenerateImage = async (id: number, prompt: string) => {
    updateScene(id, { isGeneratingImage: true });
    await executeWithAuthHandler(async () => {
      try {
        const scene = scenes.find(s => s.id === id);
        const imageUrl = await generateImage(prompt, inputs.artStyle, inputs.aspectRatio, storyContext, characters, scene?.imageOverlayText);
        updateScene(id, { imageUrl, isGeneratingImage: false });
      } catch (e) {
        updateScene(id, { isGeneratingImage: false });
        throw e;
      }
    });
  };

  const checkAndPrefillThumbnailOverlays = async (
    targetLanguage: Language,
    overrideThumbnailLocalizations?: Record<string, LocalizedThumbnail>,
    overrideThumbnailUrl?: string | null
  ): Promise<Record<string, LocalizedThumbnail>> => {
    const activeThumbnailLocalizations = { ...(overrideThumbnailLocalizations || thumbnailLocalizations) };
    const activeThumbnailUrl = overrideThumbnailUrl !== undefined ? overrideThumbnailUrl : thumbnailUrl;

    const currentLoc = activeThumbnailLocalizations[targetLanguage];
    const isTitleEmpty = !currentLoc?.titleText?.trim();
    const isSubtitleEmpty = !currentLoc?.subtitleText?.trim();
    const isTopRightEmpty = !currentLoc?.topRightText?.trim();

    if (isTitleEmpty || isSubtitleEmpty || isTopRightEmpty) {
      const defaultTitle = `${footballInput.teamA.trim() || 'Team A'} vs ${footballInput.teamB.trim() || 'Team B'}`;
      const defaultSubtitle = footballInput.competition.trim() || 'FIFA-2026 World Cup, Group-A';
      const defaultTopRight = "10K Times Simulated with AI";

      const englishThumb = activeThumbnailLocalizations[Language.English] || {
        url: null,
        titleText: thumbnailTitleText || "",
        subtitleText: thumbnailSubtitleText || "",
        topRightText: thumbnailTopRightText || "",
        prompt: thumbnailPrompt || "",
        style: thumbnailStyle || inputs.artStyle || ""
      };
      
      const activeBaseUrl = englishThumb.url || activeThumbnailUrl || (Object.values(activeThumbnailLocalizations) as any[]).find(t => t?.url)?.url || null;

      const baseTitleToTranslate = englishThumb.titleText.trim() || defaultTitle;
      const baseSubtitleToTranslate = englishThumb.subtitleText.trim() || defaultSubtitle;
      const baseTopRightToTranslate = englishThumb.topRightText.trim() || defaultTopRight;

      if (targetLanguage === Language.English) {
        const prevLoc = activeThumbnailLocalizations[Language.English] || {
          url: activeBaseUrl,
          titleText: "",
          subtitleText: "",
          topRightText: "",
          prompt: thumbnailPrompt || englishThumb.prompt || "",
          style: thumbnailStyle || englishThumb.style || inputs.artStyle || ""
        };
        const updatedLoc = {
          ...prevLoc,
          url: activeBaseUrl,
          titleText: isTitleEmpty ? baseTitleToTranslate : prevLoc.titleText,
          subtitleText: isSubtitleEmpty ? baseSubtitleToTranslate : prevLoc.subtitleText,
          topRightText: isTopRightEmpty ? baseTopRightToTranslate : prevLoc.topRightText
        };
        const nextMap = {
          ...activeThumbnailLocalizations,
          [Language.English]: updatedLoc
        };
        setThumbnailLocalizations(nextMap);
        
        if (isTitleEmpty) setThumbnailTitleText(baseTitleToTranslate);
        if (isSubtitleEmpty) setThumbnailSubtitleText(baseSubtitleToTranslate);
        if (isTopRightEmpty) setThumbnailTopRightText(baseTopRightToTranslate);
        
        return nextMap;
      } else {
        setIsLocalizing(true);
        try {
          const localizedMeta = await localizeThumbnailMetadata(
            baseTitleToTranslate,
            baseSubtitleToTranslate,
            baseTopRightToTranslate,
            targetLanguage
          );

          const prevLoc = activeThumbnailLocalizations[targetLanguage] || {
            url: activeBaseUrl,
            titleText: "",
            subtitleText: "",
            topRightText: "",
            prompt: englishThumb.prompt || thumbnailPrompt || "",
            style: englishThumb.style || thumbnailStyle || inputs.artStyle || ""
          };
          const updatedLoc = {
            ...prevLoc,
            url: activeBaseUrl,
            titleText: isTitleEmpty ? localizedMeta.titleText : prevLoc.titleText,
            subtitleText: isSubtitleEmpty ? localizedMeta.subtitleText : prevLoc.subtitleText,
            topRightText: isTopRightEmpty ? localizedMeta.topRightText : prevLoc.topRightText
          };
          const nextMap = {
            ...activeThumbnailLocalizations,
            [targetLanguage]: updatedLoc
          };
          setThumbnailLocalizations(nextMap);
          return nextMap;
        } catch (err) {
          console.error(`Failed to prefill and translate thumbnail overlays for ${targetLanguage}:`, err);
        } finally {
          setIsLocalizing(false);
        }
      }
    }
    return activeThumbnailLocalizations;
  };

  // --- Auto Publish Runner Ref ---
  const isStopRequestedRef = useRef(false);
  const isPipelineRunningRef = useRef(false);

  // --- Fixture File Parsing Logic ---
  interface ParsedMatch {
    lineIndex: number;
    originalLine: string;
    teamA: string;
    teamB: string;
    tournament: string;
    stadium: string;
    date: string;
    isCompleted: boolean;
  }

  const parseFixtureMatches = useCallback((content: string): ParsedMatch[] => {
    const lines = content.split(/\r?\n/);
    const parsedMatches: ParsedMatch[] = [];
    let currentTournament = "FIFA-2026 World Cup";

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.toLowerCase().startsWith('tournament:')) {
        currentTournament = trimmed.substring(trimmed.indexOf(':') + 1).trim();
        return;
      }

      const isDone = trimmed.toLowerCase().endsWith('| done') || trimmed.toLowerCase().endsWith(', done') || trimmed.toLowerCase().endsWith('done');
      // Extract match part by removing Done suffix
      let matchPart = trimmed;
      if (isDone) {
        const lastPipe = trimmed.lastIndexOf('|');
        const lastComma = trimmed.lastIndexOf(',');
        const cutIndex = lastPipe >= 0 ? lastPipe : (lastComma >= 0 ? lastComma : trimmed.toLowerCase().lastIndexOf('done'));
        matchPart = trimmed.substring(0, cutIndex).trim();
      }

      // Split all comma-separated parts
      const parts = matchPart.split(',').map(p => p.trim());
      if (parts.length === 0 || !parts[0]) return;

      // --- Detect "Group X, Team A - Team B, Date, Stadium" format ---
      let teamsPartIndex = 0;
      let matchTournament = currentTournament;
      const groupPrefixMatch = parts[0].match(/^Group\s+([A-Za-z0-9]+)$/i);
      if (groupPrefixMatch && parts.length > 1) {
        const groupLetter = groupPrefixMatch[1].toUpperCase();
        // Build tournament string with group info, e.g. "FIFA-2026 World Cup, Group-A"
        const baseTournament = currentTournament.split(',')[0].trim();
        matchTournament = `${baseTournament}, Group-${groupLetter}`;
        teamsPartIndex = 1; // Teams are in the next column
      }

      const teamsPart = parts[teamsPartIndex];
      if (!teamsPart) return;

      let teamA = '';
      let teamB = '';

      const dashMatch = teamsPart.match(/(.+?)\s+-\s+(.+)/);
      const vsMatch = teamsPart.match(/(.+?)\s+vs\s+(.+)/i);

      if (dashMatch) {
        teamA = dashMatch[1].trim();
        teamB = dashMatch[2].trim();
      } else if (vsMatch) {
        teamA = vsMatch[1].trim();
        teamB = vsMatch[2].trim();
      } else {
        return;
      }

      const date = parts[teamsPartIndex + 1] || '';
      const stadium = parts[teamsPartIndex + 2] || '';

      parsedMatches.push({
        lineIndex: idx,
        originalLine: line,
        teamA,
        teamB,
        tournament: matchTournament,
        stadium,
        date,
        isCompleted: isDone
      });
    });

    return parsedMatches;
  }, []);

  const executeStepWithRetry = async <T,>(
    label: string,
    stepName: 'script' | 'assets' | 'thumbnail' | 'render' | 'publish' | 'backup',
    fn: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> => {
    let ret = 0;
    while (true) {
      try {
        console.info(`🔄 [AutoMode] Starting step: "${label}" (attempt ${ret + 1}/${maxRetries + 1})`);
        setAutoPublishState(prev => ({
          ...prev,
          currentSubStep: stepName,
          statusMessage: `${label} (Attempt ${ret + 1}/${maxRetries + 1})...`,
          retries: ret
        }));
        return await fn();
      } catch (err: any) {
        console.error(`❌ [AutoMode] Step "${label}" failed:`, err);
        ret++;
        setAutoPublishState(prev => ({
          ...prev,
          errorLog: [...prev.errorLog, `Error at "${label}" (Attempt ${ret}): ${err.message || String(err)}`]
        }));
        if (ret > maxRetries) {
          throw err;
        }
        const delayMs = ret * 5000;
        console.info(`🔄 [AutoMode] Waiting ${delayMs / 1000}s before retrying...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  };

  const startFullAutoMode = async () => {
    isStopRequestedRef.current = false;
    setAutoPublishState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      errorLog: []
    }));
  };

  const stopFullAutoMode = () => {
    isStopRequestedRef.current = true;
    setAutoPublishState(prev => ({
      ...prev,
      isRunning: false,
      isPaused: false,
      statusMessage: 'Stopped.'
    }));
  };

  const handleResetEngineState = () => {
    if (window.confirm("Are you sure you want to reset the Auto Mode pipeline state and clear all generated assets for this match? This will allow you to start from scratch.")) {
      // 1. Reset auto publish engine status
      setAutoPublishState({
        isRunning: false,
        isPaused: false,
        currentLineIndex: 0,
        currentLangIndex: 0,
        currentSubStep: 'idle',
        statusMessage: 'Reset successfully.',
        errorLog: [],
        retries: 0
      });

      // 2. Clear generated assets
      setScenes([]);
      setCharacters([]);
      setStoryContext("");
      setThumbnailUrl(null);
      setThumbnailLocalizations({});
      setBurnedThumbnailUrls({} as any);
      setYoutubeMetadataLocalizations({} as any);
      setYoutubeTitle("");
      setYoutubeDescription("");
      setServerVideoFilename(null);
      setRenderedVideoUrl(null);
      setPublishSuccessUrl(null);
      setAudioBlob(null);
      setManualStoryText("");
      setTranscription("");

      console.info("🔄 [AutoMode] Engine and project states have been reset by user.");
      alert("Engine and project states have been reset. You can now start from scratch!");
    }
  };


  const runPipelineLoop = async () => {
    console.info("🚀 [AutoMode] Entering pipeline loop...");
    try {
      const fixture = fixtureFiles.find(f => f.name === selectedFixtureName);
      if (!fixture) {
        throw new Error("No fixture file selected.");
      }

      const matches = parseFixtureMatches(fixture.content);
      const pendingMatch = matches.find(m => !m.isCompleted);

      if (!pendingMatch) {
        setAutoPublishState(prev => ({
          ...prev,
          isRunning: false,
          statusMessage: "All matches completed!"
        }));
        alert("🎉 Full Auto Mode Complete! All matches have been published.");
        isPipelineRunningRef.current = false;
        return;
      }

      console.info(`⚽ [AutoMode] Next pending match: ${pendingMatch.teamA} vs ${pendingMatch.teamB}`);
      
      setAutoPublishState(prev => ({
        ...prev,
        currentLineIndex: pendingMatch.lineIndex
      }));

      setFootballInput({
        teamA: pendingMatch.teamA,
        teamB: pendingMatch.teamB,
        competition: pendingMatch.tournament,
        extraContext: `Stadium: ${pendingMatch.stadium}, Date: ${pendingMatch.date}`.trim()
      });

      const MALE_VOICES = [
        VoiceOption.Iapetus,
        VoiceOption.Enceladus,
        VoiceOption.Fenrir,
        VoiceOption.Puck
      ];
      const matchIndex = matches.findIndex(m => m.lineIndex === pendingMatch.lineIndex);
      const activeVoice = matchIndex >= 0 ? MALE_VOICES[matchIndex % MALE_VOICES.length] : VoiceOption.Iapetus;

      console.info(`🎤 [AutoMode] Selected voice for match index ${matchIndex}: ${activeVoice}`);

      setInputs(prev => ({
        ...prev,
        appMode: AppMode.Football,
        durationMinutes: 8,
        imageIntervalMinutes: 0.5,
        targetLanguage: Language.English,
        voice: activeVoice
      }));

      // Initialize local non-stale active variables using current state as a fallback (useful for resumes)
      let activeScenes = [...scenes];
      let activeCharacters = [...characters];
      let activeStoryContext = storyContext;
      let activeThumbnailUrl = thumbnailUrl;
      let activeThumbnailLocalizations = { ...thumbnailLocalizations };
      let activeBurnedThumbnailUrls = { ...burnedThumbnailUrls };
      let activeYoutubeMetadataLocalizations = { ...youtubeMetadataLocalizations };
      let activeYoutubeTitle = youtubeTitle;
      let activeYoutubeDescription = youtubeDescription;

      const languages = [Language.English, Language.Turkish, Language.Spanish, Language.Portuguese];
      let startLangIndex = autoPublishState.currentLangIndex;

      for (let langIdx = startLangIndex; langIdx < languages.length; langIdx++) {
        if (isStopRequestedRef.current) {
          console.info("⏸️ [AutoMode] Pause requested. Breaking language loop.");
          setAutoPublishState(prev => ({ ...prev, isPaused: true, isRunning: false }));
          isPipelineRunningRef.current = false;
          return;
        }

        const currentLang = languages[langIdx];
        setAutoPublishState(prev => ({
          ...prev,
          currentLangIndex: langIdx,
          statusMessage: `Starting process for ${currentLang}...`
        }));

        setCurrentEditorLanguage(currentLang);
        console.info(`🌐 [AutoMode] Processing language: ${currentLang}`);

        if (currentLang === Language.English) {
          const hasEnglishScenes = activeScenes.length > 0 && 
            activeScenes.every(s => s.imageUrl && s.ttsAudioUrl) && 
            (footballInput.teamA.toLowerCase() === pendingMatch.teamA.toLowerCase()) &&
            (footballInput.teamB.toLowerCase() === pendingMatch.teamB.toLowerCase());

          if (hasEnglishScenes) {
            console.info("⚡ [AutoMode] Detected existing English assets matching this match. Skipping English asset generation.");
            setAutoPublishState(prev => ({
              ...prev,
              statusMessage: "Skipping English asset generation (restored from backup)."
            }));
            activeThumbnailUrl = thumbnailUrl || thumbnailLocalizations[Language.English]?.url;
          } else {
            const storyScenes = Math.floor(8 / Math.max(0.1, 0.5)); // Using default 8 / 0.5
            const totalSceneCount = storyScenes + 1;
            
            const scriptResult = await executeStepWithRetry(
              `Generate Script in English`,
              'script',
              async () => {
                return await generateFootballScript(
                  pendingMatch.teamA,
                  pendingMatch.teamB,
                  pendingMatch.tournament,
                  `Stadium: ${pendingMatch.stadium}, Date: ${pendingMatch.date}`,
                  totalSceneCount,
                  8, // duration
                  inputs.useSearchGrounding,
                  activeVoice,
                  Language.English
                );
              }
            );

            activeScenes = scriptResult.scenes;
            activeCharacters = scriptResult.characters;
            activeStoryContext = scriptResult.storyContext;

            setScenes(activeScenes);
            setCharacters(activeCharacters);
            setStoryContext(activeStoryContext);
            
            let baseTournament = pendingMatch.tournament.trim() || 'FIFA-2026 World Cup';
            let groupText = 'Group Stage Matches';
            if (baseTournament.includes(',')) {
              const parts = baseTournament.split(',');
              baseTournament = parts[0].trim();
              const secondPart = parts[1].trim();
              if (secondPart.toLowerCase().startsWith('group-') || secondPart.toLowerCase().startsWith('group ')) {
                const groupLetter = secondPart.replace(/group[- ]/i, '').trim();
                groupText = `Group Stage Matches, Group ${groupLetter}`;
              } else {
                groupText = secondPart;
              }
            }

            const finalTitle = `${pendingMatch.teamA} vs ${pendingMatch.teamB} | ${baseTournament}, AI-Simulated 10K Times`;
            activeYoutubeTitle = finalTitle;
            setYoutubeTitle(finalTitle);
            setInputs(prev => ({ ...prev, title: finalTitle }));

            const initialDesc = `🎬 AI Cinematic Story: ${pendingMatch.teamA} vs ${pendingMatch.teamB} | ${baseTournament}, ${groupText}\nTactical simulation analysis of ${pendingMatch.teamA} vs ${pendingMatch.teamB} in ${baseTournament}, ${groupText}.\nGenerated with AI Creator Studio.\nWe don’t guess; we calculate. Football Simulator is a digital laboratory that leverages advanced data models and cutting-edge algorithms to generate the world’s most accurate and realistic football match simulations.\nWe simulate every single fixture 10,000 times in our proprietary data engine. Current team form, player heat maps, xG (expected goals) metrics, injuries, and off-pitch breaking news are directly fed into our algorithm. The result? Not just a random score prediction, but an in-depth, cinematic football documentary that reveals the flow of the game, tactical breaking points, and the most probable scenarios.`;
            activeYoutubeDescription = initialDesc;
            setYoutubeDescription(initialDesc);

            const initialTags = `AI, football, soccer, football simulator, world cup, fifa, fifa 2026, ${pendingMatch.teamA.toLowerCase()} football team, ${pendingMatch.teamB.toLowerCase()} football team`;

            activeYoutubeMetadataLocalizations = {
              ...activeYoutubeMetadataLocalizations,
              [Language.English]: {
                title: finalTitle,
                description: initialDesc,
                tags: initialTags
              }
            };
            setYoutubeMetadataLocalizations(activeYoutubeMetadataLocalizations);
            setThumbnailStyle(inputs.artStyle);

            const suggestions = await executeStepWithRetry(
              `Generate High-CTR Thumbnail suggestions`,
              'thumbnail',
              async () => {
                return await generateFootballThumbnailSuggestions(
                  pendingMatch.teamA,
                  pendingMatch.teamB,
                  pendingMatch.tournament,
                  `Stadium: ${pendingMatch.stadium}, Date: ${pendingMatch.date}`,
                  activeCharacters,
                  Language.English
                );
              }
            );

            const initialThumb = {
              url: null,
              titleText: suggestions.titleText,
              subtitleText: suggestions.subtitleText,
              topRightText: suggestions.topRightText,
              prompt: suggestions.customVisualPrompt,
              style: inputs.artStyle
            };
            activeThumbnailLocalizations = {
              ...activeThumbnailLocalizations,
              [Language.English]: initialThumb
            };
            setThumbnailLocalizations(activeThumbnailLocalizations);
            setThumbnailTitleText(suggestions.titleText);
            setThumbnailSubtitleText(suggestions.subtitleText);
            setThumbnailTopRightText(suggestions.topRightText);
            setThumbnailPrompt(suggestions.customVisualPrompt);

            // Image generation sequence (Sequential loop with 5s delay)
            const charsToGen = activeCharacters.filter(c => !c.referenceImageUrl);
            for (let i = 0; i < charsToGen.length; i++) {
              if (isStopRequestedRef.current) throw new Error("Pause requested.");
              const char = charsToGen[i];
              const charUrl = await executeStepWithRetry(
                `Generate Character Ref: ${char.name}`,
                'assets',
                async () => {
                  return await generateCharacterReference(char, inputs.artStyle, activeStoryContext);
                }
              );
              activeCharacters = activeCharacters.map(c => c.id === char.id ? { ...c, referenceImageUrl: charUrl } : c);
              setCharacters(activeCharacters);
              if (i < charsToGen.length - 1 || activeScenes.length > 0) {
                await new Promise(r => setTimeout(r, 5000));
              }
            }

            const scenesToGen = activeScenes.filter(s => !s.imageUrl);
            for (let j = 0; j < scenesToGen.length; j++) {
              if (isStopRequestedRef.current) throw new Error("Pause requested.");
              const scene = scenesToGen[j];
              const sceneImgUrl = await executeStepWithRetry(
                `Generate Scene Image ${scene.id + 1}/${activeScenes.length}`,
                'assets',
                async () => {
                  return await generateImage(
                    scene.visualPrompt,
                    inputs.artStyle,
                    inputs.aspectRatio,
                    activeStoryContext,
                    activeCharacters,
                    scene.imageOverlayText
                  );
                }
              );
              activeScenes = activeScenes.map(s => s.id === scene.id ? { ...s, imageUrl: sceneImgUrl } : s);
              setScenes(activeScenes);
              if (j < scenesToGen.length - 1) {
                await new Promise(r => setTimeout(r, 5000));
              }
            }

            // Audio generation sequence (Sequential loop with 5s delay)
            for (let k = 0; k < activeScenes.length; k++) {
              if (isStopRequestedRef.current) throw new Error("Pause requested.");
              const scene = activeScenes[k];
              if (scene.ttsAudioUrl) {
                console.info(`⚡ [AutoMode] English TTS audio already exists for scene ${scene.id + 1}. Skipping generation.`);
                continue;
              }
              const audioUrl = await executeStepWithRetry(
                `Generate Voiceover Audio ${scene.id + 1}/${activeScenes.length}`,
                'assets',
                async () => {
                  return await generateTTS(scene.voiceoverScript, scene.selectedVoice || activeVoice, scene.selectedTone);
                }
              );
              activeScenes = activeScenes.map(s => s.id === scene.id ? { ...s, ttsAudioUrl: audioUrl } : s);
              setScenes(activeScenes);
              if (k < activeScenes.length - 1) {
                await new Promise(r => setTimeout(r, 5000));
              }
            }

            const cleanBaseImageUrl = await executeStepWithRetry(
              `Generate Base Thumbnail Image`,
              'thumbnail',
              async () => {
                return await generateThumbnail(
                  activeYoutubeTitle,
                  inputs.artStyle,
                  activeStoryContext,
                  activeCharacters,
                  suggestions.titleText,
                  suggestions.subtitleText,
                  suggestions.customVisualPrompt
                );
              }
            );

            activeThumbnailUrl = cleanBaseImageUrl;
            setThumbnailUrl(cleanBaseImageUrl);
            activeThumbnailLocalizations = {
              ...activeThumbnailLocalizations,
              [Language.English]: {
                ...activeThumbnailLocalizations[Language.English]!,
                url: cleanBaseImageUrl
              }
            };
            setThumbnailLocalizations(activeThumbnailLocalizations);

            const burnedUrl = await burnThumbnailText(
              cleanBaseImageUrl,
              suggestions.titleText,
              suggestions.subtitleText,
              suggestions.topRightText
            );
            activeBurnedThumbnailUrls = {
              ...activeBurnedThumbnailUrls,
              [Language.English]: burnedUrl
            };
            setBurnedThumbnailUrls(activeBurnedThumbnailUrls);
          }
 
          console.info("💤 [AutoMode] Sleeping 5 seconds before starting render...");
          await new Promise(r => setTimeout(r, 5000));
 
          setRenderResolution('1440p');
          const renderResult = await executeStepWithRetry(
            `Render English Video (1440p)`,
            'render',
            async () => {
              return await renderFullVideo(
                activeScenes,
                inputs.aspectRatio,
                '1440p',
                setRenderProgress,
                false
              );
            }
          );
          setRenderedVideoUrl(renderResult.filename ? `http://localhost:3001/static/${renderResult.filename}` : null);
          setServerVideoFilename(renderResult.filename);
 
          // ZIP Export BEFORE Youtube publish
          await executeStepWithRetry(
            `Export ZIP Backup`,
            'backup',
            async () => {
              await handleExportProject(
                activeScenes,
                activeCharacters,
                activeStoryContext,
                activeThumbnailUrl,
                activeThumbnailLocalizations,
                activeYoutubeMetadataLocalizations,
                activeBurnedThumbnailUrls,
                renderResult.filename ? `http://localhost:3001/static/${renderResult.filename}` : null,
                { ...inputs, title: activeYoutubeTitle }
              );
              return true;
            }
          );
 
          console.info("💤 [AutoMode] Sleeping 5 seconds before starting YouTube publish...");
          await new Promise(r => setTimeout(r, 5000));
 
          await executeStepWithRetry(
            `Publish English Video to YouTube`,
            'publish',
            async () => {
              await executeYoutubePublish(
                renderResult.filename,
                activeYoutubeTitle,
                activeYoutubeDescription,
                activeBurnedThumbnailUrls,
                activeThumbnailLocalizations,
                activeThumbnailUrl,
                activeYoutubeMetadataLocalizations,
                Language.English
              );
              return true;
            }
          );

        } else {
          // --- TARGET LANGUAGE LOCALIZATION ---

          const hasScriptLocalized = activeScenes.every(s => s.localizations?.[currentLang]?.voiceoverScript);
          if (hasScriptLocalized) {
            console.info(`⚡ [AutoMode] Script is already localized to ${currentLang}. Skipping localization step.`);
          } else {
            await executeStepWithRetry(
              `Localize Script & Metadata to ${currentLang}`,
              'script',
              async () => {
                const updatedThumbnailLocs = await checkAndPrefillThumbnailOverlays(currentLang, activeThumbnailLocalizations, activeThumbnailUrl);
                if (updatedThumbnailLocs) {
                  activeThumbnailLocalizations = updatedThumbnailLocs;
                }
                
                const locResults = await localizeScript(activeScenes, currentLang);
                activeScenes = activeScenes.map(s => {
                  const loc = locResults[s.id];
                  if (loc) {
                    return {
                      ...s,
                      localizations: {
                        ...s.localizations,
                        [currentLang]: loc
                      }
                    };
                  }
                  return s;
                });
                setScenes(activeScenes);

                const englishMeta = activeYoutubeMetadataLocalizations[Language.English] || {
                  title: activeYoutubeTitle || inputs.title || "",
                  description: activeYoutubeDescription || "",
                  tags: inputs.appMode === AppMode.Football
                    ? `AI, football, soccer, football simulator, world cup, fifa, fifa 2026, ${pendingMatch.teamA.toLowerCase()} football team, ${pendingMatch.teamB.toLowerCase()} football team`
                    : (youtubeTags || "story, AI")
                };
                
                const localizedMeta = await localizeMetadata(englishMeta, currentLang);
                activeYoutubeMetadataLocalizations = {
                  ...activeYoutubeMetadataLocalizations,
                  [currentLang]: localizedMeta
                };
                setYoutubeMetadataLocalizations(activeYoutubeMetadataLocalizations);

                return true;
              }
            );
          }

          await new Promise(r => setTimeout(r, 2000));

          const targetLangActiveScenes = activeScenes.map(s => {
            const loc = s.localizations?.[currentLang];
            return {
              ...s,
              voiceoverScript: loc?.voiceoverScript || s.voiceoverScript,
              ttsAudioUrl: loc?.ttsAudioUrl
            };
          });

          for (let k = 0; k < targetLangActiveScenes.length; k++) {
            if (isStopRequestedRef.current) throw new Error("Pause requested.");
            const scene = targetLangActiveScenes[k];
            
            if (scene.ttsAudioUrl) {
              console.info(`⚡ [AutoMode] ${currentLang} TTS audio already exists for scene ${scene.id + 1}. Skipping generation.`);
              continue;
            }

            const audioUrl = await executeStepWithRetry(
              `Generate ${currentLang} Voiceover Audio ${scene.id + 1}/${targetLangActiveScenes.length}`,
              'assets',
              async () => {
                return await generateTTS(scene.voiceoverScript, scene.selectedVoice || activeVoice, scene.selectedTone);
              }
            );

            activeScenes = activeScenes.map(s => {
              if (s.id !== scene.id) return s;
              const prevLoc = s.localizations?.[currentLang] || { voiceoverScript: s.voiceoverScript, overlays: s.overlays };
              return {
                ...s,
                localizations: {
                  ...s.localizations,
                  [currentLang]: {
                    ...prevLoc,
                    ttsAudioUrl: audioUrl
                  }
                }
              };
            });
            setScenes(activeScenes);

            if (k < targetLangActiveScenes.length - 1) {
              await new Promise(r => setTimeout(r, 5000));
            }
          }

          let cleanBaseImageUrl = activeThumbnailUrl || activeThumbnailLocalizations[Language.English]?.url;
          if (!cleanBaseImageUrl) {
            console.info("⚡ [AutoMode] Base thumbnail image is missing during localization. Generating it first...");
            let titleText = thumbnailTitleText || "";
            let subtitleText = thumbnailSubtitleText || "";
            let topRightText = thumbnailTopRightText || "";
            let prompt = thumbnailPrompt || "";

            if (!titleText && !subtitleText) {
              const suggestions = await executeStepWithRetry(
                `Generate High-CTR Thumbnail suggestions`,
                'thumbnail',
                async () => {
                  return await generateFootballThumbnailSuggestions(
                    pendingMatch.teamA,
                    pendingMatch.teamB,
                    pendingMatch.tournament,
                    `Stadium: ${pendingMatch.stadium}, Date: ${pendingMatch.date}`,
                    activeCharacters,
                    Language.English
                  );
                }
              );
              titleText = suggestions.titleText;
              subtitleText = suggestions.subtitleText;
              topRightText = suggestions.topRightText;
              prompt = suggestions.customVisualPrompt;

              activeThumbnailLocalizations = {
                ...activeThumbnailLocalizations,
                [Language.English]: {
                  url: null,
                  titleText,
                  subtitleText,
                  topRightText,
                  prompt,
                  style: inputs.artStyle
                }
              };
              setThumbnailLocalizations(activeThumbnailLocalizations);
              setThumbnailTitleText(titleText);
              setThumbnailSubtitleText(subtitleText);
              setThumbnailTopRightText(topRightText);
              setThumbnailPrompt(prompt);
            }

            const generatedBaseUrl = await executeStepWithRetry(
              `Generate Base Thumbnail Image`,
              'thumbnail',
              async () => {
                return await generateThumbnail(
                  activeYoutubeTitle || `${pendingMatch.teamA} vs ${pendingMatch.teamB}`,
                  inputs.artStyle,
                  activeStoryContext,
                  activeCharacters,
                  titleText,
                  subtitleText,
                  prompt
                );
              }
            );

            activeThumbnailUrl = generatedBaseUrl;
            setThumbnailUrl(generatedBaseUrl);
            activeThumbnailLocalizations = {
              ...activeThumbnailLocalizations,
              [Language.English]: {
                ...(activeThumbnailLocalizations[Language.English] || {
                  titleText,
                  subtitleText,
                  topRightText,
                  prompt,
                  style: inputs.artStyle
                }),
                url: generatedBaseUrl
              }
            };
            setThumbnailLocalizations(activeThumbnailLocalizations);
            cleanBaseImageUrl = generatedBaseUrl;
          }

          const localizedThumbLoc = activeThumbnailLocalizations[currentLang] || {
            titleText: `${pendingMatch.teamA} vs ${pendingMatch.teamB}`,
            subtitleText: pendingMatch.tournament || 'FIFA-2026 World Cup, Group-A',
            topRightText: currentLang === Language.Turkish ? "10B Kez AI ile Simüle Edildi" : "10K Times Simulated with AI",
            prompt: thumbnailPrompt || ""
          };

          let cleanLocalizedThumbUrl = activeThumbnailLocalizations[currentLang]?.url;
          if (!cleanLocalizedThumbUrl) {
            cleanLocalizedThumbUrl = await executeStepWithRetry(
              `Generate Localized Thumbnail for ${currentLang}`,
              'thumbnail',
              async () => {
                return await generateThumbnail(
                  activeYoutubeMetadataLocalizations[currentLang]?.title || `${pendingMatch.teamA} vs ${pendingMatch.teamB}`,
                  inputs.artStyle,
                  activeStoryContext,
                  activeCharacters,
                  localizedThumbLoc.titleText,
                  localizedThumbLoc.subtitleText,
                  localizedThumbLoc.prompt
                );
              }
            );

            activeThumbnailLocalizations = {
              ...activeThumbnailLocalizations,
              [currentLang]: {
                ...(activeThumbnailLocalizations[currentLang] || {
                  titleText: localizedThumbLoc.titleText,
                  subtitleText: localizedThumbLoc.subtitleText,
                  topRightText: localizedThumbLoc.topRightText,
                  prompt: localizedThumbLoc.prompt,
                  style: inputs.artStyle
                }),
                url: cleanLocalizedThumbUrl
              }
            };
            setThumbnailLocalizations(activeThumbnailLocalizations);
          }

          let burnedUrl = activeBurnedThumbnailUrls[currentLang];
          if (!burnedUrl) {
            burnedUrl = await burnThumbnailText(
              cleanLocalizedThumbUrl,
              localizedThumbLoc.titleText,
              localizedThumbLoc.subtitleText,
              localizedThumbLoc.topRightText
            );
            activeBurnedThumbnailUrls = {
              ...activeBurnedThumbnailUrls,
              [currentLang]: burnedUrl
            };
            setBurnedThumbnailUrls(activeBurnedThumbnailUrls);
          }

          console.info("💤 [AutoMode] Sleeping 5 seconds before starting render...");
          await new Promise(r => setTimeout(r, 5000));
 
          setRenderResolution('1440p');
          
          const finalLocalizedScenes = activeScenes.map(s => {
            const loc = s.localizations?.[currentLang];
            return {
              ...s,
              voiceoverScript: loc?.voiceoverScript || s.voiceoverScript,
              overlays: loc?.overlays || s.overlays,
              imageOverlayText: loc?.imageOverlayText || s.imageOverlayText,
              ttsAudioUrl: loc?.ttsAudioUrl || s.ttsAudioUrl
            };
          });
  
          const renderResult = await executeStepWithRetry(
            `Render ${currentLang} Video (1440p)`,
            'render',
            async () => {
              return await renderFullVideo(
                finalLocalizedScenes,
                inputs.aspectRatio,
                '1440p',
                setRenderProgress,
                false
              );
            }
          );
          setRenderedVideoUrl(renderResult.filename ? `http://localhost:3001/static/${renderResult.filename}` : null);
          setServerVideoFilename(renderResult.filename);
  
          console.info("💤 [AutoMode] Sleeping 5 seconds before starting YouTube publish...");
          await new Promise(r => setTimeout(r, 5000));
 
          await executeStepWithRetry(
            `Publish ${currentLang} Video to YouTube`,
            'publish',
            async () => {
              await executeYoutubePublish(
                renderResult.filename,
                activeYoutubeMetadataLocalizations[currentLang]?.title,
                activeYoutubeMetadataLocalizations[currentLang]?.description,
                activeBurnedThumbnailUrls,
                activeThumbnailLocalizations,
                activeThumbnailUrl,
                activeYoutubeMetadataLocalizations,
                currentLang
              );
              return true;
            }
          );
        }
      }

      console.info("🎉 [AutoMode] Match successfully published in English, Turkish, Spanish, and Portuguese!");

      const updatedFiles = fixtureFiles.map(f => {
        if (f.name !== selectedFixtureName) return f;
        const fileLines = f.content.split(/\r?\n/);
        fileLines[pendingMatch.lineIndex] = `${pendingMatch.originalLine} | Done`;
        return {
          ...f,
          content: fileLines.join('\n')
        };
      });

      setFixtureFiles(updatedFiles);

      // Save the updated fixture file to the backend filesystem
      const updatedFixture = updatedFiles.find(f => f.name === selectedFixtureName);
      if (updatedFixture) {
        try {
          await fetch('http://localhost:3001/api/fixtures/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: updatedFixture.name, content: updatedFixture.content })
          });
          console.info(`💾 [AutoMode] Updated fixture file saved to backend filesystem: ${updatedFixture.name}`);
        } catch (saveErr) {
          console.error("⚠️ [AutoMode] Failed to save updated fixture to backend filesystem:", saveErr);
        }
      }

      setAutoPublishState(prev => ({
        ...prev,
        isRunning: false,
        currentLangIndex: 0,
        currentSubStep: 'idle',
        statusMessage: `Match ${pendingMatch.teamA} vs ${pendingMatch.teamB} completed successfully!`
      }));

      setCurrentEditorLanguage(Language.English);

      setScenes([]);
      setCharacters([]);
      setStoryContext("");
      setThumbnailUrl(null);
      setRenderedVideoUrl(null);
      setServerVideoFilename(null);

      isPipelineRunningRef.current = false;

    } catch (err: any) {
      console.error("❌ [AutoMode] Critical pipeline error:", err);
      setAutoPublishState(prev => ({
        ...prev,
        isPaused: true,
        isRunning: false,
        statusMessage: `Paused: ${err.message || 'Error occurred.'}`,
        errorLog: [...prev.errorLog, `Critical: ${err.message || String(err)}`]
      }));
      isPipelineRunningRef.current = false;
      alert(`⚠️ Auto Mode Paused!\n\nReason: ${err.message || 'Unknown error'}\n\nYou can review/resume the step after resolving the issue.`);
    }
  };

  useEffect(() => {
    if (autoPublishState.isRunning && !autoPublishState.isPaused && !isPipelineRunningRef.current) {
      isPipelineRunningRef.current = true;
      runPipelineLoop();
    }
  }, [autoPublishState.isRunning, autoPublishState.isPaused]);

  useEffect(() => {
    if (!schedulerEnabled) return;
    const interval = setInterval(() => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`;
      const todayStr = now.toDateString();
      const triggerKey = `${todayStr}_${currentTimeStr}`;

      const activeTimes = schedulerTimes.slice(0, schedulerFrequency);
      if (activeTimes.includes(currentTimeStr) && lastScheduledTrigger !== triggerKey) {
        if (selectedFixtureName === 'manual') {
          console.warn("⚠️ [Scheduler] Cannot automatically launch: Competition / Tournament drop-down is set to 'manual'. Please select a fixture file.");
          return;
        }
        console.info(`⏰ [Scheduler] Time matched (${currentTimeStr}). Automatically launching Full Auto Publish!`);
        setLastScheduledTrigger(triggerKey);
        startFullAutoMode();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [schedulerEnabled, schedulerFrequency, schedulerTimes, lastScheduledTrigger]);

  const handleLocalize = async (targetLanguage: Language) => {
    // 1. Always check and prefill empty thumbnail overlays first
    await checkAndPrefillThumbnailOverlays(targetLanguage);

    if (targetLanguage === currentEditorLanguage) return;
    
    // Switch the tab immediately
    setCurrentEditorLanguage(targetLanguage);
    
    if (targetLanguage !== Language.English && !scenes.some(s => s.localizations?.[targetLanguage])) {
      setIsLocalizing(true);
      try {
        const locResults = await localizeScript(scenes, targetLanguage);
        setScenes(prev => prev.map(s => {
          const loc = locResults[s.id];
          if (loc) {
            return {
              ...s,
              localizations: {
                ...s.localizations,
                [targetLanguage]: loc
              }
            };
          }
          return s;
        }));

        // Automatically localize the YouTube video metadata
        if (!youtubeMetadataLocalizations[targetLanguage]) {
          const englishMeta = youtubeMetadataLocalizations[Language.English] || {
            title: youtubeTitle || inputs.title || "",
            description: youtubeDescription || "",
            tags: inputs.appMode === AppMode.Football
              ? `AI, football, soccer, football simulator, world cup, fifa, fifa 2026, ${footballInput.teamA.toLowerCase()} football team, ${footballInput.teamB.toLowerCase()} football team`
              : (youtubeTags || "story, AI")
          };
          
          const localizedMeta = await localizeMetadata(englishMeta, targetLanguage);
          setYoutubeMetadataLocalizations(prev => ({
            ...prev,
            [targetLanguage]: localizedMeta
          }));
        }
      } catch (e) {
        console.error("Localization failed", e);
        alert("Localization failed");
        return;
      } finally {
        setIsLocalizing(false);
      }
    }
  };

  const handleGenerateAllImages = async () => {
    const charactersToProcess = characters.filter(c => !c.referenceImageUrl && !c.isGenerating);
    const scenesToProcess = scenes.filter(s => !s.imageUrl && !s.isGeneratingImage);
    if (charactersToProcess.length === 0 && scenesToProcess.length === 0) return;

    setIsGeneratingAllImages(true);
    try {
      // 1. First, all characters images should be generated successfully
      for (let i = 0; i < charactersToProcess.length; i++) {
        const char = charactersToProcess[i];
        await handleGenerateCharacterRef(char.id);
        
        // 5-second interval between each image generation API call (both characters and scenes)
        if (i < charactersToProcess.length - 1 || scenesToProcess.length > 0) {
          await delay(5000);
        }
      }

      // 2. Then, after characters are all generated, scene images will start to be generated one by one 5 seconds interval each
      for (let j = 0; j < scenesToProcess.length; j++) {
        const scene = scenesToProcess[j];
        await handleGenerateImage(scene.id, scene.visualPrompt);
        
        if (j < scenesToProcess.length - 1) {
          await delay(5000);
        }
      }
    } catch (e) {
      console.error("❌ [App:GenerateAllImages] Failed to generate all images:", e);
    } finally {
      setIsGeneratingAllImages(false);
    }
  };



  const handleGenerateVideoPrompt = async (id: number) => {
    const scene = scenes.find(s => s.id === id);
    if (!scene) return;
    updateScene(id, { isGeneratingVideoPrompt: true });
    await executeWithAuthHandler(async () => {
      try {
        const videoPrompt = await generateVideoPrompt(storyContext, scene);
        updateScene(id, { videoPrompt, isGeneratingVideoPrompt: false });
      } catch (e) {
        updateScene(id, { isGeneratingVideoPrompt: false });
        throw e;
      }
    });
  };

  const handleGenerateVideo = async (id: number) => {
    const scene = scenes.find(s => s.id === id);
    if (!scene?.imageUrl) return;
    updateScene(id, { isGeneratingVideo: true });
    await executeWithAuthHandler(async () => {
      try {
        const videoUrl = await generateVideo(
          scene.imageUrl,
          inputs.aspectRatio,
          undefined, // endImageSrc no longer used
          scene.videoPrompt,
          scene.videoOptions
        );
        // Store in local storage to keep RAM clean
        const storedUrl = await AssetStorage.saveAsset(`video_${id}_${Date.now()}`, await (await fetch(videoUrl)).blob());
        updateScene(id, { videoUrl: storedUrl, isGeneratingVideo: false });
      } catch (e) {
        updateScene(id, { isGeneratingVideo: false });
        throw e;
      }
    });
  };



  const handleGenerateTTS = async (id: number, tone: TTSTone) => {
    const scene = scenes.find(s => s.id === id);
    if (!scene) return;
    
    let targetScript = scene.voiceoverScript;
    if (currentEditorLanguage !== Language.English && scene.localizations?.[currentEditorLanguage]?.voiceoverScript) {
      targetScript = scene.localizations[currentEditorLanguage]!.voiceoverScript;
    }
    
    if (!targetScript) return;
    updateScene(id, { isGeneratingTTS: true });
    await executeWithAuthHandler(async () => {
      try {
        const voiceToUse = scene.selectedVoice || inputs.voice;
        const ttsAudioUrl = await generateTTS(targetScript, voiceToUse, tone);
        updateScene(id, { ttsAudioUrl, isGeneratingTTS: false });
      } catch (e) {
        updateScene(id, { isGeneratingTTS: false });
        throw e;
      }
    });
  };

  const handleGenerateAllAudio = async () => {
    const scenesToProcess = localizedScenes.filter(s => !s.ttsAudioUrl && !s.isGeneratingTTS);
    if (scenesToProcess.length === 0) return;

    setIsGeneratingAllAudio(true);
    try {
      for (let i = 0; i < scenesToProcess.length; i++) {
        const scene = scenesToProcess[i];
        await handleGenerateTTS(scene.id, scene.selectedTone);
        
        if (i < scenesToProcess.length - 1) {
          await delay(5000);
        }
      }
    } catch (e) {
      console.error("❌ [App:GenerateAllAudio] Failed to generate all audio:", e);
    } finally {
      setIsGeneratingAllAudio(false);
    }
  };

  const handleGenerateThumbnail = async () => {
    let titleToUse = inputs.title;
    if (!titleToUse && inputs.appMode === AppMode.Football) {
      const baseTournament = footballInput.competition.trim() || 'FIFA-2026 World Cup';
      titleToUse = `${footballInput.teamA} vs ${footballInput.teamB} | ${baseTournament.split(',')[0].trim()}, AI-Simulated 10K Times`;
    }
    if (!titleToUse) {
      alert("Project title is required to generate a thumbnail.");
      return;
    }
    if (!inputs.title) {
      setInputs(prev => ({ ...prev, title: titleToUse }));
    }
    setIsGeneratingThumbnail(true);
    await executeWithAuthHandler(async () => {
      try {
        const currentThumbLoc = thumbnailLocalizations[currentEditorLanguage] || {
          url: null,
          titleText: thumbnailTitleText || "",
          subtitleText: thumbnailSubtitleText || "",
          topRightText: thumbnailTopRightText || "",
          prompt: thumbnailPrompt || "",
          style: thumbnailStyle || inputs.artStyle || ""
        };

        const url = await generateThumbnail(
          titleToUse,
          currentThumbLoc.style || (thumbnailStyle as string),
          storyContext,
          characters,
          currentThumbLoc.titleText,
          currentThumbLoc.subtitleText,
          currentThumbLoc.prompt
        );

        setThumbnailLocalizations(prev => {
          const updated = { ...prev };
          for (const lang of Object.keys(updated)) {
            if (updated[lang]) {
              updated[lang] = { ...updated[lang] as any, url };
            }
          }
          updated[currentEditorLanguage] = {
            ...currentThumbLoc,
            url
          };
          return updated;
        });

        setThumbnailUrl(url); // Sync for backward compatibility
      } catch (e) {
        console.error(e);
        alert("Thumbnail gen failed");
      } finally {
        setIsGeneratingThumbnail(false);
      }
    });
  };

  const handleRenderFullVideo = async () => {
    const isAnimatedMode = inputs.appMode === AppMode.Animated;

    // Different validation for Animated vs Static mode
    if (isAnimatedMode) {
      if (scenes.some(s => !s.videoUrl || !s.ttsAudioUrl)) {
        alert("Please generate all Animated Videos and Voiceover Audio for every scene before rendering the final movie.");
        return;
      }
    } else {
      if (scenes.some(s => !s.imageUrl || !s.ttsAudioUrl)) {
        alert("Please generate all Images and Audio for every scene before rendering the final movie.");
        return;
      }
    }

    const modeLabel = isAnimatedMode ? 'Animated' : (inputs.appMode === AppMode.Football ? 'Football' : 'Static');
    console.info(`🎥 [App:Render:${modeLabel}] Starting full video render for all scenes. Resolution: ${renderResolution}`);
    console.time(`🎥 [App:Render:${modeLabel}] Full Render Duration`);
    setIsRenderingVideo(true);
    setRenderedVideoUrl(null);
    setRenderProgress("Initializing...");
    try {
      const { filename } = await renderFullVideo(
        localizedScenes,
        inputs.aspectRatio,
        renderResolution,
        setRenderProgress,
        isAnimatedMode
      );
      const url = filename ? `http://localhost:3001/static/${filename}` : null;
      console.info(`🎥 [App:Render:${modeLabel}] Render successful. Asset URL generated. Filename: ${filename}`);
      setRenderedVideoUrl(url);
      setServerVideoFilename(filename);

      if (autoPublishToYoutube && filename) {
        setTimeout(() => {
          executeYoutubePublish(filename);
        }, 500);
      }
    } catch (e: any) {
      console.error(`❌ [App:Render:${modeLabel}] Render failed:`, e);
      alert(`Video rendering failed!\n\nDetails: ${e.message || "Unknown error"}`);
    } finally {
      setIsRenderingVideo(false);
      setRenderProgress("");
      console.timeEnd(`🎥 [App:Render:${modeLabel}] Full Render Duration`);
    }
  };

  const currentLangRef = useRef<Language>(currentEditorLanguage);
  useEffect(() => {
    currentLangRef.current = currentEditorLanguage;
  }, [currentEditorLanguage]);

  const checkYoutubeStatus = async (lang = currentLangRef.current) => {
    try {
      const response = await fetch(`http://localhost:3001/api/youtube/status?lang=${lang}`);
      const data = await response.json();
      if (data.isConnected) {
        setIsYoutubeConnected(true);
        setYoutubeChannel(data.channel);
      } else {
        setIsYoutubeConnected(false);
        setYoutubeChannel(null);
      }
    } catch (e) {
      console.error("Failed to check YouTube status:", e);
    }
  };

  useEffect(() => {
    checkYoutubeStatus(currentEditorLanguage);
  }, [currentEditorLanguage]);

  useEffect(() => {
    checkYoutubeStatus();

    // Listen for cross-window messages (instant notification from popup)
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'YOUTUBE_CONNECTED') {
        console.info("🔗 [YouTube] Received YOUTUBE_CONNECTED from popup callback. Syncing...");
        checkYoutubeStatus(currentLangRef.current);
      }
    };

    // Listen for window focus to catch any manual popup closures or redirects
    const handleFocus = () => {
      console.info("🔗 [YouTube] App window focused. Syncing YouTube connection status...");
      checkYoutubeStatus(currentLangRef.current);
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Debounced effect to burn high-CTR overlay texts onto the generated base images
  useEffect(() => {
    const handler = setTimeout(async () => {
      const cleanBaseImageUrl = thumbnailLocalizations[Language.English]?.url ||
                                (Object.values(thumbnailLocalizations) as any[]).find(t => t?.url)?.url ||
                                thumbnailUrl;

      if (!cleanBaseImageUrl) return;

      for (const [lang, thumbVal] of Object.entries(thumbnailLocalizations)) {
        const langEnum = lang as Language;
        const thumb = thumbVal as LocalizedThumbnail;
        if (thumb) {
          try {
            const burnedUrl = await burnThumbnailText(
              cleanBaseImageUrl,
              thumb.titleText || "",
              thumb.subtitleText || "",
              thumb.topRightText || ""
            );
            setBurnedThumbnailUrls(prev => {
              if (prev[langEnum] === burnedUrl) return prev;
              return {
                ...prev,
                [langEnum]: burnedUrl
              };
            });
          } catch (err) {
            console.error(`Failed to burn thumbnail text for ${lang}:`, err);
          }
        }
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [thumbnailLocalizations, thumbnailUrl]);

  const handleConnectYoutube = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/youtube/auth-url?lang=${currentEditorLanguage}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data.url) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(data.url, 'YouTubeAuth', `width=${width},height=${height},left=${left},top=${top}`);
        
        const timer = setInterval(async () => {
          try {
            if (!popup || popup.closed) {
              clearInterval(timer);
              console.info("🔗 [YouTube] OAuth popup closed. Syncing YouTube status...");
              await checkYoutubeStatus();
            }
          } catch (e) {
            console.warn("🔗 [YouTube] Checking popup.closed was blocked by cross-origin policies. Will rely on focus/message events:", e);
          }
        }, 1000);
      } else {
        throw new Error("No authorization URL returned from server.");
      }
    } catch (err: any) {
      console.error("Failed to connect YouTube:", err);
      alert(`Failed to initiate YouTube connection: ${err.message}`);
    }
  };

  const handleDisconnectYoutube = async () => {
    if (confirm("Are you sure you want to disconnect your YouTube channel?")) {
      try {
        const res = await fetch(`http://localhost:3001/api/youtube/disconnect?lang=${currentEditorLanguage}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          setIsYoutubeConnected(false);
          setYoutubeChannel(null);
          setPublishSuccessUrl(null);
        }
      } catch (e) {
        console.error(e);
        alert("Failed to disconnect YouTube.");
      }
    }
  };

  const executeYoutubePublish = async (
    filename: string | null,
    overrideTitle?: string,
    overrideDescription?: string,
    overrideBurnedThumbnailUrls?: Record<string, string>,
    overrideThumbnailLocalizations?: Record<string, LocalizedThumbnail>,
    overrideThumbnailUrl?: string | null,
    overrideYoutubeMetadataLocalizations?: Record<string, any>,
    overrideLang?: Language
  ) => {
    setIsPublishing(true);
    setPublishProgress(10);
    setPublishSuccessUrl(null);

    try {
      const formData = new FormData();
      const activeLang = overrideLang || currentEditorLanguage;
      formData.append('lang', activeLang);
      if (filename) {
        formData.append('videoFilename', filename);
      }
      
      // If we have a local rendered video URL (from imports) and NO server-side filename, retrieve and upload the actual video file!
      if (renderedVideoUrl && !filename) {
        try {
          console.info("🔗 [YouTube] Fetching local video Blob to upload to server...");
          setPublishProgress(15);
          const videoResponse = await fetch(renderedVideoUrl);
          const videoBlob = await videoResponse.blob();
          formData.append('video', videoBlob, filename || 'imported_video.mp4');
          console.info("🔗 [YouTube] Appended video Blob to upload payload.");
        } catch (e) {
          console.error("🔗 [YouTube] Failed to append video Blob:", e);
        }
      }

      const activeTitle = overrideTitle || youtubeTitle || inputs.title || "";
      const activeDescription = overrideDescription || youtubeDescription || "";
      const activeBurnedThumbnailUrls = overrideBurnedThumbnailUrls || burnedThumbnailUrls;
      const activeThumbnailLocalizations = overrideThumbnailLocalizations || thumbnailLocalizations;
      const activeThumbnailUrl = overrideThumbnailUrl !== undefined ? overrideThumbnailUrl : thumbnailUrl;
      const activeYoutubeLocs = overrideYoutubeMetadataLocalizations || youtubeMetadataLocalizations;

      const currentMeta = activeYoutubeLocs[activeLang] || {
        title: activeTitle,
        description: activeDescription,
        tags: inputs.appMode === AppMode.Football
          ? `AI, football, soccer, football simulator, world cup, fifa, fifa 2026, ${footballInput.teamA.toLowerCase()} football team, ${footballInput.teamB.toLowerCase()} football team`
          : (youtubeTags || "story, AI")
      };

      formData.append('title', currentMeta.title || 'AI Story Video');
      
      let finalDesc = currentMeta.description;
      if (!finalDesc.trim()) {
        finalDesc = `🎬 AI Cinematic Story: ${inputs.title}\n\n${storyContext}\n\nGenerated with AI Creator Studio.`;
      }
      formData.append('description', finalDesc);
      
      const tagsArray = (currentMeta.tags || "").split(',').map(t => t.trim()).filter(Boolean);
      formData.append('tags', JSON.stringify(tagsArray));
      formData.append('category', inputs.appMode === AppMode.Football ? "17" : "22");

      const activeThumbUrl = activeBurnedThumbnailUrls[activeLang] || 
                             activeThumbnailLocalizations[activeLang]?.url || 
                             activeThumbnailUrl;
      if (activeThumbUrl) {
        try {
          setPublishProgress(25);
          const response = await fetch(activeThumbUrl);
          const blob = await response.blob();
          formData.append('thumbnail', blob, 'thumbnail.png');
        } catch (e) {
          console.warn("Could not retrieve custom thumbnail for YouTube upload:", e);
        }
      }

      setPublishProgress(45);
      const uploadRes = await fetch('http://localhost:3001/api/youtube/upload', {
        method: 'POST',
        body: formData
      });

      setPublishProgress(85);
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Server rejected the upload.');
      }

      if (uploadData.success) {
        setPublishProgress(100);
        setPublishSuccessUrl(uploadData.videoUrl);
        if (!autoPublishState.isRunning) {
          alert("🎉 Video successfully published to YouTube as Private!");
        } else {
          console.info("🎉 [AutoMode] Video successfully published to YouTube as Private!");
        }
      }
    } catch (err: any) {
      console.error("YouTube automated publish failed:", err);
      if (!autoPublishState.isRunning) {
        alert(`YouTube automated publishing failed: ${err.message || 'Unknown error'}`);
      } else {
        throw err;
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishToYoutube = () => {
    if (!serverVideoFilename && !renderedVideoUrl) {
      alert("Please render the movie first before publishing.");
      return;
    }
    executeYoutubePublish(serverVideoFilename);
  };

  // --- Export Functionality (Zip) ---
  const handleExportProject = async (
    overrideScenes?: Scene[],
    overrideCharacters?: Character[],
    overrideStoryContext?: string,
    overrideThumbnailUrl?: string | null,
    overrideThumbnailLocalizations?: Record<string, LocalizedThumbnail>,
    overrideYoutubeMetadataLocalizations?: Record<string, any>,
    overrideBurnedThumbnailUrls?: Record<string, string>,
    overrideRenderedVideoUrl?: string | null,
    overrideInputs?: UserInput
  ) => {
    const activeScenes = overrideScenes || scenes;
    const activeCharacters = overrideCharacters || characters;
    const activeStoryContext = overrideStoryContext || storyContext;
    const activeThumbnailUrl = overrideThumbnailUrl !== undefined ? overrideThumbnailUrl : thumbnailUrl;
    const activeThumbnailLocs = overrideThumbnailLocalizations || thumbnailLocalizations;
    const activeYoutubeLocs = overrideYoutubeMetadataLocalizations || youtubeMetadataLocalizations;
    const activeBurnedThumbnailUrls = overrideBurnedThumbnailUrls || burnedThumbnailUrls;
    const activeRenderedVideoUrl = overrideRenderedVideoUrl !== undefined ? overrideRenderedVideoUrl : renderedVideoUrl;
    const activeInputs = overrideInputs || inputs;

    if (activeScenes.length === 0) return;
    console.info(`📦 [Export] Starting ZIP export for ${activeScenes.length} scenes...`);
    console.time('📦 [Export] ZIP Operations');
    setIsExporting(true);
    try {
      const zip = new JSZip();
      let folderName = activeInputs.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      if (!folderName) folderName = "project";

      const root = zip.folder(folderName);
      if (!root) throw new Error("Zip error");

      const projectState = {
        inputs: activeInputs,
        storyContext: activeStoryContext,
        characters: activeCharacters,
        footballInput,
        scenes: activeScenes.map(s => {
          const localizationsCopy: Record<string, any> = {};
          if (s.localizations) {
            for (const [lang, locVal] of Object.entries(s.localizations)) {
              const loc = locVal as SceneLocalization;
              localizationsCopy[lang] = {
                ...loc,
                ttsAudioUrl: loc.ttsAudioUrl ? `audio/scene_${s.id}_${lang}_audio.wav` : null
              };
            }
          }
          return {
            ...s,
            imageUrl: s.imageUrl ? `images/scene_${s.id}_image.png` : null,
            imageUrlEnd: s.imageUrlEnd ? `images/scene_${s.id}_image_end.png` : null,
            videoUrl: s.videoUrl ? `videos/scene_${s.id}_video.mp4` : null,
            ttsAudioUrl: s.ttsAudioUrl ? `audio/scene_${s.id}_audio.wav` : null,
            localizations: localizationsCopy,
            characterRefId: s.characterRefId,
            overlays: s.overlays || [],
            selectedMusicId: s.selectedMusicId,
            selectedSfxId: s.selectedSfxId
          };
        }),
        thumbnailPath: activeThumbnailUrl ? `images/thumbnail.png` : null,
        thumbnailBaseUrl: activeThumbnailUrl ? `images/thumbnail_base.png` : null,
        thumbnailLocalizations: Object.entries(activeThumbnailLocs).reduce((acc, [lang, thumbVal]) => {
          const thumb = thumbVal as LocalizedThumbnail;
          if (thumb) {
            acc[lang] = {
              ...thumb,
              url: thumb.url ? `images/thumbnail_${lang}.png` : null,
              baseUrl: thumb.url ? `images/thumbnail_base_${lang}.png` : null
            };
          }
          return acc;
        }, {} as Record<string, any>),
        youtubeMetadataLocalizations: activeYoutubeLocs,
        charactersData: activeCharacters.map(c => ({
          ...c,
          referenceImageUrl: c.referenceImageUrl ? `images/char_${c.id}.png` : null
        })),
        renderedVideoPath: activeRenderedVideoUrl ? `videos/rendered_video.mp4` : null,
        serverVideoFilename: serverVideoFilename
      };
      root.file("project_data.json", JSON.stringify(projectState, null, 2));

      // Create readable script
      const fullScript = activeScenes.map(s =>
        `SCENE ${s.id + 1} (${s.timeRange})\nVISUAL: ${s.visualPrompt}\nAUDIO: ${s.voiceoverScript}\nMUSIC: ${s.selectedMusicId}\nSFX: ${s.selectedSfxId}\n`
      ).join('\n-------------------\n');
      root.file("script.txt", fullScript);
      root.file("story_bible.txt", activeStoryContext);

      const audioFolder = root.folder("audio");
      const imageFolder = root.folder("images");
      const videoFolder = root.folder("videos");

      const dataUrlToBlob = async (dataUrl: string) => {
        try {
          const res = await fetch(dataUrl);
          if (!res.ok) throw new Error(`HTTP status ${res.status}`);
          return await res.blob();
        } catch (err) {
          console.warn(`⚠️ [Export] Failed to fetch data URL for ZIP backup:`, dataUrl, err);
          return null;
        }
      };

      for (const scene of activeScenes) {
        if (scene.imageUrl && imageFolder) {
          const blob = await dataUrlToBlob(scene.imageUrl);
          if (blob) imageFolder.file(`scene_${scene.id}_image.png`, blob);
        }
        if (scene.imageUrlEnd && imageFolder) {
          const blob = await dataUrlToBlob(scene.imageUrlEnd);
          if (blob) imageFolder.file(`scene_${scene.id}_image_end.png`, blob);
        }
        if (scene.videoUrl && videoFolder) {
          const blob = await dataUrlToBlob(scene.videoUrl);
          if (blob) videoFolder.file(`scene_${scene.id}_video.mp4`, blob);
        }
        if (scene.ttsAudioUrl && audioFolder) {
          const blob = await dataUrlToBlob(scene.ttsAudioUrl);
          if (blob) audioFolder.file(`scene_${scene.id}_audio.wav`, blob);
        }
        if (scene.localizations && audioFolder) {
          for (const [lang, locVal] of Object.entries(scene.localizations)) {
            const loc = locVal as SceneLocalization;
            if (loc.ttsAudioUrl) {
              const blob = await dataUrlToBlob(loc.ttsAudioUrl);
              if (blob) audioFolder.file(`scene_${scene.id}_${lang}_audio.wav`, blob);
            }
          }
        }
      }
      for (const char of activeCharacters) {
        if (char.referenceImageUrl && imageFolder) {
          const blob = await dataUrlToBlob(char.referenceImageUrl);
          if (blob) imageFolder.file(`char_${char.id}.png`, blob);
        }
      }
      if (activeThumbnailUrl && imageFolder) {
        try {
          const baseBlob = await dataUrlToBlob(activeThumbnailUrl);
          if (baseBlob) imageFolder.file("thumbnail_base.png", baseBlob);
        } catch (e) {
          console.error("Error exporting default base thumbnail:", e);
        }
        const defaultBurnedUrl = activeBurnedThumbnailUrls[Language.English] || 
                                 Object.values(activeBurnedThumbnailUrls)[0] || 
                                 activeThumbnailUrl;
        const blob = await dataUrlToBlob(defaultBurnedUrl);
        if (blob) imageFolder.file("thumbnail.png", blob);
      }
      for (const [lang, thumbVal] of Object.entries(activeThumbnailLocs)) {
        const thumb = thumbVal as LocalizedThumbnail;
        const langEnum = lang as Language;
        if (thumb?.url && imageFolder) {
          try {
            const baseBlob = await dataUrlToBlob(thumb.url);
            if (baseBlob) imageFolder.file(`thumbnail_base_${lang}.png`, baseBlob);
          } catch (e) {
            console.error(`Error exporting base thumbnail for ${lang}:`, e);
          }
        }
        const targetUrl = activeBurnedThumbnailUrls[langEnum] || thumb?.url;
        if (targetUrl && imageFolder) {
          try {
            const blob = await dataUrlToBlob(targetUrl);
            if (blob) imageFolder.file(`thumbnail_${lang}.png`, blob);
          } catch (e) {
            console.error(`Error exporting thumbnail for ${lang}:`, e);
          }
        }
      }
      if (activeRenderedVideoUrl && videoFolder && !activeRenderedVideoUrl.startsWith('http://localhost:3001/static/')) {
        console.info(`📦 [Export] Bundling final rendered MP4 video...`);
        const blob = await dataUrlToBlob(activeRenderedVideoUrl);
        if (blob) videoFolder.file(`rendered_video.mp4`, blob);
      } else {
        console.info(`📦 [Export] Skipping large video file download for ZIP archive since it is saved on server.`);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const filename = `${folderName}_complete_project.zip`;

      // Upload/Save ZIP directly in the external volume on server
      try {
        console.info("📦 [Export] Pushing ZIP to server to save on external volume...");
        const formData = new FormData();
        formData.append('zip', content, filename);
        const saveRes = await fetch('http://localhost:3001/api/project/save-zip', {
          method: 'POST',
          body: formData
        });
        if (saveRes.ok) {
          const saveData = await saveRes.json();
          console.info("📦 [Export] Project ZIP successfully saved to external volume path:", saveData.path);
        } else {
          console.warn("⚠️ Server rejected ZIP save to external volume.");
        }
      } catch (err) {
        console.error("⚠️ Failed to automatically save ZIP to external volume:", err);
      }

      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.info(`📦 [Export] ZIP download initiated successfully.`);
    } catch (e) {
      console.error(`❌ [Export] Export failed:`, e);
      alert("Export failed.");
    } finally {
      console.timeEnd('📦 [Export] ZIP Operations');
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

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const timeRangeMatch = block.match(/SCENE \d+ \((.*?)\)/);
      const timeRange = timeRangeMatch ? timeRangeMatch[1] : "0:00";

      let overlays: Overlay[] = [];
      const overlayMatch = block.match(/OVERLAYS: (\[.*\])/);
      if (overlayMatch) {
        try { overlays = JSON.parse(overlayMatch[1]); } catch (e) { }
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
        isGeneratingImageEnd: false,
        isGeneratingVideo: false,
        isGeneratingVideoPrompt: false,
        isGeneratingTTS: false,
        selectedTone: TTSTone.Neutral,
        selectedVoice: inputs.voice,
        selectedMusicId: musicMatch ? musicMatch[1] : 'music_mystical',
        selectedSfxId: sfxMatch ? sfxMatch[1] : 'ambience_interior',
        videoOptions: {
          duration: 6 as 4 | 6 | 8,
          resolution: '1080p' as '720p' | '1080p',
          generateAudio: true,
          aspectRatio: '16:9' as '16:9' | '9:16',
          numVideos: 1 as 1 | 2,
          placement: 'end' as 'start' | 'end'
        },
        hasShortVideo: false
      };

      const imgPath = findFile(`images/scene_${i}_image.png`);
      if (imgPath) {
        const b = await zip.file(imgPath)?.async('blob');
        if (b) {
          const typedBlob = new Blob([b], { type: 'image/png' });
          scene.imageUrl = await AssetStorage.saveAsset(`img_recover_${i}_${Date.now()}`, typedBlob);
        }
      }

      const imgEndPath = findFile(`images/scene_${i}_image_end.png`);
      if (imgEndPath) {
        const b = await zip.file(imgEndPath)?.async('blob');
        if (b) {
          const typedBlob = new Blob([b], { type: 'image/png' });
          scene.imageUrlEnd = await AssetStorage.saveAsset(`img_end_recover_${i}_${Date.now()}`, typedBlob);
        }
      }

      const videoPath = findFile(`videos/scene_${i}_video.mp4`);
      if (videoPath) {
        const b = await zip.file(videoPath)?.async('blob');
        if (b) {
          const typedBlob = new Blob([b], { type: 'video/mp4' });
          scene.videoUrl = await AssetStorage.saveAsset(`video_recover_${i}_${Date.now()}`, typedBlob);
          scene.hasShortVideo = true;
        }
      }

      const audioPath = findFile(`audio/scene_${i}_audio.wav`);
      if (audioPath) {
        const b = await zip.file(audioPath)?.async('blob');
        if (b) {
          const typedBlob = new Blob([b], { type: 'audio/wav' });
          scene.ttsAudioUrl = await AssetStorage.saveAsset(`audio_recover_${i}_${Date.now()}`, typedBlob);
        }
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
      if (b) setThumbnailUrl(await blobToDataUrl(b));
    }

    const renderedVideoPath = findFile(`videos/rendered_video.mp4`);
    if (renderedVideoPath) {
      const b = await zip.file(renderedVideoPath)?.async('blob');
      if (b) {
        console.info(`📥 [Recover] Restoring final rendered MP4 video from script ZIP...`);
        const typedBlob = new Blob([b], { type: 'video/mp4' });
        const restoredUrl = await AssetStorage.saveAsset(`rendered_video_recover_${Date.now()}`, typedBlob);
        setRenderedVideoUrl(restoredUrl);
      }
    }

    setInputs({
      ...inputs,
      title: scriptPath.split('/')[0] || "Imported Project",
    });

    alert("Notice: Project recovered from script files. Some settings have been reset.");
  };

  const handleImportProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    console.info(`📥 [Import] Starting ZIP import from ${file.name}...`);
    console.time('📥 [Import] ZIP Operations');
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

      const loadBlobUrl = async (relativePath: string | null, storagePrefix: string = 'restored') => {
        if (!relativePath) return undefined;
        const fullPath = rootPrefix + relativePath;
        let fileData = zip.file(fullPath);
        if (!fileData) {
          const foundPath = files.find(f => f.toLowerCase() === fullPath.toLowerCase());
          if (foundPath) fileData = zip.file(foundPath);
        }
        if (!fileData) return undefined;

        const blob = await fileData.async("blob");
        
        // Ensure correct MIME type for the browser
        let mimeType = blob.type;
        const lowerPath = relativePath.toLowerCase();
        if (lowerPath.endsWith('.wav')) mimeType = 'audio/wav';
        else if (lowerPath.endsWith('.mp4')) mimeType = 'video/mp4';
        else if (lowerPath.endsWith('.png')) mimeType = 'image/png';
        else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) mimeType = 'image/jpeg';
        
        const typedBlob = new Blob([blob], { type: mimeType });
        const id = `${storagePrefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return await AssetStorage.saveAsset(id, typedBlob);
      };

      setInputs(data.inputs);
      setThumbnailStyle(data.inputs.artStyle || "");
      setStoryContext(data.storyContext || "");
      if (data.footballInput) setFootballInput(data.footballInput);

      const restoredChars: Character[] = await Promise.all(data.charactersData.map(async (c: any) => ({
        ...c,
        referenceImageUrl: await loadBlobUrl(c.referenceImageUrl, `char_${c.id}`)
      })));
      setCharacters(restoredChars);

      const restoredScenes: Scene[] = await Promise.all(data.scenes.map(async (s: any) => {
        const localizationsRestored: Record<string, any> = {};
        if (s.localizations) {
          for (const [lang, loc] of Object.entries(s.localizations)) {
            localizationsRestored[lang] = {
              ...(loc as any),
              ttsAudioUrl: await loadBlobUrl((loc as any).ttsAudioUrl, `audio_${s.id}_${lang}`)
            };
          }
        }
        return {
          ...s,
          imageUrl: await loadBlobUrl(s.imageUrl, `img_${s.id}`),
          imageUrlEnd: await loadBlobUrl(s.imageUrlEnd, `img_end_${s.id}`),
          ttsAudioUrl: await loadBlobUrl(s.ttsAudioUrl, `audio_${s.id}`),
          videoUrl: await loadBlobUrl(s.videoUrl, `video_restored_${s.id}`),
          localizations: localizationsRestored,
          overlays: s.overlays || [],
          animationStyles: s.animationStyles || (s.animationStyle ? [s.animationStyle] : ['animate-kb-zoom-in']),
          animationConfig: s.animationConfig || {},
          selectedVoice: s.selectedVoice || data.inputs.voice,
          selectedMusicId: s.selectedMusicId,
          selectedSfxId: s.selectedSfxId,
          isGeneratingImageEnd: false,
          isGeneratingVideoPrompt: false,
          videoOptions: s.videoOptions || {
            duration: 6 as 4 | 6 | 8,
            resolution: '1080p' as '720p' | '1080p',
            generateAudio: true,
            aspectRatio: '16:9' as '16:9' | '9:16',
            numVideos: 1 as 1 | 2,
            placement: 'end' as 'start' | 'end'
          }
        };
      }));
      setScenes(restoredScenes);

      let baseThumbUrl: string | null = null;
      if (data.thumbnailBaseUrl) {
        console.info("📥 [Import] Loading unburned base thumbnail from metadata...");
        const baseThumb = await loadBlobUrl(data.thumbnailBaseUrl, 'thumb_base');
        if (baseThumb) {
          baseThumbUrl = baseThumb;
        }
      }
      
      if (!baseThumbUrl) {
        const foundBaseThumbKey = files.find(f => f.toLowerCase().endsWith('images/thumbnail_base.png') && !f.includes('__MACOSX'));
        if (foundBaseThumbKey) {
          console.info(`📥 [Import] Found unburned base thumbnail image in ZIP at: ${foundBaseThumbKey}`);
          const relativePath = foundBaseThumbKey.substring(rootPrefix.length);
          const baseThumb = await loadBlobUrl(relativePath, 'thumb_base');
          if (baseThumb) {
            baseThumbUrl = baseThumb;
          }
        }
      }

      if (!baseThumbUrl && data.thumbnailPath) {
        const thumb = await loadBlobUrl(data.thumbnailPath);
        baseThumbUrl = thumb || null;
      }

      if (baseThumbUrl) {
        setThumbnailUrl(baseThumbUrl);
      }

      if (data.thumbnailLocalizations) {
        const restoredThumbLocs: Partial<Record<Language, any>> = {};
        const restoredBurnedUrls: Record<Language, string> = {} as any;
        for (const [lang, thumb] of Object.entries(data.thumbnailLocalizations)) {
          const t = thumb as any;
          
          let baseThumbUrlForLang: string | null = null;
          if (t.baseUrl) {
            baseThumbUrlForLang = await loadBlobUrl(t.baseUrl, `thumb_base_${lang}`) || null;
          }
          
          if (!baseThumbUrlForLang) {
            const foundBaseThumbKey = files.find(f => f.toLowerCase().endsWith(`images/thumbnail_base_${lang}.png`) && !f.includes('__MACOSX'));
            if (foundBaseThumbKey) {
              const relativePath = foundBaseThumbKey.substring(rootPrefix.length);
              baseThumbUrlForLang = await loadBlobUrl(relativePath, `thumb_base_${lang}`) || null;
            }
          }
          
          if (!baseThumbUrlForLang) {
            baseThumbUrlForLang = baseThumbUrl;
          }

          if (!baseThumbUrlForLang && t.url) {
            baseThumbUrlForLang = await loadBlobUrl(t.url, `thumb_${lang}`) || null;
          }

          restoredThumbLocs[lang as Language] = {
            url: baseThumbUrlForLang,
            titleText: t.titleText || "",
            subtitleText: t.subtitleText || "",
            topRightText: t.topRightText || "",
            prompt: t.prompt || "",
            style: t.style || ""
          };

          if (t.url) {
            const burnedUrl = await loadBlobUrl(t.url, `thumb_burned_${lang}`);
            if (burnedUrl) {
              restoredBurnedUrls[lang as Language] = burnedUrl;
            }
          }
        }
        setThumbnailLocalizations(restoredThumbLocs);
        setBurnedThumbnailUrls(restoredBurnedUrls);

        const engThumb = data.thumbnailLocalizations[Language.English] || Object.values(data.thumbnailLocalizations)[0];
        if (engThumb) {
          setThumbnailTitleText(engThumb.titleText || "");
          setThumbnailSubtitleText(engThumb.subtitleText || "");
          setThumbnailTopRightText(engThumb.topRightText || "");
          setThumbnailPrompt(engThumb.prompt || "");
          setThumbnailStyle(engThumb.style || "");
        }
      }

      if (data.youtubeMetadataLocalizations) {
        setYoutubeMetadataLocalizations(data.youtubeMetadataLocalizations);
      }

      let renderedVideoUrlToSet: string | null = null;
      if (data.renderedVideoPath) {
        console.info(`📥 [Import] Restoring final rendered MP4 video from metadata: ${data.renderedVideoPath}...`);
        const restoredUrl = await loadBlobUrl(data.renderedVideoPath, 'rendered_video');
        renderedVideoUrlToSet = restoredUrl || null;
      }

      // Fallback: Check if 'videos/rendered_video.mp4' is physically inside the ZIP archive
      // (in case the user manually copy-pasted/dropped it into the ZIP)
      if (!renderedVideoUrlToSet) {
        const foundRenderedVideoKey = files.find(f => f.toLowerCase().endsWith('videos/rendered_video.mp4') && !f.includes('__MACOSX'));
        if (foundRenderedVideoKey) {
          console.info(`📥 [Import] Found manually added final rendered MP4 video at: ${foundRenderedVideoKey}`);
          const relativePath = foundRenderedVideoKey.substring(rootPrefix.length);
          const restoredUrl = await loadBlobUrl(relativePath, 'rendered_video');
          renderedVideoUrlToSet = restoredUrl || null;
        }
      }

      if (renderedVideoUrlToSet) {
        setRenderedVideoUrl(renderedVideoUrlToSet);
      } else if (data.serverVideoFilename) {
        console.info(`📥 [Import] Raw video blob is missing in ZIP. Streaming from server static endpoint: http://localhost:3001/static/${data.serverVideoFilename}`);
        setRenderedVideoUrl(`http://localhost:3001/static/${data.serverVideoFilename}`);
      }

      if (data.serverVideoFilename) {
        setServerVideoFilename(data.serverVideoFilename);
      }

      setStep(AppStep.ASSET_GENERATION);

      console.info(`📥 [Import] Import successful. Loaded ${restoredScenes.length} scenes.`);
    } catch (e) {
      console.error(`❌ [Import] Project import failed:`, e);
      alert(`Import error: ${(e as Error).message}`);
    } finally {
      console.timeEnd('📥 [Import] ZIP Operations');
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
    if (localizedScenes.length === 0) return;
    const firstScene = localizedScenes[0];
    setIsPreviewing(true);
    setCurrentPreviewIndex(0);
    setIsPreviewPlaying(true);
    setIsCleanMode(false);
    setAudioEnded(!firstScene?.ttsAudioUrl);
    setVideoEnded(false);
    setTtsDuration(0);
    setLastTransitionTime(Date.now()); // Reset watchdog timer
  };

  const startPresentation = async () => {
    if (localizedScenes.length === 0) return;

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen request failed", e);
    }

    const firstScene = localizedScenes[0];
    setIsPreviewing(true);
    setCurrentPreviewIndex(0);
    setIsPreviewPlaying(false);
    setIsCleanMode(true);
    setAudioEnded(!firstScene?.ttsAudioUrl);
    setVideoEnded(false);
    setTtsDuration(0);
    setLastTransitionTime(Date.now()); // Reset watchdog timer

    setTimeout(() => {
      setIsPreviewPlaying(true);
      // Re-reset watchdog after the 7s delay to ensure it doesn't expire during silence
      setLastTransitionTime(Date.now());
    }, 7000);
  };

  const handlePreviewNext = useCallback(() => {
    if (currentPreviewIndex < localizedScenes.length - 1) {
      const nextIdx = currentPreviewIndex + 1;
      const nextScene = localizedScenes[nextIdx];

      console.log(`Advancing to scene ${nextIdx}`);
      setCurrentPreviewIndex(nextIdx);
      setAudioEnded(!nextScene.ttsAudioUrl);
      setVideoEnded(false);
      setLastTransitionTime(Date.now()); // Reset watchdog timer
      setTtsDuration(0);
      setCurrentPlaybackTime(0);

    } else {
      console.log("Movie ended.");
      setIsPreviewPlaying(false);
    }
  }, [currentPreviewIndex, localizedScenes]);

  // Watchdog timer to prevent stuck scenes
  const [lastTransitionTime, setLastTransitionTime] = useState<number>(0);

  // Sync Audio/Video Completion to trigger next scene
  useEffect(() => {
    if (!isPreviewing || isPreviewSingleVideo || !isPreviewPlaying) return;

    const activeScene = localizedScenes[currentPreviewIndex];
    if (!activeScene) return;

    const isEndVideo = activeScene.videoUrl && (activeScene.videoOptions?.placement === 'end' || !activeScene.videoOptions?.placement);
    const hasAudio = !!activeScene.ttsAudioUrl;

    // Condition to advance:
    // 1. Audio must be finished (if exists)
    // 2. If it's an end-video, video must be finished
    const canAdvance = (audioEnded || !hasAudio) && (!isEndVideo || videoEnded);

    // Watchdog check: If we've been on this scene for way too long, force advance
    // Expected max time: ttsDuration + transition buffer
    // For end-videos, we wait for BOTH audio AND video duration if they are sequential, 
    // but here they overlap, so it's just the max of them.
    const videoDur = activeScene.videoOptions?.duration || 6;
    const sceneDur = Math.max(ttsDuration, isEndVideo ? videoDur : 0);
    const expectedMaxDuration = (sceneDur || 5) + 5;
    const timeSinceTransition = (Date.now() - lastTransitionTime) / 1000;

    if (canAdvance) {
      console.log("Sync Complete: Advancing to next scene.");
      handlePreviewNext();
    } else if (timeSinceTransition > expectedMaxDuration && lastTransitionTime > 0) {
      console.warn(`Watchdog: Scene ${currentPreviewIndex} stuck for ${timeSinceTransition.toFixed(1)}s (Expected ${expectedMaxDuration.toFixed(1)}s). Forcing transition.`);
      handlePreviewNext();
    }
  }, [audioEnded, videoEnded, isPreviewing, isPreviewSingleVideo, isPreviewPlaying, currentPreviewIndex, localizedScenes, handlePreviewNext, ttsDuration, lastTransitionTime]);


  const handlePreviewPrev = useCallback(() => {
    if (currentPreviewIndex > 0) {
      setCurrentPreviewIndex(prev => prev - 1);
      setAudioEnded(false);
      setVideoEnded(false);
      setTtsDuration(0);
    }
  }, [currentPreviewIndex]);

  const handlePreviewSingleVideo = (id: number) => {
    const idx = localizedScenes.findIndex(s => s.id === id);
    if (idx === -1) return;

    setCurrentPreviewIndex(idx);
    setIsPreviewSingleVideo(true);
    setIsPreviewing(true);
    setIsPreviewPlaying(true);
    setIsCleanMode(true); // Default to fullscreen-like for single video
    setAudioEnded(false);
    setVideoEnded(false);
    setCurrentPlaybackTime(0);
  };


  const togglePreviewPlay = () => {
    setIsPreviewPlaying(!isPreviewPlaying);
  };

  // Sync Audio Playback
  useEffect(() => {
    if (!isPreviewing || isPreviewSingleVideo) {
      previewTtsRef.current?.pause();
      previewMusicRef.current?.pause();
      previewSfxRef.current?.pause();
      return;
    }

    const tts = previewTtsRef.current;
    const music = previewMusicRef.current;
    const sfx = previewSfxRef.current;

    if (isPreviewPlaying) {
      tts?.play().catch(() => { });
      music?.play().catch(() => { });

      if (sfx) {
        // Handle "Trim 30%" logic for SFX
        if (sfx.paused && sfx.currentTime === 0) {
          const duration = sfx.duration;
          if (duration && !isNaN(duration)) {
            sfx.currentTime = duration * 0.3; // Jump to 30%
          }
        }
        sfx.play().catch(() => { });
      }

    } else {
      tts?.pause();
      music?.pause();
      sfx?.pause();
    }
  }, [isPreviewPlaying, isPreviewing, currentPreviewIndex]); // Re-run when index changes to re-trigger play on new sources

  const toggleCleanMode = useCallback(async () => {
    if (!isCleanMode) {
      setIsCleanMode(true);
      try {
        if (previewContainerRef.current) {
          await previewContainerRef.current.requestFullscreen();
        } else if (document.documentElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) { console.warn(e); }
    } else {
      setIsCleanMode(false);
      if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch (e) { }
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

  const activeScene = localizedScenes[currentPreviewIndex];
  const AppModeAnimated = 1; // Assuming AppMode.Animated is 1, let's verify later. Actually I'll use inputs.appMode check.

  // Robustly set volumes for background audio based on current scene and mode
  useEffect(() => {
    if (!isPreviewing) return;
    
    const isAnimated = inputs.appMode === (AppMode as any).Animated;
    const musicVolume = isAnimated ? 0.074 : 0.15;
    const sfxVolume = isAnimated ? 0.3 : 0.5;

    if (previewMusicRef.current) {
      previewMusicRef.current.volume = musicVolume;
    }
    if (previewSfxRef.current) {
      previewSfxRef.current.volume = sfxVolume;
    }
    
    console.log(`[Preview] Volumes Set: Mode=${inputs.appMode}, Music=${musicVolume}, SFX=${sfxVolume}`);
  }, [isPreviewing, currentPreviewIndex, inputs.appMode]);

  // --- Renders ---

  const renderInputStep = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <div className="flex bg-slate-800 p-1 rounded-full border border-slate-700 shadow-inner">
          <button
            onClick={() => setInputs(prev => ({ ...prev, appMode: AppMode.Static, imageIntervalMinutes: prev.imageIntervalMinutes === 0.25 ? 0.5 : prev.imageIntervalMinutes }))}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${inputs.appMode === AppMode.Static ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            🖼️ Static Video
          </button>
          <button
            onClick={() => setInputs(prev => ({ ...prev, appMode: AppMode.Animated, imageIntervalMinutes: prev.imageIntervalMinutes === 0.25 ? 0.5 : prev.imageIntervalMinutes }))}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${inputs.appMode === AppMode.Animated ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            🎬 Animated Video
          </button>
          <button
            onClick={() => setInputs(prev => ({ ...prev, appMode: AppMode.Football, imageIntervalMinutes: 0.25 }))}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${inputs.appMode === AppMode.Football ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            ⚽ AI Football Simulation
          </button>
        </div>
        <div className="flex justify-end">
          <input type="file" accept=".zip" ref={fileInputRef} className="hidden" onChange={handleImportProject} />
          <button onClick={triggerImport} disabled={isImporting} className="text-indigo-400 hover:text-white text-sm flex items-center gap-2 border border-indigo-500/30 px-3 py-1 rounded-full transition-colors">
            {isImporting ? <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}
            Import Existing Project (Zip)
          </button>
        </div>
      </div>

      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          {inputs.appMode === AppMode.Football ? '⚽ Match Setup' : '1. Story Input'}
        </h2>

        {inputs.appMode === AppMode.Football ? (
          /* ── FOOTBALL MODE INPUT ── */
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-emerald-400 mb-2">Team A 🏆</label>
                <input
                  type="text"
                  value={footballInput.teamA}
                  onChange={(e) => setFootballInput(prev => ({ ...prev, teamA: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all hover:border-slate-500"
                  placeholder="e.g. Argentina, Galatasaray, Brazil..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-emerald-400 mb-2">Team B 🏆</label>
                <input
                  type="text"
                  value={footballInput.teamB}
                  onChange={(e) => setFootballInput(prev => ({ ...prev, teamB: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all hover:border-slate-500"
                  placeholder="e.g. France, Juventus, Germany..."
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-400 mb-2">🏅 Competition / Tournament</label>
                  <select
                    value={selectedFixtureName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedFixtureName(val);
                      if (val === 'manual') {
                        setFootballInput(prev => ({ ...prev, competition: '' }));
                      } else {
                        setFootballInput(prev => ({ ...prev, competition: val }));
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all hover:border-slate-500"
                  >
                    <option value="manual">✍️ Manual Tournament Entry...</option>
                    {fixtureFiles.map(file => (
                      <option key={file.name} value={file.name}>📄 {file.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="file"
                    accept=".txt,.md"
                    id="fixture-file-upload"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const text = await file.text();
                      const cleanName = file.name.replace(/\.[^/.]+$/, "");
                      setFixtureFiles(prev => {
                        const filtered = prev.filter(f => f.name !== cleanName);
                        return [...filtered, { name: cleanName, content: text }];
                      });
                      setSelectedFixtureName(cleanName);
                      setFootballInput(prev => ({ ...prev, competition: cleanName }));
                      
                      // Also save/upload fixture to backend
                      try {
                        await fetch('http://localhost:3001/api/fixtures/save', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: file.name, content: text })
                        });
                      } catch (saveErr) {
                        console.error("⚠️ Failed to save uploaded fixture to backend:", saveErr);
                      }

                      alert(`Uploaded fixture file: ${cleanName}`);
                    }}
                  />
                  <label
                    htmlFor="fixture-file-upload"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-4 rounded-xl cursor-pointer block text-center transition-all hover:scale-[1.02] duration-200"
                  >
                    Upload Fixture
                  </label>
                </div>
              </div>

              {selectedFixtureName === 'manual' && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">🏅 Enter Competition Name</label>
                  <input
                    type="text"
                    value={footballInput.competition}
                    onChange={(e) => setFootballInput(prev => ({ ...prev, competition: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all hover:border-slate-500"
                    placeholder="e.g. 2026 FIFA World Cup Final, UEFA Champions League Semi-Final..."
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">📝 Extra Context (optional)</label>
              <textarea
                value={footballInput.extraContext}
                onChange={(e) => setFootballInput(prev => ({ ...prev, extraContext: e.target.value }))}
                className="w-full min-h-[100px] bg-slate-900 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none resize-none transition-all hover:border-slate-500"
                placeholder="e.g. Mbappe is injured. Messi's final World Cup. Galatasaray's first Champions League final..."
              />
            </div>
            <div className="p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-xl text-sm text-emerald-300 space-y-1">
              <div className="font-bold text-emerald-400">⚽ AI Simulation Engine</div>
              <div className="text-slate-400">Gemini will analyze both teams using real stats (xG, form, head-to-head), then generate a multi-scene video covering team strengths, player duels, tactics, weaknesses and a final match prediction.</div>
            </div>

            {/* ── FULL AUTO PUBLISH ENGINE DASHBOARD ── */}
            {selectedFixtureName !== 'manual' && (
              <div className="bg-slate-900/60 border border-slate-700/60 p-5 rounded-2xl space-y-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="text-lg font-bold text-emerald-400">🤖 Full Auto Publish Engine</h3>
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        const file = fixtureFiles.find(f => f.name === selectedFixtureName);
                        if (!file) return;
                        const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${selectedFixtureName}_updated.txt`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 text-xs underline cursor-pointer font-semibold"
                    >
                      Download Updated File
                    </button>
                    <button
                      onClick={handleResetEngineState}
                      className="text-amber-400 hover:text-amber-300 text-xs underline cursor-pointer font-semibold"
                    >
                      Reset Engine State
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this fixture file?")) {
                          setFixtureFiles(prev => prev.filter(f => f.name !== selectedFixtureName));
                          setSelectedFixtureName('manual');
                        }
                      }}
                      className="text-red-400 hover:text-red-300 text-xs underline cursor-pointer font-semibold"
                    >
                      Delete Fixture File
                    </button>
                  </div>
                </div>

                {/* Match Checklist */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fixture Matches Checklist</div>
                  <div className="max-h-48 overflow-y-auto space-y-2 bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                    {(() => {
                      const file = fixtureFiles.find(f => f.name === selectedFixtureName);
                      if (!file) return <div className="text-slate-500 text-sm">No matches found.</div>;
                      const parsed = parseFixtureMatches(file.content);
                      if (parsed.length === 0) return <div className="text-slate-500 text-sm">No valid matches parsed.</div>;
                      
                      return parsed.map((m, i) => {
                        const isNext = parsed.find(pm => !pm.isCompleted)?.lineIndex === m.lineIndex;
                        return (
                          <div key={i} className={`flex justify-between items-center text-sm p-2.5 rounded-xl ${m.isCompleted ? 'bg-slate-900/30 text-slate-550' : isNext ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' : 'text-slate-300'}`}>
                            <div className="flex items-center gap-2">
                              <span>{m.isCompleted ? '✅' : isNext ? '⚡' : '⏳'}</span>
                              <span className={m.isCompleted ? 'line-through' : ''}>
                                {m.teamA} vs {m.teamB} {m.stadium ? `(${m.stadium})` : ''}
                              </span>
                            </div>
                            <div className="text-xs font-semibold">
                              {m.isCompleted ? 'Completed' : isNext ? 'Next Up' : 'Pending'}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Auto Mode Control Buttons */}
                <div className="flex flex-wrap gap-4 items-center">
                  {!autoPublishState.isRunning ? (
                    <>
                      <button
                        onClick={startFullAutoMode}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-98 cursor-pointer flex items-center gap-2"
                      >
                        🚀 Start Full Auto Mode
                      </button>
                      {(autoPublishState.currentLangIndex > 0 || autoPublishState.currentSubStep !== 'idle' || autoPublishState.errorLog.length > 0 || scenes.length > 0) && (
                        <button
                          onClick={handleResetEngineState}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-bold px-6 py-3 rounded-xl transition-all border border-slate-700 active:scale-98 cursor-pointer flex items-center gap-2"
                        >
                          🔄 Reset Engine & Start Fresh
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={stopFullAutoMode}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg active:scale-98 cursor-pointer"
                      >
                        ⏹️ Stop Auto Mode
                      </button>
                      <button
                        onClick={() => {
                          setAutoPublishState(prev => ({
                            ...prev,
                            isPaused: !prev.isPaused,
                            statusMessage: prev.isPaused ? 'Resuming...' : 'Paused by user.'
                          }));
                        }}
                        className={`${autoPublishState.isPaused ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'} text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-98 cursor-pointer`}
                      >
                        {autoPublishState.isPaused ? '▶️ Resume Auto Mode' : '⏸️ Pause Auto Mode'}
                      </button>
                    </>
                  )}
                  {autoPublishState.isRunning && (
                    <button
                      onClick={async () => {
                        if (confirm("Skip the current match? This will mark it as Completed and move to the next match.")) {
                          const file = fixtureFiles.find(f => f.name === selectedFixtureName);
                          if (file) {
                            const parsed = parseFixtureMatches(file.content);
                            const currentMatch = parsed.find(pm => !pm.isCompleted);
                            if (currentMatch) {
                              const updatedFiles = fixtureFiles.map(f => {
                                if (f.name !== selectedFixtureName) return f;
                                const fileLines = f.content.split(/\r?\n/);
                                fileLines[currentMatch.lineIndex] = `${currentMatch.originalLine} | Done`;
                                return { ...f, content: fileLines.join('\n') };
                              });
                              setFixtureFiles(updatedFiles);
                              setAutoPublishState(prev => ({
                                ...prev,
                                currentLangIndex: 0,
                                currentSubStep: 'idle',
                                statusMessage: `Skipped match: ${currentMatch.teamA} vs ${currentMatch.teamB}`
                              }));
                              alert(`Skipped match.`);
                            }
                          }
                        }
                      }}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold px-5 py-3 rounded-xl transition-all cursor-pointer"
                    >
                      ⏭️ Skip Match
                    </button>
                  )}
                </div>

                {/* Optional Scheduler Configuration */}
                <div className="border-t border-slate-800 pt-4 space-y-4">
                  <div className="flex justify-between items-center font-sans">
                    <label className="flex items-center gap-2 font-semibold text-slate-350 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={schedulerEnabled}
                        onChange={(e) => setSchedulerEnabled(e.target.checked)}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900 h-5 w-5"
                      />
                      ⏰ Enable Time-Based Daily Scheduler
                    </label>
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-semibold">Optional</span>
                  </div>

                  {schedulerEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-sm font-sans">
                      <div>
                        <label className="block text-slate-400 text-xs font-medium mb-1">Frequency Per Day</label>
                        <select
                          value={schedulerFrequency}
                          onChange={(e) => setSchedulerFrequency(Number(e.target.value))}
                          className="bg-slate-900 border border-slate-700 rounded p-2 text-white w-full outline-none"
                        >
                          <option value={1}>1 time a day</option>
                          <option value={2}>2 times a day</option>
                          <option value={3}>3 times a day</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-slate-400 text-xs font-medium">Scheduled Trigger Times</label>
                        {Array.from({ length: schedulerFrequency }).map((_, idx) => (
                          <input
                            key={idx}
                            type="time"
                            value={schedulerTimes[idx] || '09:00'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSchedulerTimes(prev => {
                                const copy = [...prev];
                                copy[idx] = val;
                                return copy;
                              });
                            }}
                            className="bg-slate-900 border border-slate-700 rounded p-2 text-white w-full outline-none"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Status Logger Panel */}
                {(autoPublishState.isRunning || autoPublishState.errorLog.length > 0) && (
                  <div className="space-y-4">
                    {/* Language Progress Tracker */}
                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Language Progression</div>
                      <div className="flex gap-2">
                        {['English', 'Turkish', 'Spanish', 'Portuguese'].map((lang, lIdx) => {
                          const isCurrent = autoPublishState.currentLangIndex === lIdx;
                          const isPast = autoPublishState.currentLangIndex > lIdx;
                          return (
                            <button
                              key={lang}
                              onClick={() => {
                                const targetLang = [Language.English, Language.Turkish, Language.Spanish, Language.Portuguese][lIdx];
                                setCurrentEditorLanguage(targetLang);
                                setStep(AppStep.ASSET_GENERATION);
                              }}
                              className={`flex-1 text-center py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                isCurrent
                                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                                  : isPast
                                  ? 'bg-slate-800 border-slate-700 text-slate-400'
                                  : 'bg-slate-900/55 border-slate-800 text-slate-650'
                              }`}
                            >
                              {isPast ? '✅ ' : isCurrent ? '⚡ ' : ''}{lang}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step-by-Step Pipeline Dashboard */}
                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-850 pb-2">
                        <span>Pipeline Dashboard</span>
                        <span className="text-emerald-400 animate-pulse">{autoPublishState.isRunning && !autoPublishState.isPaused ? '● ACTIVE' : '■ PAUSED'}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {[
                          { id: 'script', label: '📝 Tactical Script', desc: 'Generate match narrative and analysis' },
                          { id: 'assets', label: '👕 Player/Scene Assets', desc: 'Create character sheets, visuals, voiceovers' },
                          { id: 'thumbnail', label: '🖼️ Custom Thumbnail', desc: 'Generate high-CTR thumbnail layouts' },
                          { id: 'render', label: '🎬 Video Rendering', desc: 'Compile project at 1440p high quality' },
                          { id: 'backup', label: '📦 Project Backup', desc: 'Export ZIP file backup of project' },
                          { id: 'publish', label: '🚀 YouTube Publishing', desc: 'Publish video & localized metadata' }
                        ].map((step) => {
                          const stepOrder = ['script', 'assets', 'thumbnail', 'render', 'backup', 'publish'];
                          const currentIndex = stepOrder.indexOf(autoPublishState.currentSubStep);
                          const stepIndex = stepOrder.indexOf(step.id);
                          
                          let status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
                          if (stepIndex < currentIndex) {
                            status = 'completed';
                          } else if (stepIndex === currentIndex) {
                            if (autoPublishState.errorLog.length > 0 && autoPublishState.isPaused) {
                              status = 'failed';
                            } else {
                              status = 'running';
                            }
                          }

                          return (
                            <div
                              key={step.id}
                              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                status === 'completed'
                                  ? 'bg-emerald-950/20 border-emerald-900/50 text-slate-350'
                                  : status === 'running'
                                  ? 'bg-indigo-950/30 border-indigo-500/55 text-white ring-1 ring-indigo-500/20'
                                  : status === 'failed'
                                  ? 'bg-red-950/25 border-red-900/60 text-slate-350'
                                  : 'bg-slate-900/40 border-slate-800/60 text-slate-550'
                              }`}
                            >
                              <div className="mt-0.5 flex-shrink-0">
                                {status === 'completed' && <span className="text-emerald-500 text-sm font-bold">✓</span>}
                                {status === 'running' && <span className="block animate-spin h-3.5 w-3.5 border-2 border-indigo-400 border-t-transparent rounded-full"></span>}
                                {status === 'failed' && <span className="text-red-500 text-sm font-bold">⚠️</span>}
                                {status === 'pending' && <span className="text-slate-700 text-sm font-bold">○</span>}
                              </div>
                              <div className="space-y-0.5">
                                <div className={`text-xs font-bold ${status === 'running' ? 'text-indigo-305' : ''}`}>
                                  {step.label}
                                </div>
                                <div className="text-[10px] text-slate-500 leading-tight font-sans">
                                  {step.desc}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Console Logger Panel */}
                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 font-mono text-xs">
                      <div className="flex justify-between items-center text-slate-400 font-bold border-b border-slate-800 pb-2">
                        <span>Console Output / Error Logs</span>
                        {autoPublishState.retries > 0 && (
                          <span className="text-amber-400">Warning: Retry {autoPublishState.retries}/3</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p><span className="text-slate-500">[Status]:</span> <span className="text-slate-200">{autoPublishState.statusMessage}</span></p>
                      </div>
                      {autoPublishState.errorLog.length > 0 && (
                        <div className="space-y-1 pt-2 border-t border-slate-800 max-h-24 overflow-y-auto">
                          <span className="text-red-400 font-bold block">Error Log history:</span>
                          {autoPublishState.errorLog.map((log, lidx) => (
                            <p key={lidx} className="text-red-450">{log}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── STORY MODE INPUT (Static / Animated) ── */
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
        )}
        <div className="border-t border-slate-700 my-8"></div>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Project Title</label>
              <div className="flex gap-2">
                <input type="text" value={inputs.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({ ...inputs, title: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-600" placeholder={inputs.appMode === AppMode.Football ? 'Auto-set from team names if blank...' : 'Auto-generated if left blank...'} />
                {inputs.appMode !== AppMode.Football && (
                  <button onClick={handleAutoGenerateTitle} disabled={!manualStoryText.trim() || isGeneratingTitle} className="px-3 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded-lg border border-indigo-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    {isGeneratingTitle ? <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full block"></span> : <span className="text-lg">✨</span>}
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Special Instructions</label>
              <input type="text" value={inputs.instructions} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({ ...inputs, instructions: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Make it spooky, add dragons..." />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
        <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">2. Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Duration (mins)</label>
            <input type="number" value={inputs.durationMinutes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({ ...inputs, durationMinutes: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:border-purple-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Image Interval (mins)</label>
            <select
              value={inputs.imageIntervalMinutes}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({ ...inputs, imageIntervalMinutes: parseFloat(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
            >
              {(inputs.appMode === AppMode.Football
                ? [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10]
                : [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10]
              ).map(val => (
                <option key={val} value={val}>{val} min{val !== 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Target Language</label>
            <select value={inputs.targetLanguage} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({ ...inputs, targetLanguage: e.target.value as Language })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none">
              {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Aspect Ratio</label>
            <select value={inputs.aspectRatio} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({ ...inputs, aspectRatio: e.target.value as AspectRatio })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none">
              {ASPECT_RATIOS.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Visual Style</label>
            <select value={inputs.artStyle} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({ ...inputs, artStyle: e.target.value as ArtStyle })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none">
              {ART_STYLES.map(style => <option key={style.label} value={style.value}>{style.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Narrator Voice</label>
            <select value={inputs.voice} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({ ...inputs, voice: e.target.value as VoiceOption })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none">
              {VOICE_OPTIONS.map(voice => <option key={voice} value={voice}>{voice}</option>)}
            </select>
          </div>
        </div>
      </div>

      <button onClick={startProcessing}
        disabled={inputs.appMode === AppMode.Football ? (!footballInput.teamA.trim() || !footballInput.teamB.trim()) : (!audioBlob && !manualStoryText.trim())}
        className={`w-full py-4 bg-gradient-to-r ${inputs.appMode === AppMode.Football ? 'from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-emerald-500/30' : 'from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/30'} rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all transform hover:scale-[1.01]`}
      >
        {inputs.appMode === AppMode.Football ? '⚽ Simulate Match' : 'Transform Story'}
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
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setStep(AppStep.INPUT)} 
            className="bg-slate-700 hover:bg-slate-600 text-slate-350 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-slate-600 flex items-center gap-1 cursor-pointer"
          >
            ⬅ Back to Dashboard
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Production Studio</h2>
            <div className="text-xs text-slate-400">Total Scenes: {scenes.length}</div>
          </div>
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
              <h3 className="text-lg font-bold text-pink-400">{inputs.appMode === AppMode.Football ? '👕 Player & Staff Registry' : '👤 Character Consistency Studio'}</h3>
              <div className="text-xs text-slate-500 mt-1">{inputs.appMode === AppMode.Football ? 'Key players, coaches and staff extracted from the match. Generate reference sheets for visual consistency.' : 'Characters must have reference sheets to be consistent.'} {!isReadyForSceneGeneration && hasCharacters && <span className="text-red-400 font-bold ml-2">⚠️ Generate all character sheets before creating scenes!</span>}</div>
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
                <div 
                  className="aspect-video bg-black rounded overflow-hidden relative group border border-slate-800 cursor-pointer"
                  onClick={() => !char.isGenerating && document.getElementById(`upload-char-${char.id}`)?.click()}
                  title="Click to Upload Reference Image"
                >
                  {char.referenceImageUrl ? (<img src={char.referenceImageUrl} className="w-full h-full object-cover" />) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 text-xs text-center p-2 bg-slate-800/50 group-hover:bg-slate-800 transition-colors">
                      {char.isGenerating ? (<div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full mb-2"></div>) : (<svg className="w-8 h-8 opacity-20 mb-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 11-14 0 7 7 0 0114 0z" clipRule="evenodd" /></svg>)}
                      <span className="text-[10px] mt-1">{char.isGenerating ? 'Processing...' : 'Click to Upload'}</span>
                    </div>
                  )}
                  <input 
                    id={`upload-char-${char.id}`}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadCharacterRef(char.id, file);
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => document.getElementById(`upload-char-${char.id}`)?.click()} 
                      disabled={char.isGenerating} 
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
                      title="Upload Reference Image"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                    <button onClick={() => handleGenerateCharacterRef(char.id)} disabled={char.isGenerating} className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded disabled:opacity-50 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      {char.isGenerating ? '...' : (char.referenceImageUrl ? 'Regen' : 'Gen AI')}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500">{char.referenceImageUrl ? 'Ready' : 'Draft'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {inputs.appMode === AppMode.Football && (
        <div className="mb-6 bg-slate-800 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-300">Localization & Languages</h3>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">Alpha</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">Select a language tab to automatically translate and edit voiceovers and overlays. Images remain shared.</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(lang => (
              <button
                key={lang}
                onClick={() => handleLocalize(lang)}
                disabled={isLocalizing}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  currentEditorLanguage === lang 
                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                } disabled:opacity-50`}
              >
                {lang}
                {isLocalizing && currentEditorLanguage !== lang && scenes.some(s => s.localizations?.[lang]) === false && '...'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-8">
        {localizedScenes.map((scene) => {
          const commonProps = {
            key: scene.id,
            scene: scene,
            aspectRatio: inputs.aspectRatio,
            durationMinutes: inputs.durationMinutes / Math.max(scenes.length, 1),
            onGenerateImage: handleGenerateImage,
            onGenerateVideo: handleGenerateVideo,
            onGenerateTTS: handleGenerateTTS,
            onUpdatePrompt: (id: number, val: string) => updateScene(id, { visualPrompt: val }),
            onUpdateScript: (id: number, val: string) => updateScene(id, { voiceoverScript: val }),
            onUpdateImage: (id: number, val: string) => updateScene(id, { imageUrl: val }),
            onUpdateTone: (id: number, val: TTSTone) => updateScene(id, { selectedTone: val }),
            onUpdateVoice: (id: number, val: VoiceOption) => updateScene(id, { selectedVoice: val }),
            onUpdateOverlays: (id: number, val: Overlay[]) => updateScene(id, { overlays: val }),
            onUpdateAnimationStyle: (id: number, styles: string[], config?: Record<string, AnimationConfigEntry>) => updateScene(id, { animationStyles: styles, animationConfig: config }),
            onUpdateAudioSelection: (id: number, type: 'music' | 'sfx', val: string) => updateScene(id, type === 'music' ? { selectedMusicId: val } : { selectedSfxId: val }),
            onUpdateShortVideoToggle: (id: number, val: boolean) => {
              updateScene(id, { hasShortVideo: val });
              const sceneToUpdate = scenes.find(s => s.id === id);
              if (val && sceneToUpdate && !sceneToUpdate.videoPrompt) handleGenerateVideoPrompt(id);
            },
            onUpdateVideoOptions: (id: number, val: Partial<Scene['videoOptions']>) => updateScene(id, { videoOptions: { ...scenes.find(s => s.id === id)?.videoOptions, ...val } as any }),
            onUpdateVideoPrompt: (id: number, val: string) => updateScene(id, { videoPrompt: val }),
            onUpdateImageOverlayText: (id: number, val: string) => updateScene(id, { imageOverlayText: val }),
            videoOptions: scene.videoOptions,
            onGenerateVideoPrompt: handleGenerateVideoPrompt,
            onPreviewVideo: handlePreviewSingleVideo,
            onUpdateMute: (id: number, val: boolean) => updateScene(id, { isMuted: val }),
            isMuted: scene.isMuted
          };

          return inputs.appMode === AppMode.Animated ? (
            <AnimatedSceneCard {...commonProps} />
          ) : (
            <SceneCard {...commonProps} />
          );
        })}
      </div>

      {/* Thumbnail Section */}
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl mt-8">
        <h2 className="text-xl font-bold text-white mb-4">YouTube Thumbnail</h2>
        <div className="flex flex-col md:flex-row gap-6">
          {(() => {
            const currentThumbLoc = thumbnailLocalizations[currentEditorLanguage] || {
              url: null,
              titleText: thumbnailTitleText || "",
              subtitleText: thumbnailSubtitleText || "",
              topRightText: thumbnailTopRightText || "",
              prompt: thumbnailPrompt || "",
              style: thumbnailStyle || inputs.artStyle || ""
            };

            const updateThumbnailLoc = (updates: Partial<typeof currentThumbLoc>) => {
              setThumbnailLocalizations(prev => ({
                ...prev,
                [currentEditorLanguage]: {
                  ...(prev[currentEditorLanguage] || {
                    url: null,
                    titleText: thumbnailTitleText || "",
                    subtitleText: thumbnailSubtitleText || "",
                    topRightText: thumbnailTopRightText || "",
                    prompt: thumbnailPrompt || "",
                    style: thumbnailStyle || inputs.artStyle || ""
                  }),
                  ...updates
                }
              }));
            };

            const activeCleanImageUrl = currentThumbLoc.url || 
                                         thumbnailLocalizations[Language.English]?.url || 
                                         (Object.values(thumbnailLocalizations) as any[]).find(t => t?.url)?.url || 
                                         thumbnailUrl;

            const activePreviewImageUrl = burnedThumbnailUrls[currentEditorLanguage] || activeCleanImageUrl;

            return (
              <>
                <div className="w-full md:w-1/3 space-y-4">
                  <div className="flex gap-2">
                    <select 
                      value={currentThumbLoc.style || (thumbnailStyle as string)} 
                      onChange={(e) => updateThumbnailLoc({ style: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none"
                    >
                      <option value="" disabled>Select Style</option>
                      {ART_STYLES.map(style => <option key={style.label} value={style.value}>{style.label}</option>)}
                    </select>
                  </div>
                  <input 
                    type="text" 
                    value={currentThumbLoc.titleText} 
                    onChange={(e) => updateThumbnailLoc({ titleText: e.target.value })} 
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none" 
                    placeholder="Main Title Text (e.g. İNANILMAZ MAÇ!)" 
                  />
                  <input 
                    type="text" 
                    value={currentThumbLoc.subtitleText} 
                    onChange={(e) => updateThumbnailLoc({ subtitleText: e.target.value })} 
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none" 
                    placeholder="Subtitle (e.g. Gemini Simülasyonu)" 
                  />
                  <input 
                    type="text" 
                    value={currentThumbLoc.topRightText || ""} 
                    onChange={(e) => updateThumbnailLoc({ topRightText: e.target.value })} 
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none" 
                    placeholder="Top Right Text (e.g. 10BİN SİM)" 
                  />
                  <textarea 
                    value={currentThumbLoc.prompt} 
                    onChange={(e) => updateThumbnailLoc({ prompt: e.target.value })} 
                    className="w-full h-24 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white resize-none focus:border-indigo-500 outline-none" 
                    placeholder="Custom visual description for thumbnail (optional)..." 
                  />
                  <button 
                    onClick={handleGenerateThumbnail} 
                    disabled={isGeneratingThumbnail} 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded font-bold disabled:opacity-50"
                  >
                    {isGeneratingThumbnail ? 'Generating...' : 'Generate Thumbnail'}
                  </button>
                </div>
                
                <div className="w-full md:w-2/3 bg-black rounded-lg aspect-video flex items-center justify-center overflow-hidden border border-slate-700 relative group">
                  {activePreviewImageUrl ? (
                    <div className="relative w-full h-full">
                      <img src={activePreviewImageUrl} className="w-full h-full object-cover" />
                      
                      {/* Premium Localized High-CTR Overlay Text (Fallback when clean URL is shown) */}
                      {!burnedThumbnailUrls[currentEditorLanguage] && (
                        <div className="absolute inset-0 flex flex-col justify-end p-8 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none select-none">
                          {currentThumbLoc.titleText && (
                            <h2 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-400 uppercase tracking-wider drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] mb-1 font-sans">
                              {currentThumbLoc.titleText}
                            </h2>
                          )}
                          {currentThumbLoc.subtitleText && (
                            <p className="text-base md:text-lg font-bold text-white uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] opacity-90">
                              {currentThumbLoc.subtitleText}
                            </p>
                          )}
                        </div>
                      )}

                      <a href={activePreviewImageUrl} download={`thumbnail_${currentEditorLanguage}.png`} className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-sm opacity-0 group-hover:opacity-100 transition-opacity">Download</a>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-sm">Thumbnail Preview</div>
                  )}
                </div>
              </>
            );
          })()}
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
            <option value="1440p">1440p (2K)</option>
          </select>
          <button onClick={handleRenderFullVideo} disabled={isRenderingVideo} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold text-lg shadow-[0_0_20px_rgba(220,38,38,0.4)] disabled:opacity-50 transition-all hover:scale-105">
            {isRenderingVideo ? 'Rendering Video...' : 'Render Movie (MP4)'}
          </button>
        </div>
        {isRenderingVideo && (<div className="max-w-md mx-auto mt-4"><div className="w-full bg-slate-700 rounded-full h-2 mb-2"><div className="bg-red-500 h-2 rounded-full animate-pulse w-full"></div></div><p className="text-indigo-300 text-sm animate-pulse">{renderProgress}</p></div>)}
        {renderedVideoUrl && (<div className="mt-8 animate-fade-in"><video controls src={renderedVideoUrl} className="max-w-full rounded-lg shadow-2xl border border-slate-700 mx-auto max-h-[70vh]" /><a href={renderedVideoUrl} download={`${inputs.title.replace(/\s+/g, '_')}_final.mp4`} className="inline-block mt-4 text-indigo-400 hover:text-white underline">Download MP4</a></div>)}
      </div>

      {/* YouTube Automation Panel */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 rounded-2xl border border-slate-700 mt-12 text-left space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-2">
              <span className="text-red-500 font-sans">▶</span> YouTube Autopilot
            </h2>
            <p className="text-slate-400 mt-1 text-sm">Automate publishing directly to your YouTube Channel.</p>
          </div>
          
          <div className="mt-4 md:mt-0">
            {isYoutubeConnected ? (
              <div className="flex items-center gap-3 bg-slate-800/80 p-2 pr-4 rounded-full border border-slate-700">
                {youtubeChannel?.avatar && (
                  <img src={youtubeChannel.avatar} alt="Channel" className="w-8 h-8 rounded-full border border-red-500" />
                )}
                <div className="text-left">
                  <p className="text-xs text-slate-400">Connected Channel</p>
                  <p className="text-sm font-semibold text-white">{youtubeChannel?.title || 'Unknown Channel'}</p>
                </div>
                <button
                  onClick={handleDisconnectYoutube}
                  className="ml-4 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectYoutube}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-full transition-all flex items-center gap-2 shadow-lg shadow-red-600/20 active:scale-95 cursor-pointer"
              >
                <span>🔴</span> Connect {currentEditorLanguage} YouTube Channel
              </button>
            )}
          </div>
        </div>

        {isYoutubeConnected ? (() => {
          const currentMetadata = youtubeMetadataLocalizations[currentEditorLanguage] || {
            title: youtubeTitle || inputs.title || "",
            description: youtubeDescription || "",
            tags: inputs.appMode === AppMode.Football
              ? `AI, football, soccer, football simulator, world cup, fifa, fifa 2026, ${footballInput.teamA.toLowerCase()} football team, ${footballInput.teamB.toLowerCase()} football team`
              : (youtubeTags || "story, AI")
          };

          const handleUpdateMetadata = (updates: Partial<typeof currentMetadata>) => {
            setYoutubeMetadataLocalizations(prev => ({
              ...prev,
              [currentEditorLanguage]: {
                ...(prev[currentEditorLanguage] || {
                  title: youtubeTitle || inputs.title || "",
                  description: youtubeDescription || "",
                  tags: inputs.appMode === AppMode.Football
                    ? `AI, football, soccer, football simulator, world cup, fifa, fifa 2026, ${footballInput.teamA.toLowerCase()} football team, ${footballInput.teamB.toLowerCase()} football team`
                    : (youtubeTags || "story, AI")
                }),
                ...updates
              }
            }));
            if (updates.title !== undefined) setYoutubeTitle(updates.title);
            if (updates.description !== undefined) setYoutubeDescription(updates.description);
            if (updates.tags !== undefined) setYoutubeTags(updates.tags);
          };

          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-200">Video Meta & Optimization</h3>
                
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Video Title (max 100 characters)</label>
                  <input
                    type="text"
                    value={currentMetadata.title}
                    onChange={(e) => handleUpdateMetadata({ title: e.target.value })}
                    placeholder="Enter video title..."
                    maxLength={100}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Video Description</label>
                  <textarea
                    value={currentMetadata.description}
                    onChange={(e) => handleUpdateMetadata({ description: e.target.value })}
                    placeholder="Describe your video..."
                    rows={5}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors font-sans text-sm resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={currentMetadata.tags}
                    onChange={(e) => handleUpdateMetadata({ tags: e.target.value })}
                    placeholder="tag1, tag2, tag3"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col justify-between bg-slate-800/20 border border-slate-800/80 rounded-xl p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-200">Autopilot Settings</h3>
                  
                  <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Autopilot Publish</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Automatically upload as Private as soon as render finishes.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoPublishToYoutube}
                        onChange={(e) => setAutoPublishToYoutube(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  </div>

                  <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/50 space-y-2">
                    <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <span>Visibility</span>
                      <span className="text-red-400">Locked to Private</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <span>Altered Content</span>
                      <span className="text-emerald-400">Yes</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <span>Category</span>
                      <span className="text-emerald-400">{inputs.appMode === AppMode.Football ? 'Sports' : 'People & Blogs'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <span>Caption Certification</span>
                      <span className="text-emerald-400">None</span>
                    </div>
                  </div>
                </div>

              <div className="space-y-4">
                {isPublishing ? (
                  <div className="space-y-2 text-center">
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className="bg-red-500 h-2 rounded-full transition-all duration-300" style={{ width: `${publishProgress}%` }}></div>
                    </div>
                    <p className="text-red-400 font-semibold text-sm animate-pulse">Uploading to YouTube... {publishProgress}%</p>
                  </div>
                ) : publishSuccessUrl ? (
                  <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl text-center space-y-2">
                    <p className="text-green-400 font-semibold">🎉 Video Published Privately!</p>
                    <a
                      href={publishSuccessUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-full transition-colors cursor-pointer"
                    >
                      View on YouTube
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={handlePublishToYoutube}
                    disabled={(!serverVideoFilename && !renderedVideoUrl) || isPublishing}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-red-600/15 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] cursor-pointer"
                  >
                    🚀 Publish to YouTube (Private)
                  </button>
                )}
                {!serverVideoFilename && !renderedVideoUrl && (
                  <p className="text-center text-xs text-slate-500">
                    ⚠️ You must render the movie before you can publish.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })() : (
          <div className="bg-slate-900/40 p-8 rounded-xl border border-slate-800 text-center space-y-4">
            <div className="text-4xl">🔒</div>
            <h4 className="text-base font-semibold text-slate-300">YouTube Publishing Console Locked</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Please click the "Connect YouTube Channel" button above to authenticate with Google and unlock full-auto uploads.
            </p>
            <div className="pt-2">
              <button 
                onClick={checkYoutubeStatus}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-400 font-semibold px-4 py-2.5 rounded-lg border border-slate-700 hover:border-indigo-500/30 transition-all active:scale-95 flex items-center gap-1.5 mx-auto cursor-pointer"
              >
                🔄 Sync Connection Status
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (!hasCheckedKey) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-mono animate-pulse">Initializing Studio...</div>;
  }

  // API Key Landing Page
  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center font-sans">
        <div className="w-full max-w-md animate-fade-in space-y-8">
          <div className="space-y-2">
            <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Mythos Studio
            </h1>
            <p className="text-slate-400 text-lg">AI-Powered Cinematic Storytelling</p>
          </div>

          <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
            <div className="flex justify-center mb-6">
              <div className="p-3 bg-indigo-500/20 rounded-full">
                <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-3">Connect Google Cloud</h3>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              This application uses high-fidelity models (<strong>Veo</strong> for video, <strong>Gemini 3 Pro</strong> for images) which require a billing-enabled project.
            </p>

            <button
              onClick={handleConnectKey}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all transform hover:scale-[1.02] shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
            >
              Select API Key
            </button>

            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <a
                href="https://ai.google.dev/gemini-api/docs/billing"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1 hover:underline"
              >
                About Gemini API Pricing
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main App Interface
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-indigo-500/30">
      <main className={`pt-24 pb-12 px-4 transition-all duration-500 ${isPreviewing ? 'opacity-0 pointer-events-none fixed inset-0' : 'opacity-100'}`}>
        {step === AppStep.INPUT && renderInputStep()}
        {step === AppStep.PROCESSING_SCRIPT && renderProcessingStep()}
        {step === AppStep.ASSET_GENERATION && renderAssetGenerationStep()}
      </main>

      {/* Preview Overlay */}
      {isPreviewing && localizedScenes.length > 0 && (
        <div ref={previewContainerRef} className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center">
            {isPreviewSingleVideo ? (
              /* RAW VIDEO ONLY PREVIEW */
              <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                {activeScene.videoUrl ? (
                  <video
                    src={activeScene.videoUrl}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    No video generated for this scene yet.
                  </div>
                )}
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() => { setIsPreviewing(false); setIsPreviewSingleVideo(false); }}
                    className="bg-black/60 hover:bg-black/80 text-white px-4 py-2 rounded-full backdrop-blur-md border border-white/20 text-xs font-bold transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* FULL SCENE PREVIEW */
              <>
                <KenBurnsPlayer
                  key={currentPreviewIndex}
                  imageUrl={activeScene.imageUrl || ''}
                  durationMinutes={inputs.durationMinutes / scenes.length}
                  animationStyles={activeScene.animationStyles}
                  animationConfig={activeScene.animationConfig}
                  overlays={activeScene.overlays}
                  videoUrl={activeScene.videoUrl}
                  videoPlacement={activeScene.videoOptions?.placement}
                  videoOptions={activeScene.videoOptions}
                  currentTime={currentPlaybackTime}
                  actualDuration={ttsDuration}
                  onVideoEnded={() => setVideoEnded(true)}
                  imageUrlEnd={activeScene.imageUrlEnd}
                  isCleanMode={isCleanMode}
                  isLargePlayer={true}
                  isPlaying={isPreviewPlaying}
                  isMuted={activeScene.isMuted}
                  videoVolume={inputs.appMode === AppMode.Animated ? 0.2 : 1.0}
                />


                {/* EXIT BUTTON FOR PRESENTATION MODE */}
                {isCleanMode && (
                  <div className="absolute top-8 right-8 z-[110] opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setIsPreviewing(false); }}
                      className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full backdrop-blur-md border border-white/30 text-sm font-bold transition-all"
                    >
                      Exit
                    </button>
                  </div>
                )}

                {/* Multi-Track Audio Player */}
                {/* 1. TTS - Driver (onEnded triggers next) */}
                {activeScene.ttsAudioUrl && (
                  <audio
                    ref={previewTtsRef}
                    src={activeScene.ttsAudioUrl}
                    onLoadedMetadata={(e) => {
                      const dur = (e.target as HTMLAudioElement).duration;
                      setTtsDuration(dur);
                      if (lastTransitionTime === 0) setLastTransitionTime(Date.now()); // Set initial watchdog
                    }}
                    onEnded={() => {
                      setAudioEnded(true);
                    }}
                    onTimeUpdate={(e) => {
                      setCurrentPlaybackTime((e.target as HTMLAudioElement).currentTime);
                    }}

                    onError={() => {
                      console.error("TTS Audio Load Error for scene", currentPreviewIndex);
                      setAudioEnded(true); // Don't get stuck on error
                    }}
                    className="hidden"
                  />
                )}
                {/* 2. Background Music - Loop, Volume Low */}
                <audio
                  ref={previewMusicRef}
                  src={getAudioSrc(activeScene.selectedMusicId)}
                  loop
                  className="hidden"
                  onCanPlay={(e) => { /* Volume handled by useEffect */ }}
                />
                {/* 3. SFX - Volume Med, Start trimmed */}
                <audio
                  ref={previewSfxRef}
                  src={getAudioSrc(activeScene.selectedSfxId)}
                  className="hidden"
                  onCanPlay={(e) => { /* Volume handled by useEffect */ }}
                />
              </>
            )}
          </div>

          {/* Minimal Controls */}
          {!isCleanMode && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 opacity-0 hover:opacity-100 transition-opacity duration-300">
              <button onClick={handlePreviewPrev} className="text-white/70 hover:text-white"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
              <button onClick={togglePreviewPlay} className="text-white hover:scale-110 transition-transform">
                {isPreviewPlaying ? (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                ) : (
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                )}
              </button>
              <button onClick={handlePreviewNext} className="text-white/70 hover:text-white"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg></button>
              <div className="w-px h-4 bg-white/20 mx-2"></div>
              <button onClick={toggleCleanMode} className="text-white/70 hover:text-white text-xs font-mono uppercase tracking-widest">Fullscreen (F)</button>
              <button onClick={() => setIsPreviewing(false)} className="text-white/70 hover:text-white text-xs font-mono uppercase tracking-widest ml-4">Close (Esc)</button>
            </div>
          )}
        </div>
      )}

      <LiveAssistant />
    </div>
  );
};

export default App;
