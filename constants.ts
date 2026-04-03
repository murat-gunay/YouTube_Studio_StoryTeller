
import { ArtStyle, AspectRatio, VoiceOption, TTSTone, AudioAsset, Language } from "./types";

export const DEFAULT_DURATION = 30;
export const DEFAULT_INTERVAL = 2;

export const MODELS = {
  transcription: 'gemini-3.1-flash-lite-preview',
  scriptGen: 'gemini-3.1-flash-lite-preview',
  contentRefine: 'gemini-3.1-flash-lite-preview',
  imageGen: 'gemini-3.1-flash-image-preview', // For aspect ratio control
  imageEdit: 'gemini-3-pro-image-preview', // Upgraded to Pro for better instruction following
  videoGen: 'veo-3.1-lite-generate-preview',
  tts: 'gemini-2.5-pro-preview-tts',
  live: 'gemini-2.5-flash-native-audio-preview-12-2025'
};

export const ART_STYLES = Object.entries(ArtStyle).map(([key, value]) => ({
  label: key,
  value: value,
}));

export const VOICE_OPTIONS = Object.values(VoiceOption);

export const LANGUAGES = Object.values(Language);

export const ASPECT_RATIOS = Object.values(AspectRatio);

export const TTS_TONES = Object.values(TTSTone);

export const ANIMATION_GROUPS = [
  {
    title: "Primary Movement (Select One)",
    type: "movement",
    options: [
      { label: "Slow Zoom In", value: "animate-kb-zoom-in" },
      { label: "Slow Zoom Out", value: "animate-kb-zoom-out" },
      { label: "Pan Right", value: "animate-kb-pan-right" },
      { label: "Pan Left", value: "animate-kb-pan-left" },
      { label: "Pan Up", value: "animate-kb-pan-up" },
      { label: "Pan Down", value: "animate-kb-pan-down" },
      { label: "Diagonal Pan", value: "animate-kb-diag-right-up" },
      { label: "Zoom & Pan", value: "animate-kb-zoom-pan-right" },
    ]
  },
  {
    title: "Effects (Select Multiple)",
    type: "effect",
    options: [
      { label: "Crash Zoom (Fast)", value: "animate-active-crash-zoom" },
      { label: "Vertigo (Fast Out)", value: "animate-active-vertigo" },
      { label: "Handheld Shake", value: "animate-active-shake" },
      { label: "Pulse / Heartbeat", value: "animate-active-pulse" },
      { label: "3D Tilt", value: "animate-active-3d-tilt" },
    ]
  }
];

export const ALL_ANIMATION_OPTIONS = ANIMATION_GROUPS.flatMap(g => g.options);

// Curated Library of Assets using Google Actions Public Sounds & GitHub Raw
// These replace local files to solve the 10MB limit issue.
export const AUDIO_LIBRARY: AudioAsset[] = [
  // --- MUSIC (GitHub Raw) ---
  { id: 'music_happy', url: 'https://raw.githubusercontent.com/murat-gunay/VideoSoundMusic/main/music_acoustic_happy.mp3', category: 'music', label: '😊 Acoustic Happy / Bright' },
  { id: 'music_dark_epic', url: 'https://raw.githubusercontent.com/murat-gunay/VideoSoundMusic/main/music_cinematic_dark_epic.mp3', category: 'music', label: '🌑 Cinematic Dark Epic' },
  { id: 'music_sad', url: 'https://raw.githubusercontent.com/murat-gunay/VideoSoundMusic/main/music_cinematic_sad.mp3', category: 'music', label: '😢 Cinematic Sad / Emotional' },
  { id: 'music_tension', url: 'https://raw.githubusercontent.com/murat-gunay/VideoSoundMusic/main/music_cinematic_tension.mp3', category: 'music', label: '😰 Cinematic Tension / Suspense' },
  { id: 'music_thrilling', url: 'https://raw.githubusercontent.com/murat-gunay/VideoSoundMusic/main/music_cinematic_thrilling.mp3', category: 'music', label: '🏃 Cinematic Thrilling / Action' },
  { id: 'music_mystical', url: 'https://raw.githubusercontent.com/murat-gunay/VideoSoundMusic/main/music_desert_mystical_arabic.mp3', category: 'music', label: '🔮 Desert Mystical / Arabic' },

  // --- AMBIENCE / SFX (Google Actions) ---
  { id: 'sfx_magic', url: 'https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg', category: 'sfx', label: '✨ Magic Chime' },
  { id: 'sfx_battle_sword', url: 'https://actions.google.com/sounds/v1/crowds/battle_intimidation_forest.ogg', category: 'sfx', label: '⚔️ Ancient Battle (Swords/Forest)' },
  { id: 'sfx_battle_cry', url: 'https://actions.google.com/sounds/v1/crowds/battle_cry_high_pitch.ogg', category: 'sfx', label: '🗣️ Battle Cry (Loud)' },
  { id: 'sfx_battle_win', url: 'https://actions.google.com/sounds/v1/crowds/battle_crowd_celebrate_stutter.ogg', category: 'sfx', label: '🎉 Battle Victory / Celebration' },
  { id: 'ambience_wind', url: 'https://actions.google.com/sounds/v1/weather/strong_wind.ogg', category: 'ambience', label: '💨 Strong Wind' },
  { id: 'sfx_rocket', url: 'https://actions.google.com/sounds/v1/weapons/airplane_rocket_fire_close.ogg', category: 'sfx', label: '🚀 Modern Rocket Fire' },
  { id: 'sfx_gun', url: 'https://actions.google.com/sounds/v1/weapons/rifle_musket_fire_random.ogg', category: 'sfx', label: '🔫 Modern Rifle / Musket' },
  { id: 'sfx_fire', url: 'https://actions.google.com/sounds/v1/ambiences/fire.ogg', category: 'sfx', label: '🔥 Open Camp Fire' },
  { id: 'ambience_city', url: 'https://actions.google.com/sounds/v1/transportation/city_traffic.ogg', category: 'ambience', label: '🏙️ City Traffic' },
  { id: 'ambience_ocean', url: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg', category: 'ambience', label: '🌊 Ocean Waves' },
  { id: 'ambience_storm', url: 'https://actions.google.com/sounds/v1/weather/thunderstorm_long.ogg', category: 'ambience', label: '⚡ Thunderstorm Lightning' },
  { id: 'ambience_rain', url: 'https://actions.google.com/sounds/v1/weather/rain_on_roof.ogg', category: 'ambience', label: '🌧️ Rain on Roof' },
  { id: 'ambience_jungle', url: 'https://actions.google.com/sounds/v1/ambiences/jungle_atmosphere_night.ogg', category: 'ambience', label: '🌴 Forest/Jungle Night' },
  { id: 'ambience_crowd', url: 'https://actions.google.com/sounds/v1/crowds/crowd_talking.ogg', category: 'ambience', label: '👥 Interior Crowd Talking' },
];
