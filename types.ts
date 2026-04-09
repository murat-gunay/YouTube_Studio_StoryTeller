
export enum AppStep {
  INPUT = 0,
  PROCESSING_SCRIPT = 1,
  REVIEW_SCRIPT = 2,
  ASSET_GENERATION = 3,
  FINAL_OUTPUT = 4,
}

export enum VoiceOption {
  Kore = 'Kore',
  Despina = 'Despina',
  Callirrhoe = 'Callirrhoe',
  Sulafat = 'Sulafat',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr',
  Iapetus = 'Iapetus',
  Enceladus = 'Enceladus'
}

export enum Language {
  English = 'English',
  Spanish = 'Spanish',
  French = 'French',
  German = 'German',
  Chinese = 'Chinese',
  Japanese = 'Japanese',
  Turkish = 'Turkish',
  Portuguese = 'Portuguese',
  Hindi = 'Hindi',
  Arabic = 'Arabic'
}

export enum TTSTone {
  Neutral = 'Neutral',
  Warm = 'Warm',
  Dramatic = 'Dramatic',
  Calm = 'Calm',
  Enthusiastic = 'Enthusiastic',
  Melancholic = 'Melancholic',
  Mysterious = 'Mysterious'
}

export enum ArtStyle {
  Cinematic = 'Cinematic shot on 35mm film with anamorphic lens, shallow depth of field. Hyper-realistic textures, volumetric lighting, and dramatic color grading suitable for a blockbuster movie.',

  Watercolour = 'Soft and dreamy watercolor painting on textured rough paper using wet-on-wet technique. Pastel color palette, bleeding edges, and artistic splashes with a hand-painted feel.',

  Cyberpunk = 'Futuristic cyberpunk aesthetic with neon cyan and magenta lighting reflecting on wet surfaces. High-tech dystopian atmosphere, volumetric fog, and detailed mechanical elements.',

  Fantasy = 'Epic high fantasy oil painting with rich, deep colors and expressive brushstrokes. Ethereal lighting, magical aura, and intricate details reminiscent of classic fantasy concept art.',

  Anime = 'High-quality anime art style inspired by Studio Ghibli, with lush backgrounds and vibrant colors. Soft cel-shading, emotional lighting, and 4k detailed rendering.',

  Retro = '1980s retro synthwave aesthetic with lo-fi VHS tape texture, tracking lines, and static noise. Neon grid horizons, chromatic aberration, and a nostalgic analog video feel.',

  Documentary = 'Gritty black and white documentary photography, shot on vintage 35mm film with high grain. High contrast, natural lighting, and authentic historical texture evoking the early 20th century.',

  Sketch = 'Rough charcoal and graphite sketch on aged paper with visible hatching lines. Minimalist composition focusing on raw emotion, rapid gestural strokes, and artistic shading.',

  Comic = 'Modern graphic novel style with bold black ink outlines and vibrant flat colors. Dynamic composition, dramatic shadows, and clean vector-like details.',

  Mystical = 'Cinematic magical realism blending gritty historical texture with ethereal spiritual light. Supernatural glow, surreal atmosphere, and divine energy anomalies in a hyper-realistic setting.',

  OilPainting = 'Classical oil painting with visible impasto brushstrokes, rich textures, and dramatic chiaroscuro lighting. Warm color palette with deep shadows and historical fine art quality.',

  Ukiyoe = 'Traditional Japanese ukiyo-e woodblock print style with flat areas of color, bold outlines, and stylized landscapes. Elegant compositions inspired by Edo-period masters.',

  Sumie = 'Traditional East Asian ink wash painting (Sumi-e) on aged rice paper. Minimalist aesthetic with spontaneous brushwork, emphasizing negative space and Zen-like simplicity.',

  Isometric = 'Clean isometric 3D digital art style with vibrant colors and low-poly geometric shapes. Playful diorama-like composition with soft ambient occlusion and modern digital aesthetics.',

  Vaporwave = 'Surreal 1990s internet aesthetic featuring Greek statues, glitch art, and pixelated elements. Pastel neon color palette with marble textures, palm trees, and a nostalgic lo-fi vibe.',

