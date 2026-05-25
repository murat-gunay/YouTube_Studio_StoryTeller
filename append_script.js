const fs = require('fs');

const codeToAppend = `
export const generateAnimatedStoryScript = async (
  transcription: string,
  title: string,
  instructions: string,
  sceneCount: number,
  durationMinutes: number,
  useSearch: boolean,
  defaultVoice: VoiceOption,
  targetLanguage: Language
): Promise<{ scenes: Scene[], storyContext: string, characters: Character[] }> => {
  console.info(\`📜 [Script:Animated] Generating animated story script for "\${title}". Scenes: \${sceneCount}\`);
  console.time('📜 [Script:Animated] Generation Duration');
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const durationPerScene = durationMinutes / sceneCount;

  const musicList = AUDIO_LIBRARY.filter(a => a.category === 'music').map(a => \`- ID: "\${a.id}" (Description: \${a.label})\`).join('\\n');
  const sfxList = AUDIO_LIBRARY.filter(a => a.category !== 'music').map(a => \`- ID: "\${a.id}" (Description: \${a.label})\`).join('\\n');

  const prompt = \`
    You are a professional video content creator.
    Project Title: \${title}
    Context/Instructions: \${instructions}
    Source Material (Transcript in English): \${transcription}
    
    **LANGUAGE PROTOCOLS (CRITICAL - FOLLOW STRICTLY)**:
    1. **PRODUCTION METADATA (Backend)**: The 'visual_description' (for image gen), 'video_prompt', 'story_context' (Story Bible), and 'characters.description' MUST be written in **ENGLISH**.
    2. **VIDEO CONTENT (User Facing)**: The 'voiceover', 'caption_context', and 'caption_dialogue' MUST be written in **\${targetLanguage}**.

    Target Specifications:
    - Total Scenes: \${sceneCount}
    - You must define EXACTLY ONE MAIN CHARACTER for the entire video. The character should have a simple drawing style.

    **AVAILABLE AUDIO ASSETS (Strictly select from this list. Use none_music or none_sfx if no audio is needed)**:
    [BACKGROUND MUSIC]
    \${musicList}

    [SFX / AMBIENCE]
    \${sfxList}

    **CRITICAL STRUCTURE INSTRUCTIONS**:
    1. **SCENE 1 (THE HOOK)**: 
       - Must instantly grab attention visually.
    2. **ALL SCENES**:
       - **Voiceover**: Write a voiceover script for each scene in \${targetLanguage}.
       - **Visual Description**: Must feature the ONE MAIN CHARACTER visually acting out the scene. Absolutely NO speech bubbles or text inside the image.
       - **Video Prompt**: A 1-2 sentence description for Veo 3.1 describing a *simple animation* of the character.

    Task: 
    1. **Character Extraction**: Define the SINGLE main character with a simple drawing style description.
    2. **Story Bible**: Describe setting and mood in **ENGLISH**.
    3. **Script**: Create scenes.
    4. **Visual Descriptions**: For EACH scene, write a PURELY content-based visual description in **ENGLISH**.
    5. **Video Prompts**: For EACH scene, write a seamless loop animation prompt for Veo in **ENGLISH**.
    
    Output JSON format:
    {
      "story_context": "General setting and mood in ENGLISH...",
      "characters": [
         { "name": "Main Character", "description": "Simple 2D line art style, detailed visual description..." }
      ],
      "scenes": [
        {
          "voiceover": "The spoken text in \${targetLanguage}...",
          "caption_context": "Short narrative text in \${targetLanguage}...",
          "caption_dialogue": "Short dialogue or sound effect in \${targetLanguage}...",
          "visual_description": "A detailed reference image generation prompt in ENGLISH...",
          "video_prompt": "seamless loop animation prompt for Veo in ENGLISH...",
          "background_audio_id": "music_mystical",
          "sfx_audio_id": "ambience_rain"
        }
      ]
    }
  \`;

  const tools = useSearch ? [{ googleSearch: {} }] : [];

  const response = await ai.models.generateContent({
    model: MODELS.scriptGen,
    contents: prompt,
    config: {
      tools: tools,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          story_context: { type: Type.STRING },
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["name", "description"]
            }
          },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                voiceover: { type: Type.STRING },
                caption_context: { type: Type.STRING },
                caption_dialogue: { type: Type.STRING },
                visual_description: { type: Type.STRING },
                video_prompt: { type: Type.STRING },
                background_audio_id: { type: Type.STRING },
                sfx_audio_id: { type: Type.STRING }
              },
              required: ["voiceover", "caption_context", "caption_dialogue", "visual_description", "video_prompt", "background_audio_id", "sfx_audio_id"]
            }
          }
        },
        required: ["story_context", "scenes", "characters"]
      }
    }
  });

  const rawData: any = JSON.parse(response.text || "{}");

  const formatTime = (totalMinutes: number) => {
    const totalSeconds = Math.round(totalMinutes * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;
  };

  const scenes = (rawData.scenes || []).map((s: any, index: number) => {
    const overlays: Overlay[] = [
      { text: s.caption_context || "", style: 'comic-box' },
      { text: s.caption_dialogue || "", style: 'speech-bubble' }
    ];

    const startMin = index * durationPerScene;
    const endMin = (index + 1) * durationPerScene;
    const timeRange = \`\${formatTime(startMin)} - \${formatTime(endMin)}\`;

    return {
      id: index,
      timeRange: timeRange,
      voiceoverScript: s.voiceover || "",
      overlays: overlays,
      visualPrompt: s.visual_description,
      animationStyles: [],
      isGeneratingImage: false,
      isGeneratingImageEnd: false,
      isGeneratingVideo: false,
      isGeneratingVideoPrompt: false,
      isGeneratingTTS: false,
      selectedTone: TTSTone.Neutral,
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
      videoPrompt: s.video_prompt,
      isAnimated: true
    };
  });

  const characters = (rawData.characters || []).map((c: any, i: number) => ({
    id: \`char_\${i}\`,
    name: c.name,
    description: c.description
  }));

  console.info(\`📜 [Script:Animated] Script generation complete. Extracted \${characters.length} characters.\`);
  return { scenes, storyContext: rawData.story_context || "", characters };
  } catch (error) {
    console.error(\`❌ [Script:Animated] Script generation failed:\`, error);
    throw error;
  } finally {
    console.timeEnd('📜 [Script:Animated] Generation Duration');
  }
};
`;

