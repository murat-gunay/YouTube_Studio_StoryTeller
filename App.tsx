
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
import { transcribeAudio, generateStoryScript, generateAnimatedStoryScript, generateFootballScript, generateImage, generateVideo, generateTTS, generateThumbnail, generateCharacterReference, generateKitReferenceImage, generateTitle, generateVideoPrompt, localizeScript, generateFootballThumbnailSuggestions, localizeThumbnailMetadata, localizeMetadata, generateMatchVisualPrompts, generateLocalizedFootballScript, runMatchSimulationEngine, getTeamProfileHelper, translateTeamData, getStatsLabels, getCanonicalStatKey } from './services/geminiService';
import { renderFullVideo } from './services/videoRenderService';
import { AssetStorage } from './services/assetStorage';
import { burnThumbnailText } from './services/thumbnailUtils';
import { OverlayStyle } from './types';

const determineOverlayStyle = (text: string, index: number): OverlayStyle => {
  if (!text) return 'comic-box';
  const clean = text.toLowerCase();
  
  if (clean.includes('|') && clean.includes(':')) {
    return 'stats-board';
  }
  
  if (clean.includes('goal') || clean.includes('gol') || clean.includes('goool') || clean.includes('red card') || clean.includes('kırmızı kart') || clean.includes('sarı kart') || clean.includes('yellow card') || clean.includes('penalty') || clean.includes('penaltı')) {
    return 'goal-banner';
  }
  
  if (index === 0) {
    if (clean.includes('versus') || clean.includes('vs') || clean.includes('score') || clean.includes('skor') || clean.includes('min') || clean.includes('dk') || clean.includes('lineup') || clean.includes('kadro')) {
      return 'scoreboard';
    }
    return 'comic-box';
  }
  
  if (index === 1) {
    return 'comic-box';
  }
  
  if (index === 2) {
    if (clean.includes('%') || clean.includes('possession') || clean.includes('şut') || clean.includes('shot') || clean.includes('xg') || clean.includes('tact') || clean.includes('anal') || clean.includes('pas') || clean.includes('pass') || clean.includes('stat') || clean.includes('insig') || clean.includes('veriler')) {
      return 'tactical-card';
    }
    return 'comic-box';
  }
  
  return 'comic-box';
};

const translateFootballTerm = (term: string, lang: string): string => {
  if (!term || term === 'N/A') return 'N/A';
  const lowerLang = lang.toLowerCase();
  
  // Extract text inside parentheses
  const parenIndex = term.indexOf('(');
  let baseText = term;
  let parenSuffix = '';
  if (parenIndex !== -1) {
    baseText = term.substring(0, parenIndex).trim();
    parenSuffix = ' ' + term.substring(parenIndex).trim();
  }

  const cleanTerm = baseText.toLowerCase().trim();

  const dictionary: Record<string, Record<string, string>> = {
    turkish: {
      'goalkeeper': 'Kaleci',
      'gk': 'Kaleci',
      'centre-back': 'Stoper',
      'center-back': 'Stoper',
      'cb': 'Stoper',
      'defender': 'Defans',
      'right-back': 'Sağ Bek',
      'rb': 'Sağ Bek',
      'left-back': 'Sol Bek',
      'lb': 'Sol Bek',
      'defensive midfield': 'Ön Libero',
      'defensive midfielder': 'Ön Libero',
      'dm': 'Ön Libero',
      'central midfield': 'Merkez Orta Saha',
      'central midfielder': 'Merkez Orta Saha',
      'cm': 'Merkez Orta Saha',
      'midfielder': 'Orta Saha',
      'attacking midfield': 'Ofansif Orta Saha',
      'attacking midfielder': 'Ofansif Orta Saha',
      'am': 'Ofansif Orta Saha',
      'right winger': 'Sağ Kanat',
      'rw': 'Sağ Kanat',
      'left winger': 'Sol Kanat',
      'lw': 'Sol Kanat',
      'centre-forward': 'Santrfor',
      'striker': 'Santrfor',
      'cf': 'Santrfor',
      'tiki-taka': 'Tiki-taka',
      'gegenpressing': 'Gegenpressing',
      'pressing': 'Pres',
      'high press': 'Yüksek Pres',
      'counter-attacking': 'Kontratak',
      'counterattack': 'Kontratak',
      'counter attack': 'Kontratak',
      'possession based': 'Topa Sahip Olma',
      'possession-based': 'Topa Sahip Olma',
      'possession': 'Topla Oynama',
      'defensive': 'Savunma Ağırlıklı',
      'park the bus': 'Otobüsü Çekme',
      'low block': 'Alçak Blok',
      'attacking': 'Hücum',
      'high-tempo attacking': 'Hızlı Hücum',
      'winners': 'Şampiyon',
      'winner': 'Şampiyon',
      'runner-up': 'İkinci',
      'runners-up': 'İkinci',
      'semi-finals': 'Yarı Final',
      'semi-final': 'Yarı Final',
      'semifinals': 'Yarı Final',
      'semifinal': 'Yarı Final',
      'quarter-finals': 'Çeyrek Final',
      'quarter-final': 'Çeyrek Final',
      'quarterfinals': 'Çeyrek Final',
      'quarterfinal': 'Çeyrek Final',
      'round of 16': 'Son 16',
      'group stage': 'Grup Aşaması',
      'none': 'Yok',
      'appearances': 'Katılım',
      'apps': 'Katılım',
      'titles': 'Şampiyonluk'
    },
    spanish: {
      'goalkeeper': 'Portero',
      'gk': 'Portero',
      'centre-back': 'Defensa Central',
      'center-back': 'Defensa Central',
      'cb': 'Defensa Central',
      'defender': 'Defensa',
      'right-back': 'Lateral Derecho',
      'rb': 'Lateral Derecho',
      'left-back': 'Lateral Izquierdo',
      'lb': 'Lateral Izquierdo',
      'defensive midfield': 'Pivote',
      'defensive midfielder': 'Pivote',
      'dm': 'Pivote',
      'central midfield': 'Mediocentro',
      'central midfielder': 'Mediocentro',
      'cm': 'Mediocentro',
      'midfielder': 'Centrocampista',
      'attacking midfield': 'Mediapunta',
      'attacking midfielder': 'Mediapunta',
      'am': 'Mediapunta',
      'right winger': 'Extremo Derecho',
      'rw': 'Extremo Derecho',
      'left winger': 'Extremo Izquierdo',
      'lw': 'Extremo Izquierdo',
      'centre-forward': 'Delantero Centro',
      'striker': 'Delantero Centro',
      'cf': 'Delantero Centro',
      'tiki-taka': 'Tiki-taka',
      'gegenpressing': 'Gegenpressing',
      'pressing': 'Presión',
      'high press': 'Presión Alta',
      'counter-attacking': 'Contraataque',
      'counterattack': 'Contraataque',
      'counter attack': 'Contraataque',
      'possession based': 'Juego de Posesión',
      'possession-based': 'Juego de Posesión',
      'possession': 'Posesión',
      'defensive': 'Defensivo',
      'park the bus': 'Autobús',
      'low block': 'Bloque Bajo',
      'attacking': 'Ofensivo',
      'high-tempo attacking': 'Ataque Rápido',
      'winners': 'Campeón',
      'winner': 'Campeón',
      'runner-up': 'Subcampeón',
      'runners-up': 'Subcampeón',
      'semi-finals': 'Semifinales',
      'semi-final': 'Semifinales',
      'semifinals': 'Semifinales',
      'semifinal': 'Semifinales',
      'quarter-finals': 'Cuartos de Final',
      'quarter-final': 'Cuartos de Final',
      'quarterfinals': 'Cuartos de Final',
      'quarterfinal': 'Cuartos de Final',
      'round of 16': 'Octavos de Final',
      'group stage': 'Fase de Grupos',
      'none': 'Ninguno',
      'appearances': 'Partic. en Mundiales',
      'apps': 'Partic. en Mundiales',
      'titles': 'Títulos'
    },
    portuguese: {
      'goalkeeper': 'Goleiro',
      'gk': 'Goleiro',
      'centre-back': 'Zagueiro',
      'center-back': 'Zagueiro',
      'cb': 'Zagueiro',
      'defender': 'Defensor',
      'right-back': 'Lateral Direito',
      'rb': 'Lateral Direito',
      'left-back': 'Lateral Esquerdo',
      'lb': 'Lateral Esquerdo',
      'defensive midfield': 'Volante',
      'defensive midfielder': 'Volante',
      'dm': 'Volante',
      'central midfield': 'Meia Central',
      'central midfielder': 'Meia Central',
      'cm': 'Meia Central',
      'midfielder': 'Meio-campista',
      'attacking midfield': 'Meia-atacante',
      'attacking midfielder': 'Meia-atacante',
      'am': 'Meia-atacante',
      'right winger': 'Ponta Direita',
      'rw': 'Ponta Direita',
      'left winger': 'Ponta Esquerda',
      'lw': 'Ponta Esquerda',
      'centre-forward': 'Centroavante',
      'striker': 'Centroavante',
      'cf': 'Centroavante',
      'tiki-taka': 'Tiki-taka',
      'gegenpressing': 'Gegenpressing',
      'pressing': 'Marcação sob Pressão',
      'high press': 'Pressão Alta',
      'counter-attacking': 'Contra-ataque',
      'counterattack': 'Contra-ataque',
      'counter attack': 'Contra-ataque',
      'possession based': 'Posse de Bola',
      'possession-based': 'Posse de Bola',
      'possession': 'Posse de bola',
      'defensive': 'Defensivo',
      'park the bus': 'Retranca',
      'low block': 'Bloco Baixo',
      'attacking': 'Ofensivo',
      'high-tempo attacking': 'Ataque em Ritmo Acelerado',
      'winners': 'Campeão',
      'winner': 'Campeão',
      'runner-up': 'Vice-campeão',
      'runners-up': 'Vice-campeão',
      'semi-finals': 'Semifinais',
      'semi-final': 'Semifinais',
      'semifinals': 'Semifinais',
      'semifinal': 'Semifinais',
      'quarter-finals': 'Quartas de Final',
      'quarter-final': 'Quartas de Final',
      'quarterfinals': 'Quartas de Final',
      'quarterfinal': 'Quartas de Final',
      'round of 16': 'Oitavas de Final',
      'group stage': 'Fase de Grupos',
      'none': 'Nenhum',
      'appearances': 'Partic. em Copas',
      'apps': 'Partic. em Copas',
      'titles': 'Títulos'
    },
    french: {
      'goalkeeper': 'Gardien',
      'gk': 'Gardien',
      'centre-back': 'Défenseur Central',
      'center-back': 'Défenseur Central',
      'cb': 'Défenseur Central',
      'defender': 'Défenseur',
      'right-back': 'Arrière Droit',
      'rb': 'Arrière Droit',
      'left-back': 'Arrière Gauche',
      'lb': 'Arrière Gauche',
      'defensive midfield': 'Milieu Défensif',
      'defensive midfielder': 'Milieu Défensif',
      'dm': 'Milieu Défensif',
      'central midfield': 'Milieu Central',
      'central midfielder': 'Milieu Central',
      'cm': 'Milieu Central',
      'midfielder': 'Milieu de Terrain',
      'attacking midfield': 'Milieu Offensif',
      'attacking midfielder': 'Milieu Offensif',
      'am': 'Milieu Offensif',
      'right winger': 'Ailier Droit',
      'rw': 'Ailier Droit',
      'left winger': 'Ailier Gauche',
      'lw': 'Ailier Gauche',
      'centre-forward': 'Avant-centre',
      'striker': 'Buteur',
      'cf': 'Avant-centre',
      'tiki-taka': 'Tiki-taka',
      'gegenpressing': 'Gegenpressing',
      'pressing': 'Pressing',
      'high press': 'Pressing Haut',
      'counter-attacking': 'Contre-attaque',
      'counterattack': 'Contre-attaque',
      'counter attack': 'Contre-attaque',
      'possession based': 'Jeu de Possession',
      'possession-based': 'Jeu de Possession',
      'possession': 'Possession',
      'defensive': 'Défensif',
      'park the bus': 'Garer le Bus',
      'low block': 'Bloco Baixo',
      'attacking': 'Offensif',
      'high-tempo attacking': 'Attaque à Haute Intensité',
      'winners': 'Vainqueur',
      'winner': 'Vainqueur',
      'runner-up': 'Finaliste',
      'runners-up': 'Finaliste',
      'semi-finals': 'Demi-finales',
      'semi-final': 'Demi-finales',
      'semifinals': 'Demi-finales',
      'semifinal': 'Demi-finales',
      'quarter-finals': 'Quarts de finale',
      'quarter-final': 'Quarts de finale',
      'quarterfinals': 'Quarts de finale',
      'quarterfinal': 'Quarts de finale',
      'round of 16': 'Huitièmes de finale',
      'group stage': 'Phase de Groupes',
      'none': 'Aucun',
      'appearances': 'Participations',
      'apps': 'Participations',
      'titles': 'Titres'
    },
    german: {
      'goalkeeper': 'Torwart',
      'gk': 'Torwart',
      'centre-back': 'Innenverteidiger',
      'center-back': 'Innenverteidiger',
      'cb': 'Innenverteidiger',
      'defender': 'Abwehrspieler',
      'right-back': 'Rechter Verteidiger',
      'rb': 'Rechter Verteidiger',
      'left-back': 'Linker Verteidiger',
      'lb': 'Linker Verteidiger',
      'defensive midfield': 'Defensives Mittelfeld',
      'defensive midfielder': 'Defensiver Mittelfeldspieler',
      'dm': 'Defensives Mittelfeld',
      'central midfield': 'Zentrales Mittelfeld',
      'central midfielder': 'Zentraler Mittelfeldspieler',
      'cm': 'Zentrales Mittelfeld',
      'midfielder': 'Mittelfeldspieler',
      'attacking midfield': 'Offensives Mittelfeld',
      'attacking midfielder': 'Offensiver Mittelfeldspieler',
      'am': 'Offensives Mittelfeld',
      'right winger': 'Rechter Flügelspieler',
      'rw': 'Rechter Flügelspieler',
      'left winger': 'Linker Flügelspieler',
      'lw': 'Linker Flügelspieler',
      'centre-forward': 'Mittelstürmer',
      'striker': 'Stürmer',
      'cf': 'Mittelstürmer',
      'tiki-taka': 'Tiki-Taka',
      'gegenpressing': 'Gegenpressing',
      'pressing': 'Pressing',
      'high press': 'Hohes Pressing',
      'counter-attacking': 'Konterspiel',
      'counterattack': 'Konter',
      'counter attack': 'Konter',
      'possession based': 'Ballbesitzfußball',
      'possession-based': 'Ballbesitzfußball',
      'possession': 'Ballbesitz',
      'defensive': 'Defensiv',
      'park the bus': 'Bus Parken',
      'low block': 'Tiefes Abwehrblock',
      'attacking': 'Offensiv',
      'high-tempo attacking': 'Schnelles Angriffsspiel',
      'winners': 'Sieger',
      'winner': 'Sieger',
      'runner-up': 'Zweiter',
      'runners-up': 'Zweiter',
      'semi-finals': 'Halbfinale',
      'semi-final': 'Halbfinale',
      'semifinals': 'Halbfinale',
      'semifinal': 'Halbfinale',
      'quarter-finals': 'Viertelfinale',
      'quarter-final': 'Viertelfinale',
      'quarterfinals': 'Viertelfinale',
      'quarterfinal': 'Viertelfinale',
      'round of 16': 'Achtelfinale',
      'group stage': 'Gruppenphase',
      'none': 'Keine',
      'appearances': 'Teilnahmen',
      'apps': 'Teilnahmen',
      'titles': 'Titel'
    }
  };

  const langKey = Object.keys(dictionary).find(k => lowerLang.includes(k) || k === lowerLang);
  if (langKey && dictionary[langKey]) {
    if (dictionary[langKey][cleanTerm]) {
      return dictionary[langKey][cleanTerm] + parenSuffix;
    }
    for (const [eng, loc] of Object.entries(dictionary[langKey])) {
      if (cleanTerm.includes(eng)) {
        return cleanTerm.replace(eng, loc) + parenSuffix;
      }
    }
  }

  return baseText.replace(/\b\w/g, c => c.toUpperCase()) + parenSuffix;
};