  Noir = 'Atmospheric film noir style with high-contrast black and white cinematography. Dramatic hard lighting, deep shadows (low-key), and a gritty urban mystery feel with cinematic grain.',

  Claymation = 'Tactile stop-motion claymation style with visible fingerprints and handmade imperfections. Warm studio lighting, expressive character features, and a whimsical miniature world aesthetic.',

  PulpFiction = 'Vintage 1950s pulp magazine cover art with distressed paper textures and halftone printing dots. Bold, sensationalist composition with saturated colors and retro illustrative style.',

  StainedGlass = 'Intricate stained glass window art with vibrant translucent colors and thick black leaded outlines. Divine light rays shining through geometric glass patterns, creating a cathedral-like glow.',

  GothicWhimsy = 'Whimsical gothic art style inspired by Tim Burton, with spindly proportions and slightly eerie atmospheres. Desaturated color palette, curly motifs, and a dark yet playful fairy tale vibe.',

  Surrealism = 'Dream-like surrealist painting featuring impossible geometry, melting objects, and illogical compositions. Vibrant yet haunting atmosphere inspired by masters like Dali and Magritte.',

  VectorGraphic = 'Flat, clean vector illustration style with sharp edges and minimal gradients. Professional corporate aesthetic with a modern, friendly look suitable for educational storytelling.'
}

export enum AspectRatio {
  Square = "1:1",
  Standard = "4:3",
  Landscape = "16:9",
  Portrait = "9:16",
  Cinematic = "21:9"
}

export interface UserInput {
  title: string;
  instructions: string;
  durationMinutes: number;
  imageIntervalMinutes: number;
  voice: VoiceOption;
  artStyle: ArtStyle;
  aspectRatio: AspectRatio;
  useSearchGrounding: boolean;
  targetLanguage: Language;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  referenceImageUrl?: string;
  isGenerating?: boolean;
  isCustom?: boolean; // New flag for manually added characters
}

export type OverlayStyle = 'comic-box' | 'speech-bubble';

export interface Overlay {
  text: string;
  style: OverlayStyle;
}

export interface AnimationConfigEntry {
  start: number;
  duration: number;
}

export interface AudioAsset {
  id: string;
  url: string; // Changed from filename to url for remote support
  category: 'music' | 'ambience' | 'sfx';
  label: string;
}

export interface VideoOptions {
  duration: 4 | 6 | 8;
  resolution: '720p' | '1080p' | '1440p';
  generateAudio: boolean;
  aspectRatio: '16:9' | '9:16';
  numVideos: 1 | 2;
  placement: 'start' | 'end';
}

export interface Scene {
  id: number;
  timeRange: string;
  voiceoverScript: string;
  overlays: Overlay[];
  visualPrompt: string;
  visualPromptEnd?: string; // [DEPRECATED] No longer used in single-image animation flow
  animationStyles: string[];
  animationConfig?: Record<string, AnimationConfigEntry>;
  imageUrl?: string;
  imageUrlEnd?: string; // [DEPRECATED] No longer used in single-image animation flow
  videoUrl?: string;
  videoPrompt?: string; // Prompt for Veo
  ttsAudioUrl?: string;
  isGeneratingImage: boolean;
  isGeneratingImageEnd: boolean; // [DEPRECATED] No longer used
  isGeneratingVideo: boolean;
  isGeneratingVideoPrompt: boolean; // New
  isGeneratingTTS: boolean;
  selectedTone: TTSTone;
  selectedVoice: VoiceOption;
  characterRefId?: string;
  // Audio Tracks
  selectedMusicId?: string; // Background Music
  selectedSfxId?: string;   // Ambience/SFX
  // Video Options
  videoOptions?: VideoOptions; // Options for this specific scene
  hasShortVideo: boolean; // Toggle for short video generation
  isMuted?: boolean; // Mute state for video playback
}

export interface GeneratedScriptResponse {
  story_context: string;
  characters: { name: string; description: string }[];
  scenes: {
    voiceover: string;
    caption_context: string;
    caption_dialogue: string;
    visual_description: string;
    background_audio_id: string;
    sfx_audio_id: string;
  }[];
}
