
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


// ⚽ AI Football Simulation Script Generator (Multi-stage Pipeline)
export const generateFootballScript = async (
  teamA: string,
  teamB: string,
  competition: string,
  extraContext: string,
  sceneCount: number,
  durationMinutes: number,
  useSearch: boolean,
  defaultVoice: VoiceOption,
  targetLanguage: Language
): Promise<{ scenes: Scene[], storyContext: string, characters: Character[] }> => {
  console.info(`⚽ [Script:Football] Generating "${teamA} vs ${teamB}". Scenes: ${sceneCount}`);
  console.time('⚽ [Script:Football] Generation Duration');

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Define JSON schema using SDK Type
    const teamSchema = {
      type: Type.OBJECT,
      properties: {
        team_name: { type: Type.STRING },
        head_coach: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            preferred_formation: { type: Type.STRING },
            play_style_summary: { type: Type.STRING }
          },
          required: ["name", "preferred_formation", "play_style_summary"]
        },
        key_players: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              position: { type: Type.STRING },
              market_value: { type: Type.STRING },
              performance_stats: { type: Type.STRING }
            },
            required: ["name", "position", "market_value", "performance_stats"]
          }
        },
        injuries_and_absences: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              player_name: { type: Type.STRING },
              absence_reason: { type: Type.STRING }
            },
            required: ["player_name", "absence_reason"]
          }
        }
      },
      required: ["team_name", "head_coach", "key_players", "injuries_and_absences"]
    };

    const getTeamSearchPrompt = (name: string): string => `
You are an expert football data researcher. Using the Google Search tool, you MUST perform three SEPARATE and distinct searches to gather verified information about the ${name} football team for the 2026 season. 

Execute the following searches step-by-step:

1. First Search Query: "${name} national team current squad transfermarkt 2026" or "${name} football club squad 2026"
   -> Task: Extract the top 3 most valuable and in-form players currently in the squad. Note their positions, market values, and a brief performance or form highlight.

2. Second Search Query: "${name} football team current injuries 2026"
   -> Task: Identify key players who are currently injured, suspended, or officially excluded from the squad. Note the reason for their absence.

3. Third Search Query: "${name} football team head coach tactics formation"
   -> Task: Determine the head coach's name, their preferred tactical formation (e.g., 4-3-3), and core playing style.

CRITICAL INSTRUCTION: You MUST synthesize your findings and output the final response STRICTLY as a valid JSON object matching the requested schema.
    `;

    // Fetch list of cached teams from server
    let cachedTeamsList: { filename: string; team_name: string }[] = [];
    try {
      const listRes = await fetch('http://localhost:3001/api/teams');
      if (listRes.ok) {
        cachedTeamsList = await listRes.json();
      }
    } catch (err) {
      console.warn('⚠️ [Script:Football] Failed to fetch cached teams list from server:', err);
    }

    const findCachedTeam = async (name: string): Promise<{ filename: string; team_name: string } | null> => {
      if (cachedTeamsList.length === 0) return null;

      // Ask Gemini to match the input name with any of the cached names semantically
      const cachedNames = cachedTeamsList.map(t => t.team_name);
      const prompt = `
        You are a football data assistant.
        A user is searching for information about the team: "${name}".
        We have a list of cached teams: ${JSON.stringify(cachedNames)}.
        
        Task: Determine if the team "${name}" is semantically the same as one of the cached teams (even if the names are slightly different, e.g. "Galatasaray SK" vs "Galatasaray", or "Real Madrid CF" vs "Real Madrid").
        
        Response format:
        Return ONLY a JSON object with:
        {
          "isMatched": true,
          "matchedTeamName": "The exact team name from the cached list"
        }
        or:
        {
          "isMatched": false,
          "matchedTeamName": null
        }
      `;

      try {
        const response = await ai.models.generateContent({
          model: MODELS.scriptGen,
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });
        const result = robustParseJson(response.text || "{}");
        if (result.isMatched && result.matchedTeamName) {
          const match = cachedTeamsList.find(t => t.team_name.toLowerCase() === result.matchedTeamName.toLowerCase());
          if (match) {
            console.info(`⚽ [Script:Football] Semantic match found: "${name}" maps to cached "${match.team_name}"`);
            return match;
          }
        }
      } catch (err) {
        console.error("❌ Error using Gemini to match cached team:", err);
      }

      // Fallback direct match (case-insensitive)
      const directMatch = cachedTeamsList.find(t => t.team_name.toLowerCase() === name.toLowerCase());
      if (directMatch) {
        console.info(`⚽ [Script:Football] Direct string match found: "${name}" maps to cached "${directMatch.team_name}"`);
      }
      return directMatch || null;
    };

    const getTeamProfile = async (name: string): Promise<any> => {
      // 1. Semantic cache check
      const cachedTeam = await findCachedTeam(name);
      if (cachedTeam) {
        try {
          const res = await fetch(`http://localhost:3001/api/teams/${encodeURIComponent(cachedTeam.team_name)}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.team_name) {
              console.info(`⚽ [Script:Football] Using cached profile for: ${cachedTeam.team_name}`);
              return data;
            }
          }
        } catch (err) {
          console.warn(`⚠️ [Script:Football] Failed to load cached file for ${cachedTeam.team_name}:`, err);
        }
      }

      // 2. Not found: fetch using Gemini + Google Search (default tools on)
      console.info(`⚽ [Script:Football] Cache miss for "${name}". Running Google Search to gather profile...`);
      const searchPrompt = getTeamSearchPrompt(name);
      const searchTools = [{ googleSearch: {} }];

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: searchPrompt,
        config: {
          tools: searchTools,
          responseMimeType: 'application/json',
          responseSchema: teamSchema,
          thinkingConfig: { thinkingBudget: 2048 }
        }
      });

      const parsedData = robustParseJson(response.text || "{}");

      // 3. Save to server cache
      if (parsedData && parsedData.team_name) {
        try {
          await fetch(`http://localhost:3001/api/teams/${encodeURIComponent(parsedData.team_name)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsedData)
          });
          console.info(`⚽ [Script:Football] Successfully cached profile for team: ${parsedData.team_name}`);
        } catch (err) {
          console.warn(`⚠️ [Script:Football] Failed to save team cache for ${parsedData.team_name}:`, err);
        }
      }

      return parsedData;
    };

    // ── STEP 1: PARALLEL TEAM DATA COLLECTION ──
    console.info(`⚽ [Script:Football] Step 1: Gathering team profiles...`);
    const [teamAData, teamBData] = await Promise.all([
      getTeamProfile(teamA),
      getTeamProfile(teamB)
    ]);

    // ── STEP 2: CONTEXT INJECTION & CHARACTER AUTO-EXTRACTION ──
    console.info(`⚽ [Script:Football] Step 2: Injecting context and building character registry...`);
    const teamAJsonString = JSON.stringify(teamAData, null, 2);
    const teamBJsonString = JSON.stringify(teamBData, null, 2);

    const characters: Character[] = [];
    const addTeamCharacters = (data: any, teamLabel: string) => {
      if (data.head_coach && data.head_coach.name) {
        characters.push({
          id: `char_coach_${teamLabel.replace(/\s+/g, '_')}`,
          name: data.head_coach.name,
          description: `${data.head_coach.name}, Head Coach of ${teamLabel}. Preferred formation: ${data.head_coach.preferred_formation || 'Unknown'}. Play style: ${data.head_coach.play_style_summary || 'Unknown'}`
        });
      }
      if (Array.isArray(data.key_players)) {
        data.key_players.forEach((p: any, idx: number) => {
          if (p.name) {
            characters.push({
              id: `char_player_${teamLabel.replace(/\s+/g, '_')}_${idx}`,
              name: p.name,
              description: `${p.name}, key player for ${teamLabel}. Position: ${p.position || 'Unknown'}. Market value: ${p.market_value || 'Unknown'}. Form/Stats: ${p.performance_stats || 'Unknown'}`
            });
          }
        });
      }
    };

    addTeamCharacters(teamAData, teamA);
    addTeamCharacters(teamBData, teamB);

    // ── STEP 2.5: DECIDE MATCH SCORE & TIMELINE (gemini-3.1-flash-lite-preview, High Thinking) ──
    console.info(`⚽ [Script:Football] Step 2.5: Determining match simulation score and timeline...`);
    const simulationSchema = {
      type: Type.OBJECT,
      properties: {
        winner: { type: Type.STRING },
        finalScore: { type: Type.STRING },
        halfTimeScore: { type: Type.STRING },
        matchTimeline: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              minute: { type: Type.INTEGER },
              team: { type: Type.STRING },
              event: { type: Type.STRING },
              detail: { type: Type.STRING }
            },
            required: ["minute", "team", "event", "detail"]
          }
        },
        tacticalSummary: { type: Type.STRING }
      },
      required: ["winner", "finalScore", "halfTimeScore", "matchTimeline", "tacticalSummary"]
    };

    const simulationPrompt = `
You are an advanced football simulation data engine.
Using the team squad, tactical, and injury profiles provided below in JSON format, run a simulated match reasoning process.
We want to simulate the fixture between ${teamA} and ${teamB} ${competition ? `in ${competition}` : ''} extremely realistically, taking into account tactical styles, coaching, key players' forms, and missing players due to injuries.

--- TEAM DATA INPUTS ---
TEAM A (${teamA}):
${teamAJsonString}

TEAM B (${teamB}):
${teamBJsonString}

ADDITIONAL CONTEXT:
${extraContext || "None"}
-------------------------

Task:
1. Reason about the matchup: how do the formations, playstyles, and squads clash?
2. Run a detailed match simulation to decide:
   - The winner ("${teamA}", "${teamB}", or "Draw").
   - The final score (formatted as "Team A Score - Team B Score", e.g. "2-1").
   - The halftime score (formatted similarly, e.g. "1-0").
   - A realistic timeline of events (e.g., goals, red cards, key substitutions/injuries during the match) with exact minutes. Ensure it is chronologically ordered and matches the final score exactly.
   - A brief tactical summary explaining how the goals were scored or why the match ended this way based on the squads.

Return the result strictly as a valid JSON matching the requested schema. Do not include any formatting other than the JSON itself.
    `;

    const simulationResponse = await ai.models.generateContent({
      model: MODELS.scriptGen,
      contents: simulationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: simulationSchema,
        thinkingConfig: { thinkingBudget: 8192 } // High thinking enabled for high-quality simulation
      }
    });

    const scoreDecision = robustParseJson(simulationResponse.text || "{}");
    console.info(`⚽ [Script:Football] Simulation result decided: ${scoreDecision.finalScore} (HT: ${scoreDecision.halfTimeScore})`);

    // ── STEP 3: SCRIPT GENERATION (Google Search OFF, gemini-3.1-flash-lite, High Thinking) ──
    console.info(`⚽ [Script:Football] Step 3: Generating commentary script...`);

    const totalDurationSeconds = durationMinutes * 60;
    const durationPerSceneSeconds = totalDurationSeconds / sceneCount;
    const targetWordCount = Math.floor((durationPerSceneSeconds / 60) * 135); // 135 WPM speaking rate

    const formatTime = (totalMinutes: number) => {
      const totalSeconds = Math.round(totalMinutes * 60);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const musicList = AUDIO_LIBRARY.filter(a => a.category === 'music').map(a => `- ID: "${a.id}" (${a.label})`).join('\n');
    const sfxList = AUDIO_LIBRARY.filter(a => a.category !== 'music').map(a => `- ID: "${a.id}" (${a.label})`).join('\n');

    const finalPrompt = `
You are an expert football tactical analyst and a highly passionate match commentator for a popular YouTube football simulation channel (think Gary Neville meets ESPN FC). 

Your task is to simulate a match between ${teamA} and ${teamB} ${competition ? `in ${competition}` : ''} and write a highly engaging, play-by-play commentary script. You MUST base your entire simulation STRICTLY on the real-world data and pre-decided score timeline provided below.

--- MATCH DATA INPUTS ---
TEAM A (${teamA}) DATA:
${teamAJsonString}

TEAM B (${teamB}) DATA:
${teamBJsonString}
-------------------------

--- PRE-DECIDED MATCH SIMULATION RESULTS (MUST FOLLOW STRICTLY) ---
FINAL SCORE: ${scoreDecision.finalScore}
HALFTIME SCORE: ${scoreDecision.halfTimeScore}
MATCH EVENTS TIMELINE:
${JSON.stringify(scoreDecision.matchTimeline, null, 2)}
TACTICAL PLAYOUT SUMMARY:
${scoreDecision.tacticalSummary}
-------------------------------------------------------------------

ADDITIONAL USER CONTEXT:
${extraContext || "None"}

Using the provided data, execute the following instructions:
1. Mention about 10,000 times played simulation results to establish analysis credibility.
2. Pre-Match Analysis: Briefly analyze the tactical matchup based on the head coaches' preferred formations. Highlight how the identified key players and specific injuries/absences will impact the game's dynamic.
3. Match Flow & Simulation: Construct a logical and realistic narrative for the match. If a team is missing a star player due to injury, reflect that struggle in the narrative. Allow the key players mentioned in the data to shine or influence the game.
4. Final Score & Event Timeline Constraints: You MUST strictly conform the commentary story to the pre-decided final score (${scoreDecision.finalScore}), halftime score (${scoreDecision.halfTimeScore}), and the events timeline. All goals, cards, and milestones in the commentary scenes MUST match the timeline exactly. Under no circumstances should any other goals be scored or the score be different in any scene. The last scene (outro) MUST explicitly state/show the final score of ${scoreDecision.finalScore}.
5. Commentary Script: Write a thrilling, dynamic play-by-play commentary script designed to be narrated for the video.
   - Include an exciting Intro welcoming the viewers to the simulation.
   - Cover the first half, second half, and key dramatic moments (goals, near misses, tactical shifts).
   - Ensure the tone is energetic, professional, and uses authentic football terminology.
   - Conclude with an Outro summarizing the match, the final score, and asking viewers to subscribe (using standard outro phrases like "subscribe", "thanks for joining", "watching", etc.).
     - CRITICAL RULES FOR THE LAST SCENE (OUTRO):
       1. The voiceover script MUST be normal and warm, without any excited or dramatic extreme emotions. DO NOT use any voice bracket inflections (like [excitedly], [dramatically], [sighs], [gasps], etc.) in the last scene.
       2. The visual_description (image prompt) MUST depict a big scoreboard design displaying the final simulated score of the match.
       3. The visual_description (image prompt) for the last scene MUST NOT depict, describe, or include any logo, text overlay (except the scoreboard numbers/names itself), or commentator/spiker/host/narrator characters.

── VOICE INFLECTION GUIDE (CRITICAL — use bracket notation IN the voiceover text) ──
Use these throughout every scene except the last scene for a human, pundit-like feel:
[excitedly] — exciting revelations, big stats
[sarcastically] — ironic takes, overconfident claims
[sighs] — disappointment, hard truths
[laughs] — light moments, surprising facts
[dramatically] — big predictions, pivotal moments
[coughs] — awkward truths, reality checks
[gasps] — shocking stats, surprise factors

EXAMPLE STYLE:
"[excitedly] This is the clash football fans have been dreaming about!
But here's what nobody is talking about...
[sighs] The xG numbers tell a brutal story.
[dramatically] And Gemini's prediction? [gasps] You are NOT ready for this."

── NARRATIVE STRUCTURE (distribute evenly across ${sceneCount} scenes) ──
Cover ALL of the following beats, merging or expanding based on scene count:
1. PRE-MATCH SETUP — Why is ${teamA} the favorite or how do they stack up? Recent form, squad stats.
2. SECRET WEAPON — Tactical surprises or underrated players from either team.
3. PLAYER DUEL — Head-to-head comparison of key players from both teams.
4. COACH BATTLE — Tactics: formations, pressing intensity, set-piece threats, mind games.
5. WEAKNESSES EXPOSED — Both teams' vulnerabilities, missing players, fatigue, defensive frailty.
6. CONDITIONS & REFEREE — Stadium atmosphere, referee factor or external conditions if relevant.
7. 🤖 SIMULATION PREDICTION — Final score prediction based on 10,000 simulations, key turning point, MVP pick, upset probability %.

── LANGUAGE RULES ──
- 'voiceover' → in ${targetLanguage} (with bracket inflections for non-outro scenes)
- 'visual_description' → in ENGLISH (for image generation)
- 'overlays' → array of exactly 3 text overlays in ${targetLanguage}. Format MUST be context/informational, not dialogue.

── AUDIO SELECTION ──
[BACKGROUND MUSIC] - Select one per scene based on emotion:
${musicList}

[SFX / AMBIENCE] - Select one per scene based on setting:
${sfxList}

Prefer 'music_thrilling' or 'music_tension' for most scenes. Use 'ambience_crowd' or 'sfx_battle_cry' for intense moments. Vary across scenes.

── OUTPUT FORMAT ──
Each scene voiceover MUST be exactly ${targetWordCount} words.
Output JSON:
{
  "scenes": [
    {
      "narrative_beat": "e.g. Pre-Match Setup",
      "voiceover": "The spoken narration in ${targetLanguage} with [bracket inflections] mixed in naturally...",
      "overlays": [
        { "text": "Context Info 1", "startSecond": 1.5, "duration": 5.0 },
        { "text": "Context Info 2", "startSecond": 6.0, "duration": 5.0 },
        { "text": "Context Info 3", "startSecond": 10.0, "duration": 5.0 }
      ],
      "visual_description": "A detailed image generation prompt in ENGLISH. Include team colors, stadium, players by name, scoreboard, tactical diagrams, or split comparison visuals. Be specific.",
      "background_audio_id": "music_thrilling",
      "sfx_audio_id": "ambience_crowd"
    }
  ]
}

CRITICAL RULE: Do not hallucinate player names, statistics, or injuries that are not present in the provided JSON data. Make the commentary feel alive, as if the match is unfolding in real-time.
    `;

    const finalResponse = await ai.models.generateContent({
      model: MODELS.scriptGen, // mapped to 'gemini-3.1-flash-lite-preview'
      contents: finalPrompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 24576 } // High thinking enabled for high-quality writing
      }
    });

    console.debug('🔬 [Script:Football] Final Script Raw:', finalResponse.text);
    const rawData = robustParseJson(finalResponse.text || "{}");
    const rawScenes = Array.isArray(rawData.scenes) ? rawData.scenes : [];

    const movementAnimations = [
      'animate-kb-zoom-in', 'animate-kb-zoom-out',
      'animate-kb-pan-right', 'animate-kb-pan-left',
      'animate-kb-diag-right-up', 'animate-kb-zoom-pan-right'
    ];

    const scenes: Scene[] = rawScenes.map((s: any, index: number) => {
      const startMin = (index * durationPerSceneSeconds) / 60;
      const endMin = ((index + 1) * durationPerSceneSeconds) / 60;
      const timeRange = `${formatTime(startMin)} - ${formatTime(endMin)}`;

      const overlays: Overlay[] = (s.overlays || []).slice(0, 3).map((o: any) => ({
        text: o.text || '',
        style: 'comic-box',
        startSecond: typeof o.startSecond === 'number' ? o.startSecond : 0,
        duration: typeof o.duration === 'number' ? o.duration : 5
      }));
      while(overlays.length < 3) {
        overlays.push({ text: '', style: 'comic-box', startSecond: 0, duration: 5 });
      }

      return {
        id: index,
        timeRange,
        voiceoverScript: s.voiceover || '',
        overlays,
        visualPrompt: s.visual_description || '',
        visualPromptEnd: undefined,
        animationStyles: [movementAnimations[index % movementAnimations.length]],
        isGeneratingImage: false,
        isGeneratingImageEnd: false,
        isGeneratingVideo: false,
        isGeneratingVideoPrompt: false,
        isGeneratingTTS: false,
        selectedTone: index === sceneCount - 1 ? TTSTone.Warm : TTSTone.Enthusiastic,
        selectedVoice: defaultVoice,
        selectedMusicId: s.background_audio_id || 'music_thrilling',
        selectedSfxId: s.sfx_audio_id || 'ambience_crowd',
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

    console.info(`⚽ [Script:Football] Complete. ${scenes.length} scenes, ${characters.length} characters.`);
    return {
      scenes: scenes.length > 0 ? scenes : [],
      storyContext: `Tactical simulation analysis of ${teamA} vs ${teamB} in ${competition || 'friendly'}.`,
      characters
    };
  } catch (error) {
    console.error(`❌ [Script:Football] Generation failed:`, error);
    throw error;
  } finally {
    console.timeEnd('⚽ [Script:Football] Generation Duration');
  }
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

  // Clean [whisper] or [whispers] out of the voiceover prompt to prevent it from being spoken/generating issues
  const sanitizedText = text.replace(/\[whispers?\]/gi, '');
  const textWithTone = `(Spoken in a ${tone} tone) ${sanitizedText}`;

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

// 3a. Generate YouTube Thumbnail (High-CTR, template-based with custom context injection)
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

  // Segment characters to focus on players as the primary focal point, coaches/referees in the background
  let characterFocusPrompt = "";
  if (characters.length > 0) {
    const players = characters.filter(c => 
      c.description.toLowerCase().includes("player") || 
      c.description.toLowerCase().includes("striker") || 
      c.description.toLowerCase().includes("goalkeeper") || 
      c.description.toLowerCase().includes("midfielder") || 
      c.description.toLowerCase().includes("defender") || 
      c.description.toLowerCase().includes("captain")
    );
    const secondary = characters.filter(c => !players.includes(c));

    const mainFocusChar = players.length > 0 ? players[0] : characters[0];
    const otherFocusChars = players.slice(1, 3);
    const backgroundChars = secondary.length > 0 ? secondary : characters.slice(3);

    characterFocusPrompt = `
      CHARACTER COMPOSITION & STORY ROLES:
      - PRIMARY FOCAL CHARACTER: ${mainFocusChar.name}. Place them in sharp, hyper-detailed focus in the foreground with an intense, raw emotional reaction (screaming in passion, wide-eyed in celebration, or shock).
    `;
    if (otherFocusChars.length > 0) {
      characterFocusPrompt += `- SUPPORTING CHARACTER(S): ${otherFocusChars.map(c => c.name).join(", ")}. Positioned near the center-ground, sharing dynamic spotlight. \n`;
    }
    if (backgroundChars.length > 0) {
      characterFocusPrompt += `- BACKGROUND CHARACTERS: ${backgroundChars.map(c => c.name).join(", ")} (e.g. head coaches, referees). Place them in the secondary background looking stressed, angry, or pointing, slightly out of focus to create deep dynamic field separation. \n`;
    }
  }

  const premiumTemplate = `
      ROLE: Master YouTube CTR Thumbnail Artist.
      TASK: Create a professional, high-impact YouTube Thumbnail in 16:9 widescreen format designed for maximum CTR.

      ART STYLE RULE:
      ${style}. Widescreen cinematic CGI render, octane render, rich textures, deep shadows, dramatic highlights, volumetric light shafts.

      VISUAL STAGE DIRECTIVE (Variable Context Injected):
      ${customVisualPrompt || storyContext}

      ${characterFocusPrompt}

      ${charInstructions}

      HIGH-CTR COMPOSITION & LIGHTING PROTOCOLS:
      1. RULE OF THIRDS: The primary face and character must be positioned off-center (left or right third) with clear sightlines.
      2. DRAMATIC split-screen or color contrast dividing the background with saturated glowing colors (e.g., neon team-colored energy clashing).
      3. CINEMATIC DEPTH: Moody stadium atmosphere at night, volumetric fog/dust particles catching the bright spotlights, shallow depth of field.
      4. TEXT LAYOUT SPACE: Keep the middle-left area clean and high-contrast to allow bold text overlays without obscuring important character faces.
      
      REQUIREMENTS:
      - 16:9 widescreen ratio.
      - Vibrant colors, ultra-high contrast, hyper-realistic skin textures, sweat and emotion.
      - NO spelling text or graphics generated directly on the image. Make it a clean, professional, text-free visual cover.
  `;

  contentParts.push({ text: premiumTemplate });

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

export const generateFootballThumbnailSuggestions = async (
  teamA: string,
  teamB: string,
  competition: string,
  extraContext: string,
  characters: Character[],
  targetLanguage: Language
): Promise<{ titleText: string; subtitleText: string; topRightText: string; customVisualPrompt: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const charListStr = characters.map(c => `- ${c.name}: ${c.description}`).join('\n');

  const parsedComp = competition.trim() || 'FIFA-2026 World Cup, Group-A';

  const prompt = `
    You are an expert YouTube Thumbnail Designer and Growth Analyst specialized in high-CTR football content.
    Given this football match context, generate a high-impact click-worthy YouTube Thumbnail Design.

    MATCH DETAILS:
    - Team A: ${teamA}
    - Team B: ${teamB}
    - Competition: ${parsedComp}
    - Extra Context: ${extraContext}

    EXTRACTED CHARACTERS (PLAYERS & COACHES & STAFF):
    ${charListStr}

    CTR STRATEGY RULES:
    1. Focus on the best and most powerful players (superstars, playmakers, top scorers) as the primary focal point of the thumbnail with intense emotional facial expressions (screaming, celebration, shock).
    2. Place secondary prominent characters (coaches, referees, or supporting players) in the secondary background looking tense or frustrated.
    3. Generate a highly clickable, dramatic Title Text in the target language: ${targetLanguage}. The Title Text MUST follow the format "Team A vs Team B" (translated/localized for the target language if necessary, e.g. "TEAM A vs TEAM B", "TEAM A contra TEAM B", "TEAM A vs. TEAM B" etc.). Do NOT add any extra slogan, suffix, or descriptive text (such as ": World Cup Clash" or similar). Maintain case sensitivity.
    4. Generate a Subtitle Text in the target language: ${targetLanguage}. Default to translating/localizing the template "${parsedComp}". Maintain case sensitivity.
    5. Generate a Top-Right badge text in the target language: ${targetLanguage}. Default to translating/localizing the template "10K Times Simulated with AI". Maintain case sensitivity.
    6. Generate a highly detailed, professional visual prompt in ENGLISH for an image generator (like Imagen 3) describing the visual composition perfectly.
    
    VISUAL PROMPT TEMPLATE to follow:
    "An epic, high-contrast YouTube Thumbnail for the ${parsedComp} match between ${teamA} and ${teamB}. Split-screen or diagonal dynamic split composition.
    [Vivid description of the main star player from Team A or B in sharp focus, screaming in triumph/emotion, hyper-detailed face, wearing their team kit].
    In the background/secondary field, [vivid description of secondary characters like head coaches or referees with shocked/frustrated facial expressions].
    Background: A massive, packed football stadium at night under bright stadium floodlights with dramatic volumetric fog, neon stadium lights representing [Team A color] and [Team B color] clashing.
    Cinematic lighting, dynamic low-angle wide shot, rule of thirds, highly detailed, Unreal Engine 5 style."

    Return a JSON response exactly in this format:
    {
      "titleText": "Strictly format as '${teamA} vs ${teamB}' localized in ${targetLanguage}",
      "subtitleText": "High-CTR subtitle in ${targetLanguage} (default/translating '${parsedComp}')",
      "topRightText": "High-CTR top-right badge text in ${targetLanguage} (default/translating '10K Times Simulated with AI')",
      "customVisualPrompt": "A highly detailed, context-aware prompt in ENGLISH strictly following the template above."
    }
  `;

  const response = await ai.models.generateContent({
    model: MODELS.scriptGen,
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  const parsed = robustParseJson(response.text || "{}");
  return {
    titleText: parsed.titleText || `${teamA} vs ${teamB}`,
    subtitleText: parsed.subtitleText || parsedComp,
    topRightText: parsed.topRightText || `10K Times Simulated with AI`,
    customVisualPrompt: parsed.customVisualPrompt || `A cinematic YouTube thumbnail for ${teamA} vs ${teamB} in ${parsedComp}.`
  };
};

// 3c. Localize YouTube thumbnail metadata text for other language tabs
export const localizeThumbnailMetadata = async (
  titleText: string,
  subtitleText: string,
  topRightText: string,
  targetLanguage: Language
): Promise<{ titleText: string; subtitleText: string; topRightText: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const targetLangStr = targetLanguage === Language.Portuguese ? "Portuguese (specifically Brazilian Portuguese, Português Brasileiro)" : targetLanguage;
  const prompt = `
    You are a professional localizer and growth hacker.
    Translate and adapt these three YouTube thumbnail texts to ${targetLangStr}.
    Maintain the same high emotional energy and click-worthiness. 
    Keep them concise but fully translated, preserving the meaning and case structure of the original texts.

    CRITICAL RULE FOR TITLE: The titleText MUST follow the format "Team A vs Team B" (where 'vs' is translated/adapted to target language if necessary, e.g. 'vs', 'vs.', 'contra', 'karşı karşıya'). Do NOT add any extra slogan, suffix, or descriptive text (such as ": World Cup Clash" or similar).

    Original Title: "${titleText}"
    Original Subtitle: "${subtitleText}"
    Original Top-Right Badge: "${topRightText}"

    Output JSON format:
    {
      "titleText": "Translated title in the strict format 'Team A vs Team B'",
      "subtitleText": "Translated subtitle",
      "topRightText": "Translated top-right badge"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODELS.scriptGen,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = robustParseJson(response.text || "{}");
    let finalTopRight = parsed.topRightText || topRightText;
    if (targetLanguage === Language.Turkish && (!parsed.topRightText || parsed.topRightText.includes("10K") || parsed.topRightText.includes("Simulated") || parsed.topRightText.includes("10 Kez") || parsed.topRightText.includes("10 bin") || parsed.topRightText.includes("10Bin"))) {
      finalTopRight = "10B Kez AI ile Simüle Edildi";
    }
    return {
      titleText: parsed.titleText || titleText,
      subtitleText: parsed.subtitleText || subtitleText,
      topRightText: finalTopRight
    };
  } catch (err) {
    console.error("Failed to localize thumbnail:", err);
    let fallbackTopRight = topRightText;
    if (targetLanguage === Language.Turkish && (topRightText.includes("10K") || topRightText.includes("Simulated"))) {
      fallbackTopRight = "10B Kez AI ile Simüle Edildi";
    }
    return { titleText, subtitleText, topRightText: fallbackTopRight };
  }
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

// 5. Localize Script
export const localizeScript = async (
  scenes: Scene[],
  targetLanguage: Language
): Promise<Record<number, any>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const sceneData = scenes.map(s => ({
    id: s.id,
    voiceover: s.voiceoverScript,
    overlays: s.overlays.map(o => o.text),
    imageOverlayText: s.imageOverlayText
  }));

  const targetLangStr = targetLanguage === Language.Portuguese ? "Portuguese (specifically Brazilian Portuguese, Português Brasileiro)" : targetLanguage;
  const prompt = `
    You are an expert translator and localizer for YouTube videos.
    Translate and localize the following scene voiceovers and overlays from English to ${targetLangStr}.
    
    Strict Translation Rules:
    1. Localize the script for the target language to make it sound as natural, native, and local as possible. Do not perform a literal word-for-word translation. Use native idioms, conversational vocabulary, and a style suitable for an engaging video voiceover.
    2. The voiceover contains emotional/tone expressions enclosed in brackets (such as "[excitedly]", "[whispering]", "[sighs]", etc.). You MUST preserve these emotion and tone definers EXACTLY as they are in English inside the translated script.
    3. Do NOT translate or modify any text inside the square brackets. Keep them in the correct semantic/syntactic position of the sentence where they belong in the target language.
    4. Keep the pacing and length as close to the original as possible.
    
    Scenes Data:
    ${JSON.stringify(sceneData, null, 2)}
    
    Output JSON format:
    {
      "localizations": [
        {
          "id": 0,
          "voiceover": "Translated voiceover preserving English brackets exactly...",
          "overlays": ["Translated overlay 1", "Translated overlay 2"],
          "imageOverlayText": "Translated image overlay text"
        }
      ]
    }
  `;

  const response = await ai.models.generateContent({
    model: MODELS.scriptGen,
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  const rawData = robustParseJson(response.text || "{}");
  
  const results: Record<number, any> = {};
  
  if (rawData.localizations && Array.isArray(rawData.localizations)) {
    rawData.localizations.forEach((loc: any) => {
      const originalScene = scenes.find(s => s.id === loc.id);
      if (!originalScene) return;
      
      const newOverlays = originalScene.overlays.map((o, idx) => ({
        ...o,
        text: loc.overlays?.[idx] || o.text
      }));
      
      results[loc.id] = {
        voiceoverScript: loc.voiceover || originalScene.voiceoverScript,
        overlays: newOverlays,
        imageOverlayText: loc.imageOverlayText || originalScene.imageOverlayText,
        ttsAudioUrl: undefined,
        isGeneratingTTS: false
      };
    });
  }
  
  return results;
};

// 6. Localize YouTube Metadata (Title, Description, Tags)
export const localizeMetadata = async (
  metadata: { title: string; description: string; tags: string },
  targetLanguage: string
): Promise<{ title: string; description: string; tags: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const targetLangStr = targetLanguage === 'Portuguese' || targetLanguage === Language.Portuguese ? "Portuguese (specifically Brazilian Portuguese, Português Brasileiro)" : targetLanguage;
  const prompt = `
    You are an expert localizer for YouTube video metadata.
    Translate and localize the following YouTube video metadata (Title, Description, Tags) into the target language: ${targetLangStr}.
    
    Guidelines:
    1. Make the translation sound natural, professional, and highly engaging/click-worthy to football fans in ${targetLanguage}. Use proper localized football/soccer terms (e.g. use "fútbol" for Spanish, "futbol" for Turkish, "futebol" for Portuguese).
    2. Do NOT translate brand/product names like "AI Creator Studio", "Football Simulator", "Gemini", or "FIFA-2026". Keep them exactly as they are.
    3. Ensure tags are localized into search-friendly tags/keywords in the target language.
    4. CRITICAL: Keep the exact line-by-line structure, paragraph spacing, casing, and format of the description. Preserve the emoji 🎬 at the beginning of the description. Do NOT remove or modify any non-text structural lines.
    5. The translated title MUST be under 100 characters in length.

    Metadata to localize:
    {
      "title": "${metadata.title.replace(/"/g, '\\"')}",
      "description": "${metadata.description.replace(/\n/g, '\\n').replace(/"/g, '\\"')}",
      "tags": "${metadata.tags.replace(/"/g, '\\"')}"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODELS.scriptGen,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = robustParseJson(response.text || "{}");
    return {
      title: parsed.title || metadata.title,
      description: parsed.description || metadata.description,
      tags: parsed.tags || metadata.tags
    };
  } catch (err) {
    console.error("Failed to localize metadata:", err);
    return metadata;
  }
};