let content = fs.readFileSync('services/geminiService.ts', 'utf-8');
content += '\n' + codeToAppend;

// Also apply the fix for generateVideo (loop support)
content = content.replace(
  /const startBase64 = await urlToBase64\(imageSrc\);\s*const videoConfig: any = {/,
  `const startBase64 = await urlToBase64(imageSrc);
    // Use endImageSrc if provided, otherwise default back to startBase64 for a perfect seamless loop
    const endBase64 = endImageSrc ? await urlToBase64(endImageSrc) : startBase64;

    // Safety rule: Veo 3.1 only supports 1080p resolution for 8 second videos
    let safeResolution = options?.resolution || '720p';
    const videoDuration = options?.duration || 6;
    if (safeResolution === '1080p' && videoDuration !== 8) {
      console.warn(\`🎬 [Video] Veo 3.1 limits 1080p to 8s videos. Falling back to 720p for \${videoDuration}s.\`);
      safeResolution = '720p';
    }

    const videoConfig: any = {`
);

content = content.replace(
  /resolution: options\?.resolution \|\| '720p',\s*includeAudio: options\?.generateAudio \?\? true,\s*include_audio: options\?.generateAudio \?\? true, \s*videoDurationSeconds: options\?.duration \|\| 6/,
  `resolution: safeResolution,
      includeAudio: options?.generateAudio ?? true,
      include_audio: options?.generateAudio ?? true, 
      videoDurationSeconds: videoDuration,
      lastFrame: {
        imageBytes: endBase64,
        mimeType: 'image/png'
      }`
);

// Also apply fix for generateVideoPrompt (no voiceover from Veo)
content = content.replace(
  /Veo 3\.1 will receive a SINGLE reference image as the starting point\./,
  `Veo 3.1 will receive the SAME reference image as both the START and END frames to create a PERFECT SEAMLESS LOOP.`
);

content = content.replace(
  /CRITICAL INSTRUCTIONS:[\s\S]*?Focus on cinematic brilliance\./,
  `CRITICAL VEO 3.1 PROMPTING INSTRUCTIONS:
    1. **SEAMLESS LOOP CONSTRAINT**: The animation MUST naturally loop perfectly. Describe actions that can loop continuously.
    2. **SUBJECT & ACTION**: Identify the main subject and describe its action clearly.
    3. **CAMERA MOTION (LOCKED)**: Do NOT use camera panning, tracking, or dolly shots. You MUST command a "static camera, completely locked off shot" to ensure the start and end frames align perfectly without jumping.
    4. **STYLE & COMPOSITION**: Re-emphasize the dark, cinematic, atmospheric style.
    5. **ENVIRONMENTAL AMBIANCE**: Describe environmental animations in the background that loop well.
    6. **AUDIO PROMPTING CUES**: Veo 3.1 generates audio from text cues.
       - DO NOT include any spoken dialogue or speech in the prompt. Voiceover is strictly handled separately by our TTS engine.
       - Include explicit SFX (e.g., "creaking wood loudly").
       - Include Ambient Noise descriptions.
       
    Combine these elements into ONE highly descriptive, comma-separated, professional prompt.
    Focus on cinematic brilliance and a seamless loop aesthetic.`
);

fs.writeFileSync('services/geminiService.ts', content);
console.log('Update Complete');
