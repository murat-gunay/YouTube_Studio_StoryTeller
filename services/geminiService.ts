
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MODELS, AUDIO_LIBRARY } from "../constants";
import { Scene, GeneratedScriptResponse, TTSTone, AspectRatio, Character, Overlay, VoiceOption, Language, VideoOptions } from "../types";

// Helper to base64 encode blobs
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Failed to read blob"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Robustly ensures we have base64 data from ANY image source (Data URL or Blob URL).
 */
export const urlToBase64 = async (url: string): Promise<string> => {
  if (!url) return "";
  if (url.startsWith('data:')) {
    return url.split(',')[1];
  }
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await blobToBase64(blob);
  } catch (e) {
    console.error(`Failed to convert URL to base64: ${url}`, e);
    return "";
  }
};

// --- WAV Header Utilities ---

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const addWavHeader = (samples: Uint8Array, sampleRate: number = 24000, numChannels: number = 1, bitDepth: number = 16): Uint8Array => {
  const buffer = new ArrayBuffer(44 + samples.length);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (1 is PCM) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length, true);

  const dataView = new Uint8Array(buffer);
  dataView.set(samples, 44);

  return dataView;
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// ---------------------------

// Helper for robust JSON extraction from Gemini responses
const robustParseJson = (text: string | undefined | null) => {
  if (!text) return {};
  
  let cleanText = text.trim();
  
  // Try to remove markdown code blocks if present
  if (cleanText.startsWith("```")) {
    const lines = cleanText.split("\n");
    if (lines[0].startsWith("```")) lines.shift(); // remove first line
    if (lines[lines.length - 1].startsWith("```")) lines.pop(); // remove last line
    cleanText = lines.join("\n").trim();
  }

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // If simple trim didn't work, search for any { ... } block
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.error("❌ [robustParseJson] Regex match failed to parse:", e2);
      }
    }
    console.warn("⚠️ [robustParseJson] JSON parsing failed. returning {}. Raw text preview:", text.substring(0, 100));
    return {};
  }
};

const SPEAKING_RATE_WPM = 150; // Standard for clear, engaging narration
const HOOK_DURATION_SECONDS = 15;

// 1. Transcribe Audio
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Audio = await blobToBase64(audioBlob);

  const response = await ai.models.generateContent({
    model: MODELS.transcription,
    contents: {
      parts: [
        { inlineData: { mimeType: audioBlob.type || 'audio/webm', data: base64Audio } },
        { text: "Transcribe this audio. If it is not in English, translate it to natural English suitable for a story script." }
      ]
    }
  });

  return response.text || "";
};

// 1b. Generate Title
export const generateTitle = async (content: string, targetLanguage: Language = Language.English): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: MODELS.scriptGen,
    contents: `Analyze the following story content and generate a catchy, short YouTube video title (max 10 words). 
    
    CRITICAL: The title MUST be in **${targetLanguage}**.
    
    Return ONLY the title text, no quotes, no markdown.
    
    Content: ${content.substring(0, 5000)}`
  });
  return response.text?.trim().replace(/^"|"$/g, '').replace(/\*\*/g, '') || "Untitled Project";
};