const normalizeMarketValue = (val: string): string => {
  if (!val || val === 'N/A') return 'N/A';
  let clean = val.trim();
  // Remove any leading quote, backtick, apostrophe, space
  clean = clean.replace(/^[‘'’`" ]+/, '');
  // Ensure it starts with a valid currency symbol, defaulting to Euro (€) if none is present
  if (!/^[€$£]/.test(clean)) {
    clean = '€' + clean;
  }
  return clean;
};

const localizeFootballStatsString = (text: string, lang: Language): string => {
  if (!text) return '';
  if (!text.includes('|') || !text.includes(':')) return text; // Not a stats-board formatted string
  
  const parts = text.split('|');
  const targetLabels = getStatsLabels(lang);
  
  const localizedParts = parts.map(part => {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) return part;
    
    const label = part.substring(0, colonIndex).trim();
    const valuesStr = part.substring(colonIndex + 1).trim();
    
    // Find canonical key
    const canonicalKey = getCanonicalStatKey(label);
    const localizedLabel = canonicalKey && targetLabels[canonicalKey as keyof typeof targetLabels]
      ? targetLabels[canonicalKey as keyof typeof targetLabels]
      : label;
      
    // Find separator
    let dashIndex = valuesStr.indexOf(' - ');
    let dividerLength = 3;
    if (dashIndex === -1) {
      dashIndex = valuesStr.indexOf('-');
      dividerLength = 1;
    }
    
    if (dashIndex === -1) {
      // No dash, maybe single value or custom text, translate it directly
      return `${localizedLabel}: ${translateFootballTerm(valuesStr, lang)}`;
    }
    
    const valA = valuesStr.substring(0, dashIndex).trim();
    const valB = valuesStr.substring(dashIndex + dividerLength).trim();
    
    // For comparison cards (position, style, performance), translate values
    let valATrans = valA;
    let valBTrans = valB;
    if (canonicalKey === 'position' || canonicalKey === 'style' || canonicalKey === 'performance' || canonicalKey === 'bestFinish' || canonicalKey === 'worldCupAppearances' || canonicalKey === 'worldCupTitles') {
      valATrans = translateFootballTerm(valA, lang);
      valBTrans = translateFootballTerm(valB, lang);
    }
    
    return `${localizedLabel}: ${valATrans} - ${valBTrans}`;
  });
  
  return localizedParts.join(' | ');
};

// --- API Coordination & Concurrency Queue Classes ---
class StaggeredApiOrchestrator {
  private lastCallTime = 0;
  private queue: (() => Promise<any>)[] = [];
  private running = false;
  private delayMs = 3000;

  constructor(delayMs = 3000) {
    this.delayMs = delayMs;
  }

  public enqueue<T>(apiCall: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const res = await apiCall();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
      this.start();
    });
  }

  private async start() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        const now = Date.now();
        const elapsed = now - this.lastCallTime;
        if (elapsed < this.delayMs) {
          await new Promise(resolve => setTimeout(resolve, this.delayMs - elapsed));
        }
        this.lastCallTime = Date.now();
        task();
      }
    }
    this.running = false;
  }
}

class RenderConcurrencyQueue {
  private runningCount = 0;
  private maxConcurrency = 2;
  private waitingQueue: (() => void)[] = [];

  constructor(maxConcurrency = 2) {
    this.maxConcurrency = maxConcurrency;
  }

  public setMaxConcurrency(val: number) {
    this.maxConcurrency = val;
  }

  public async acquire(): Promise<() => void> {
    if (this.runningCount < this.maxConcurrency) {
      this.runningCount++;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.waitingQueue.push(() => {
        this.runningCount++;
        resolve(() => this.release());
      });
    });
  }

  private release() {
    this.runningCount--;
    if (this.waitingQueue.length > 0) {
      const next = this.waitingQueue.shift();
      next?.();
    }
  }
}

