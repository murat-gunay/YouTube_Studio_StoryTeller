const fs = require('fs');

let content = fs.readFileSync('services/geminiService.ts', 'utf-8');

// Fix 1: generateVideo
content = content.replace(
  /const startBase64 = await urlToBase64\(imageSrc\);\s+const videoConfig: any = {/g,
  `const startBase64 = await urlToBase64(imageSrc);\n    const endBase64 = endImageSrc ? await urlToBase64(endImageSrc) : startBase64;\n    let safeResolution = options?.resolution || '720p';\n    const videoDuration = options?.duration || 6;\n    if (safeResolution === '1080p' && videoDuration !== 8) {\n      safeResolution = '720p';\n    }\n    const videoConfig: any = {`
);

content = content.replace(
  /videoDurationSeconds: options\?.duration \|\| 6\s+};/g,
  `videoDurationSeconds: videoDuration,\n      lastFrame: {\n        imageBytes: endBase64,\n        mimeType: 'image/png'\n      }\n    };`
);

// Fix 1.5: Fix resolution variable reference in videoConfig
content = content.replace(
  /resolution: options\?.resolution \|\| '720p',/g,
  `resolution: safeResolution,`
);

// Fix 2: generateVideoPrompt
content = content.replace(
  /Veo 3\.1 will receive a SINGLE reference image as the starting point\./g,
  `Veo 3.1 will receive the SAME reference image as both the START and END frames to create a PERFECT SEAMLESS LOOP.`
);

content = content.replace(
  /CRITICAL INSTRUCTIONS:([\s\S]*?)Keep it in ENGLISH./g,
  `CRITICAL VEO 3.1 PROMPTING INSTRUCTIONS:
    1. **SEAMLESS LOOP CONSTRAINT**: The animation MUST naturally loop perfectly. Describe actions that can loop continuously.
    2. **SUBJECT & ACTION**: Identify the main subject and describe its action clearly.
    3. **CAMERA MOTION (LOCKED)**: Do NOT use camera panning, tracking, or dolly shots. You MUST command a "static camera, completely locked off shot".
    4. **STYLE & COMPOSITION**: Re-emphasize the dark, cinematic, atmospheric style.
    5. **ENVIRONMENTAL AMBIANCE**: Describe environmental animations that loop well.
    6. **AUDIO PROMPTING CUES**: Veo 3.1 generates audio from text cues.
       - DO NOT include any spoken dialogue or speech in the prompt. Voiceover is strictly handled separately by our TTS engine.
       - Include explicit SFX (e.g., "creaking wood loudly").
       - Include Ambient Noise descriptions (e.g., "A faint eerie hum resonates").
       
    Combine these elements into ONE highly descriptive, comma-separated, professional prompt.
    Focus on cinematic brilliance and a seamless loop aesthetic.
    Keep it in ENGLISH.`
);

// Fix 3: generateAnimatedStoryScript
content = content.replace(
  /2\. \*\*VIDEO CONTENT \(User Facing\)\*\*(.*?)\n(.*?)Target Specifications:/g,
  `2. **VIDEO CONTENT (User Facing)**: The 'voiceover', 'caption_context', and 'caption_dialogue' MUST be written in **\${targetLanguage}**.

    Target Specifications:`
);

content = content.replace(
  /- \*\*CRITICAL: THERE WILL BE NO SPEECH OR DIALOGUE IN THESE VIDEOS\.\*\* The videos are purely visual with background music\/SFX\. Do not write any voiceover\. Do not include speech or thought bubbles in the visual descriptions\./g,
  `` // Just remove the line completely
);

content = content.replace(
  /- \*\*Voiceover\*\*: Leave it completely blank \(""\)\. There is no voiceover\./g,
  `- **Voiceover**: Write a voiceover script for each scene in \${targetLanguage}.`
);

content = content.replace(
  /- \*\*Video Prompt\*\*: A 1-2 sentence description for Veo 3\.1 describing a \*simple animation\* of the character \(e\.g\., "character walking forward, wind blowing clothes", "character typing on a laptop, blinking"\)\. DO NOT overcomplicate the animation\./g,
  `- **Video Prompt**: A 1-2 sentence description for Veo 3.1 describing a *simple animation* of the character.`
);

content = content.replace(
  /6\. \*\*Overlays\*\*: For EACH scene, generate text overlays or speech bubbles in \*\*\$\{targetLanguage\}\*\*\./g,
  ``
);

content = content.replace(
  /      "scenes": \[\n        {\n          "visual_description": "A detailed reference image generation prompt in ENGLISH\.\.\.",\n          "video_prompt": "seamless loop animation prompt for Veo in ENGLISH\.\.\.",\n          "background_audio_id": "music_mystical",\n          "sfx_audio_id": "ambience_rain"\n        }\n      \]/g,
  `      "scenes": [
        {
          "voiceover": "The spoken text in \${targetLanguage}...",
          "caption_context": "Short narrative text in \${targetLanguage}...",
          "caption_dialogue": "Short dialogue or sound effect in \${targetLanguage}...",
          "visual_description": "A detailed reference image generation prompt in ENGLISH...",
          "video_prompt": "seamless loop animation prompt for Veo in ENGLISH...",
          "background_audio_id": "music_mystical",
          "sfx_audio_id": "ambience_rain"
        }
      ]`
);

content = content.replace(
  /              properties: {\n                visual_description: \{ type: Type\.STRING \},\n                video_prompt: \{ type: Type\.STRING \},\n                background_audio_id: \{ type: Type\.STRING \},\n                sfx_audio_id: \{ type: Type\.STRING \}\n              },\n              required: \["visual_description", "video_prompt", "background_audio_id", "sfx_audio_id"\]/g,
  `              properties: {
                voiceover: { type: Type.STRING },
                caption_context: { type: Type.STRING },
                caption_dialogue: { type: Type.STRING },
                visual_description: { type: Type.STRING },
                video_prompt: { type: Type.STRING },
                background_audio_id: { type: Type.STRING },
                sfx_audio_id: { type: Type.STRING }
              },
              required: ["voiceover", "caption_context", "caption_dialogue", "visual_description", "video_prompt", "background_audio_id", "sfx_audio_id"]`
);

content = content.replace(
  /const scenes = \(rawData\.scenes \|\| \[\]\)\.map\(\(s: any, index: number\) => {\n    \/\/ In animated mode we might not want traditional comic overlays since Veo is doing speech bubbles\n    \/\/ But we keep them empty or optional depending on the design\. The user requested:\n    \/\/ "overlay text vs olmayacak ama image geneation'de\.\.\. text üretmesine izin verilecek\. sahneye uygun düşünce veya konuşma baloncuğu üretilebilecek"\n    const overlays: Overlay\[\] = \[\];\n\n    const startMin = index \* durationPerScene;\n    const endMin = \(index \+ 1\) \* durationPerScene;\n    const timeRange = \`\\\$\\{formatTime\(startMin\)\\} \- \\\$\\{formatTime\(endMin\)\\}\`;\n\n    return {\n      id: index,\n      timeRange: timeRange,\n      voiceoverScript: "", \/\/ Explicitly empty for Animated mode/g,
  `const scenes = (rawData.scenes || []).map((s: any, index: number) => {
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
      voiceoverScript: s.voiceover || "",`
);

fs.writeFileSync('services/geminiService.ts', content);
console.log('Update successful');