// 2. Generate Story Script
export const generateStoryScript = async (
  transcription: string,
  title: string,
  instructions: string,
  sceneCount: number,
  durationMinutes: number,
  useSearch: boolean,
  defaultVoice: VoiceOption,
  targetLanguage: Language
): Promise<{ scenes: Scene[], storyContext: string, characters: Character[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const totalDurationSeconds = durationMinutes * 60;
  const hookDurationSeconds = HOOK_DURATION_SECONDS;
  const remainingDurationSeconds = Math.max(0, totalDurationSeconds - hookDurationSeconds);
  const remainingScenesCount = Math.max(1, sceneCount - 1);
  const durationPerSceneSeconds = remainingDurationSeconds / remainingScenesCount;

  // Exact word count targets
  const hookWordCount = Math.floor((hookDurationSeconds / 60) * SPEAKING_RATE_WPM);
  const targetWordCount = Math.floor((durationPerSceneSeconds / 60) * SPEAKING_RATE_WPM);

  // Prepare Audio Library for Prompt
  const musicList = AUDIO_LIBRARY.filter(a => a.category === 'music').map(a => `- ID: "${a.id}" (Description: ${a.label})`).join('\n');
  const sfxList = AUDIO_LIBRARY.filter(a => a.category !== 'music').map(a => `- ID: "${a.id}" (Description: ${a.label})`).join('\n');

  const prompt = `
    You are a professional YouTube content creator and storyteller making a comic-style video.
    Project Title: ${title}
    Context/Instructions: ${instructions}
    Source Material (Transcript in English): ${transcription}
    
    **LANGUAGE PROTOCOLS (CRITICAL - FOLLOW STRICTLY)**:
    1. **VIDEO CONTENT (User Facing)**: The 'voiceover', 'caption_context', and 'caption_dialogue' MUST be written in **${targetLanguage}**.
    2. **PRODUCTION METADATA (Backend)**: The 'visual_description' (for image gen), 'story_context' (Story Bible), and 'characters.description' MUST be written in **ENGLISH**.

    Target Specifications:
    - Total Scenes: ${sceneCount}
    
    **AVAILABLE AUDIO ASSETS (Strictly select from this list)**:
    
    [BACKGROUND MUSIC] - Select one per scene based on emotion.
    ${musicList}

    [SFX / AMBIENCE] - Select one per scene based on setting.
    ${sfxList}

    **CRITICAL STRUCTURE INSTRUCTIONS**:

    1. **SCENE 1 (THE HOOK - MANDATORY)**: 
       - Duration: Exactly 10-15 seconds (approx 30-40 words).
       - **Content Strategy**: You MUST use a "Ledünni Paradox" (Spiritual/Metaphysical Paradox) style question to immediately grab attention.
       - **Style Reference**: Think of mysteries like:
         * "How can a killer save a child's life by killing him? (Khidr style)"
         * "Who was the baker who told the Sultan of Time 'You do not fit here'? (Somuncu Baba style)"
       - **Instruction**: Create a NEW paradox/mystery hook in **${targetLanguage}** that relates to the story.
       - **Visual**: A metaphorical, mysterious, or high-contrast image representing the paradox (Description in English).

    2. **REMAINING SCENES (SCENE 2 to ${sceneCount})**:
       - Continue the story normally based on the transcript.
       - Voiceover Length: Approximately ${targetWordCount} words per scene.
       - **Language**: Write ALL narration in **${targetLanguage}**.

    Task: 
    1. **Character Extraction**: Identify main characters. Provide detailed visual description in **ENGLISH**.
    2. **Story Bible**: Describe setting and mood in **ENGLISH**.
    3. **Script**: Create scenes.
       - **SCENE 1 (THE HOOK)**: MUST be exactly **${hookWordCount} words** long (to fill 15 seconds).
       - **REMAINING SCENES**: EACH MUST be exactly **${targetWordCount} words** long (to fill ${Math.round(durationPerSceneSeconds)} seconds).
    4. **Visual Descriptions**: For EACH scene, write a PURELY content-based visual description in **ENGLISH**.
    5. **Overlays**: For EACH scene, generate text overlays in **${targetLanguage}**.
    
    Output JSON format:
    {
      "story_context": "General setting and mood in ENGLISH...",
      "characters": [
         { "name": "Hero Name", "description": "Detailed visual description in ENGLISH..." }
      ],
      "scenes": [
        {
          "voiceover": "The spoken text in ${targetLanguage}...",
          "caption_context": "Short narrative text in ${targetLanguage}...",
          "caption_dialogue": "Short dialogue or sound effect in ${targetLanguage}...",
          "visual_description": "A detailed reference image generation prompt in ENGLISH...",
          "background_audio_id": "music_mystical",
          "sfx_audio_id": "ambience_rain"
        }
      ]
    }
  `;

  const tools = useSearch ? [{ googleSearch: {} }] : [];

  const response = await ai.models.generateContent({
    model: MODELS.scriptGen,
    contents: prompt,
    config: {
      tools: tools,
      responseMimeType: "application/json"
    }
  });

  const rawData: GeneratedScriptResponse = robustParseJson(response.text || "{}");

  const movementAnimations = [
    'animate-kb-zoom-in', 'animate-kb-zoom-out',
    'animate-kb-pan-right', 'animate-kb-pan-left', 'animate-kb-pan-up', 'animate-kb-pan-down',
    'animate-kb-diag-right-up', 'animate-kb-diag-left-up', 'animate-kb-zoom-pan-right'
  ];

  const formatTime = (totalMinutes: number) => {
    const totalSeconds = Math.round(totalMinutes * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const scenes = (rawData.scenes || []).map((s, index) => {
    const overlays: Overlay[] = [
      { text: s.caption_context, style: 'comic-box' },
      { text: s.caption_dialogue, style: 'speech-bubble' }
    ];

    // Handle time range calculation correctly
    let timeRange = "";
    const hookDurationMins = 15 / 60;

    if (index === 0) {
      timeRange = `0:00 - ${formatTime(hookDurationMins)} (Hook)`;
    } else {
      const remainingDurationMins = Math.max(0, durationMinutes - hookDurationMins);
      const remainingScenesCount = Math.max(1, rawData.scenes.length - 1);
      const durationPerRemainingScene = remainingDurationMins / remainingScenesCount;

      const startMin = hookDurationMins + ((index - 1) * durationPerRemainingScene);
      const endMin = hookDurationMins + (index * durationPerRemainingScene);

      timeRange = `${formatTime(startMin)} - ${formatTime(endMin)}`;
    }

    return {
      id: index,
      timeRange: timeRange,
      voiceoverScript: s.voiceover,
      overlays: overlays,
      visualPrompt: s.visual_description,
      visualPromptEnd: undefined, // No longer used
      // Initialize with one random movement animation
      animationStyles: [movementAnimations[Math.floor(Math.random() * movementAnimations.length)]],
      isGeneratingImage: false,
      isGeneratingImageEnd: false,
      isGeneratingVideo: false,
      isGeneratingVideoPrompt: false,
      isGeneratingTTS: false,
      selectedTone: index === 0 ? TTSTone.Mysterious : TTSTone.Neutral, // Default hook to Mysterious
      selectedVoice: defaultVoice,
      selectedMusicId: s.background_audio_id || 'music_mystical',
      selectedSfxId: s.sfx_audio_id || 'ambience_interior',
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
  });

  const characters = (rawData.characters || []).map((c, i) => ({
    id: `char_${i}`,
    name: c.name,
    description: c.description
  }));

  return { scenes, storyContext: rawData.story_context || "", characters };
};

// 3. Generate Image with Multimodal Character consistency AND Time Travel Adaptation
export const generateImage = async (
  scenePrompt: string,
  style: string,
  aspectRatio: string,
  storyContext: string,
  characters: Character[] = [],
  imageOverlayText?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const contentParts: any[] = [];

  // 1. Detect which characters are in this scene based on name matching
  // This allows us to only send relevant reference images.
  const relevantCharacters = characters.filter(c =>
    scenePrompt.toLowerCase().includes(c.name.toLowerCase()) && c.referenceImageUrl
  );

  let characterInstruction = "";

  if (relevantCharacters.length > 0) {
    characterInstruction += "CHARACTER REFERENCES:\n";
    for (const char of relevantCharacters) {
      if (char.referenceImageUrl) {
        const base64Data = await urlToBase64(char.referenceImageUrl);
        if (base64Data) {
          contentParts.push({
            inlineData: { mimeType: 'image/png', data: base64Data }
          });
          characterInstruction += `- ${char.name}: Use the provided reference for facial identity/features. Ignore its original art style.\n`;
        }
      }
    }
  } else if (characters.length > 0) {
    characterInstruction = "CHARACTERS:\n" + characters.map(c => `- ${c.name}: ${c.description}`).join("\n");
  }

  const fullPrompt = `
    ROLE: Senior Art Director.
    TASK: Generate a high-fidelity image that strictly adheres to the TECHNICAL STYLE PROFILE.

    1. TECHNICAL STYLE PROFILE: 
    - Base Style: ${style}
    - Aesthetic Rules: Maintain absolute consistency. If the style is minimalist (Sketch, Stickman, Sumie), DO NOT add realistic textures, complex shading, or detailed backgrounds. If the style is Cinematic/Noir, emphasize professional lighting and composition.

    2. NARRATIVE SUBJECT:
    - Content: ${scenePrompt}
    - Story Context: ${storyContext}
    - Character Continuity: ${characterInstruction}

    3. COMPOSITION CONSTRAINTS:
    - Zero Tolerance: No dialogue bubbles, no text (unless specified in OVERLAY), no "magical" or unrealistic distortions. Ground everything in the chosen aesthetic.
    - Overlay Message: ${imageOverlayText ? `Render following text naturally: "${imageOverlayText}"` : "None"}

    FINAL DIRECTIVE: The TECHNICAL STYLE PROFILE is the absolute priority. The NARRATIVE SUBJECT must be interpreted through this style only.
  `;

  contentParts.push({ text: fullPrompt });

  const validRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
  const safeAspectRatio = validRatios.includes(aspectRatio) ? aspectRatio : "16:9";

  const response = await ai.models.generateContent({
    model: MODELS.imageGen,
    contents: { parts: contentParts },
    config: {
      imageConfig: {
        aspectRatio: safeAspectRatio as any,
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
  if (textPart?.text) throw new Error(`Generation refused: ${textPart.text}`);
  throw new Error("No image generated");
};

// 3c. Generate Character Reference Sheet (SPLIT VIEW)
export const generateCharacterReference = async (
  character: Character,
  style: string,
  storyContext: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Explicitly requesting a Split View for better reference usage
  const prompt = `
      ROLE: Senior Character Designer.
      TASK: Generate a standardized Studio Character Reference Sheet for "${character.name}".
      
      TECHNICAL STYLE: ${style}
      IDENTITY: ${character.description}
      STORY CONTEXT: ${storyContext}
      
      COMPOSITION:
      - Layout: Single full-body shot of the character (Front view, standing).
      - Requirement: The character must be shown from head to toe. No cropped faces or split views.
      - Background: Sterile studio grey. No distractions.
      - Rule: Prioritize ${style} above all literal descriptions.
    `;

  const response = await ai.models.generateContent({
    model: MODELS.imageGen,
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: "16:9", // Wide aspect ratio is best for split view
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Character generation failed");
};


// 3b. Edit Image (Updated to use Gemini 3 Pro for high quality "Edit by Instruction")
export const editImage = async (base64Image: string, prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await urlToBase64(base64Image);

  // We treat the original image as a reference and ask the model to regenerate it with the change
  const fullPrompt = `
    Reference Image provided.
    
    Task: Re-generate this image, but apply the following specific modification: "${prompt}".
    
    Constraints:
    - Maintain the exact same composition, art style, and character identity as the reference image.
    - Only change what is requested in the modification.
    - High quality output.
  `;

  const response = await ai.models.generateContent({
    model: MODELS.imageEdit, // Now pointing to gemini-3-pro-image-preview
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/png', data: base64Data } },
        { text: fullPrompt }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9", // Defaulting to wide, but ideally we match input. 
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Image edit failed");
};

// 4. Generate Video (Veo 3.1)
export const generateVideo = async (
  imageSrc: string,
  aspectRatio: string,
  endImageSrc?: string,
  prompt?: string,
  options?: VideoOptions
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const startBase64 = await urlToBase64(imageSrc);
  const endBase64 = endImageSrc ? await urlToBase64(endImageSrc) : startBase64;

  let safeResolution = options?.resolution || '720p';
  const videoDuration = options?.duration || 6;
  if (safeResolution === '1080p' && videoDuration !== 8) {
    console.warn(`🎬 [Video] Veo 3.1 limits 1080p to 8s videos. Falling back to 720p for ${videoDuration}s.`);
    safeResolution = '720p';
  }

  const videoConfig: any = {
    numberOfVideos: options?.numVideos || 1,
    aspectRatio: (options?.aspectRatio || aspectRatio) === '9:16' ? '9:16' : '16:9',
    resolution: safeResolution,
    includeAudio: options?.generateAudio ?? true,
    include_audio: options?.generateAudio ?? true, 
    videoDurationSeconds: videoDuration,
    lastFrame: {
      imageBytes: endBase64,
      mimeType: 'image/png'
    }
  };

  // Image-to-Video mode: Veo 3.1 will animate this specific reference image.
  const contents: any = {
    model: MODELS.videoGen,
    image: {
      imageBytes: startBase64,
      mimeType: 'image/png'
    },
    config: videoConfig
  };

  // Add video prompt if provided
  if (prompt) {
    contents.prompt = prompt;
  }

  let operation = await ai.models.generateVideos(contents);

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed");

  const res = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await res.blob();

  // Note: App will handle storage in AssetStorage to keep RAM clean
  return URL.createObjectURL(blob);
};

// 4b. Generate Video Prompt based on scene context
export const generateVideoPrompt = async (storyContext: string, scene: Scene): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    ROLE: Master of Silent Performance & Physical Theater.
    TASK: Generate a professional animation directive for Veo 3.1.
    
    Veo 3.1 will receive the SAME reference image as both START and END frames for a PERFECT SEAMLESS LOOP.
    
    1. ACTING DIRECTIVE: ${scene.videoPrompt || scene.visualPrompt}
    2. PERFORMANCE GOAL: Real-time, meaningful movement. NO SLOW-MOTION.
    3. BEHAVIORAL FOCUS: Focus purely on what happens BETWEEN the frames (emotions, transitions, environmental acting).
    4. MANDATORY CONSTRAINTS:
       - ZERO DIALOGUE: Absolutely no mouth movement or speaking.
       - LOCKED CAMERA: Static camera only.
       - SEAMLESS LOOP: Final state must match the initial reference frame.
       
    Combine these into a cinematic animation prompt in ENGLISH. Return ONLY the text.
  `;

  const response = await ai.models.generateContent({
    model: MODELS.scriptGen,
    contents: prompt
  });

  return response.text?.trim() || scene.visualPrompt;
};

// 5. Text to Speech with Tone
export const generateTTS = async (text: string, voiceName: string, tone: TTSTone): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const textWithTone = `(Spoken in a ${tone} tone) ${text}`;

  const response = await ai.models.generateContent({
    model: MODELS.tts,
    contents: [{ parts: [{ text: textWithTone }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName }
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("TTS failed");

  const pcmBytes = base64ToUint8Array(base64Audio);
  const wavBytes = addWavHeader(pcmBytes, 24000, 1, 16);
  const wavBase64 = uint8ArrayToBase64(wavBytes);

  return `data:audio/wav;base64,${wavBase64}`;
};

// 2b. Refine Content
export const refineContent = async (
  originalText: string,
  instruction: string,
  type: 'voiceover' | 'visual'
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = type === 'voiceover'
    ? `Rewrite the following voiceover script based on this instruction: "${instruction}". \n\nOriginal Script: "${originalText}"\n\nOutput only the new script text.`
    : `Enhance the following image generation prompt to be more professional, descriptive, and high-quality, based on this instruction: "${instruction}". 
       
       CRITICAL: The output MUST be in **ENGLISH**.
       
       Original Prompt: "${originalText}"\n\nOutput only the new prompt text.`;

  const response = await ai.models.generateContent({
    model: MODELS.contentRefine,
    contents: prompt
  });

  return response.text?.trim() || originalText;
};

// 3a. Generate YouTube Thumbnail
export const generateThumbnail = async (
  projectTitle: string,
  style: string,
  storyContext: string,
  characters: Character[] = [],
  titleText?: string,
  subtitleText?: string,
  customVisualPrompt?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const contentParts: any[] = [];
  let charInstructions = "";

  // 1. Add Character References
  // Filter for valid references and maybe limit to keep composition clean, though we'll send all valid ones.
  const charsWithRefs = characters.filter(c => c.referenceImageUrl);

  if (charsWithRefs.length > 0) {
    charInstructions += "CHARACTERS TO INCLUDE (Maintain consistency with provided references):\n";
    for (const char of charsWithRefs) {
      if (char.referenceImageUrl) {
        const base64Data = await urlToBase64(char.referenceImageUrl);
        if (base64Data) {
          contentParts.push({
            inlineData: { mimeType: 'image/png', data: base64Data }
          });
          charInstructions += `- Character "${char.name}": Reference image provided. Maintain facial identity but ADAPT CLOTHING/POSE to the thumbnail composition.\n`;
        }
      }
    }
  }

  // 2. Text Instructions
  let textInstructions = "";
  if (titleText) {
    textInstructions += `\n- VISIBLE TEXT: Render the title text "${titleText}" prominently in the image. Use a font style matching the art style.`;
  }
  if (subtitleText) {
    textInstructions += `\n- VISIBLE TEXT: Render the subtitle text "${subtitleText}" clearly.`;
  }

  // If no text provided, let the model decide or create a text-free version
  if (!titleText && !subtitleText) {
    textInstructions += `\n- TEXT HANDLING: You may choose to render the project title "${projectTitle}" if it enhances the composition, or leave the image text-free for post-production. Use your creative judgment.`;
  }

  let prompt = "";

  if (customVisualPrompt) {
    // User overrides the description part but we still respect style and text/char constraints
    prompt = `
        Create a high-impact YouTube Thumbnail.
        
        VISUAL DESCRIPTION (Must be interpreted in ENGLISH): ${customVisualPrompt}
        
        Art Style: ${style}.
        
        ${charInstructions}
        
        Requirements:
        - High contrast, vibrant colors, click-worthy.
        - Aspect Ratio: 16:9.
        ${textInstructions}
     `;
  } else {
    prompt = `
        Create a high-impact YouTube Thumbnail for a video project titled "${projectTitle}".
        
        Art Style: ${style}.
        Story Context: ${storyContext}
        
        ${charInstructions}
        
        Requirements:
        - High contrast, vibrant colors, click-worthy.
        - Composition: Rule of thirds, dynamic lighting.
        - Aspect Ratio: 16:9.
        ${textInstructions}
        - If characters are included, ensure they look consistent with the provided references but in a dramatic pose suitable for a cover.
     `;
  }

  contentParts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: MODELS.imageGen,
    contents: { parts: contentParts },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "1K"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Thumbnail generation failed");
};

export const generateAnimatedStoryScript = async (
  transcription: string,
  title: string,
  instructions: string,
  sceneCount: number,
  durationMinutes: number,
  useSearch: boolean,
  defaultVoice: VoiceOption,
  targetLanguage: Language,
  style: string
): Promise<{ scenes: Scene[], storyContext: string, characters: Character[] }> => {
  console.info(`📜 [Script:Animated] Generating animated story script for "${title}". Scenes: ${sceneCount}`);
  console.time('📜 [Script:Animated] Generation Duration');
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const tools = useSearch ? [{ googleSearch: {} }] : [];

    // --- PHASE 1: CHARACTER & BIBLE EXTRACTION ---
    console.info(`📜 [Script:Animated] Phase 1: Identifying characters and story universe...`);
    
    const phase1Prompt = `
      You are a world-class Story Architect and Social Psychologist.
      Analyze the following source material to define a deep narrative universe for a video project focusing on psychology, sociology, and motivation.
      
      Project Title: ${title}
      Source Material: ${transcription}
      Target Visual Style: ${style}

      TASK:
      1. **NARRATIVE UNIVERSE**: Define the setting and atmospheric tone (Focus on psychological/educational depth).
      2. **CHARACTER ARCHETYPES**: Identify the primary actors. Provide a professional visual profile for each.
         - **NO NARRATOR**: Do NOT extract a character named "Narrator". Only actors who participate in scenes.
         - **FULL-BODY FOCUS (BOYDAN)**: Visual descriptions MUST focus on the character from head to toe. Describe clothing, stance, and physical presence as a whole.
         - **COMPATIBILITY**: Descriptions must be naturally compatible with the "${style}" style.

      Output JSON format:
      {
        "story_context": "Deep atmospheric setting and tone in ENGLISH...",
        "characters": [
          { "name": "Name", "description": "Core visual identity compatible with ${style} in ENGLISH..." }
        ]
      }
    `;

    const phase1Response = await ai.models.generateContent({
      model: MODELS.scriptGen,
      contents: phase1Prompt,
      config: {
        tools: tools,
        responseMimeType: "application/json"
      }
    });

    console.debug("🔬 [Script:Animated] Phase 1 Raw Response:", phase1Response.text);
    
    if (!phase1Response.text) {
      console.error("❌ [Script:Animated] Phase 1 returned NULL or EMPTY response text.");
    }

    const phase1Data = robustParseJson(phase1Response.text);
    const extractedCharacters = phase1Data.characters || [];
    const extractedContext = phase1Data.story_context || "";
    
    if (extractedCharacters.length === 0) {
      console.warn("⚠️ [Script:Animated] Phase 1 returned no characters. Response Text:", phase1Response.text);
    }
    if (!extractedContext) {
      console.warn("⚠️ [Script:Animated] Phase 1 returned no story context.");
    }

    const charContextString = extractedCharacters.length > 0 
      ? extractedCharacters.map((c: any) => `- ${c.name}: ${c.description}`).join("\n")
      : "No specific characters identified. Focus on metaphorical or abstract figures.";

    // --- PHASE 2: SCENE GENERATION ---
    console.info(`📜 [Script:Animated] Phase 2: Generating ${sceneCount} scenes with actors: ${extractedCharacters.length > 0 ? extractedCharacters.map((c: any) => c.name).join(", ") : 'Anonymous'}`);

    // --- CALCULATION LOGIC ---
    const totalDurationSeconds = durationMinutes * 60;
    const hookDurationSeconds = HOOK_DURATION_SECONDS;
    const remainingDurationSeconds = Math.max(0, totalDurationSeconds - hookDurationSeconds);
    const remainingScenesCount = Math.max(1, sceneCount - 1);
    const durationPerRemainingSceneSeconds = remainingDurationSeconds / remainingScenesCount;

    const hookWordCount = Math.floor((hookDurationSeconds / 60) * SPEAKING_RATE_WPM);
    const targetWordCount = Math.floor((durationPerRemainingSceneSeconds / 60) * SPEAKING_RATE_WPM);

    const musicList = AUDIO_LIBRARY.filter(a => a.category === 'music').map(a => `- ID: "${a.id}" (Description: ${a.label})`).join('\n');
    const sfxList = AUDIO_LIBRARY.filter(a => a.category !== 'music').map(a => `- ID: "${a.id}" (Description: ${a.label})`).join('\n');

    const phase2Prompt = `
      You are an Award-winning Educational Psychotherapist and Visual Scriptwriter.
      Create a visually symbolic script in ${targetLanguage} using the provided character identities and story bible.
      
      **UNIVERSE**: ${extractedContext}
      **PRIMARY ACTORS**: 
      ${charContextString}
      **TARGET STYLE**: ${style}

      **ANIMATION PROTOCOLS (STRICT)**:
      1. **IDENTITY PRESERVATION**: In 'visual_description', you MUST use the exact Character Names/Titles (e.g., "${extractedCharacters[0]?.name || 'Actor'}"). Never use generic terms like "a stickman" if a name exists.
      2. **NON-REDUNDANT VIDEO PROMPT**: The 'video_prompt' should NOT re-describe the static background or the character's clothing. It MUST focus exclusively on the movement, emotions, and acting occurring *between* the first and last frame.
      3. **ROLE-PLAYING & SITUATION**: Depict characters in situational role-play scenarios.
      4. **REAL-TIME MOVEMENT**: Movement must be natural and real-time. ABSOLUTELY NO SLOW-MOTION, blurry effects, or tiny micro-movements.
      5. **SILENT PERFORMANCE**: Absolutely no dialogue or mouth movement.
      6. **SEAMLESS LOOPS**: Ensure the behavioral arc can cycle perfectly.

      TASK:
      1. **SCENE 1 (THE HOOK)**: Exactly **${hookWordCount} words** (15s). Use a paradox or psychological mystery.
      2. **REMAINING SCENES**: Each MUST be exactly **${targetWordCount} words** (for ${Math.round(durationPerRemainingSceneSeconds)}s).

      Final JSON Output Keys:
      - 'voiceover': The spoken narration in ${targetLanguage}.
      - 'visual_description': Detailed image prompt using EXACT Character Names/Titles (Style: ${style}).
      - 'video_prompt': Performance directive for Veo. Focus only on acting, emotions, and real-time movement *between* frames. Do not re-describe the scene.
      - 'image_overlay_text': A deep, meaningful message.
      - 'background_audio_id', 'sfx_audio_id'.
    `;

    const phase2Response = await ai.models.generateContent({
      model: MODELS.scriptGen,
      contents: phase2Prompt,
      config: {
        tools: tools,
        responseMimeType: "application/json"
      }
    });

    console.debug("🔬 [Script:Animated] Phase 2 Raw Response:", phase2Response.text);
    const rawData = robustParseJson(phase2Response.text);
    
    const formatTime = (totalMinutes: number) => {
      const totalSeconds = Math.round(totalMinutes * 60);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const rawScenes = rawData.scenes || [];
    
    // Failsafe: If scenes are missing, try to treat the whole object as a list or find any array
    let finalRawScenes = rawScenes;
    if (!Array.isArray(finalRawScenes) || finalRawScenes.length === 0) {
      const arrayKey = Object.keys(rawData).find(key => Array.isArray(rawData[key]));
      if (arrayKey) {
        finalRawScenes = rawData[arrayKey];
      } else if (Array.isArray(rawData)) {
        finalRawScenes = rawData;
      }
    }

    const scenes = (finalRawScenes || []).map((s: any, index: number) => {
      let timeRange = "";
      const hookDurationMins = 15 / 60;

      if (index === 0) {
        timeRange = `0:00 - ${formatTime(hookDurationMins)} (Hook)`;
      } else {
        const remainingDurationMins = Math.max(0, durationMinutes - hookDurationMins);
        const remainingScenesCount = Math.max(1, (finalRawScenes.length || sceneCount) - 1);
        const durationPerRemainingScene = remainingDurationMins / remainingScenesCount;

        const startMin = hookDurationMins + ((index - 1) * durationPerRemainingScene);
        const endMin = hookDurationMins + (index * durationPerRemainingScene);

        timeRange = `${formatTime(startMin)} - ${formatTime(endMin)}`;
      }

      return {
        id: index,
        timeRange: timeRange,
        voiceoverScript: s.voiceover || "",
        overlays: [],
        visualPrompt: s.visual_description || s.description || "",
        animationStyles: [],
        isGeneratingImage: false,
        isGeneratingImageEnd: false,
        isGeneratingVideo: false,
        isGeneratingVideoPrompt: false,
        isGeneratingTTS: false,
        selectedTone: index === 0 ? TTSTone.Mysterious : TTSTone.Neutral,
        selectedVoice: defaultVoice,
        selectedMusicId: s.background_audio_id || 'music_mystical',
        selectedSfxId: s.sfx_audio_id || 'ambience_interior',
        videoOptions: {
          duration: 8 as 4 | 6 | 8,
          resolution: '1080p' as '720p' | '1080p',
          generateAudio: true,
          aspectRatio: '16:9' as '16:9' | '9:16', 
          numVideos: 1 as 1 | 2,
          placement: 'start' as 'start' | 'end'
        },
        hasShortVideo: true,
        videoPrompt: s.video_prompt || s.visual_description || "",
        imageOverlayText: s.image_overlay_text || "",
        isAnimated: true
      };
    });

    const characters = (extractedCharacters || []).map((c: any, i: number) => ({
      id: `char_${i}`,
      name: c.name || "Unnamed Actor",
      description: c.description || "General character description."
    }));

    console.info(`📜 [Script:Animated] Script generation complete. ${scenes.length} scenes, ${characters.length} characters.`);
    return { 
      scenes: scenes.length > 0 ? scenes : [], 
      storyContext: extractedContext || "A story derived from source material.", 
      characters 
    };
  } catch (error) {
    console.error(`❌ [Script:Animated] Script generation failed:`, error);
    throw error;
  } finally {
    console.timeEnd('📜 [Script:Animated] Generation Duration');
  }
};