const apiOrchestrator = new StaggeredApiOrchestrator(3000);
const renderQueue = new RenderConcurrencyQueue(2);

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
  const [renderConcurrency, setRenderConcurrency] = useState<number>(() => {
    const saved = localStorage.getItem('yt_studio_render_concurrency');
    return saved ? Number(saved) : 2;
  });
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
    speaker1Voice: VoiceOption.Enceladus,
    speaker2Voice: VoiceOption.Kore,
    imageGenerator: 'xAI',
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

  const [schedulerStatus, setSchedulerStatus] = useState<{
    nextTriggerStr: string;
    countdownStr: string;
    warningStr: string;
  }>({ nextTriggerStr: '', countdownStr: '', warningStr: '' });

  // --- Selected Languages and Successfully Uploaded Videos Log ---
  interface UploadedVideo {
    id: string;
    title: string;
    lang: Language;
    youtubeUrl: string;
    uploadedAt: string;
    matchInfo?: string;
  }

  interface LangPipelineStepState {
    subStep: 'idle' | 'script' | 'assets' | 'thumbnail' | 'render' | 'publish' | 'backup';
    statusMessage: string;
    errorLog: string[];
    retries: number;
  }

  const [dashboardSelectedLanguage, setDashboardSelectedLanguage] = useState<Language>(Language.English);

  const [langPipelineSteps, setLangPipelineSteps] = useState<Record<Language, LangPipelineStepState>>({
    [Language.English]: { subStep: 'idle', statusMessage: 'Idle.', errorLog: [], retries: 0 },
    [Language.Turkish]: { subStep: 'idle', statusMessage: 'Idle.', errorLog: [], retries: 0 },
    [Language.Spanish]: { subStep: 'idle', statusMessage: 'Idle.', errorLog: [], retries: 0 },
    [Language.Portuguese]: { subStep: 'idle', statusMessage: 'Idle.', errorLog: [], retries: 0 },
    [Language.French]: { subStep: 'idle', statusMessage: 'Idle.', errorLog: [], retries: 0 },
    [Language.German]: { subStep: 'idle', statusMessage: 'Idle.', errorLog: [], retries: 0 }
  } as Record<Language, LangPipelineStepState>);

  const [selectedAutoLanguages, setSelectedAutoLanguages] = useState<Language[]>(() => {
    const saved = localStorage.getItem('yt_studio_selected_auto_languages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [Language.English, Language.Turkish, Language.Spanish, Language.Portuguese, Language.French, Language.German];
  });

  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>(() => {
    const saved = localStorage.getItem('yt_studio_uploaded_videos');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [];
  });

  const getNextScheduledDate = (): { date: Date; timeStr: string } | null => {
    if (!schedulerEnabled) return null;
    const now = new Date();
    const activeTimes = Array.from({ length: schedulerFrequency }).map((_, idx) => schedulerTimes[idx] || '09:00');
    
    let nextDate: Date | null = null;
    let nextTimeStr = '';

    activeTimes.forEach(t => {
      const [hStr, mStr] = t.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (isNaN(h) || isNaN(m)) return;

      // Candidate 1: today at h:m
      const candidate1 = new Date(now);
      candidate1.setHours(h, m, 0, 0);

      // Candidate 2: tomorrow at h:m
      const candidate2 = new Date(now);
      candidate2.setDate(candidate2.getDate() + 1);
      candidate2.setHours(h, m, 0, 0);

      // Use candidate 1 if it's in the future (at least 1 second in the future), else candidate 2
      const chosen = candidate1.getTime() > now.getTime() + 1000 ? candidate1 : candidate2;

      if (!nextDate || chosen.getTime() < nextDate.getTime()) {
        nextDate = chosen;
        nextTimeStr = t;
      }
    });

    return nextDate ? { date: nextDate, timeStr: nextTimeStr } : null;
  };

  useEffect(() => {
    if (!schedulerEnabled) {
      setSchedulerStatus({ nextTriggerStr: '', countdownStr: '', warningStr: '' });
      return;
    }

    const updateStatus = () => {
      let warningStr = '';
      if (selectedFixtureName === 'manual') {
        warningStr = "Competition / Tournament dropdown is set to 'manual'. Please select a fixture file for automatic triggers to work.";
      } else if (selectedAutoLanguages.length === 0) {
        warningStr = "No languages are selected for automatic publishing. Please include at least one language channel.";
      } else if (autoPublishState.isRunning) {
        warningStr = "Full Auto Publish engine is already running. The next scheduled trigger will be bypassed if the current match is still publishing.";
      }

      const nextInfo = getNextScheduledDate();
      if (!nextInfo) {
        setSchedulerStatus({ nextTriggerStr: '', countdownStr: '', warningStr });
        return;
      }

      const diffMs = nextInfo.date.getTime() - Date.now();
      if (diffMs <= 0) {
        setSchedulerStatus({
          nextTriggerStr: nextInfo.timeStr,
          countdownStr: 'Triggering now...',
          warningStr
        });
        return;
      }

      const diffSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(diffSecs / 3600);
      const minutes = Math.floor((diffSecs % 3600) / 60);
      const seconds = diffSecs % 60;

      let countdownStr = '';
      if (hours > 0) {
        countdownStr += `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        countdownStr += `${minutes}m ${seconds}s`;
      } else {
        countdownStr += `${seconds}s`;
      }

      setSchedulerStatus({
        nextTriggerStr: nextInfo.timeStr,
        countdownStr,
        warningStr
      });
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);
    return () => clearInterval(interval);
  }, [schedulerEnabled, schedulerFrequency, schedulerTimes, selectedFixtureName, autoPublishState.isRunning, selectedAutoLanguages]);


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

  useEffect(() => {
    localStorage.setItem('yt_studio_render_concurrency', String(renderConcurrency));
  }, [renderConcurrency]);

  useEffect(() => {
    localStorage.setItem('yt_studio_selected_auto_languages', JSON.stringify(selectedAutoLanguages));
  }, [selectedAutoLanguages]);

  useEffect(() => {
    localStorage.setItem('yt_studio_uploaded_videos', JSON.stringify(uploadedVideos));
  }, [uploadedVideos]);

  // Load fixtures from server
  const loadFixtures = useCallback(async () => {
    try {
      // Use cache-busting query parameter to prevent browser caching of API responses
      const response = await fetch(`http://localhost:3001/api/fixtures?t=${Date.now()}`);
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
  }, []);

  useEffect(() => {
    loadFixtures();

    // Auto-reload fixtures when browser tab or window gains focus
    window.addEventListener('focus', loadFixtures);
    return () => {
      window.removeEventListener('focus', loadFixtures);
    };
  }, [loadFixtures]);

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recorderKey, setRecorderKey] = useState(0);
  const [manualStoryText, setManualStoryText] = useState<string>("");
  const [footballInput, setFootballInput] = useState<FootballInput>({ teamA: '', teamB: '', competition: '', extraContext: '' });
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  const [transcription, setTranscription] = useState<string>("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [kitAUrl, setKitAUrl] = useState<string>("");
  const [kitBUrl, setKitBUrl] = useState<string>("");
  const [isGeneratingKitA, setIsGeneratingKitA] = useState<boolean>(false);
  const [isGeneratingKitB, setIsGeneratingKitB] = useState<boolean>(false);
  const [storyContext, setStoryContext] = useState<string>("");
  const [historyData, setHistoryData] = useState<any>(null);
  const [teamAProfile, setTeamAProfile] = useState<any>(null);
  const [teamBProfile, setTeamBProfile] = useState<any>(null);
  const [scoreDecision, setScoreDecision] = useState<any>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  // Asset Gen Loading States
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [isGeneratingAllAudio, setIsGeneratingAllAudio] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [soloRunningLanguage, setSoloRunningLanguage] = useState<Language | null>(null);

  // Thumbnail
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailTopLeftText, setThumbnailTopLeftText] = useState("");
  const [thumbnailTitleText, setThumbnailTitleText] = useState("");
  const [thumbnailSubtitleText, setThumbnailSubtitleText] = useState("");
  const [thumbnailTopRightText, setThumbnailTopRightText] = useState("");
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [thumbnailStyle, setThumbnailStyle] = useState<ArtStyle | string>("");

  interface LocalizedThumbnail {
    url: string | null;
    topLeftText: string;
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
  const [youtubeConnections, setYoutubeConnections] = useState<Record<string, { isConnected: boolean; channel?: { title: string; avatar: string; customUrl: string } | null }>>({});
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeDescription, setYoutubeDescription] = useState("");
  const [youtubeTags, setYoutubeTags] = useState("story, AI");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishSuccessUrl, setPublishSuccessUrl] = useState<string | null>(null);
  const [serverVideoFilename, setServerVideoFilename] = useState<string | null>(null);
  const [autoPublishToYoutube, setAutoPublishToYoutube] = useState(false);
  const [sharedImagesMode, setSharedImagesMode] = useState(true);
  const sharedImageCacheRef = useRef<Record<number, Promise<string>>>({});

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
    return scenes.map((s, idx) => {
      let currentOverlays = s.overlays || [];
      let currentVoiceover = s.voiceoverScript;
      let currentImageOverlay = s.imageOverlayText;
      let currentTtsUrl = s.ttsAudioUrl;
      let currentIsGeneratingTts = s.isGeneratingTTS || false;
      let currentImageUrl = s.imageUrl;
      let currentMatchMinute = s.matchMinute;

      if (currentEditorLanguage !== Language.English) {
        const loc = s.localizations?.[currentEditorLanguage];
        if (loc) {
          if (loc.voiceoverScript) currentVoiceover = loc.voiceoverScript;
          if (loc.overlays) currentOverlays = loc.overlays;
          if (loc.imageOverlayText) currentImageOverlay = loc.imageOverlayText;
          if (loc.ttsAudioUrl !== undefined) currentTtsUrl = loc.ttsAudioUrl;
          if (loc.isGeneratingTTS !== undefined) currentIsGeneratingTts = loc.isGeneratingTTS;
          if (loc.imageUrl) currentImageUrl = loc.imageUrl;
          if (loc.matchMinute !== undefined) currentMatchMinute = loc.matchMinute;
        }
      }

      const paddedOverlays = (currentOverlays || []).map(o => {
        let text = o.text || '';
        if (o.style === 'stats-board' || (text.includes('|') && text.includes(':'))) {
          text = localizeFootballStatsString(text, currentEditorLanguage);
        }
        return {
          text,
          style: o.style || 'comic-box',
          startSecond: typeof o.startSecond === 'number' ? o.startSecond : 0,
          duration: typeof o.duration === 'number' ? o.duration : 5
        };
      });
      while (paddedOverlays.length < 3) {
        paddedOverlays.push({
          text: '',
          style: 'comic-box' as const,
          startSecond: 0,
          duration: 5
        });
      }

      if (idx === 0 && historyData) {
        const labels = getStatsLabels(currentEditorLanguage);
        const teamAName = s.teamA || footballInput.teamA || "Team A";
        const teamBName = s.teamB || footballInput.teamB || "Team B";
        const wcA = historyData.teamA?.worldCupTitles || "0";
        const wcB = historyData.teamB?.worldCupTitles || "0";
        const bestA = historyData.teamA?.bestFinish || "N/A";
        const bestB = historyData.teamB?.bestFinish || "N/A";
        const rankA = historyData.teamA?.fifaRanking || "N/A";
        const rankB = historyData.teamB?.fifaRanking || "N/A";
        const appsA = historyData.teamA?.worldCupAppearances || "N/A";
        const appsB = historyData.teamB?.worldCupAppearances || "N/A";
        const h2h = historyData.h2hRecord || "N/A";
        
        const statsText = `${labels.compare}: ${teamAName} - ${teamBName} | ${labels.worldCupTitles}: ${wcA} - ${wcB} | ${labels.bestFinish}: ${bestA} - ${bestB} | ${labels.fifaRanking}: ${rankA} - ${rankB} | ${labels.worldCupAppearances}: ${appsA} - ${appsB} | ${labels.h2hRecord}: ${h2h}`;
        paddedOverlays[1] = {
          text: statsText,
          style: 'stats-board',
          startSecond: 0.5,
          duration: 14.0
        };
      } else if (idx === 1 && teamAProfile && teamBProfile) {
        const labels = getStatsLabels(currentEditorLanguage);
        const coachA = teamAProfile.head_coach?.name || "Coach A";
        const coachB = teamBProfile.head_coach?.name || "Coach B";
        const formA = teamAProfile.head_coach?.preferred_formation || "N/A";
        const formB = teamBProfile.head_coach?.preferred_formation || "N/A";
        const styleA = teamAProfile.head_coach?.play_style_summary || "N/A";
        const styleB = teamBProfile.head_coach?.play_style_summary || "N/A";
        const statsText = `${labels.compare}: ${coachA} - ${coachB} | ${labels.formation}: ${formA} - ${formB} | ${labels.style}: ${styleA} - ${styleB}`;
        paddedOverlays[1] = {
          text: statsText,
          style: 'stats-board',
          startSecond: 0.5,
          duration: 14.0
        };
      } else if (idx === 2 && teamAProfile && teamBProfile) {
        const labels = getStatsLabels(currentEditorLanguage);
        const playerA = teamAProfile.key_players?.[0]?.name || "Player A";
        const playerB = teamBProfile.key_players?.[0]?.name || "Player B";
        const posA = teamAProfile.key_players?.[0]?.position || "Forward";
        const posB = teamBProfile.key_players?.[0]?.position || "Forward";
        const ageA = teamAProfile.key_players?.[0]?.age || "N/A";
        const ageB = teamBProfile.key_players?.[0]?.age || "N/A";
        const goalsA = typeof teamAProfile.key_players?.[0]?.goals === 'number' ? teamAProfile.key_players[0].goals : "0";
        const goalsB = typeof teamBProfile.key_players?.[0]?.goals === 'number' ? teamBProfile.key_players[0].goals : "0";
        const assistsA = typeof teamAProfile.key_players?.[0]?.assists === 'number' ? teamAProfile.key_players[0].assists : "0";
        const assistsB = typeof teamBProfile.key_players?.[0]?.assists === 'number' ? teamBProfile.key_players[0].assists : "0";
        const valA = normalizeMarketValue(teamAProfile.key_players?.[0]?.market_value || "N/A");
        const valB = normalizeMarketValue(teamBProfile.key_players?.[0]?.market_value || "N/A");
        const perfA = teamAProfile.key_players?.[0]?.performance_stats || "N/A";
        const perfB = teamBProfile.key_players?.[0]?.performance_stats || "N/A";
        const statsText = `${labels.compare}: ${playerA} - ${playerB} | ${labels.position}: ${posA} - ${posB} | ${labels.age}: ${ageA} - ${ageB} | ${labels.goals}: ${goalsA} - ${goalsB} | ${labels.assists}: ${assistsA} - ${assistsB} | ${labels.marketValue}: ${valA} - ${valB} | ${labels.performance}: ${perfA} - ${perfB}`;
        paddedOverlays[1] = {
          text: statsText,
          style: 'stats-board',
          startSecond: 0.5,
          duration: 14.0
        };
      } else if (idx === scenes.length - 2 && scoreDecision && scoreDecision.teamStats) {
        const labels = getStatsLabels(currentEditorLanguage);
        const stats = scoreDecision.teamStats;
        const statsText = `${labels.score}: ${scoreDecision.finalScore} | ${labels.possession}: ${stats.teamA.possessionPercent}% - ${stats.teamB.possessionPercent}% | ${labels.shots}: ${stats.teamA.totalShots} - ${stats.teamB.totalShots} | ${labels.onTarget}: ${stats.teamA.shotsOnTarget} - ${stats.teamB.shotsOnTarget} | ${labels.xg}: ${stats.teamA.expectedGoalsXg} - ${stats.teamB.expectedGoalsXg} | ${labels.corners}: ${stats.teamA.cornerKicks} - ${stats.teamB.cornerKicks} | ${labels.fouls}: ${stats.teamA.foulsCommitted} - ${stats.teamB.foulsCommitted}`;
        paddedOverlays[1] = {
          text: statsText,
          style: 'stats-board',
          startSecond: 0.5,
          duration: 14.0
        };
      }

      return {
        ...s,
        voiceoverScript: currentVoiceover,
        overlays: paddedOverlays.slice(0, 3),
        imageOverlayText: currentImageOverlay,
        ttsAudioUrl: currentTtsUrl,
        isGeneratingTTS: currentIsGeneratingTts,
        imageUrl: currentImageUrl,
        matchMinute: currentMatchMinute,
        language: currentEditorLanguage,
        teamA: (s as any).teamA || (inputs.appMode === AppMode.Football ? footballInput.teamA : undefined),
        teamB: (s as any).teamB || (inputs.appMode === AppMode.Football ? footballInput.teamB : undefined)
      };
    });
  }, [scenes, currentEditorLanguage, footballInput, inputs.appMode, historyData, teamAProfile, teamBProfile, scoreDecision]);

  // Fetch team profiles and sim results for manual mode / editor view
  useEffect(() => {
    let active = true;
    const loadProfileData = async () => {
      const teamA = footballInput.teamA;
      const teamB = footballInput.teamB;
      const comp = footballInput.competition;
      
      if (!teamA || !teamB) {
        if (active) {
          setTeamAProfile(null);
          setTeamBProfile(null);
          setScoreDecision(null);
          setKitAUrl("");
          setKitBUrl("");
        }
        return;
      }

      const matchKey = getMatchKey({ teamA, teamB, tournament: comp });
      const currentLang = currentEditorLanguage || Language.English;

      // 1. Fetch sim_result.json to set historyData and scoreDecision if missing/cacheable
      try {
        const simRes = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&fileName=sim_result.json`).then(r => r.json());
        if (simRes.exists && simRes.data && active) {
          if (simRes.data.historyData) setHistoryData(simRes.data.historyData);
          if (simRes.data.scoreDecision) setScoreDecision(simRes.data.scoreDecision);
        }
      } catch (e) {
        console.warn("Error pre-fetching sim_result.json for editor:", e);
      }

      // 2. Fetch Team A Profile
      let profileA = null;
      try {
        const fileA = `team_a_profile_${currentLang}.json`;
        const resA = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${currentLang}&fileName=${fileA}`).then(r => r.json());
        if (resA.exists && resA.data && Object.keys(resA.data).length > 0) {
          profileA = resA.data;
        } else {
          // Fallback to raw cached profile from server
          const cleanName = teamA.toLowerCase().replace(/[^a-z0-9_-]/g, '');
          const fallbackRes = await fetch(`http://localhost:3001/api/teams/${cleanName}`);
          if (fallbackRes.ok) {
            profileA = await fallbackRes.json();
          }
        }
      } catch (e) {
        console.warn("Error fetching team A profile for editor:", e);
      }

      // 3. Fetch Team B Profile
      let profileB = null;
      try {
        const fileB = `team_b_profile_${currentLang}.json`;
        const resB = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${currentLang}&fileName=${fileB}`).then(r => r.json());
        if (resB.exists && resB.data && Object.keys(resB.data).length > 0) {
          profileB = resB.data;
        } else {
          // Fallback to raw cached profile from server
          const cleanName = teamB.toLowerCase().replace(/[^a-z0-9_-]/g, '');
          const fallbackRes = await fetch(`http://localhost:3001/api/teams/${cleanName}`);
          if (fallbackRes.ok) {
            profileB = await fallbackRes.json();
          }
        }
      } catch (e) {
        console.warn("Error fetching team B profile for editor:", e);
      }

      // 4. Fetch Kits
      try {
        const [checkA, checkB] = await Promise.all([
          fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&fileName=kit_A.png`).then(r => r.json()),
          fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&fileName=kit_B.png`).then(r => r.json())
        ]);
        if (active) {
          setKitAUrl(checkA.exists && checkA.url ? checkA.url : "");
          setKitBUrl(checkB.exists && checkB.url ? checkB.url : "");
        }
      } catch (e) {
        console.warn("Error pre-fetching kit files:", e);
      }

      if (active) {
        setTeamAProfile(profileA);
        setTeamBProfile(profileB);
      }
    };

    loadProfileData();
    return () => {
      active = false;
    };
  }, [footballInput.teamA, footballInput.teamB, footballInput.competition, currentEditorLanguage]);

  // Blocking Check
  const hasCharacters = characters.length > 0;
  const hasKits = inputs.appMode === AppMode.Football ? (!!kitAUrl && !!kitBUrl) : true;
  const isReadyForSceneGeneration = characters.every(c => !!c.referenceImageUrl) && hasKits;

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
      sharedImageCacheRef.current = {};
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
        setHistoryData(result.historyData || null);
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
            return `🎬 AI Cinematic Story: ${footballInput.teamA} vs ${footballInput.teamB} | ${baseTournament}, ${groupText}\nTactical simulation analysis of ${footballInput.teamA} vs ${footballInput.teamB} in ${baseTournament}, ${groupText}.\nWe don’t guess; we calculate. Football Simulator is a digital laboratory that leverages advanced data models and cutting-edge algorithms to generate the world’s most accurate and realistic football match simulations.\nWe simulate every single fixture 10,000 times in our proprietary data engine. Current team form, player heat maps, xG (expected goals) metrics, injuries, and off-pitch breaking news are directly fed into our algorithm. The result? Not just a random score prediction, but an in-depth, cinematic football documentary that reveals the flow of the game, tactical breaking points, and the most probable scenarios.`;
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
                topLeftText: suggestions.topLeftText,
                titleText: suggestions.titleText,
                subtitleText: suggestions.subtitleText,
                topRightText: suggestions.topRightText,
                prompt: suggestions.customVisualPrompt,
                style: inputs.artStyle
              }
            });

            // Also sync the default single-language states
            setThumbnailTopLeftText(suggestions.topLeftText);
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

  const handleGenerateKit = async (teamKey: 'A' | 'B') => {
    const teamName = teamKey === 'A' ? footballInput.teamA : footballInput.teamB;
    const profile = teamKey === 'A' ? teamAProfile : teamBProfile;
    if (!teamName) return;

    const setGenerating = teamKey === 'A' ? setIsGeneratingKitA : setIsGeneratingKitB;
    const setUrl = teamKey === 'A' ? setKitAUrl : setKitBUrl;

    setGenerating(true);
    await executeWithAuthHandler(async () => {
      try {
        const matchKey = getMatchKey({
          teamA: footballInput.teamA,
          teamB: footballInput.teamB,
          tournament: footballInput.competition
        });
        
        const kitColors = profile?.kit_colors?.home || {
          primary_color: teamKey === 'A' ? 'red' : 'blue',
          secondary_color: 'white',
          pattern: 'solid'
        };

        const url = await generateKitReferenceImage(
          teamName,
          'home',
          kitColors,
          inputs.artStyle,
          inputs.imageGenerator
        );

        const saveRes = await fetch('http://localhost:3001/api/auto-assets/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchKey, fileName: `kit_${teamKey}.png`, content: url })
        }).then(r => r.json());

        setUrl(saveRes.url || url);
      } finally {
        setGenerating(false);
      }
    });
  };

  const handleUploadKit = async (teamKey: 'A' | 'B', file: File) => {
    if (!file) return;
    const setGenerating = teamKey === 'A' ? setIsGeneratingKitA : setIsGeneratingKitB;
    const setUrl = teamKey === 'A' ? setKitAUrl : setKitBUrl;

    setGenerating(true);
    try {
      const matchKey = getMatchKey({
        teamA: footballInput.teamA,
        teamB: footballInput.teamB,
        tournament: footballInput.competition
      });

      const storedUrl = await AssetStorage.saveAsset(`kit_${teamKey}_${Date.now()}`, file);

      const saveRes = await fetch('http://localhost:3001/api/auto-assets/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchKey, fileName: `kit_${teamKey}.png`, content: storedUrl })
      }).then(r => r.json());

      setUrl(saveRes.url || storedUrl);
    } catch (e) {
      console.error("Kit upload failed", e);
      alert("Failed to upload kit reference image.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateCharacterRef = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    updateCharacter(charId, { isGenerating: true });
    await executeWithAuthHandler(async () => {
      try {
        let kitUrl = "";
        if (inputs.appMode === AppMode.Football) {
          const teamKey = char.id.includes(`_${footballInput.teamA.replace(/\s+/g, '_')}`) ? 'A' : 'B';
          kitUrl = teamKey === 'A' ? kitAUrl : kitBUrl;
        }

        const url = await generateCharacterReference(char, inputs.artStyle, storyContext, inputs.imageGenerator, kitUrl);
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
        let imageUrl = "";
        let imgPromise = sharedImageCacheRef.current[id];

        if (sharedImagesMode && imgPromise) {
          imageUrl = await imgPromise;
          console.info(`🎯 [App:Image] Reusing cached image for Scene ${id + 1}: ${imageUrl}`);
        } else {
          const currentLoc = scene?.localizations?.[currentEditorLanguage];
          const sceneInvolvedIds = currentLoc?.involvedCharacterIds || scene?.involvedCharacterIds || [];
          const cleanPrompt = sharedImagesMode
            ? `${prompt} Do not generate any text, words, labels, numbers, letters, names, scoreboards, banners, UI elements, or strings directly on the image itself. Render a clean background visual only.`
            : prompt;

          const generationPromise = (async () => {
            const kitReferenceUrls: string[] = [];
            if (inputs.appMode === AppMode.Football) {
              if (kitAUrl) kitReferenceUrls.push(kitAUrl);
              if (kitBUrl) kitReferenceUrls.push(kitBUrl);
            }

            return await generateImage(
              cleanPrompt,
              scene?.selectedArtStyle || inputs.artStyle,
              inputs.aspectRatio,
              storyContext,
              characters,
              undefined, // Bypassed overlay text rendering on the image itself
              sceneInvolvedIds,
              scene?.voiceoverScript,
              scene?.id,
              inputs.imageGenerator,
              kitReferenceUrls
            );
          })();

          if (sharedImagesMode) {
            sharedImageCacheRef.current[id] = generationPromise;
          }
          imageUrl = await generationPromise;
        }

        updateScene(id, { 
          imageUrl, 
          isGeneratingImage: false,
          localizations: {
            ...scene?.localizations,
            [currentEditorLanguage]: {
              ...(scene?.localizations?.[currentEditorLanguage] || { voiceoverScript: '', overlays: [] }),
              imageUrl
            }
          }
        });
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
    const isTopLeftEmpty = !currentLoc?.topLeftText?.trim();

    if (isTitleEmpty || isSubtitleEmpty || isTopRightEmpty || isTopLeftEmpty) {
      const defaultTitle = `${footballInput.teamA.trim() || 'Team A'} vs ${footballInput.teamB.trim() || 'Team B'}`;
      const defaultSubtitle = footballInput.competition.trim() || 'FIFA-2026 World Cup, Group-A';
      const defaultTopRight = "10K Times Simulated with AI";
      const defaultTopLeft = "WINNER PREDICTED!";

      const englishThumb = activeThumbnailLocalizations[Language.English] || {
        url: null,
        topLeftText: thumbnailTopLeftText || "",
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
      const baseTopLeftToTranslate = englishThumb.topLeftText.trim() || defaultTopLeft;

      if (targetLanguage === Language.English) {
        const prevLoc = activeThumbnailLocalizations[Language.English] || {
          url: activeBaseUrl,
          topLeftText: "",
          titleText: "",
          subtitleText: "",
          topRightText: "",
          prompt: thumbnailPrompt || englishThumb.prompt || "",
          style: thumbnailStyle || englishThumb.style || inputs.artStyle || ""
        };
        const updatedLoc = {
          ...prevLoc,
          url: activeBaseUrl,
          topLeftText: isTopLeftEmpty ? baseTopLeftToTranslate : prevLoc.topLeftText,
          titleText: isTitleEmpty ? baseTitleToTranslate : prevLoc.titleText,
          subtitleText: isSubtitleEmpty ? baseSubtitleToTranslate : prevLoc.subtitleText,
          topRightText: isTopRightEmpty ? baseTopRightToTranslate : prevLoc.topRightText
        };
        const nextMap = {
          ...activeThumbnailLocalizations,
          [Language.English]: updatedLoc
        };
        setThumbnailLocalizations(nextMap);

        if (isTopLeftEmpty) setThumbnailTopLeftText(baseTopLeftToTranslate);
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
            baseTopLeftToTranslate,
            targetLanguage
          );

          const prevLoc = activeThumbnailLocalizations[targetLanguage] || {
            url: activeBaseUrl,
            topLeftText: "",
            titleText: "",
            subtitleText: "",
            topRightText: "",
            prompt: englishThumb.prompt || thumbnailPrompt || "",
            style: englishThumb.style || thumbnailStyle || inputs.artStyle || ""
          };
          const updatedLoc = {
            ...prevLoc,
            url: activeBaseUrl,
            topLeftText: isTopLeftEmpty ? localizedMeta.topLeftText : prevLoc.topLeftText,
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
    targetLangs?: Language | Language[],
    maxRetries = 3
  ): Promise<T> => {
    let ret = 0;
    while (true) {
      try {
        console.info(`🔄 [AutoMode] Starting step: "${label}" (attempt ${ret + 1}/${maxRetries + 1})`);
        const statusMsg = `${label} (Attempt ${ret + 1}/${maxRetries + 1})...`;
        setAutoPublishState(prev => ({
          ...prev,
          currentSubStep: stepName,
          statusMessage: statusMsg,
          retries: ret
        }));

        if (targetLangs) {
          const langs = Array.isArray(targetLangs) ? targetLangs : [targetLangs];
          setLangPipelineSteps(prev => {
            const next = { ...prev };
            langs.forEach(lang => {
              next[lang] = {
                ...next[lang],
                subStep: stepName,
                statusMessage: statusMsg,
                retries: ret
              };
            });
            return next;
          });
        }

        return await fn();
      } catch (err: any) {
        console.error(`❌ [AutoMode] Step "${label}" failed:`, err);
        ret++;
        const errMsg = `Error at "${label}" (Attempt ${ret}): ${err.message || String(err)}`;
        setAutoPublishState(prev => ({
          ...prev,
          errorLog: [...prev.errorLog, errMsg]
        }));

        if (targetLangs) {
          const langs = Array.isArray(targetLangs) ? targetLangs : [targetLangs];
          setLangPipelineSteps(prev => {
            const next = { ...prev };
            langs.forEach(lang => {
              next[lang] = {
                ...next[lang],
                errorLog: [...(next[lang]?.errorLog || []), errMsg]
              };
            });
            return next;
          });
        }

        if (ret > maxRetries) {
          throw err;
        }
        const delayMs = ret * 5000;
        console.info(`🔄 [AutoMode] Waiting ${delayMs / 1000}s before retrying...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  };

  const getMatchKey = (match: { teamA: string; teamB: string; tournament: string }) => {
    return `${match.teamA}_vs_${match.teamB}_${match.tournament}`.replace(/[^a-z0-9_-]/gi, '_');
  };

  const startSoloAutoMode = async (lang: Language) => {
    isStopRequestedRef.current = false;
    setSoloRunningLanguage(lang);
    setAutoPublishState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      errorLog: []
    }));
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

  const handleResetEngineState = async () => {
    if (window.confirm("Are you sure you want to reset the Auto Mode pipeline state and clear all generated assets for this match? This will allow you to start from scratch.")) {
      // Clear backend directory cache if match is pending
      const fixture = fixtureFiles.find(f => f.name === selectedFixtureName);
      if (fixture) {
        const matches = parseFixtureMatches(fixture.content);
        const pendingMatch = matches.find(m => !m.isCompleted);
        if (pendingMatch) {
          const matchKey = getMatchKey(pendingMatch);
          try {
            await fetch('http://localhost:3001/api/auto-assets/reset', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ matchKey })
            });
            console.info(`🗑️ [AutoMode] Asset directory reset successfully for key: ${matchKey}`);
          } catch (err) {
            console.error("⚠️ [AutoMode] Failed to reset backend asset directory:", err);
          }
        }
      }

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
      sharedImageCacheRef.current = {};
      setScenes([]);
      setCharacters([]);
      setStoryContext("");
      setHistoryData(null);
      setThumbnailUrl(null);
      setThumbnailTopLeftText("");
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
    const pipelineDurationMinutes = inputs.durationMinutes === DEFAULT_DURATION ? 6 : (inputs.durationMinutes || 6);

    // Calculate active languages early and validate
    const activeLanguages = soloRunningLanguage 
      ? [soloRunningLanguage]
      : [Language.English, Language.Turkish, Language.Spanish, Language.Portuguese, Language.French, Language.German]
          .filter(lang => selectedAutoLanguages.includes(lang));

    if (activeLanguages.length === 0) {
      const errMsg = "No languages selected for video creation. Please select at least one language in the connection grid.";
      setAutoPublishState(prev => ({
        ...prev,
        isRunning: false,
        statusMessage: `Failed: ${errMsg}`
      }));
      alert(`⚠️ ${errMsg}`);
      isPipelineRunningRef.current = false;
      return;
    }

    // Reset language pipeline states
    setLangPipelineSteps(prev => {
      const next = { ...prev };
      [Language.English, Language.Turkish, Language.Spanish, Language.Portuguese, Language.French, Language.German].forEach(lang => {
        const isActive = activeLanguages.includes(lang);
        next[lang] = {
          subStep: 'idle',
          statusMessage: isActive ? 'Initializing...' : 'Excluded from auto publish.',
          errorLog: [],
          retries: 0
        };
      });
      return next;
    });

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

      const matchKey = getMatchKey(pendingMatch);
      console.info(`⚽ [AutoMode] Next pending match: ${pendingMatch.teamA} vs ${pendingMatch.teamB} (Match Key: ${matchKey})`);

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
        durationMinutes: prev.durationMinutes === DEFAULT_DURATION ? 6 : (prev.durationMinutes || 6),
        imageIntervalMinutes: 0.5,
        targetLanguage: Language.English,
        voice: activeVoice
      }));

      // --- PHASE 1: GOSSIP, PROFILES, & SIMULATION SCORE ---
      let simResult;
      const simResultCheck = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&fileName=sim_result.json`).then(r => r.json());
      if (simResultCheck.exists && simResultCheck.data) {
        console.info(`🎯 [AutoMode] Found existing simulation reasoning locally for ${matchKey}. Resuming...`);
        simResult = simResultCheck.data;

        // Self-healing: If teamAData or teamBData is empty/missing, re-fetch it using getTeamProfileHelper
        let healed = false;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
        if (!simResult.teamAData || Object.keys(simResult.teamAData).length === 0) {
          console.info(`🔧 [AutoMode] Self-healing: teamAData is empty in cached sim_result.json. Re-fetching for ${pendingMatch.teamA}...`);
          simResult.teamAData = await getTeamProfileHelper(pendingMatch.teamA, ai);
          healed = true;
        }
        if (!simResult.teamBData || Object.keys(simResult.teamBData).length === 0) {
          console.info(`🔧 [AutoMode] Self-healing: teamBData is empty in cached sim_result.json. Re-fetching for ${pendingMatch.teamB}...`);
          simResult.teamBData = await getTeamProfileHelper(pendingMatch.teamB, ai);
          healed = true;
        }

        if (healed) {
          // Save the healed sim_result back to the server
          await fetch('http://localhost:3001/api/auto-assets/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchKey, fileName: 'sim_result.json', content: simResult })
          });
          console.info(`🔧 [AutoMode] Saved healed sim_result.json to server.`);
        }
      } else {
        simResult = await executeStepWithRetry(
          `Run Football Simulation Reasoning`,
          'script',
          async () => {
            const result = await runMatchSimulationEngine(
              pendingMatch.teamA,
              pendingMatch.teamB,
              pendingMatch.tournament,
              `Stadium: ${pendingMatch.stadium}, Date: ${pendingMatch.date}`
            );
            // Save to server local assets
            await fetch('http://localhost:3001/api/auto-assets/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ matchKey, fileName: 'sim_result.json', content: result })
            });
            return result;
          },
          activeLanguages
        );
      }

      const { gossipSummary, teamAData, teamBData, scoreDecision, historyData } = simResult;
      setHistoryData(historyData || null);
      const combinedExtraContext = gossipSummary 
        ? `--- GOSSIP, NEWS, & RUMORS (GROUNDED SEARCH) ---\n${gossipSummary}\n\n--- USER CONTEXT ---\nStadium: ${pendingMatch.stadium}, Date: ${pendingMatch.date}`
        : `Stadium: ${pendingMatch.stadium}, Date: ${pendingMatch.date}`;

      // --- PHASE 2: COMMON MATCH VISUAL STORYBOARD ---
      const totalSceneCount = Math.floor(pipelineDurationMinutes / 0.5) + 1;
      const durationPerSceneSeconds = (pipelineDurationMinutes * 60) / totalSceneCount;

      let visualScenes;
      const visualScenesCheck = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&fileName=visual_scenes.json`).then(r => r.json());
      if (visualScenesCheck.exists && visualScenesCheck.data) {
        console.info(`🎯 [AutoMode] Found existing visual storyboard locally for ${matchKey}. Resuming...`);
        visualScenes = visualScenesCheck.data;
      } else {
        visualScenes = await executeStepWithRetry(
          `Generate Common Visual Storyboard`,
          'script',
          async () => {
            const result = await generateMatchVisualPrompts(
              pendingMatch.teamA,
              pendingMatch.teamB,
              pendingMatch.tournament,
              combinedExtraContext,
              scoreDecision,
              totalSceneCount,
              teamAData,
              teamBData
            );
            // Save to server local assets
            await fetch('http://localhost:3001/api/auto-assets/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ matchKey, fileName: 'visual_scenes.json', content: result })
            });
            return result;
          },
          activeLanguages
        );
      }

      // Reset global simulator UI states
      sharedImageCacheRef.current = {};
      setScenes([]);
      setCharacters([]);
      setStoryContext(`Tactical simulation analysis of ${pendingMatch.teamA} vs ${pendingMatch.teamB} in ${pendingMatch.tournament || 'friendly'}.`);
      setHistoryData(null);

      // --- PHASE 2.5: EXTRACT PLAYER REGISTRY & GENERATE CHARACTER REFERENCES ---
      const autoCharacters: Character[] = [];
      const addTeamCharacters = (data: any, teamLabel: string) => {
        if (!data) return;
        if (data.head_coach && data.head_coach.name) {
          autoCharacters.push({
            id: `char_coach_${teamLabel.replace(/\s+/g, '_')}`,
            name: data.head_coach.name,
            description: `${data.head_coach.name}, Head Coach of ${teamLabel}. Preferred formation: ${data.head_coach.preferred_formation || 'Unknown'}. Play style: ${data.head_coach.play_style_summary || 'Unknown'}`
          });
        }
        if (Array.isArray(data.key_players)) {
          data.key_players.forEach((p: any, idx: number) => {
            if (p.name) {
              autoCharacters.push({
                id: `char_player_${teamLabel.replace(/\s+/g, '_')}_${idx}`,
                name: p.name,
                description: `${p.name}, key player for ${teamLabel}. Position: ${p.position || 'Unknown'}. Market value: ${p.market_value || 'Unknown'}. Form/Stats: ${p.performance_stats || 'Unknown'}`
              });
            }
          });
        }
      };

      addTeamCharacters(teamAData, pendingMatch.teamA);
      addTeamCharacters(teamBData, pendingMatch.teamB);

      // Save to state so they are visible in the UI
      setCharacters(autoCharacters);

      const storyContextText = `Tactical simulation analysis of ${pendingMatch.teamA} vs ${pendingMatch.teamB} in ${pendingMatch.tournament || 'friendly'}.`;

      // --- PHASE 2.6: GENERATE TEAM KIT REFERENCE IMAGES (ONE PER TEAM) ---
      const kitReferenceUrls: Record<string, string> = {};
      const teamsToProcess = [
        { key: 'A', name: pendingMatch.teamA, data: teamAData },
        { key: 'B', name: pendingMatch.teamB, data: teamBData }
      ];

      for (const t of teamsToProcess) {
        const kitFilename = `kit_${t.key}.png`;
        const kitCheck = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&fileName=${kitFilename}`).then(r => r.json());
        if (kitCheck.exists && kitCheck.url) {
          console.info(`🎯 [AutoMode] Found cached kit reference locally for ${t.name}: ${kitCheck.url}`);
          kitReferenceUrls[t.key] = kitCheck.url;
          if (t.key === 'A') setKitAUrl(kitCheck.url);
          else setKitBUrl(kitCheck.url);
        } else {
          if (t.data?.kit_colors?.home) {
            const kitUrl = await executeStepWithRetry(
              `Generate Kit Reference Image for ${t.name}`,
              'assets',
              async () => {
                const url = await apiOrchestrator.enqueue(() => generateKitReferenceImage(
                  t.name,
                  'home',
                  t.data.kit_colors.home,
                  inputs.artStyle,
                  inputs.imageGenerator
                ));
                const saveRes = await fetch('http://localhost:3001/api/auto-assets/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ matchKey, fileName: kitFilename, content: url })
                }).then(r => r.json());
                return saveRes.url || url;
              }
            );
            kitReferenceUrls[t.key] = kitUrl;
            if (t.key === 'A') setKitAUrl(kitUrl);
            else setKitBUrl(kitUrl);
          }
        }
      }

      if (autoCharacters.length > 0) {
        console.info(`⚽ [AutoMode] Generating character references for ${autoCharacters.length} registry entries...`);
        const charRefPromises = autoCharacters.map(async (char, cIdx) => {
          const charFile = `char_${char.id}.png`;
          const charCheck = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&fileName=${charFile}`).then(r => r.json());
          if (charCheck.exists && charCheck.url) {
            console.info(`🎯 [AutoMode] Found character reference locally: ${char.name}`);
            char.referenceImageUrl = charCheck.url;
            setCharacters(prev => prev.map(c => c.id === char.id ? { ...c, referenceImageUrl: charCheck.url } : c));
            return charCheck.url;
          }

          return await executeStepWithRetry(
            `Generate Character Reference for ${char.name}`,
            'assets',
            async () => {
              // Stagger call to avoid hitting rate limits
              await new Promise(r => setTimeout(r, cIdx * 3000));
              const teamKey = char.id.includes(`_${pendingMatch.teamA.replace(/\s+/g, '_')}`) ? 'A' : 'B';
              const kitUrl = kitReferenceUrls[teamKey] || "";
              const url = await apiOrchestrator.enqueue(() => generateCharacterReference(char, inputs.artStyle, storyContextText, inputs.imageGenerator, kitUrl));
              
              // Save to server local assets
              const saveRes = await fetch('http://localhost:3001/api/auto-assets/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchKey, fileName: charFile, content: url })
              }).then(r => r.json());

              const savedUrl = saveRes.url || url;
              char.referenceImageUrl = savedUrl;
              setCharacters(prev => prev.map(c => c.id === char.id ? { ...c, referenceImageUrl: savedUrl } : c));
              return savedUrl;
            },
            activeLanguages
          );
        });
        await Promise.all(charRefPromises);
      }

      const movementAnimations = [
        'animate-kb-zoom-in', 'animate-kb-zoom-out',
        'animate-kb-pan-right', 'animate-kb-pan-left',
        'animate-kb-diag-right-up', 'animate-kb-zoom-pan-right'
      ];

      const formatTime = (totalMinutes: number) => {
        const totalSeconds = Math.round(totalMinutes * 60);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };

      // --- PHASE 3: PARALLEL LOCALIZED LANGUAGE PIPELINES ---
      if (activeLanguages.length === 0) {
        throw new Error("No languages selected for video creation. Please select at least one language in the connection grid.");
      }
      
      const pipelinePromises = activeLanguages.map(async (currentLang, langIdx) => {
        // Staggered delay for starting Gemini script generation API call (7s interval between script calls)
        console.info(`🌐 [AutoMode] Scheduling localized pipeline for ${currentLang} (staggered delay: ${langIdx * 7}s)...`);
        await new Promise(r => setTimeout(r, langIdx * 7000));
        
        if (isStopRequestedRef.current) {
          console.info(`⏸️ [AutoMode] Pipeline run cancelled before starting ${currentLang}.`);
          return;
        }

        // Translate team profiles for this target language using Gemini
        const [localizedTeamAData, localizedTeamBData] = await Promise.all([
          executeStepWithRetry(
            `Translate Team A Profile (${currentLang})`,
            'script',
            async () => {
              const fileName = `team_a_profile_${currentLang}.json`;
              const check = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${currentLang}&fileName=${fileName}`).then(r => r.json());
              if (check.exists && check.data && Object.keys(check.data).length > 0) {
                return check.data;
              }
              const result = teamAData ? await translateTeamData(teamAData, currentLang) : null;
              if (result && Object.keys(result).length > 0) {
                await fetch('http://localhost:3001/api/auto-assets/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ matchKey, language: currentLang, fileName, content: result })
                });
              }
              return result;
            }
          ),
          executeStepWithRetry(
            `Translate Team B Profile (${currentLang})`,
            'script',
            async () => {
              const fileName = `team_b_profile_${currentLang}.json`;
              const check = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${currentLang}&fileName=${fileName}`).then(r => r.json());
              if (check.exists && check.data && Object.keys(check.data).length > 0) {
                return check.data;
              }
              const result = teamBData ? await translateTeamData(teamBData, currentLang) : null;
              if (result && Object.keys(result).length > 0) {
                await fetch('http://localhost:3001/api/auto-assets/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ matchKey, language: currentLang, fileName, content: result })
                });
              }
              return result;
            }
          )
        ]);

        // 1. Localized Script Generation Call
        let scriptResult;
        const scriptCheck = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${currentLang}&fileName=script_result.json`).then(r => r.json());
        if (scriptCheck.exists && scriptCheck.data) {
          console.info(`🎯 [AutoMode] Found existing script locally for ${currentLang}. Resuming...`);
          scriptResult = scriptCheck.data;
        } else {
          scriptResult = await executeStepWithRetry(
            `Generate Localized Script (${currentLang})`,
            'script',
            async () => {
              const result = await generateLocalizedFootballScript(
                currentLang,
                pendingMatch.teamA,
                pendingMatch.teamB,
                pendingMatch.tournament,
                combinedExtraContext,
                scoreDecision,
                visualScenes,
                totalSceneCount,
                pipelineDurationMinutes,
                activeVoice,
                autoCharacters,
                historyData,
                teamAData,
                teamBData
              );
              // Save to server local assets
              await fetch('http://localhost:3001/api/auto-assets/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchKey, language: currentLang, fileName: 'script_result.json', content: result })
              });
              return result;
            }
          );
        }

        // Integrate scenes into functional updates to prevent clobbering other languages in React state
        setScenes(prev => {
          const baseList = prev.length > 0 ? prev : scriptResult.scenes.map((s, idx) => {
            return {
              id: s.id,
              timeRange: `${formatTime((idx * durationPerSceneSeconds)/60)} - ${formatTime(((idx+1)*durationPerSceneSeconds)/60)}`,
              voiceoverScript: '',
              overlays: [],
              visualPrompt: visualScenes[idx]?.visual_description || '',
              animationStyles: [movementAnimations[idx % movementAnimations.length]],
              isGeneratingImage: false,
              isGeneratingImageEnd: false,
              isGeneratingVideo: false,
              isGeneratingVideoPrompt: false,
              isGeneratingTTS: false,
              selectedTone: idx === totalSceneCount - 1 ? TTSTone.Warm : TTSTone.Enthusiastic,
              selectedVoice: activeVoice,
              selectedArtStyle: (visualScenes[idx]?.art_style as any) || inputs.artStyle,
              selectedMusicId: s.background_audio_id || 'music_thrilling',
              selectedSfxId: s.sfx_audio_id || 'ambience_crowd',
              videoOptions: {
                duration: 6 as 4 | 6 | 8,
                resolution: '1080p' as '720p' | '1080p' | '1440p',
                generateAudio: true,
                aspectRatio: '16:9' as '16:9' | '9:16',
                numVideos: 1 as 1 | 2,
                placement: 'end' as 'start' | 'end'
              },
              hasShortVideo: false,
              teamA: pendingMatch.teamA,
              teamB: pendingMatch.teamB
            };
          });

          return baseList.map((s, idx) => {
            const matchScene = scriptResult.scenes[idx];
            if (!matchScene) return s;
            return {
              ...s,
              id: idx,
              localizations: {
                ...s.localizations,
                [currentLang]: {
                  voiceoverScript: matchScene.voiceover,
                  overlays: (() => {
                    const list = (matchScene.overlays || []).map((o, oIdx) => {
                      let text = o.text || '';
                      const style = determineOverlayStyle(text, oIdx);
                      if (style === 'stats-board' || (text.includes('|') && text.includes(':'))) {
                        text = localizeFootballStatsString(text, currentLang);
                      }
                      return {
                        text,
                        style,
                        startSecond: typeof o.startSecond === 'number' ? o.startSecond : 0,
                        duration: typeof o.duration === 'number' ? o.duration : 5
                      };
                    });
                    while (list.length < 3) {
                      list.push({
                        text: '',
                        style: 'comic-box' as const,
                        startSecond: 0,
                        duration: 5
                      });
                    }
                    if (idx === 0 && historyData) {
                      const labels = getStatsLabels(currentLang);
                      const wcA = historyData.teamA?.worldCupTitles || "0";
                      const wcB = historyData.teamB?.worldCupTitles || "0";
                      const bestA = historyData.teamA?.bestFinish || "N/A";
                      const bestB = historyData.teamB?.bestFinish || "N/A";
                      const rankA = historyData.teamA?.fifaRanking || "N/A";
                      const rankB = historyData.teamB?.fifaRanking || "N/A";
                      const appsA = historyData.teamA?.worldCupAppearances || "N/A";
                      const appsB = historyData.teamB?.worldCupAppearances || "N/A";
                      const h2h = historyData.h2hRecord || "N/A";
                      
                      const statsText = `${labels.compare}: ${pendingMatch.teamA} - ${pendingMatch.teamB} | ${labels.worldCupTitles}: ${wcA} - ${wcB} | ${labels.bestFinish}: ${bestA} - ${bestB} | ${labels.fifaRanking}: ${rankA} - ${rankB} | ${labels.worldCupAppearances}: ${appsA} - ${appsB} | ${labels.h2hRecord}: ${h2h}`;
                      list[1] = {
                        text: statsText,
                        style: 'stats-board',
                        startSecond: 0.5,
                        duration: 14.0
                      };
                    } else if (idx === 1 && localizedTeamAData && localizedTeamBData) {
                      const labels = getStatsLabels(currentLang);
                      const coachA = localizedTeamAData.head_coach?.name || "Coach A";
                      const coachB = localizedTeamBData.head_coach?.name || "Coach B";
                      const formA = localizedTeamAData.head_coach?.preferred_formation || "N/A";
                      const formB = localizedTeamBData.head_coach?.preferred_formation || "N/A";
                      const styleA = localizedTeamAData.head_coach?.play_style_summary || "N/A";
                      const styleB = localizedTeamBData.head_coach?.play_style_summary || "N/A";
                      const statsText = `${labels.compare}: ${coachA} - ${coachB} | ${labels.formation}: ${formA} - ${formB} | ${labels.style}: ${styleA} - ${styleB}`;
                      list[1] = {
                        text: statsText,
                        style: 'stats-board',
                        startSecond: 0.5,
                        duration: 14.0
                      };
                    } else if (idx === 2 && localizedTeamAData && localizedTeamBData) {
                      const labels = getStatsLabels(currentLang);
                      const playerA = localizedTeamAData.key_players?.[0]?.name || "Player A";
                      const playerB = localizedTeamBData.key_players?.[0]?.name || "Player B";
                      const posA = localizedTeamAData.key_players?.[0]?.position || "Forward";
                      const posB = localizedTeamBData.key_players?.[0]?.position || "Forward";
                      const ageA = localizedTeamAData.key_players?.[0]?.age || "N/A";
                      const ageB = localizedTeamBData.key_players?.[0]?.age || "N/A";
                      const goalsA = typeof localizedTeamAData.key_players?.[0]?.goals === 'number' ? localizedTeamAData.key_players[0].goals : "0";
                      const goalsB = typeof localizedTeamBData.key_players?.[0]?.goals === 'number' ? localizedTeamBData.key_players[0].goals : "0";
                      const assistsA = typeof localizedTeamAData.key_players?.[0]?.assists === 'number' ? localizedTeamAData.key_players[0].assists : "0";
                      const assistsB = typeof localizedTeamBData.key_players?.[0]?.assists === 'number' ? localizedTeamBData.key_players[0].assists : "0";
                      const valA = normalizeMarketValue(localizedTeamAData.key_players?.[0]?.market_value || "N/A");
                      const valB = normalizeMarketValue(localizedTeamBData.key_players?.[0]?.market_value || "N/A");
                      const perfA = localizedTeamAData.key_players?.[0]?.performance_stats || "N/A";
                      const perfB = localizedTeamBData.key_players?.[0]?.performance_stats || "N/A";
                      const statsText = `${labels.compare}: ${playerA} - ${playerB} | ${labels.position}: ${posA} - ${posB} | ${labels.age}: ${ageA} - ${ageB} | ${labels.goals}: ${goalsA} - ${goalsB} | ${labels.assists}: ${assistsA} - ${assistsB} | ${labels.marketValue}: ${valA} - ${valB} | ${labels.performance}: ${perfA} - ${perfB}`;
                      list[1] = {
                        text: statsText,
                        style: 'stats-board',
                        startSecond: 0.5,
                        duration: 14.0
                      };
                    } else if (idx === totalSceneCount - 2 && scoreDecision && scoreDecision.teamStats) {
                      const labels = getStatsLabels(currentLang);
                      const stats = scoreDecision.teamStats;
                      const statsText = `${labels.score}: ${scoreDecision.finalScore} | ${labels.possession}: ${stats.teamA.possessionPercent}% - ${stats.teamB.possessionPercent}% | ${labels.shots}: ${stats.teamA.totalShots} - ${stats.teamB.totalShots} | ${labels.onTarget}: ${stats.teamA.shotsOnTarget} - ${stats.teamB.shotsOnTarget} | ${labels.xg}: ${stats.teamA.expectedGoalsXg} - ${stats.teamB.expectedGoalsXg} | ${labels.corners}: ${stats.teamA.cornerKicks} - ${stats.teamB.cornerKicks} | ${labels.fouls}: ${stats.teamA.foulsCommitted} - ${stats.teamB.foulsCommitted}`;
                      list[1] = {
                        text: statsText,
                        style: 'stats-board',
                        startSecond: 0.5,
                        duration: 14.0
                      };
                    }
                    return list.slice(0, 3);
                  })(),
                  visualPrompt: matchScene.visual_description,
                  isGeneratingTTS: false,
                  isGeneratingImage: false,
                  involvedCharacterIds: matchScene.involved_character_ids || []
                }
              }
            };
          });
        });

        // Set localized thumbnail overlays
        const thumbMeta = scriptResult.thumbnail;
        setThumbnailLocalizations(prev => ({
          ...prev,
          [currentLang]: {
            url: null,
            topLeftText: thumbMeta.topLeftText || "",
            titleText: thumbMeta.titleText,
            subtitleText: thumbMeta.subtitleText,
            topRightText: thumbMeta.topRightText,
            prompt: thumbMeta.customVisualPrompt,
            style: inputs.artStyle
          }
        }));

        // YouTube metadata titles/descriptions
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

        // Check if YouTube metadata localization already exists
        let localizedMeta;
        const metaCheck = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${currentLang}&fileName=youtube_metadata.json`).then(r => r.json());
        if (metaCheck.exists && metaCheck.data) {
          localizedMeta = metaCheck.data;
        } else {
          const localizedTitle = `${thumbMeta.titleText} | ${baseTournament}, AI-Simulated 10K Times`;
          const englishMeta = {
            title: localizedTitle,
            description: `🎬 AI Cinematic Story: ${pendingMatch.teamA} vs ${pendingMatch.teamB} | ${baseTournament}, ${groupText}\nTactical simulation analysis of ${pendingMatch.teamA} vs ${pendingMatch.teamB} in ${baseTournament}, ${groupText}.\nGenerated with AI Creator Studio.\nWe don’t guess; we calculate. Football Simulator is a digital laboratory that leverages advanced data models and cutting-edge algorithms to generate the world’s most accurate and realistic football match simulations.\nWe simulate every single fixture 10,000 times in our proprietary data engine. Current team form, player heat maps, xG (expected goals) metrics, injuries, and off-pitch breaking news are directly fed into our algorithm. The result? Not just a random score prediction, but an in-depth, cinematic football documentary that reveals the flow of the game, tactical breaking points, and the most probable scenarios.`,
            tags: `AI, football, soccer, football simulator, world cup, fifa, fifa 2026, ${pendingMatch.teamA.toLowerCase()} football team, ${pendingMatch.teamB.toLowerCase()} football team`
          };
          localizedMeta = await localizeMetadata(englishMeta, currentLang);
          await fetch('http://localhost:3001/api/auto-assets/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchKey, language: currentLang, fileName: 'youtube_metadata.json', content: localizedMeta })
          });
        }
        
        setYoutubeMetadataLocalizations(prev => ({
          ...prev,
          [currentLang]: localizedMeta
        }));

        // Check existing assets on server
        const existingAssets: Record<string, string> = {};
        for (let idx = 0; idx < totalSceneCount; idx++) {
          const imgFile = `scene_${idx}_image.png`;
          const audioFile = `scene_${idx}_voiceover.wav`;
          
          const [imgCheck, audioCheck] = await Promise.all([
            fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${currentLang}&fileName=${imgFile}`).then(r => r.json()),
            fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${currentLang}&fileName=${audioFile}`).then(r => r.json())
          ]);
          
          let finalImgUrl = "";
          if (imgCheck.exists && imgCheck.url) {
            finalImgUrl = imgCheck.url;
          } else if (sharedImagesMode) {
            // Check fallback languages to see if the image was pregenerated elsewhere
            const fallbackLangs = [
              Language.English,
              Language.Turkish,
              Language.Spanish,
              Language.Portuguese,
              Language.French,
              Language.German,
              Language.Chinese,
              Language.Japanese,
              Language.Hindi,
              Language.Arabic
            ].filter(l => l !== currentLang);

            for (const fallbackLang of fallbackLangs) {
              try {
                const fallbackCheck = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${fallbackLang}&fileName=${imgFile}`).then(r => r.json());
                if (fallbackCheck.exists && fallbackCheck.url) {
                  finalImgUrl = fallbackCheck.url;
                  console.info(`🎯 [AutoMode] Found pre-generated image for Scene ${idx + 1} in fallback language (${fallbackLang}): ${fallbackCheck.url}`);
                  break;
                }
              } catch (e) {
                console.warn(`Failed to check existing image for fallback language ${fallbackLang}:`, e);
              }
            }
          }

          if (finalImgUrl) {
            existingAssets[imgFile] = finalImgUrl;
          }
          if (audioCheck.exists && audioCheck.url) {
            existingAssets[audioFile] = audioCheck.url;
          }
        }
        
        const thumbCleanCheck = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${currentLang}&fileName=thumbnail_clean.png`).then(r => r.json());
        const thumbBurnedCheck = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${currentLang}&fileName=thumbnail_burned.png`).then(r => r.json());
        
        if (thumbCleanCheck.exists && thumbCleanCheck.url) {
          existingAssets['thumbnail_clean.png'] = thumbCleanCheck.url;
        }
        if (thumbBurnedCheck.exists && thumbBurnedCheck.url) {
          existingAssets['thumbnail_burned.png'] = thumbBurnedCheck.url;
        }

        // 2. Localized Parallel Asset Generation (Spaces every API call by 3s via orchestrator)
        console.info(`🌐 [AutoMode] Launching asset generation tasks in parallel for ${currentLang}...`);
        const assetPromises: Promise<any>[] = [];

        // Scene Image and Audio TTS generation concurrently per scene
        for (let idx = 0; idx < totalSceneCount; idx++) {
          const targetScene = scriptResult.scenes[idx];
          const scenePrompt = targetScene?.visual_description || visualScenes[idx]?.visual_description;
          const sceneArtStyle = visualScenes[idx]?.art_style || inputs.artStyle;

          // Image generation task (enqueued to staggered orchestrator)
          const imgTask = executeStepWithRetry(
            `Generate Scene ${idx + 1} Image (${currentLang})`,
            'assets',
            async () => {
              const targetFilename = `scene_${idx}_image.png`;
              if (existingAssets[targetFilename]) {
                console.info(`🎯 [AutoMode:Image] Using existing image asset: ${targetFilename}`);
                const url = existingAssets[targetFilename];
                if (sharedImagesMode && !sharedImageCacheRef.current[idx]) {
                  sharedImageCacheRef.current[idx] = Promise.resolve(url);
                }
                setScenes(prev => prev.map(s => {
                  if (s.id !== idx) return s;
                  const prevLoc = s.localizations?.[currentLang] || { voiceoverScript: '', overlays: [] };
                  return {
                    ...s,
                    localizations: {
                      ...s.localizations,
                      [currentLang]: {
                        ...prevLoc,
                        imageUrl: url
                      }
                    }
                  };
                }));
                return url;
              }

              let url = "";
              const imgPromise = sharedImageCacheRef.current[idx];
              if (sharedImagesMode && imgPromise) {
                console.info(`🎯 [AutoMode:Image] Awaiting cached image Promise for Scene ${idx + 1} (${currentLang})...`);
                url = await imgPromise;
              } else {
                const cleanPrompt = sharedImagesMode
                  ? `${scenePrompt} Do not generate any text, words, labels, numbers, letters, names, scoreboards, banners, UI elements, or strings directly on the image itself. Render a clean background visual only.`
                  : scenePrompt;

                const generationPromise = (async () => {
                  const kitsInScene: string[] = [];
                  if (kitReferenceUrls['A']) kitsInScene.push(kitReferenceUrls['A']);
                  if (kitReferenceUrls['B']) kitsInScene.push(kitReferenceUrls['B']);

                  const dataUrl = await apiOrchestrator.enqueue(() => generateImage(
                    cleanPrompt,
                    sceneArtStyle,
                    inputs.aspectRatio,
                    `Tactical simulation analysis of ${pendingMatch.teamA} vs ${pendingMatch.teamB} in ${pendingMatch.tournament || 'friendly'}.`,
                    autoCharacters, // Use auto-generated characters with reference images
                    undefined, // Bypassed overlay text rendering on the image itself
                    targetScene?.involved_character_ids || [],
                    targetScene?.voiceover,
                    idx,
                    inputs.imageGenerator,
                    kitsInScene
                  ));
                  
                  // Save to server local assets
                  const saveRes = await fetch('http://localhost:3001/api/auto-assets/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ matchKey, language: currentLang, fileName: targetFilename, content: dataUrl })
                  }).then(r => r.json());
                  
                  return saveRes.url || dataUrl;
                })();

                if (sharedImagesMode) {
                  sharedImageCacheRef.current[idx] = generationPromise;
                }
                url = await generationPromise;
              }
              
              setScenes(prev => prev.map(s => {
                if (s.id !== idx) return s;
                const prevLoc = s.localizations?.[currentLang] || { voiceoverScript: '', overlays: [] };
                return {
                  ...s,
                  localizations: {
                    ...s.localizations,
                    [currentLang]: {
                      ...prevLoc,
                      imageUrl: url
                    }
                  }
                };
              }));
              return url;
            },
            currentLang
          );
          assetPromises.push(imgTask);

          // Voiceover TTS task (enqueued to staggered orchestrator)
          const ttsTask = executeStepWithRetry(
            `Generate Scene ${idx + 1} Voiceover Audio (${currentLang})`,
            'assets',
            async () => {
              const targetFilename = `scene_${idx}_voiceover.wav`;
              if (existingAssets[targetFilename]) {
                console.info(`🎯 [AutoMode:TTS] Using existing TTS audio asset: ${targetFilename}`);
                const url = existingAssets[targetFilename];
                setScenes(prev => prev.map(s => {
                  if (s.id !== idx) return s;
                  const prevLoc = s.localizations?.[currentLang] || { voiceoverScript: '', overlays: [] };
                  return {
                    ...s,
                    localizations: {
                      ...s.localizations,
                      [currentLang]: {
                        ...prevLoc,
                        voiceoverScript: targetScene?.voiceover || prevLoc.voiceoverScript || "",
                        ttsAudioUrl: url
                      }
                    }
                  };
                }));
                return url;
              }

              const res = await apiOrchestrator.enqueue(() => generateTTS(
                targetScene?.voiceover || "",
                activeVoice,
                idx === totalSceneCount - 1 ? TTSTone.Warm : TTSTone.Enthusiastic,
                inputs.speaker1Voice,
                inputs.speaker2Voice,
                currentLang
              ));

              // Save to server local assets
              const saveRes = await fetch('http://localhost:3001/api/auto-assets/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchKey, language: currentLang, fileName: targetFilename, content: res.audioUrl })
              }).then(r => r.json());
              
              const savedUrl = saveRes.url || res.audioUrl;

              setScenes(prev => prev.map(s => {
                if (s.id !== idx) return s;
                const prevLoc = s.localizations?.[currentLang] || { voiceoverScript: '', overlays: [] };
                return {
                  ...s,
                  localizations: {
                    ...s.localizations,
                    [currentLang]: {
                      ...prevLoc,
                      voiceoverScript: res.correctedText || prevLoc.voiceoverScript || targetScene?.voiceover || "",
                      ttsAudioUrl: savedUrl
                    }
                  }
                };
              }));
              return savedUrl;
            },
            currentLang
          );
          assetPromises.push(ttsTask);
        }

        // Localized Thumbnail task (enqueued to staggered orchestrator)
        const thumbTask = executeStepWithRetry(
          `Generate Thumbnail Image (${currentLang})`,
          'thumbnail',
          async () => {
            if (existingAssets['thumbnail_clean.png'] && existingAssets['thumbnail_burned.png']) {
              console.info(`🎯 [AutoMode:Thumbnail] Using existing clean & burned thumbnail assets.`);
              const cleanUrl = existingAssets['thumbnail_clean.png'];
              const burnedUrl = existingAssets['thumbnail_burned.png'];
              
              setThumbnailLocalizations(prev => ({
                ...prev,
                [currentLang]: {
                  ...prev[currentLang]!,
                  url: cleanUrl
                }
              }));

              setBurnedThumbnailUrls(prev => ({
                ...prev,
                [currentLang]: burnedUrl
              }));

              return { cleanUrl, burnedUrl };
            }

            const cleanUrl = await apiOrchestrator.enqueue(() => generateThumbnail(
              localizedMeta.title,
              inputs.artStyle,
              `Tactical simulation analysis of ${pendingMatch.teamA} vs ${pendingMatch.teamB} in ${pendingMatch.tournament || 'friendly'}.`,
              autoCharacters,
              thumbMeta.titleText,
              thumbMeta.subtitleText,
              thumbMeta.customVisualPrompt,
              inputs.imageGenerator
            ));

            const burnedUrl = await burnThumbnailText(
              cleanUrl,
              thumbMeta.titleText,
              thumbMeta.subtitleText,
              thumbMeta.topRightText,
              thumbMeta.topLeftText,
              pendingMatch.teamA,
              pendingMatch.teamB
            );

            // Save clean to server local assets
            const saveClean = await fetch('http://localhost:3001/api/auto-assets/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ matchKey, language: currentLang, fileName: 'thumbnail_clean.png', content: cleanUrl })
            }).then(r => r.json());
            
            // Save burned to server local assets
            const saveBurned = await fetch('http://localhost:3001/api/auto-assets/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ matchKey, language: currentLang, fileName: 'thumbnail_burned.png', content: burnedUrl })
            }).then(r => r.json());

            const cleanSavedUrl = saveClean.url || cleanUrl;
            const burnedSavedUrl = saveBurned.url || burnedUrl;

            setThumbnailLocalizations(prev => ({
              ...prev,
              [currentLang]: {
                ...prev[currentLang]!,
                url: cleanSavedUrl
              }
            }));

            setBurnedThumbnailUrls(prev => ({
              ...prev,
              [currentLang]: burnedSavedUrl
            }));

            return { cleanUrl: cleanSavedUrl, burnedUrl: burnedSavedUrl };
          },
          currentLang
        );
        assetPromises.push(thumbTask);

        // Wait for all assets (all images + all TTS audios + thumbnail) to finish generating
        const resolvedAssets = await Promise.all(assetPromises);
        const resolvedThumbnail = resolvedAssets[resolvedAssets.length - 1];

        // 3. Concurrency-Controlled Video Rendering
        let renderFilename: string | null = null;

        // Check if video is already rendered locally
        const videoCheck = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${currentLang}&fileName=rendered_video.mp4`).then(r => r.json());
        if (videoCheck.exists && videoCheck.url) {
          console.info(`🎯 [AutoMode] Video already rendered locally for ${currentLang}. Skipping rendering step.`);
          renderFilename = `auto_assets/${matchKey}/${currentLang}/rendered_video.mp4`;
          
          if (currentLang === Language.English) {
            setRenderedVideoUrl(videoCheck.url);
            setServerVideoFilename(renderFilename);
          }

          setLangPipelineSteps(prev => ({
            ...prev,
            [currentLang]: {
              ...prev[currentLang],
              statusMessage: `Video rendering complete (reused local).`
            }
          }));
        } else {
          console.info(`🎥 [AutoMode] Localized assets completed for ${currentLang}. Queuing for rendering...`);
          renderQueue.setMaxConcurrency(renderConcurrency);
          const releaseRender = await renderQueue.acquire();
          try {
            if (isStopRequestedRef.current) throw new Error("Pause requested before rendering starts.");

            const renderStatusMsg = `Rendering ${currentLang} video (concurrency locked)...`;
            setAutoPublishState(prev => ({
              ...prev,
              statusMessage: renderStatusMsg
            }));

            setLangPipelineSteps(prev => ({
              ...prev,
              [currentLang]: {
                ...prev[currentLang],
                subStep: 'render',
                statusMessage: renderStatusMsg
              }
            }));

            // Rebuild final scenes array for this language using the resolved URLs
            const finalScenes = scriptResult.scenes.map((s, idx) => {
              return {
                id: idx,
                imageUrl: resolvedAssets[2 * idx],
                ttsAudioUrl: resolvedAssets[2 * idx + 1],
                voiceoverScript: s.voiceover,
                overlays: (() => {
                  const list = (s.overlays || []).map((o, oIdx) => {
                    let text = o.text || '';
                    const style = determineOverlayStyle(text, oIdx);
                    if (style === 'stats-board' || (text.includes('|') && text.includes(':'))) {
                      text = localizeFootballStatsString(text, currentLang);
                    }
                    return {
                      text,
                      style,
                      startSecond: typeof o.startSecond === 'number' ? o.startSecond : 0,
                      duration: typeof o.duration === 'number' ? o.duration : 5
                    };
                  });
                  while (list.length < 3) {
                    list.push({
                      text: '',
                      style: 'comic-box' as const,
                      startSecond: 0,
                      duration: 5
                    });
                  }
                   if (idx === 0 && historyData) {
                     const labels = getStatsLabels(currentLang);
                     const wcA = historyData.teamA?.worldCupTitles || "0";
                     const wcB = historyData.teamB?.worldCupTitles || "0";
                     const bestA = historyData.teamA?.bestFinish || "N/A";
                     const bestB = historyData.teamB?.bestFinish || "N/A";
                     const rankA = historyData.teamA?.fifaRanking || "N/A";
                     const rankB = historyData.teamB?.fifaRanking || "N/A";
                     const appsA = historyData.teamA?.worldCupAppearances || "N/A";
                     const appsB = historyData.teamB?.worldCupAppearances || "N/A";
                     const h2h = historyData.h2hRecord || "N/A";
                     
                     const statsText = `${labels.compare}: ${pendingMatch.teamA} - ${pendingMatch.teamB} | ${labels.worldCupTitles}: ${wcA} - ${wcB} | ${labels.bestFinish}: ${bestA} - ${bestB} | ${labels.fifaRanking}: ${rankA} - ${rankB} | ${labels.worldCupAppearances}: ${appsA} - ${appsB} | ${labels.h2hRecord}: ${h2h}`;
                     list[1] = {
                       text: statsText,
                       style: 'stats-board',
                       startSecond: 0.5,
                       duration: 14.0
                     };
                   } else if (idx === 1 && localizedTeamAData && localizedTeamBData) {
                    const labels = getStatsLabels(currentLang);
                    const coachA = localizedTeamAData.head_coach?.name || "Coach A";
                    const coachB = localizedTeamBData.head_coach?.name || "Coach B";
                    const formA = localizedTeamAData.head_coach?.preferred_formation || "N/A";
                    const formB = localizedTeamBData.head_coach?.preferred_formation || "N/A";
                    const styleA = localizedTeamAData.head_coach?.play_style_summary || "N/A";
                    const styleB = localizedTeamBData.head_coach?.play_style_summary || "N/A";
                    const statsText = `${labels.compare}: ${coachA} - ${coachB} | ${labels.formation}: ${formA} - ${formB} | ${labels.style}: ${styleA} - ${styleB}`;
                    list[1] = {
                      text: statsText,
                      style: 'stats-board',
                      startSecond: 0.5,
                      duration: 14.0
                    };
                  } else if (idx === 2 && localizedTeamAData && localizedTeamBData) {
                    const labels = getStatsLabels(currentLang);
                    const playerA = localizedTeamAData.key_players?.[0]?.name || "Player A";
                    const playerB = localizedTeamBData.key_players?.[0]?.name || "Player B";
                    const posA = localizedTeamAData.key_players?.[0]?.position || "Forward";
                    const posB = localizedTeamBData.key_players?.[0]?.position || "Forward";
                    const ageA = localizedTeamAData.key_players?.[0]?.age || "N/A";
                    const ageB = localizedTeamBData.key_players?.[0]?.age || "N/A";
                    const goalsA = typeof localizedTeamAData.key_players?.[0]?.goals === 'number' ? localizedTeamAData.key_players[0].goals : "0";
                    const goalsB = typeof localizedTeamBData.key_players?.[0]?.goals === 'number' ? localizedTeamBData.key_players[0].goals : "0";
                    const assistsA = typeof localizedTeamAData.key_players?.[0]?.assists === 'number' ? localizedTeamAData.key_players[0].assists : "0";
                    const assistsB = typeof localizedTeamBData.key_players?.[0]?.assists === 'number' ? localizedTeamBData.key_players[0].assists : "0";
                    const valA = normalizeMarketValue(localizedTeamAData.key_players?.[0]?.market_value || "N/A");
                    const valB = normalizeMarketValue(localizedTeamBData.key_players?.[0]?.market_value || "N/A");
                    const perfA = localizedTeamAData.key_players?.[0]?.performance_stats || "N/A";
                    const perfB = localizedTeamBData.key_players?.[0]?.performance_stats || "N/A";
                    const statsText = `${labels.compare}: ${playerA} - ${playerB} | ${labels.position}: ${posA} - ${posB} | ${labels.age}: ${ageA} - ${ageB} | ${labels.goals}: ${goalsA} - ${goalsB} | ${labels.assists}: ${assistsA} - ${assistsB} | ${labels.marketValue}: ${valA} - ${valB} | ${labels.performance}: ${perfA} - ${perfB}`;
                    list[1] = {
                      text: statsText,
                      style: 'stats-board',
                      startSecond: 0.5,
                      duration: 14.0
                    };
                  } else if (idx === totalSceneCount - 2 && scoreDecision && scoreDecision.teamStats) {
                    const labels = getStatsLabels(currentLang);
                    const stats = scoreDecision.teamStats;
                    const statsText = `${labels.score}: ${scoreDecision.finalScore} | ${labels.possession}: ${stats.teamA.possessionPercent}% - ${stats.teamB.possessionPercent}% | ${labels.shots}: ${stats.teamA.totalShots} - ${stats.teamB.totalShots} | ${labels.onTarget}: ${stats.teamA.shotsOnTarget} - ${stats.teamB.shotsOnTarget} | ${labels.xg}: ${stats.teamA.expectedGoalsXg} - ${stats.teamB.expectedGoalsXg} | ${labels.corners}: ${stats.teamA.cornerKicks} - ${stats.teamB.cornerKicks} | ${labels.fouls}: ${stats.teamA.foulsCommitted} - ${stats.teamB.foulsCommitted}`;
                    list[1] = {
                      text: statsText,
                      style: 'stats-board',
                      startSecond: 0.5,
                      duration: 14.0
                    };
                  }
                  return list.slice(0, 3);
                })(),
                animationStyles: [movementAnimations[idx % movementAnimations.length]],
                selectedMusicId: s.background_audio_id || 'music_thrilling',
                selectedSfxId: s.sfx_audio_id || 'ambience_crowd',
                videoOptions: {
                  duration: 6,
                  resolution: '1080p',
                  generateAudio: true,
                  aspectRatio: '16:9',
                  numVideos: 1,
                  placement: 'end'
                },
                matchMinute: s.match_minute,
                language: currentLang,
                teamA: pendingMatch.teamA,
                teamB: pendingMatch.teamB
              };
            });

            setRenderResolution('1440p');
            const renderResult = await renderFullVideo(
              finalScenes as any[],
              inputs.aspectRatio,
              '1440p',
              setRenderProgress,
              false
            );
            
            const rawFilename = renderResult.filename;
            if (!rawFilename) {
              throw new Error(`Video rendering returned empty filename for ${currentLang}.`);
            }

            // Save the rendered video file copy to target auto-assets folder
            const saveVideoRes = await fetch('http://localhost:3001/api/auto-assets/save-rendered-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ matchKey, language: currentLang, videoFilename: rawFilename })
            }).then(r => r.json());

            renderFilename = `auto_assets/${matchKey}/${currentLang}/rendered_video.mp4`;

            if (currentLang === Language.English) {
              setRenderedVideoUrl(saveVideoRes.url || `http://localhost:3001/static/${renderFilename}`);
              setServerVideoFilename(renderFilename);
            }

            setLangPipelineSteps(prev => ({
              ...prev,
              [currentLang]: {
                ...prev[currentLang],
                statusMessage: `Video rendering complete.`
              }
            }));
          } finally {
            releaseRender();
          }
        }

        if (!renderFilename) {
          throw new Error(`Video rendering returned empty filename for ${currentLang}.`);
        }

        // 4. Parallel YouTube Upload & Publish
        if (isStopRequestedRef.current) return;

        // Check if already published
        const publishCheck = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${currentLang}&fileName=publish_status.json`).then(r => r.json());
        if (publishCheck.exists && publishCheck.data?.published) {
          console.info(`🎯 [AutoMode] Video already published for ${currentLang} to YouTube: ${publishCheck.data.videoUrl}`);
          setLangPipelineSteps(prev => ({
            ...prev,
            [currentLang]: {
              ...prev[currentLang],
              statusMessage: `Published successfully!`
            }
          }));
          return;
        }

        console.info(`🚀 [AutoMode] Rendering completed for ${currentLang}. Initiating YouTube upload in parallel...`);
        
        await executeStepWithRetry(
          `Publish ${currentLang} Video to YouTube`,
          'publish',
          async () => {
            const burnedThumbUrl = resolvedThumbnail.burnedUrl;
            const thumbLoc = {
              topLeftText: thumbMeta.topLeftText || "",
              titleText: thumbMeta.titleText,
              subtitleText: thumbMeta.subtitleText,
              topRightText: thumbMeta.topRightText,
              prompt: thumbMeta.customVisualPrompt,
              style: inputs.artStyle,
              url: burnedThumbUrl
            };

            const uploadRes = await executeYoutubePublish(
              renderFilename,
              localizedMeta.title,
              localizedMeta.description,
              { [currentLang]: burnedThumbUrl },
              { [currentLang]: thumbLoc },
              burnedThumbUrl,
              { [currentLang]: localizedMeta },
              currentLang
            );
            
            // Save publish status
            await fetch('http://localhost:3001/api/auto-assets/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                matchKey,
                language: currentLang,
                fileName: 'publish_status.json',
                content: { published: true, videoUrl: uploadRes?.videoUrl || `https://www.youtube.com/watch?v=${uploadRes?.videoId || ''}` }
              })
            });
            
            return true;
          },
          currentLang
        );

        setLangPipelineSteps(prev => ({
          ...prev,
          [currentLang]: {
            ...prev[currentLang],
            statusMessage: `Published successfully!`
          }
        }));

        console.info(`🎉 [AutoMode] Language ${currentLang} successfully published!`);
      });

      // Await all parallel pipelines to finish
      await Promise.all(pipelinePromises);

      // Only mark match as Done if all selected languages are done
      const statusChecks = await Promise.all(
        (selectedAutoLanguages.length > 0 ? selectedAutoLanguages : [currentEditorLanguage]).map(async (lang) => {
          try {
            const check = await fetch(`http://localhost:3001/api/auto-assets/load?matchKey=${matchKey}&language=${lang}&fileName=publish_status.json`).then(r => r.json());
            return !!check.exists && !!check.data?.published;
          } catch {
            return false;
          }
        })
      );
      const allSelectedLangsDone = statusChecks.every(Boolean);

      if (allSelectedLangsDone) {
        console.info("🎉 [AutoMode] All selected languages completed successfully. Marking match as Done!");
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
      } else {
        console.info("ℹ️ [AutoMode] Some selected languages are still pending. Match will not be marked as Done yet.");
      }

      setAutoPublishState(prev => ({
        ...prev,
        isRunning: false,
        currentLangIndex: 0,
        currentSubStep: 'idle',
        statusMessage: `Match ${pendingMatch.teamA} vs ${pendingMatch.teamB} completed successfully!`
      }));

      setCurrentEditorLanguage(Language.English);

      sharedImageCacheRef.current = {};
      setScenes([]);
      setCharacters([]);
      setStoryContext("");
      setHistoryData(null);
      setThumbnailUrl(null);
      setRenderedVideoUrl(null);
      setServerVideoFilename(null);

    } catch (err: any) {
      console.error("❌ [AutoMode] Critical pipeline error:", err);
      setAutoPublishState(prev => ({
        ...prev,
        isPaused: true,
        isRunning: false,
        statusMessage: `Paused: ${err.message || 'Error occurred.'}`,
        errorLog: [...prev.errorLog, `Critical: ${err.message || String(err)}`]
      }));
      alert(`⚠️ Auto Mode Paused!\n\nReason: ${err.message || 'Unknown error'}\n\nYou can review/resume the step after resolving the issue.`);
    } finally {
      setSoloRunningLanguage(null);
      isPipelineRunningRef.current = false;
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

      const activeTimes = Array.from({ length: schedulerFrequency }).map((_, idx) => schedulerTimes[idx] || '09:00');
      if (activeTimes.includes(currentTimeStr) && lastScheduledTrigger !== triggerKey) {
        if (selectedFixtureName === 'manual') {
          console.warn("⚠️ [Scheduler] Cannot automatically launch: Competition / Tournament drop-down is set to 'manual'. Please select a fixture file.");
          return;
        }
        if (selectedAutoLanguages.length === 0) {
          console.warn("⚠️ [Scheduler] Cannot automatically launch: No active languages selected.");
          setLastScheduledTrigger(triggerKey);
          return;
        }
        if (autoPublishState.isRunning) {
          console.warn(`⏰ [Scheduler] Time matched (${currentTimeStr}), but Full Auto Publish is already running. Trigger bypassed.`);
          setLastScheduledTrigger(triggerKey);
          return;
        }
        console.info(`⏰ [Scheduler] Time matched (${currentTimeStr}). Automatically launching Full Auto Publish!`);
        setLastScheduledTrigger(triggerKey);
        startFullAutoMode();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [schedulerEnabled, schedulerFrequency, schedulerTimes, lastScheduledTrigger, selectedFixtureName, autoPublishState.isRunning, selectedAutoLanguages]);


  const handleLocalize = async (targetLanguage: Language) => {
    // 1. Always check and prefill empty thumbnail overlays first
    await checkAndPrefillThumbnailOverlays(targetLanguage);

    if (targetLanguage === currentEditorLanguage) return;

    // Switch the tab immediately
    setCurrentEditorLanguage(targetLanguage);

    if (targetLanguage !== Language.English && !scenes.some(s => s.localizations?.[targetLanguage])) {
      setIsLocalizing(true);
      try {
        const locResults = await localizeScript(scenes, targetLanguage, inputs.appMode, footballInput);
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
        const res = await generateTTS(targetScript, voiceToUse, tone, inputs.speaker1Voice, inputs.speaker2Voice, currentEditorLanguage);
        const updates: any = { ttsAudioUrl: res.audioUrl, isGeneratingTTS: false };
        if (res.correctedText) {
          updates.voiceoverScript = res.correctedText;
        }
        updateScene(id, updates);
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
          topLeftText: thumbnailTopLeftText || "",
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
          currentThumbLoc.prompt,
          inputs.imageGenerator
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

      // Sync status for all 4 languages for the match setup connection menu
      const langs = ['English', 'Turkish', 'Spanish', 'Portuguese'];
      const connectionStatuses = await Promise.all(
        langs.map(async (l) => {
          try {
            const res = await fetch(`http://localhost:3001/api/youtube/status?lang=${l}`);
            if (!res.ok) return { lang: l, isConnected: false, channel: null };
            const statusData = await res.json();
            return { lang: l, isConnected: !!statusData.isConnected, channel: statusData.channel || null };
          } catch {
            return { lang: l, isConnected: false, channel: null };
          }
        })
      );

      const nextConns: Record<string, { isConnected: boolean; channel?: { title: string; avatar: string; customUrl: string } | null }> = {};
      connectionStatuses.forEach(s => {
        nextConns[s.lang] = { isConnected: s.isConnected, channel: s.channel };
      });
      setYoutubeConnections(nextConns);
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
              thumb.topRightText || "",
              thumb.topLeftText || "",
              inputs.appMode === AppMode.Football ? footballInput.teamA : undefined,
              inputs.appMode === AppMode.Football ? footballInput.teamB : undefined
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

  const handleConnectYoutube = async (lang = currentEditorLanguage) => {
    try {
      const res = await fetch(`http://localhost:3001/api/youtube/auth-url?lang=${lang}`);
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

  const handleDisconnectYoutube = async (lang = currentEditorLanguage) => {
    if (confirm(`Are you sure you want to disconnect your YouTube channel for ${lang}?`)) {
      try {
        const res = await fetch(`http://localhost:3001/api/youtube/disconnect?lang=${lang}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          if (lang === currentEditorLanguage) {
            setIsYoutubeConnected(false);
            setYoutubeChannel(null);
            setPublishSuccessUrl(null);
          }
          await checkYoutubeStatus();
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

        // Record successfully uploaded video in history log
        const newUploadedVideo: UploadedVideo = {
          id: uploadData.videoId || `${Date.now()}_${activeLang}`,
          title: currentMeta.title || 'AI Story Video',
          lang: activeLang,
          youtubeUrl: uploadData.videoUrl || `https://www.youtube.com/watch?v=${uploadData.videoId}`,
          uploadedAt: new Date().toISOString(),
          matchInfo: inputs.appMode === AppMode.Football
            ? `${footballInput.teamA} vs ${footballInput.teamB} (${footballInput.competition})`
            : inputs.title
        };

        setUploadedVideos(prev => [newUploadedVideo, ...prev]);

        if (!autoPublishState.isRunning) {
          alert("🎉 Video successfully published to YouTube as Private!");
        } else {
          console.info("🎉 [AutoMode] Video successfully published to YouTube as Private!");
        }
        return uploadData;
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
        historyData,
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
        if (!dataUrl) return null;
        if (dataUrl.startsWith('data:')) {
          try {
            const parts = dataUrl.split(',');
            const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            return new Blob([u8arr], { type: mime });
          } catch (e) {
            console.error("Failed to parse data URL to blob directly:", e);
          }
        }
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

      setInputs({
        imageGenerator: 'xAI',
        ...data.inputs
      });
      setThumbnailStyle(data.inputs.artStyle || "");
      setStoryContext(data.storyContext || "");
      setHistoryData(data.historyData || null);
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
    const musicVolume = isAnimated ? 0.037 : 0.075;
    const sfxVolume = isAnimated ? 0.15 : 0.25;

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
            onClick={() => setInputs(prev => {
              const newStyle = prev.artStyle === ArtStyle.VectorGraphic ? ArtStyle.Cinematic : prev.artStyle;
              return { 
                ...prev, 
                appMode: AppMode.Football, 
                imageIntervalMinutes: 0.25,
                durationMinutes: prev.durationMinutes === DEFAULT_DURATION ? 6 : prev.durationMinutes,
                artStyle: newStyle
              };
            })}
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

                {/* YouTube Channel Status Grid */}
                <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">YouTube Automation Channels Connection</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                    {['English', 'Turkish', 'Spanish', 'Portuguese', 'French', 'German'].map((lang) => {
                      const conn = youtubeConnections[lang];
                      const isConnected = !!conn?.isConnected;
                      const channel = conn?.channel;
                      const langFlags: Record<string, string> = {
                        'English': '🇺🇸',
                        'Turkish': '🇹🇷',
                        'Spanish': '🇪🇸',
                        'Portuguese': '🇧🇷',
                        'French': '🇫🇷',
                        'German': '🇩🇪'
                      };

                      return (
                        <div
                          key={lang}
                          className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all duration-300 ${
                            soloRunningLanguage === (lang as Language)
                              ? 'bg-amber-950/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.25)] animate-pulse'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="font-bold text-sm text-slate-200 flex items-center gap-1.5">
                              <span>{langFlags[lang] || '🌐'}</span> {lang}
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${isConnected ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                              {isConnected ? 'Active' : 'Offline'}
                            </span>
                          </div>

                          {isConnected && channel ? (
                            <div className="flex items-center gap-2">
                              {channel.avatar && (
                                <img src={channel.avatar} alt={channel.title} className="w-6 h-6 rounded-full border border-red-500/30" />
                              )}
                              <div className="text-[11px] font-semibold text-slate-400 truncate max-w-[120px]">
                                {channel.title}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 italic">No channel connected</div>
                          )}

                          <div className="space-y-1.5">
                            {isConnected ? (
                              <button
                                onClick={() => handleDisconnectYoutube(lang)}
                                className="w-full text-center text-xs text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/30 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                Disconnect
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnectYoutube(lang)}
                                className="w-full text-center text-xs text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/30 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                Connect Channel
                              </button>
                            )}

                            {isConnected && (
                              <div>
                                {soloRunningLanguage === (lang as Language) ? (
                                  <button
                                    onClick={() => {
                                      setSoloRunningLanguage(null);
                                      stopFullAutoMode();
                                    }}
                                    className="w-full text-center text-xs text-white bg-amber-600 hover:bg-amber-500 border border-amber-500 py-1.5 rounded-lg transition-all cursor-pointer font-bold animate-pulse"
                                  >
                                    ⏹️ Stop Solo
                                  </button>
                                ) : (
                                  <button
                                    disabled={autoPublishState.isRunning}
                                    onClick={() => startSoloAutoMode(lang as Language)}
                                    className={`w-full text-center text-xs font-semibold py-1.5 rounded-lg transition-all cursor-pointer border ${
                                      autoPublishState.isRunning
                                        ? 'text-slate-600 bg-slate-800/20 border-slate-800/40 cursor-not-allowed'
                                        : 'text-amber-400 bg-amber-500/5 hover:bg-amber-500/15 border-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                                    }`}
                                  >
                                    ⚡ Run Solo
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between mt-1">
                            <span className="text-[11px] text-slate-400 font-medium">Auto Publish</span>
                            <button
                              onClick={() => setSelectedAutoLanguages(prev => prev.includes(lang as Language) ? prev.filter(l => l !== (lang as Language)) : [...prev, lang as Language])}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                selectedAutoLanguages.includes(lang as Language) ? 'bg-emerald-500' : 'bg-slate-700'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  selectedAutoLanguages.includes(lang as Language) ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
                        disabled={selectedAutoLanguages.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-98 cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        🚀 Start Full Auto Mode
                      </button>
                      {selectedAutoLanguages.length === 0 && (
                        <span className="text-red-400 text-xs font-semibold">
                          ⚠️ Select at least one channel above to run Auto Mode.
                        </span>
                      )}
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
                    <div className="space-y-4">
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

                      {/* Scheduler Live Status Panel */}
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2 text-xs font-sans">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Scheduler Live Status</span>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            schedulerStatus.warningStr 
                              ? 'bg-amber-950/40 text-amber-400 border-amber-800' 
                              : 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${schedulerStatus.warningStr ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                            {schedulerStatus.warningStr ? 'Warning' : 'Active & Waiting'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-1">
                          <div className="space-y-1">
                            <span className="text-slate-500 block text-[10px] uppercase">Next Run Time</span>
                            <span className="text-white font-medium text-sm">
                              {schedulerStatus.nextTriggerStr ? `${schedulerStatus.nextTriggerStr} (Local)` : 'Not Configured'}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-slate-500 block text-[10px] uppercase">Countdown</span>
                            <span className="text-emerald-400 font-mono text-sm font-semibold">
                              {schedulerStatus.countdownStr || 'Calculating...'}
                            </span>
                          </div>
                        </div>
                        
                        {schedulerStatus.warningStr && (
                          <div className="mt-2 text-amber-400/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg flex items-start gap-2 leading-relaxed">
                            <span className="mt-0.5">⚠️</span>
                            <span>{schedulerStatus.warningStr}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Status Logger Panel */}
                {(autoPublishState.isRunning || autoPublishState.errorLog.length > 0) && (
                  <div className="space-y-4">
                    {/* Language Progress Tracker */}
                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Language Progression Tabs</div>
                        {!selectedAutoLanguages.includes(dashboardSelectedLanguage) ? null : (
                          <button
                            onClick={() => {
                              setCurrentEditorLanguage(dashboardSelectedLanguage);
                              setStep(AppStep.ASSET_GENERATION);
                            }}
                            className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer font-semibold"
                          >
                            🎨 View Assets in Studio ↗
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {['English', 'Turkish', 'Spanish', 'Portuguese', 'French', 'German'].map((lang, lIdx) => {
                          const targetLang = [Language.English, Language.Turkish, Language.Spanish, Language.Portuguese, Language.French, Language.German][lIdx];
                          const isExcluded = !selectedAutoLanguages.includes(targetLang);
                          const stepState = langPipelineSteps[targetLang];
                          const isCompleted = stepState?.subStep === 'publish' && stepState?.statusMessage === 'Published successfully!';
                          const isRunning = autoPublishState.isRunning && !isExcluded && !isCompleted && stepState?.subStep && stepState?.subStep !== 'idle';
                          const isSelected = dashboardSelectedLanguage === targetLang;

                          let btnClass = "bg-slate-900/55 border-slate-800 text-slate-400";
                          if (isExcluded) {
                            btnClass = "bg-slate-950/20 border-slate-900/40 text-slate-500 opacity-50 cursor-not-allowed";
                          } else if (isSelected) {
                            btnClass = "bg-indigo-650/30 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/20";
                          } else if (isRunning) {
                            btnClass = "bg-emerald-950/30 border-emerald-500 text-emerald-400 shadow-sm shadow-emerald-500/5";
                          } else if (isCompleted) {
                            btnClass = "bg-slate-800 border-slate-700 text-slate-350";
                          }

                          return (
                            <button
                              key={lang}
                              onClick={() => {
                                setDashboardSelectedLanguage(targetLang);
                                setCurrentEditorLanguage(targetLang);
                              }}
                              className={`flex-1 text-center py-2 px-3 rounded-lg text-[10px] md:text-xs font-semibold border transition-all cursor-pointer ${btnClass}`}
                              disabled={isExcluded}
                            >
                              {isExcluded ? '🚫 ' : isCompleted ? '✅ ' : isRunning ? '⚡ ' : '⏳ '}{lang}
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
                          const activeLangState = langPipelineSteps[dashboardSelectedLanguage];
                          const currentIndex = stepOrder.indexOf(activeLangState?.subStep || 'idle');
                          const stepIndex = stepOrder.indexOf(step.id);

                          let status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
                          if (stepIndex < currentIndex) {
                            status = 'completed';
                          } else if (stepIndex === currentIndex) {
                            if ((activeLangState?.errorLog?.length || 0) > 0 && autoPublishState.isPaused) {
                              status = 'failed';
                            } else {
                              status = 'running';
                            }
                          }

                          return (
                            <div
                              key={step.id}
                              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${status === 'completed'
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
                              <div className="space-y-0.5 text-left">
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
                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 font-mono text-xs text-left">
                      <div className="flex justify-between items-center text-slate-400 font-bold border-b border-slate-800 pb-2">
                        <span>Console Output / Error Logs ({dashboardSelectedLanguage})</span>
                        {(langPipelineSteps[dashboardSelectedLanguage]?.retries || 0) > 0 && (
                          <span className="text-amber-400">Warning: Retry {langPipelineSteps[dashboardSelectedLanguage]?.retries}/3</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p><span className="text-slate-500">[Status]:</span> <span className="text-slate-200">{langPipelineSteps[dashboardSelectedLanguage]?.statusMessage || 'Idle.'}</span></p>
                      </div>
                      {(langPipelineSteps[dashboardSelectedLanguage]?.errorLog?.length || 0) > 0 && (
                        <div className="space-y-1 pt-2 border-t border-slate-800 max-h-24 overflow-y-auto">
                          <span className="text-red-400 font-bold block">Error Log history:</span>
                          {langPipelineSteps[dashboardSelectedLanguage].errorLog.map((log, lidx) => (
                            <p key={lidx} className="text-red-450">{log}</p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Successfully Uploaded YouTube Videos Log */}
                    <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                      <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>📤</span> Successfully Uploaded YouTube Videos
                        </div>
                        {uploadedVideos.length > 0 && (
                          <button
                            onClick={() => {
                              if (confirm("Are you sure you want to clear the upload history log?")) {
                                setUploadedVideos([]);
                                localStorage.removeItem('yt_studio_uploaded_videos');
                              }
                            }}
                            className="text-[10px] text-red-400 hover:text-red-300 underline cursor-pointer font-semibold"
                          >
                            Clear Log
                          </button>
                        )}
                      </div>
                      {uploadedVideos.length === 0 ? (
                        <div className="text-[11px] text-slate-500 italic p-2">No videos uploaded in this session yet.</div>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                          {uploadedVideos.map((video) => {
                            const langFlags: Record<string, string> = {
                              'English': '🇺🇸',
                              'Turkish': '🇹🇷',
                              'Spanish': '🇪🇸',
                              'Portuguese': '🇧🇷'
                            };
                            const dateStr = new Date(video.uploadedAt).toLocaleString();
                            return (
                              <div key={video.id} className="bg-slate-900/80 p-3 rounded-lg border border-slate-850 flex items-center justify-between gap-4 text-xs hover:border-slate-700 transition-colors">
                                <div className="flex flex-col gap-1 min-w-0 flex-1 text-left">
                                  <div className="font-semibold text-slate-200 truncate" title={video.title}>
                                    {video.title}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
                                    <span className="bg-slate-850 px-1.5 py-0.5 rounded text-slate-350 flex items-center gap-1 font-mono">
                                      <span>{langFlags[video.lang] || '🌐'}</span>
                                      <span>{video.lang}</span>
                                    </span>
                                    {video.matchInfo && (
                                      <span className="truncate max-w-[200px]" title={video.matchInfo}>
                                        ⚽ {video.matchInfo}
                                      </span>
                                    )}
                                    <span>•</span>
                                    <span>📅 {dateStr}</span>
                                  </div>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-2">
                                  <span className="bg-green-500/10 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-500/25 uppercase">
                                    Success
                                  </span>
                                  <a
                                    href={video.youtubeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-indigo-650 hover:bg-indigo-600 text-white font-bold px-3 py-1.5 rounded text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    View ↗
                                  </a>
                                </div>
                              </div>
                            );
                          })}
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
            <input type="number" value={inputs.durationMinutes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputs({ ...inputs, durationMinutes: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">MP4 Render Concurrency</label>
            <input type="number" min={1} max={10} value={renderConcurrency} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenderConcurrency(parseInt(e.target.value) || 2)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none" />
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
            <label className="block text-sm font-medium text-slate-400 mb-2">Image Generator</label>
            <select
              value={inputs.imageGenerator || 'xAI'}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({ ...inputs, imageGenerator: e.target.value as 'xAI' | 'Gemini' })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
            >
              <option value="xAI">xAI (Grok Imagine)</option>
              <option value="Gemini">Gemini (Imagen 3)</option>
            </select>
          </div>
          {inputs.appMode === AppMode.Football ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Speaker 1 (Host) Voice</label>
                <select
                  value={inputs.speaker1Voice || VoiceOption.Enceladus}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({ ...inputs, speaker1Voice: e.target.value as VoiceOption })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                >
                  {VOICE_OPTIONS.map(voice => <option key={voice} value={voice}>{voice}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Speaker 2 (Analyst) Voice</label>
                <select
                  value={inputs.speaker2Voice || VoiceOption.Kore}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({ ...inputs, speaker2Voice: e.target.value as VoiceOption })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                >
                  {VOICE_OPTIONS.map(voice => <option key={voice} value={voice}>{voice}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Visual Style</label>
                <select value={inputs.artStyle} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({ ...inputs, artStyle: e.target.value as ArtStyle })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none">
                  {ART_STYLES.filter(style => inputs.appMode !== AppMode.Football || style.value !== ArtStyle.VectorGraphic).map(style => (
                    <option key={style.label} value={style.value}>{style.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Narrator Voice</label>
                <select value={inputs.voice} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInputs({ ...inputs, voice: e.target.value as VoiceOption })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none">
                  {VOICE_OPTIONS.map(voice => <option key={voice} value={voice}>{voice}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between col-span-1 md:col-span-2 lg:col-span-3 mt-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Ortak Görsel Modu (Shared Images Mode)</h4>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">Görselleri sadece bir kez üreterek diller arasında ortak kullanır ve Imagen API maliyetlerini %75 azaltır.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={sharedImagesMode}
                onChange={(e) => setSharedImagesMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
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
          <button onClick={() => handleExportProject()} disabled={isExporting} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-500/30 flex items-center gap-2">
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
              <div className="text-xs text-slate-500 mt-1">{inputs.appMode === AppMode.Football ? 'Key players, coaches, staff, and team kit designs extracted/defined for the match. Generate references for visual consistency.' : 'Characters must have reference sheets to be consistent.'} {!isReadyForSceneGeneration && (hasCharacters || !hasKits) && <span className="text-red-400 font-bold ml-2">⚠️ Generate all character sheets and team kit designs before creating scenes!</span>}</div>
            </div>
            <button onClick={addCustomCharacter} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 border border-slate-600 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Character
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin font-sans">
            {inputs.appMode === AppMode.Football && (
              <>
                {/* Team A Kit Card */}
                <div className="min-w-[240px] w-[240px] bg-slate-900 rounded-lg p-3 border border-slate-700 flex flex-col gap-2 relative shadow-md">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-bold text-white truncate" title={`${footballInput.teamA || 'Team A'} Kit`}>👕 {footballInput.teamA || 'Team A'} Kit</span>
                    <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded font-mono border border-emerald-400/20">Ref Design</span>
                  </div>
                  <div
                    className="aspect-video bg-black rounded overflow-hidden relative group border border-slate-800 cursor-pointer"
                    onClick={() => !isGeneratingKitA && document.getElementById('upload-kit-a')?.click()}
                    title="Click to Upload Kit Image"
                  >
                    {kitAUrl ? (
                      <img src={kitAUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 text-xs text-center p-2 bg-slate-800/50 group-hover:bg-slate-800 transition-colors">
                        {isGeneratingKitA ? (
                          <div className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full mb-2"></div>
                        ) : (
                          <svg className="w-8 h-8 opacity-20 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                        <span className="text-[10px] mt-1">{isGeneratingKitA ? 'Processing...' : 'Click to Upload'}</span>
                      </div>
                    )}
                    <input
                      id="upload-kit-a"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadKit('A', file);
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => document.getElementById('upload-kit-a')?.click()}
                        disabled={isGeneratingKitA}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
                        title="Upload Custom Kit Design"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleGenerateKit('A')}
                        disabled={isGeneratingKitA}
                        className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded disabled:opacity-50 flex items-center gap-1 font-bold"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {isGeneratingKitA ? '...' : (kitAUrl ? 'Regen' : 'Gen AI')}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500">{kitAUrl ? 'Ready' : 'Missing'}</span>
                  </div>
                </div>

                {/* Team B Kit Card */}
                <div className="min-w-[240px] w-[240px] bg-slate-900 rounded-lg p-3 border border-slate-700 flex flex-col gap-2 relative shadow-md">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-bold text-white truncate" title={`${footballInput.teamB || 'Team B'} Kit`}>👕 {footballInput.teamB || 'Team B'} Kit</span>
                    <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded font-mono border border-emerald-400/20">Ref Design</span>
                  </div>
                  <div
                    className="aspect-video bg-black rounded overflow-hidden relative group border border-slate-800 cursor-pointer"
                    onClick={() => !isGeneratingKitB && document.getElementById('upload-kit-b')?.click()}
                    title="Click to Upload Kit Image"
                  >
                    {kitBUrl ? (
                      <img src={kitBUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 text-xs text-center p-2 bg-slate-800/50 group-hover:bg-slate-800 transition-colors">
                        {isGeneratingKitB ? (
                          <div className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full mb-2"></div>
                        ) : (
                          <svg className="w-8 h-8 opacity-20 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                        <span className="text-[10px] mt-1">{isGeneratingKitB ? 'Processing...' : 'Click to Upload'}</span>
                      </div>
                    )}
                    <input
                      id="upload-kit-b"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadKit('B', file);
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => document.getElementById('upload-kit-b')?.click()}
                        disabled={isGeneratingKitB}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
                        title="Upload Custom Kit Design"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleGenerateKit('B')}
                        disabled={isGeneratingKitB}
                        className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded disabled:opacity-50 flex items-center gap-1 font-bold"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {isGeneratingKitB ? '...' : (kitBUrl ? 'Regen' : 'Gen AI')}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500">{kitBUrl ? 'Ready' : 'Missing'}</span>
                  </div>
                </div>
              </>
            )}
            {characters.length === 0 && inputs.appMode !== AppMode.Football && <div className="text-slate-500 text-sm p-4 w-full text-center border-2 border-dashed border-slate-700 rounded-lg">No characters extracted. Add one manually.</div>}
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
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${currentEditorLanguage === lang
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
            onUpdateArtStyle: (id: number, val: ArtStyle) => updateScene(id, { selectedArtStyle: val }),
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
            isMuted: scene.isMuted,
            appMode: inputs.appMode
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
              topLeftText: thumbnailTopLeftText || "",
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
                    topLeftText: thumbnailTopLeftText || "",
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
                      {ART_STYLES.filter(style => inputs.appMode !== AppMode.Football || style.value !== ArtStyle.VectorGraphic).map(style => (
                        <option key={style.label} value={style.value}>{style.label}</option>
                      ))}
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
                    value={currentThumbLoc.topLeftText || ""}
                    onChange={(e) => updateThumbnailLoc({ topLeftText: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none"
                    placeholder="Top Left Badge (e.g. WINNER PREDICTED!)"
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
