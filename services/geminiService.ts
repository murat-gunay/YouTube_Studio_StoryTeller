
import { GoogleGenAI, Type, Modality, ThinkingLevel } from "@google/genai";
import { MODELS, AUDIO_LIBRARY } from "../constants";
import { Scene, GeneratedScriptResponse, TTSTone, AspectRatio, Character, Overlay, VoiceOption, Language, VideoOptions, ArtStyle, AppMode, OverlayStyle } from "../types";

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

export const getStatsLabels = (lang: string) => {
  const lower = lang.toLowerCase();
  if (lower === 'turkish' || lower === 'türkçe' || lower === 'tr') {
    return {
      score: 'Skor',
      possession: 'Topla Oynama',
      shots: 'Toplam Şut',
      onTarget: 'İsabetli Şut',
      xg: 'Gol Beklentisi (xG)',
      corners: 'Köşe Vuruşu',
      fouls: 'Faul',
      compare: 'KARŞILAŞTIR',
      formation: 'Formasyon',
      style: 'Oyun Tarzı',
      position: 'Pozisyon',
      age: 'Yaş',
      goals: 'Gol',
      assists: 'Asist',
      marketValue: 'Piyasa Değeri',
      performance: 'Performans',
      worldCupTitles: 'Dünya Kupası Şampiyonluğu',
      bestFinish: 'En İyi Derece',
      fifaRanking: 'FIFA Sıralaması',
      worldCupAppearances: 'Dünya Kupası Katılımı',
      h2hRecord: 'Aralarındaki Maçlar'
    };
  }
  if (lower === 'spanish' || lower === 'es') {
    return {
      score: 'Marcador',
      possession: 'Posesión',
      shots: 'Remates',
      onTarget: 'Tiros al Arco',
      xg: 'Goles Esperados (xG)',
      corners: 'Tiros de Esquina',
      fouls: 'Faltas',
      compare: 'COMPARAR',
      formation: 'Formación',
      style: 'Estilo de Juego',
      position: 'Posición',
      age: 'Edad',
      goals: 'Goles',
      assists: 'Asistencias',
      marketValue: 'Valor de Mercado',
      performance: 'Rendimiento',
      worldCupTitles: 'Títulos de Copa del Mundo',
      bestFinish: 'Mejor Resultado',
      fifaRanking: 'Ranking FIFA',
      worldCupAppearances: 'Partic. en Mundiales',
      h2hRecord: 'Historial H2H'
    };
  }
  if (lower === 'french' || lower === 'fr') {
    return {
      score: 'Score',
      possession: 'Possession',
      shots: 'Tirs',
      onTarget: 'Tirs Cadrés',
      xg: 'Buts Attendus (xG)',
      corners: 'Corners',
      fouls: 'Fautes',
      compare: 'COMPARER',
      formation: 'Formation',
      style: 'Style de Jeu',
      position: 'Position',
      age: 'Âge',
      goals: 'Buts',
      assists: 'Passes Décisives',
      marketValue: 'Valeur de Marché',
      performance: 'Performance',
      worldCupTitles: 'Titres en Coupe du Monde',
      bestFinish: 'Meilleur Résultat',
      fifaRanking: 'Classement FIFA',
      worldCupAppearances: 'Participations CDM',
      h2hRecord: 'Historique H2H'
    };
  }
  if (lower === 'german' || lower === 'de') {
    return {
      score: 'Ergebnis',
      possession: 'Ballbesitz',
      shots: 'Schüsse',
      onTarget: 'Torschüsse',
      xg: 'Erwartete Tore (xG)',
      corners: 'Ecken',
      fouls: 'Fouls',
      compare: 'VERGLEICH',
      formation: 'Formation',
      style: 'Spielstil',
      position: 'Position',
      age: 'Alter',
      goals: 'Tore',
      assists: 'Assists',
      marketValue: 'Marktwert',
      performance: 'Leistung',
      worldCupTitles: 'WM-Titel',
      bestFinish: 'Bestes Ergebnis',
      fifaRanking: 'FIFA-Weltrangliste',
      worldCupAppearances: 'WM-Teilnahmen',
      h2hRecord: 'H2H-Bilanz'
    };
  }
  if (lower.includes('portuguese') || lower === 'pt') {
    return {
      score: 'Placar',
      possession: 'Posse de Bola',
      shots: 'Chutes',
      onTarget: 'Chutes a Gol',
      xg: 'Gols Esperados (xG)',
      corners: 'Escanteios',
      fouls: 'Faltas',
      compare: 'COMPARAR',
      formation: 'Formação',
      style: 'Estilo de Jogo',
      position: 'Posição',
      age: 'Idade',
      goals: 'Gols',
      assists: 'Assistências',
      marketValue: 'Valor de Mercado',
      performance: 'Desempenho',
      worldCupTitles: 'Títulos da Copa do Mundo',
      bestFinish: 'Melhor Campanha',
      fifaRanking: 'Ranking da FIFA',
      worldCupAppearances: 'Partic. em Copas',
      h2hRecord: 'Histórico H2H'
    };
  }
  return {
    score: 'Score',
    possession: 'Possession',
    shots: 'Total Shots',
    onTarget: 'Shots on Target',
    xg: 'Expected Goals (xG)',
    corners: 'Corner Kicks',
    fouls: 'Fouls',
    compare: 'COMPARE',
    formation: 'Formation',
    style: 'Play Style',
    position: 'Position',
    age: 'Age',
    goals: 'Goals',
    assists: 'Assists',
    marketValue: 'Market Value',
    performance: 'Performance',
    worldCupTitles: 'World Cup Titles',
    bestFinish: 'Best Finish',
    fifaRanking: 'FIFA Ranking',
    worldCupAppearances: 'World Cup Apps',
    h2hRecord: 'H2H Record'
  };
};

export const getCanonicalStatKey = (label: string): string | null => {
  const cleanLabel = label.trim().toLowerCase();
  const allLanguages = ['english', 'turkish', 'spanish', 'french', 'german', 'portuguese'];
  for (const lang of allLanguages) {
    const labelsObj = getStatsLabels(lang);
    for (const [key, val] of Object.entries(labelsObj)) {
      if (val.toLowerCase() === cleanLabel) {
        return key;
      }
    }
  }
  // Fallbacks
  const clean_includes = (text: string, list: string[]) => list.some(item => text.includes(item));
  if (cleanLabel.includes('world cup titles') || cleanLabel.includes('wm-titel') || cleanLabel.includes('dünya kupası şampiyonluğu') || cleanLabel.includes('títulos de copa del mundo') || cleanLabel.includes('titres en coupe du monde') || cleanLabel.includes('títulos da copa do mundo') || cleanLabel.includes('trophies') || cleanLabel.includes('kupa şampiyon')) return 'worldCupTitles';
  if (cleanLabel.includes('best finish') || cleanLabel.includes('bestes ergebnis') || cleanLabel.includes('en iyi derece') || cleanLabel.includes('mejor resultado') || cleanLabel.includes('meilleur résultat') || cleanLabel.includes('melhor campanha')) return 'bestFinish';
  if (cleanLabel.includes('fifa ranking') || cleanLabel.includes('fifa sıralaması') || cleanLabel.includes('ranking fifa') || cleanLabel.includes('classement fifa') || cleanLabel.includes('fifa-weltrangliste') || cleanLabel.includes('ranking da fifa')) return 'fifaRanking';
  if (cleanLabel.includes('appearances') || cleanLabel.includes('apps') || cleanLabel.includes('katılımı') || cleanLabel.includes('participations') || cleanLabel.includes('teilnahmen') || cleanLabel.includes('partic.')) return 'worldCupAppearances';
  if (cleanLabel.includes('h2h') || cleanLabel.includes('aralarındaki') || cleanLabel.includes('bilanz') || cleanLabel.includes('historial') || cleanLabel.includes('historique') || cleanLabel.includes('histórico')) return 'h2hRecord';
  if (cleanLabel.includes('compare') || clean_includes(cleanLabel, ['karşılaştır', 'karşilaştir', 'karsilastir', 'comparar', 'comparer', 'vergleich'])) return 'compare';
  if (cleanLabel.includes('possession') || clean_includes(cleanLabel, ['topla oynama', 'posesión', 'posse', 'ballbesitz'])) return 'possession';
  if (cleanLabel.includes('shots on target') || clean_includes(cleanLabel, ['isabetli şut', 'tiros al arco', 'tirs cadrés', 'torschüsse', 'chutes a gol'])) return 'onTarget';
  if (cleanLabel.includes('shots') || clean_includes(cleanLabel, ['şut', 'remates', 'tirs', 'schüsse', 'chutes'])) return 'shots';
  if (cleanLabel.includes('xg') || clean_includes(cleanLabel, ['gol beklentisi', 'goles esperados', 'buts attendus', 'erwartete tore'])) return 'xg';
  if (cleanLabel.includes('corner') || clean_includes(cleanLabel, ['köşe', 'esquina', 'ecken', 'escanteios'])) return 'corners';
  if (cleanLabel.includes('foul') || clean_includes(cleanLabel, ['faul', 'faltas', 'fautes'])) return 'fouls';
  if (cleanLabel.includes('score') || clean_includes(cleanLabel, ['skor', 'marcador', 'ergebnis', 'placar'])) return 'score';
  if (cleanLabel.includes('formation')) return 'formation';
  if (cleanLabel.includes('style') || cleanLabel.includes('tarz')) return 'style';
  if (cleanLabel.includes('position') || cleanLabel.includes('pozisyon')) return 'position';
  if (cleanLabel.includes('age') || cleanLabel.includes('yaş') || cleanLabel.includes('edad') || cleanLabel.includes('âge') || cleanLabel.includes('alter') || cleanLabel.includes('idade')) return 'age';
  if (cleanLabel.includes('goal') || cleanLabel.includes('gol') || cleanLabel.includes('tor')) return 'goals';
  if (cleanLabel.includes('assist') || cleanLabel.includes('asist') || cleanLabel.includes('pass')) return 'assists';
  if (cleanLabel.includes('value') || cleanLabel.includes('değer') || cleanLabel.includes('valor') || cleanLabel.includes('valeur') || cleanLabel.includes('wert')) return 'marketValue';
  if (cleanLabel.includes('perf')) return 'performance';

  return null;
};

export const fetchTeamHistory = async (teamA: string, teamB: string, ai: any): Promise<any> => {
  console.info(`⚽ [HistorySearch] Researching history for ${teamA} vs ${teamB}...`);
  const historySchema = {
    type: Type.OBJECT,
    properties: {
      teamA: {
        type: Type.OBJECT,
        properties: {
          worldCupTitles: { type: Type.STRING, description: 'Number of World Cup titles (e.g. "4", "None") or Champions League titles if club' },
          bestFinish: { type: Type.STRING, description: 'Best finish in major tournaments (e.g. "Winners (1998)", "Semi-finals (2002)")' },
          fifaRanking: { type: Type.STRING, description: 'FIFA ranking or domestic league position (e.g. "12th")' },
          worldCupAppearances: { type: Type.STRING, description: 'Number of tournament appearances or achievements (e.g. "21 appearances")' }
        },
        required: ["worldCupTitles", "bestFinish", "fifaRanking", "worldCupAppearances"]
      },
      teamB: {
        type: Type.OBJECT,
        properties: {
          worldCupTitles: { type: Type.STRING, description: 'Number of World Cup titles (e.g. "4", "None") or Champions League titles if club' },
          bestFinish: { type: Type.STRING, description: 'Best finish in major tournaments (e.g. "Winners (1998)", "Semi-finals (2002)")' },
          fifaRanking: { type: Type.STRING, description: 'FIFA ranking or domestic league position (e.g. "12th")' },
          worldCupAppearances: { type: Type.STRING, description: 'Number of tournament appearances or achievements (e.g. "21 appearances")' }
        },
        required: ["worldCupTitles", "bestFinish", "fifaRanking", "worldCupAppearances"]
      },
      h2hRecord: { type: Type.STRING, description: 'Head-to-head record summary (e.g., "12 matches: 4 Wins, 3 Draws, 5 Losses")' }
    },
    required: ["teamA", "teamB", "h2hRecord"]
  };

  const historyPrompt = `
You are an expert football historian and statistician.
Using the Google Search tool, perform research to gather historical facts, major trophy achievements, tournament finishes, and head-to-head records for the football matchup: "${teamA}" vs "${teamB}".

Execute the following queries and compile the results:
1. "${teamA} national football team world cup appearances titles trophies" or "${teamA} football club history achievements trophies"
2. "${teamB} national football team world cup appearances titles trophies" or "${teamB} football club history achievements trophies"
3. "${teamA} vs ${teamB} head to head football match history record"

If they are national teams, focus on World Cups, Euros, Copa America, FIFA rankings, etc. If they are club teams, focus on domestic league titles, Champions League titles, domestic cup wins, current league standings, etc.
Provide the output strictly in the requested JSON format matching the schema. Keep the text values very short (e.g., just "4" or "None" for titles, and "Winners (1998)" for best finish).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: historyPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: historySchema
      }
    });

    const parsedData = robustParseJson(response.text || "{}");
    console.info(`⚽ [HistorySearch] Successfully researched history for ${teamA} vs ${teamB}:`, parsedData);
    return parsedData;
  } catch (err) {
    console.error(`❌ [HistorySearch] Failed to research history:`, err);
    // Return a realistic default
    return {
      teamA: { worldCupTitles: "0", bestFinish: "N/A", fifaRanking: "N/A", worldCupAppearances: "N/A" },
      teamB: { worldCupTitles: "0", bestFinish: "N/A", fifaRanking: "N/A", worldCupAppearances: "N/A" },
      h2hRecord: "No previous meetings recorded"
    };
  }
};


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

export const getSpeakerNamesForLanguage = (lang: Language) => {
  switch (lang) {
    case Language.Turkish:
      return {
        speaker1: "Mert",
        speaker2: "Dr. Selin Taşkan",
        introExamples: [
          `Speaker 1: [excitedly] Ben Mert, yanımda Selin var. Selin, yapay zekanın 10.000 kez simüle ettiği bu maçtaki o kırmızı kart tahmini şaka mı?
Speaker 2: [calm] Hiç şaka değil Mert, yapay zeka takımların agresiflik düzeyini hesapladı ve o kart neredeyse kaçınılmaz.`,
          `Speaker 1: [excitedly] Ben Mert. Speaker 2: [calm] Ben de Selin. Speaker 1: Bugün yapay zekanın 10 bin simülasyonluk verileriyle konuşuyoruz. Selin, şu forvet krizine ne diyorsun, sence de sürpriz bir yedek kurtarabilir mi maçı?
Speaker 2: [surprised] Tam üstüne bastın Mert, simülasyonlarda kulübeden gelen o isim her şeyi değiştiriyor.`,
          `Speaker 1: [excitedly] Mert ve Selin burada, 10.000 yapay zeka simülasyonu ekranımızda. Selin, bu maçı kazanacak takımın taktiği hakkında yapay zekanın sunduğu o tuhaf istatistik de neyin nesi?
Speaker 2: [calm] Şaşırmakta haklısın Mert, çünkü veriler kağıt üzerindeki favorinin aslında büyük bir zayıflığı olduğunu gösteriyor.`
        ]
      };
    case Language.Spanish:
      return {
        speaker1: "Mateo",
        speaker2: "Dra. Sofía Silva",
        introExamples: [
          `Speaker 1: [excitedly] Hola, soy Mateo y me acompaña Sofía. Sofía, ¿es una broma esa expulsión que la IA predijo en las 10,000 simulaciones de este partido?
Speaker 2: [calm] Para nada Mateo, los datos de agresividad defensiva indican que esa tarjeta roja es casi inevitable.`,
          `Speaker 1: [excitedly] Mateo aquí. Speaker 2: [calm] Y Sofía por este lado. Speaker 1: Hoy analizamos 10,000 simulaciones de IA. Sofía, ¿crees que los rumores del vestuario afectarán el planteamiento táctico?
Speaker 2: [surprised] Totalmente, de hecho la simulación muestra que un cambio inesperado en el banquillo decidirá el partido.`,
          `Speaker 1: [excitedly] Listos con Mateo y Sofía, y 10,000 simulaciones de IA en pantalla. Sofía, ¿qué es ese dato absurdo sobre la posesión del favorito?
Speaker 2: [calm] Es real Mateo, los números revelan que la posesión no salvará al favorito de una contra letal.`
        ]
      };
    case Language.Portuguese:
      return {
        speaker1: "Lucas",
        speaker2: "Dra. Camila Souza",
        introExamples: [
          `Speaker 1: [excitedly] Eu sou o Lucas e aqui está a Camila. Camila, aquela expulsão que a IA previu nas 10.000 simulações desse jogo é sério mesmo?
Speaker 2: [calm] Super sério Lucas, os dados de agressividade mostram que esse cartão vermelho é quase inevitável.`,
          `Speaker 1: [excitedly] Lucas aqui. Speaker 2: [calm] E Camila deste lado. Speaker 1: Hoje analisamos 10.000 simulações de IA. Camila, o drama dos bastidores vai mudar a tática em campo?
Speaker 2: [surprised] Com certeza Lucas, a simulação indica que um reserva inesperado vai ser o herói improvável.`,
          `Speaker 1: [excitedly] Lucas e Camila na área, com as estatísticas de 10.000 simulações de IA. Camila, que bizarrice de darei essa sobre o time favorito?
Speaker 2: [calm] Pois é Lucas, os números revelam que o favorito tem um ponto fraco gigante que ninguém estava vendo.`
        ]
      };
    default:
      return {
        speaker1: "Leo",
        speaker2: "Dr. Sarah Chen",
        introExamples: [
          `Speaker 1: [excitedly] I'm Leo, joined by Sarah. Sarah, is that red card predicted in our 10,000 AI simulations of this match actually for real?
Speaker 2: [calm] Absolutely, Leo. The defensive aggression metrics show that card is almost a statistical certainty.`,
          `Speaker 1: [excitedly] Leo here. Speaker 2: [calm] And Sarah as well. Speaker 1: We analyzed 10,000 AI simulations today. Sarah, is that locker-room drama really going to disrupt their tactics?
Speaker 2: [surprised] Totally, Leo. In fact, the simulation predicts a surprise bench player will turn the game completely upside down.`,
          `Speaker 1: [excitedly] Leo and Sarah in the studio, looking at 10,000 AI simulations. Sarah, what is this wild statistic about the favorite team's weakness?
Speaker 2: [calm] It's real, Leo. The data indicates the heavy favorite is vulnerable to a very specific counter-attack.`
        ]
      };
  }
}

export const normalizeSpeakerTags = (text: string): string => {
  if (!text) return text;

  // Replace variations of Host / Speaker 1 (Including language-specific names)
  let normalized = text
    .replace(/^(Speaker\s*1|Host|Presenter|Sunucu|Presentador|Apresentador|Lucas|Mert|Mateo|Leo)\s*(?:\([^)]+\))?\s*:/gim, 'Speaker 1:')
    .replace(/\n(Speaker\s*1|Host|Presenter|Sunucu|Presentador|Apresentador|Lucas|Mert|Mateo|Leo)\s*(?:\([^)]+\))?\s*:/gim, '\nSpeaker 1:');

  // Replace variations of Analyst / Speaker 2 (Including language-specific names)
  normalized = normalized
    .replace(/^(Speaker\s*2|Analyst|Analist|Analista|Camila|Selin|Sofía|Sarah|Dra?\.\s*Camila\s*Souza|Dr\.\s*Selin\s*Taşkan|Dra\.\s*Sofía\s*Silva|Dr\.\s*Sarah\s*Chen)\s*(?:\([^)]+\))?\s*:/gim, 'Speaker 2:')
    .replace(/\n(Speaker\s*2|Analyst|Analist|Analista|Camila|Selin|Sofía|Sarah|Dra?\.\s*Camila\s*Souza|Dr\.\s*Selin\s*Taşkan|Dra\.\s*Sofía\s*Silva|Dr\.\s*Sarah\s*Chen)\s*(?:\([^)]+\))?\s*:/gim, '\nSpeaker 2:');

  return normalized;
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
    4. **Visual Descriptions**: For EACH scene, write a PURELY content-based visual description in **ENGLISH**. If the scene involves specific characters/players, you MUST refer to them directly by their exact names (e.g. 'Vitinha', 'Roberto Martínez') rather than using generic terms like 'a player', 'the midfielder', or 'the coach'. Describe their specific visual actions, positions, and postures in the scene using their real names.
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

const resolveArtStyleDescription = (styleName: string): string => {
  if (!styleName) return "";
  const values = Object.values(ArtStyle) as string[];
  if (values.includes(styleName)) {
    return styleName;
  }
  const entries = Object.entries(ArtStyle);
  const matched = entries.find(([key]) => key.toLowerCase() === styleName.toLowerCase());
  if (matched) {
    return matched[1];
  }
  return styleName;
};

const getSceneCharacterInstructions = async (
  scenePrompt: string,
  voiceoverScript: string,
  characters: Character[],
  involvedCharacterIds?: string[],
  ai?: any
): Promise<{ characterInstruction: string; activeCharacters: Character[] }> => {
  if (!characters || characters.length === 0) {
    return { characterInstruction: "", activeCharacters: [] };
  }

  let activeCharacters: Character[] = [];
  if (involvedCharacterIds && involvedCharacterIds.length > 0) {
    activeCharacters = characters.filter(c => involvedCharacterIds.includes(c.id));
  } else {
    activeCharacters = characters.filter(c => {
      const lowerName = c.name.toLowerCase();
      const lowerPrompt = scenePrompt.toLowerCase();
      const lowerVoiceover = voiceoverScript ? voiceoverScript.toLowerCase() : "";

      if (lowerPrompt.includes(lowerName) || lowerVoiceover.includes(lowerName)) {
        return true;
      }
      const nameParts = lowerName.split(/\s+/).filter(part => part.length >= 3);
      if (nameParts.length > 0) {
        return nameParts.some(part => lowerPrompt.includes(part) || lowerVoiceover.includes(part));
      }
      return false;
    });
  }

  if (activeCharacters.length === 0) {
    return { characterInstruction: "", activeCharacters: [] };
  }

  const charactersToAnalyze = activeCharacters.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description
  }));

  const cleanPrompt = `
You are an expert sports art director and image prompt designer.
For each of the following characters participating in the scene, write a short, visually-focused description in English suitable for an image generator (e.g. age, physical characteristics, clothing, kit/jersey with colors if a player/coach, and facial expression appropriate to the scene).
CRITICAL: Strip out all non-visual stats, market values, career goals/assists, formations, or play style philosophies. Keep it strictly visual and concise.

Scene: "${scenePrompt}"
Characters:
${JSON.stringify(charactersToAnalyze, null, 2)}

Return a JSON array exactly in this format:
[
  {
    "id": "character_id",
    "visualDescription": "Vivid, concise visual description in English..."
  }
]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: cleanPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              visualDescription: { type: Type.STRING }
            },
            required: ["id", "visualDescription"]
          }
        }
      }
    });

    const parsed = robustParseJson(response.text || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) {
      let instructionText = "CHARACTERS TO INCLUDE IN THIS SCENE:\n";
      const matchedCharacters: Character[] = [];

      for (const item of parsed) {
        const char = activeCharacters.find(c => c.id === item.id);
        if (char) {
          matchedCharacters.push(char);
          let desc = item.visualDescription;
          if (char.referenceImageUrl) {
            desc += " [Use the provided image reference for facial identity and features, but adapt pose and clothing to the scene.]";
          }
          instructionText += `- Character "${char.name}": ${desc}\n`;
        }
      }
      return { characterInstruction: instructionText, activeCharacters: matchedCharacters };
    }
  } catch (e) {
    console.warn("⚠️ Failed to clean character descriptions with gemini-3.1-flash-lite:", e);
  }

  let fallbackText = "CHARACTERS TO INCLUDE IN THIS SCENE:\n";
  for (const char of activeCharacters) {
    const cleaned = char.description
      .replace(/Position:\s*[^.]+/gi, "")
      .replace(/Market value:\s*[^.]+/gi, "")
      .replace(/Form\/Stats:\s*[^.]+/gi, "")
      .replace(/Preferred formation:\s*[^.]+/gi, "")
      .replace(/Play style:\s*[^.]+/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    let desc = cleaned;
    if (char.referenceImageUrl) {
      desc += " [Use the provided image reference for facial identity and features, but adapt pose and clothing to the scene.]";
    }
    fallbackText += `- Character "${char.name}": ${desc}\n`;
  }
  return { characterInstruction: fallbackText, activeCharacters };
};

const generateImageXAI = async (
  prompt: string,
  aspectRatio: string,
  imageUrls?: string[],
  resolution: string = "2k"
): Promise<string> => {
  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) {
    throw new Error("XAI_API_KEY is not defined in environment variables");
  }

  const validRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2", "19.5:9", "9:19.5", "20:9", "9:20", "auto"];
  const safeAspectRatio = validRatios.includes(aspectRatio) ? aspectRatio : "16:9";

  const requestBody: any = {
    model: 'grok-imagine-image-quality',
    prompt: prompt,
    aspect_ratio: safeAspectRatio,
    resolution: resolution,
    response_format: 'b64_json'
  };

  if (imageUrls && imageUrls.length > 0) {
    requestBody.image_urls = imageUrls.slice(0, 3);
  }

  const response = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${xaiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`xAI API returned status ${response.status}: ${errText}`);
  }

  const resData = await response.json();
  const b64Data = resData?.data?.[0]?.b64_json;
  if (b64Data) {
    return `data:image/png;base64,${b64Data}`;
  }
  throw new Error("No image data found in xAI response");
};

// 3. Generate Image with Multimodal Character consistency AND Time Travel Adaptation
export const generateImage = async (
  scenePrompt: string,
  style: string,
  aspectRatio: string,
  storyContext: string,
  characters: Character[] = [],
  imageOverlayText?: string,
  involvedCharacterIds?: string[],
  voiceoverScript?: string,
  sceneId?: number,
  imageGenerator?: 'xAI' | 'Gemini',
  kitReferenceUrls?: string[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const contentParts: any[] = [];

  const detailedStyle = resolveArtStyleDescription(style);

  const { characterInstruction, activeCharacters } = await getSceneCharacterInstructions(
    scenePrompt,
    voiceoverScript || "",
    characters,
    involvedCharacterIds,
    ai
  );

  const fullPrompt = `
    ROLE: Senior Art Director.
    TASK: Generate a high-fidelity image that strictly adheres to the TECHNICAL STYLE PROFILE.

    1. TECHNICAL STYLE PROFILE: 
    - Base Style Description: ${detailedStyle}
    - Aesthetic Rules: Maintain absolute consistency. If the style is minimalist (Sketch, Stickman, Sumie), DO NOT add realistic textures, complex shading, or detailed backgrounds. If the style is Cinematic/Noir, emphasize professional lighting and composition.

    2. NARRATIVE SUBJECT:
    - Content: ${scenePrompt}
    - Story Context: ${storyContext}
    - Character Continuity: ${characterInstruction || "No specific characters in this scene."}

    3. COMPOSITION CONSTRAINTS:
    - Zero Tolerance: Do not generate any text, words, labels, numbers, letters, names, scoreboards, banners, UI elements, or strings directly on the image itself. Ground everything in the chosen aesthetic, rendering a clean background visual only. No dialogue bubbles, no "magical" or unrealistic distortions.
    - Overlay Message: ${imageOverlayText ? `Render following text naturally: "${imageOverlayText}"` : "None"}

    FINAL DIRECTIVE: The TECHNICAL STYLE PROFILE is the absolute priority. The NARRATIVE SUBJECT must be interpreted through this style only.
  `;

  if (imageGenerator === 'xAI') {
    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      console.warn("⚠️ XAI_API_KEY not found in environment variables. Falling back to Gemini for image generation.");
    } else {
      try {
        const imageUrls: string[] = [];
        if (activeCharacters.length > 0) {
          for (const char of activeCharacters) {
            if (char.referenceImageUrl) {
              const base64Data = await urlToBase64(char.referenceImageUrl);
              if (base64Data) {
                imageUrls.push(`data:image/png;base64,${base64Data}`);
              }
            }
          }
        }

        if (kitReferenceUrls && kitReferenceUrls.length > 0) {
          for (const kitUrl of kitReferenceUrls) {
            if (kitUrl) {
              const base64Data = await urlToBase64(kitUrl);
              if (base64Data) {
                imageUrls.push(`data:image/png;base64,${base64Data}`);
              }
            }
          }
        }

        // Log the visual scene generation prompt to local server
        try {
          await fetch('http://localhost:3001/api/log-image-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: fullPrompt,
              type: 'scene',
              identifier: sceneId !== undefined ? `Scene ${sceneId + 1}` : 'Scene',
              style: style,
              aspectRatio: aspectRatio
            })
          });
        } catch (e) {
          console.warn("⚠️ Failed to call /api/log-image-prompt for scene:", e);
        }

        return await generateImageXAI(fullPrompt, aspectRatio, imageUrls);
      } catch (err) {
        console.error("❌ xAI Image generation failed:", err);
        console.warn("⚠️ Falling back to Gemini for image generation due to xAI error.");
      }
    }
  }

  // Gemini model logic
  if (activeCharacters.length > 0) {
    for (const char of activeCharacters) {
      if (char.referenceImageUrl) {
        const base64Data = await urlToBase64(char.referenceImageUrl);
        if (base64Data) {
          contentParts.push({
            inlineData: { mimeType: 'image/png', data: base64Data }
          });
        }
      }
    }
  }

  if (kitReferenceUrls && kitReferenceUrls.length > 0) {
    for (const kitUrl of kitReferenceUrls) {
      if (kitUrl) {
        try {
          const base64Data = await urlToBase64(kitUrl);
          if (base64Data) {
            contentParts.push({
              inlineData: { mimeType: 'image/png', data: base64Data }
            });
          }
        } catch (e) {
          console.warn("⚠️ Failed to convert kit reference URL to base64 for Gemini:", e);
        }
      }
    }
  }

  // Log the visual scene generation prompt to local server for Gemini
  try {
    await fetch('http://localhost:3001/api/log-image-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: fullPrompt,
        type: 'scene',
        identifier: sceneId !== undefined ? `Scene ${sceneId + 1}` : 'Scene',
        style: style,
        aspectRatio: aspectRatio
      })
    });
  } catch (e) {
    console.warn("⚠️ Failed to call /api/log-image-prompt for scene:", e);
  }

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

// 3b. Generate Kit Reference Image
export const generateKitReferenceImage = async (
  teamName: string,
  kitType: 'home' | 'away',
  kitDetails: { primary_color: string; secondary_color: string; pattern: string },
  style: string,
  imageGenerator?: 'xAI' | 'Gemini'
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const detailedStyle = resolveArtStyleDescription(style);

  const prompt = `
    ROLE: Professional Football Kit Designer.
    TASK: Generate a studio presentation of the official ${kitType} kit for "${teamName}".
    
    TECHNICAL STYLE: ${style} (${detailedStyle})
    
    KIT DESCRIPTION:
    - Apparel: Official football jersey (shirt), shorts, and socks.
    - Colors: The primary color is ${kitDetails.primary_color}, secondary/accent color is ${kitDetails.secondary_color}.
    - Pattern/Design: Jersey features a ${kitDetails.pattern} pattern in these colors.
    
    COMPOSITION:
    - Layout: A clean, direct flat-lay display or a headless mannequin presentation showing only the jersey shirt, matching shorts, and socks.
    - Strict: Headless mannequin only, or laid flat on a surface. Absolutely no human head, face, skin, hands, feet, or body model should be visible.
    - Background: Sterile studio grey background.
    - Zero Tolerance: Do not generate any text, words, brand names, sponsor logos, or team crest badges on the jersey. The kit must be completely clean and text-free.
  `;

  // Log kit reference prompt
  try {
    await fetch('http://localhost:3001/api/log-image-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        type: 'kit_ref',
        identifier: `${teamName} ${kitType} kit`,
        style: style,
        aspectRatio: '16:9'
      })
    });
  } catch (e) {
    console.warn("⚠️ Failed to call /api/log-image-prompt for kit reference:", e);
  }

  if (imageGenerator === 'xAI') {
    const xaiKey = process.env.XAI_API_KEY;
    if (xaiKey) {
      try {
        return await generateImageXAI(prompt, '16:9');
      } catch (err) {
        console.error("❌ xAI Kit reference generation failed:", err);
      }
    }
  }

  const response = await ai.models.generateContent({
    model: MODELS.imageGen,
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: '16:9',
        imageSize: '1K'
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
  storyContext: string,
  imageGenerator?: 'xAI' | 'Gemini',
  kitReferenceUrl?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Attempt to extract team from character description to ensure team uniform colors are included
  let uniformInstruction = "";
  const teamMatch = character.description.match(/(?:player for|Coach of|Head Coach of)\s+([A-Za-z0-9\s]+?)(?:\.|$|,)/i);
  if (teamMatch && teamMatch[1]) {
    const teamName = teamMatch[1].trim();
    uniformInstruction = `- Uniform/Clothing: The character MUST be wearing the official football kit/jersey of the team "${teamName}". Use "${teamName}" team colors for the jersey and apparel.`;
    
    // Fetch cached kit colors if available to describe the kit precisely (ignoring badges/sponsors)
    try {
      const res = await fetch(`http://localhost:3001/api/teams/${encodeURIComponent(teamName)}`);
      if (res.ok) {
        const teamData = await res.json();
        if (teamData?.kit_colors?.home) {
          const home = teamData.kit_colors.home;
          uniformInstruction = `- Uniform/Clothing: The character MUST be wearing the official home football kit/jersey of the team "${teamName}". The jersey features a ${home.pattern} pattern with ${home.primary_color} as the main color and ${home.secondary_color} accents/details. The entire uniform (jersey, shorts, socks) must strictly match these colors. Do not include any logos, sponsor text, or badges.`;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Failed to fetch cached team kit colors for character reference:`, e);
    }
  }

  // Explicitly requesting a Split View for better reference usage
  const prompt = `
      ROLE: Senior Character Designer.
      TASK: Generate a standardized Studio Character Reference Sheet for "${character.name}".
      
      TECHNICAL STYLE: ${style}
      IDENTITY: ${character.description}
      STORY CONTEXT: ${storyContext}
      ${uniformInstruction}
      ${kitReferenceUrl ? "[Use the provided kit design image as the design reference for the uniform jersey, shorts, and socks. Maintain these colors, patterns, and stripes exactly on the player.]" : ""}
      
      COMPOSITION:
      - Layout: Single full-body shot of the character (Front view, standing).
      - Requirement: The character must be shown from head to toe. No cropped faces or split views.
      - Background: Sterile studio grey. No distractions.
      - Rule: Prioritize ${style} above all literal descriptions.
    `;

  // Log the character reference prompt to local server
  try {
    await fetch('http://localhost:3001/api/log-image-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        type: 'character_ref',
        identifier: character.name || 'Character Ref',
        style: style,
        aspectRatio: '16:9'
      })
    });
  } catch (e) {
    console.warn("⚠️ Failed to call /api/log-image-prompt for character reference:", e);
  }

  if (imageGenerator === 'xAI') {
    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      console.warn("⚠️ XAI_API_KEY not found in environment variables. Falling back to Gemini for character reference.");
    } else {
      try {
        const imageUrls: string[] = [];
        if (kitReferenceUrl) {
          const base64Data = await urlToBase64(kitReferenceUrl);
          if (base64Data) {
            imageUrls.push(`data:image/png;base64,${base64Data}`);
          }
        }
        return await generateImageXAI(prompt, '16:9', imageUrls);
      } catch (err) {
        console.error("❌ xAI Character reference generation failed:", err);
        console.warn("⚠️ Falling back to Gemini for character reference generation due to xAI error.");
      }
    }
  }

  const parts: any[] = [{ text: prompt }];
  if (kitReferenceUrl) {
    try {
      const base64Data = await urlToBase64(kitReferenceUrl);
      if (base64Data) {
        parts.push({
          inlineData: {
            mimeType: "image/png",
            data: base64Data
          }
        });
      }
    } catch (e) {
      console.warn("⚠️ Failed to convert kit reference URL to base64 for Gemini:", e);
    }
  }

  const response = await ai.models.generateContent({
    model: MODELS.imageGen,
    contents: { parts },
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
): Promise<{ scenes: Scene[], storyContext: string, characters: Character[], historyData?: any }> => {
  console.info(`⚽ [Script:Football] Generating "${teamA} vs ${teamB}". Scenes: ${sceneCount}`);
  console.time('⚽ [Script:Football] Generation Duration');

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // ── AUTOMATED GOSSIP, NEWS & RUMOR GATHERING ──
    let combinedExtraContext = extraContext || "";
    try {
      console.info(`⚽ [Script:Football] Gathering rumors, news, and gossip via gemini-3.1-flash-lite with Google Search grounding...`);
      const gossipPrompt = `
You are a top sports journalist and investigative football reporter. Use the Google Search tool to gather recent news, rumors, gossip, and controversies about the teams "${teamA}" and "${teamB}", their key players, coaches, and related countries (fan expectations, national press drama, tactical debates, or off-pitch incidents) for the 2026 season.
Focus on:
- Player transfers, team morale, and locker room atmosphere.
- Coach/manager statements, pressure, potential sack rumors, or tactical choices.
- Key player drama, disputes, or injury controversy.
- Country/fan base expectations and media hype.
Provide a detailed, organized summary of your findings.

CRITICAL SAFETY RULE: You MUST NOT gather or include any details regarding political disputes, regional conflicts, historical country friction, war, or sensitive non-sport national issues. Keep the context purely about football tactics and sports entertainment.
      `;
      const searchTools = [{ googleSearch: {} }];
      const gossipResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: gossipPrompt,
        config: {
          tools: searchTools,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        }
      });
      const gossipText = gossipResponse.text || "";
      if (gossipText.trim()) {
        console.info(`⚽ [Script:Football] Gossip search successfully fetched ${gossipText.length} characters.`);
        combinedExtraContext = `--- GOSSIP, NEWS, & RUMORS (GROUNDED SEARCH) ---\n${gossipText}\n\n--- USER CONTEXT ---\n${combinedExtraContext}`;
      } else {
        console.warn(`⚠️ [Script:Football] Gossip search returned empty text.`);
      }
    } catch (err) {
      console.error(`❌ [Script:Football] Failed to retrieve gossip via search grounding:`, err);
    }

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
              performance_stats: { type: Type.STRING },
              age: { type: Type.INTEGER },
              goals: { type: Type.INTEGER },
              assists: { type: Type.INTEGER }
            },
            required: ["name", "position", "market_value", "performance_stats", "age", "goals", "assists"]
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
        },
        kit_colors: {
          type: Type.OBJECT,
          properties: {
            home: {
              type: Type.OBJECT,
              properties: {
                primary_color: { type: Type.STRING, description: "Main color of the home jersey, e.g. Red, White" },
                secondary_color: { type: Type.STRING, description: "Secondary color of the home jersey" },
                pattern: { type: Type.STRING, description: "Pattern of the home jersey, e.g. solid, vertical stripes, hoops, sash" }
              },
              required: ["primary_color", "secondary_color", "pattern"]
            },
            away: {
              type: Type.OBJECT,
              properties: {
                primary_color: { type: Type.STRING, description: "Main color of the away jersey" },
                secondary_color: { type: Type.STRING, description: "Secondary color of the away jersey" },
                pattern: { type: Type.STRING, description: "Pattern of the away jersey" }
              },
              required: ["primary_color", "secondary_color", "pattern"]
            }
          },
          required: ["home", "away"]
        }
      },
      required: ["team_name", "head_coach", "key_players", "injuries_and_absences", "kit_colors"]
    };

    const getTeamSearchPrompt = (name: string): string => `
You are an expert football data researcher. Using the Google Search tool, you MUST perform three SEPARATE and distinct searches to gather verified information about the ${name} football team for the 2026 season. 

Execute the following searches step-by-step:

1. First Search Query: "${name} national team squad goals assists 2025 2026" or "${name} team key players stats transfermarkt"
   -> Task: Identify the top 3 most valuable, active, and in-form players currently in the squad. For each key player:
      - Search specifically to find their real age (do NOT default to N/A or 25; search for the player's birth date or age on transfermarkt/wikipedia).
      - Find their actual goals scored and assists in the most recent season or tournament (2024, 2025, or 2026). Do NOT return 0 or N/A unless they actually have 0 goals/assists. Search thoroughly.
      - Extract their market value (e.g. €45m, €80m) and position.
      - Summarize their recent performance statistics (e.g. pass completion %, key passes, tackles per game, or clean sheets) in the 'performance_stats' field.

2. Second Search Query: "${name} football team current injuries suspensions 2026"
   -> Task: Identify key players who are currently injured, suspended, or officially excluded from the squad. Note the reason for their absence.

3. Third Search Query: "${name} football team head coach tactics formation 2026"
   -> Task: Determine the head coach's name, their preferred tactical formation (e.g., 4-3-3), and core playing style.
   -> Also, search for the official home and away kit/jersey colors and pattern (e.g. solid, vertical stripes, horizontal stripes, hoops, sash, etc.) of the ${name} team. Do NOT search for or include any badges, sponsorships, or brand names.

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
              const hasEmptyStats = !data.key_players || data.key_players.some((p: any) => !p.age || p.age === 25 || (p.goals === 0 && p.assists === 0));
              if (!hasEmptyStats) {
                console.info(`⚽ [Script:Football] Using cached profile for: ${cachedTeam.team_name}`);
                return data;
              }
              console.info(`⚽ [Script:Football] Cached profile for "${cachedTeam.team_name}" has default stats. Re-fetching to get actual stats...`);
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
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
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

    // ── STEP 1: PARALLEL TEAM DATA & HISTORY COLLECTION ──
    console.info(`⚽ [Script:Football] Step 1: Gathering team profiles and history...`);
    const [teamAData, teamBData, historyData] = await Promise.all([
      getTeamProfile(teamA),
      getTeamProfile(teamB),
      fetchTeamHistory(teamA, teamB, ai)
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
        winner: { type: Type.STRING, description: 'Name of the winning team, or "Draw"' },
        finalScore: { type: Type.STRING, description: 'Formatted as "A-B" e.g., "2-1" or "0-0"' },
        halfTimeScore: { type: Type.STRING, description: 'Formatted as "A-B" e.g., "1-0" or "0-0"' },
        tacticalSummary: { type: Type.STRING },
        teamStats: {
          type: Type.OBJECT,
          properties: {
            teamA: {
              type: Type.OBJECT,
              properties: {
                possessionPercent: { type: Type.INTEGER },
                totalShots: { type: Type.INTEGER },
                shotsOnTarget: { type: Type.INTEGER },
                expectedGoalsXg: { type: Type.NUMBER },
                totalPasses: { type: Type.INTEGER },
                passAccuracyPercent: { type: Type.INTEGER },
                foulsCommitted: { type: Type.INTEGER },
                cornerKicks: { type: Type.INTEGER },
                bigChancesCreated: { type: Type.INTEGER },
                bigChancesMissed: { type: Type.INTEGER },
                ppdaPress: { type: Type.NUMBER }
              },
              required: [
                "possessionPercent", "totalShots", "shotsOnTarget", "expectedGoalsXg",
                "totalPasses", "passAccuracyPercent", "foulsCommitted", "cornerKicks",
                "bigChancesCreated", "bigChancesMissed", "ppdaPress"
              ]
            },
            teamB: {
              type: Type.OBJECT,
              properties: {
                possessionPercent: { type: Type.INTEGER },
                totalShots: { type: Type.INTEGER },
                shotsOnTarget: { type: Type.INTEGER },
                expectedGoalsXg: { type: Type.NUMBER },
                totalPasses: { type: Type.INTEGER },
                passAccuracyPercent: { type: Type.INTEGER },
                foulsCommitted: { type: Type.INTEGER },
                cornerKicks: { type: Type.INTEGER },
                bigChancesCreated: { type: Type.INTEGER },
                bigChancesMissed: { type: Type.INTEGER },
                ppdaPress: { type: Type.NUMBER }
              },
              required: [
                "possessionPercent", "totalShots", "shotsOnTarget", "expectedGoalsXg",
                "totalPasses", "passAccuracyPercent", "foulsCommitted", "cornerKicks",
                "bigChancesCreated", "bigChancesMissed", "ppdaPress"
              ]
            }
          },
          required: ["teamA", "teamB"]
        },
        matchTimeline: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              minute: { type: Type.INTEGER },
              team: { type: Type.STRING },
              event: { type: Type.STRING, description: 'Must be one of: "Goal", "Yellow Card", "Red Card", "Substitution"' },
              player: { type: Type.STRING },
              detail: { type: Type.STRING }
            },
            required: ["minute", "team", "event", "player", "detail"]
          }
        }
      },
      required: ["winner", "finalScore", "halfTimeScore", "matchTimeline", "tacticalSummary", "teamStats"]
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
${combinedExtraContext || "None"}
-------------------------

Task:
1. Reason about the matchup: how do the formations, playstyles, and squads clash?
2. Run a detailed match simulation to decide:
   - The winner ("${teamA}", "${teamB}", or "Draw").
   - The final score (formatted as "Team A Score - Team B Score", e.g. "2-1" or "0-0").
   - The halftime score (formatted similarly, e.g. "1-0" or "0-0").
   - A realistic timeline of events (e.g., goals, red cards, key substitutions/injuries during the match) with exact minutes. Ensure it is chronologically ordered and matches the final score exactly. For cards (Yellow and Red cards):
     * Do NOT generate just a single "tactical yellow card" (taktiksel sarı kart) every time. Real matches have multiple cards (typically 2 to 6 yellow cards in total across both teams, and occasionally a direct red or double-yellow red card, about a 15-20% chance).
     * Provide realistic, varied reasons for the cards, such as reckless tackles, holding back a counter-attacker, dissent/arguing with the referee, simulation, time wasting, or a dangerous slide tackle, rather than always labeling it as tactical.
     * Assign cards to realistic players from the squad profiles or realistic position designations.
   - Realistic team statistics. Ensure possessionPercent for teamA and teamB sum up to exactly 100.
   - A brief tactical summary explaining how the goals were scored or why the match ended this way based on the squads.

Return the result strictly as a valid JSON matching the requested schema. Do not include any formatting other than the JSON itself.
    `;

    const simulationResponse = await ai.models.generateContent({
      model: MODELS.scriptGen,
      contents: simulationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: simulationSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } // High thinking enabled for high-quality simulation
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

    const characterRegistryText = characters.length > 0
      ? `\n--- CHARACTER REGISTRY (Use these exact character IDs when mapping characters to scenes in the 'involved_character_ids' array field) ---\n` +
      characters.map(c => `- ID: "${c.id}" | Name: "${c.name}" | Description: "${c.description}"`).join('\n') + `\n`
      : "";

    const names = getSpeakerNamesForLanguage(targetLanguage);
    const speaker1NameClean = names.speaker1.replace(/Dr(a)?\.\s*/, '').split(' ')[0];
    const speaker2NameClean = names.speaker2.replace(/Dr(a)?\.\s*/, '').split(' ')[0];

    const finalPrompt = `
You are an expert football tactical analyst and a highly passionate match commentator running a premium, data-driven sports analysis podcast channel presenting simulation results (think Tifo Football meets Opta).

Your task is to write a highly engaging, two-speaker conversational script presenting the results of 10,000 simulated matches between ${teamA} and ${teamB} ${competition ? `in ${competition}` : ''}. 
They are engaging in a dynamic, fast-paced back-and-forth conversation, contrasting emotional sports hype with cold, hard data logic. The script MUST be written as a natural, back-and-forth conversational (some scenes with disagreements, some scenes with objective doubts, some scenes where they agree on the same thing, etc) dialogue (screenplay style).
You MUST base your entire simulation presentation strictly on the real-world data and pre-decided score timeline provided below.

--- MATCH DATA INPUTS ---
TEAM A (${teamA}) DATA:
${teamAJsonString}

TEAM B (${teamB}) DATA:
${teamBJsonString}
-------------------------

--- TEAM FOOTBALL HISTORY & HEAD-TO-HEAD RECORDS ---
${JSON.stringify(historyData, null, 2)}
----------------------------------------------------
${characterRegistryText}

--- PRE-DECIDED MATCH SIMULATION RESULTS (MUST FOLLOW STRICTLY) ---
FINAL SCORE: ${scoreDecision.finalScore}
HALFTIME SCORE: ${scoreDecision.halfTimeScore}
MATCH STATISTICS:
${JSON.stringify(scoreDecision.teamStats, null, 2)}
MATCH EVENTS TIMELINE:
${JSON.stringify(scoreDecision.matchTimeline, null, 2)}
TACTICAL PLAYOUT SUMMARY:
${scoreDecision.tacticalSummary}
-------------------------------------------------------------------

ADDITIONAL USER CONTEXT:
${combinedExtraContext || "None"}

Using the provided data, execute the following instructions:
1. Two-Speaker Dialogue System: They are engaging in a dynamic, fast-paced back-and-forth conversation, contrasting emotional sports hype with cold, hard data logic. The script MUST be written as a natural, back-and-forth conversational (some scenes with disagreements, some scenes with objective doubts, some scenes where they agree on the same thing, etc) dialogue (screenplay style) using EXACTLY two speakers:
   - Speaker 1 (Host): Named ${names.speaker1} (addressed in dialogue as "${speaker1NameClean}"). Passionate, represents the fan's perspective, asks emotional or hype-driven questions. Male.
   - Speaker 2 (Data Analyst): Named ${names.speaker2} (addressed in dialogue as "${speaker2NameClean}"). Calm, objective, responds exclusively with data, probabilities, and tactical insights derived from the 10,000 simulations. Female.
   
   Every dialogue line in the voiceover MUST start with either "Speaker 1: " or "Speaker 2: " exactly (DO NOT use their actual names as prefixes like "${names.speaker1}:" or "${names.speaker2}:", use "Speaker 1:" and "Speaker 2:" tags for code parsing. However, in the spoken text itself, they must address each other by their names: "${speaker1NameClean}" and "${speaker2NameClean}").

   CRITICAL DIALOGUE STRUCTURE RULE: For EVERY single scene in the generated script, the "voiceover" text MUST contain a dialogue exchange where BOTH Speaker 1 and Speaker 2 speak at least once. Do NOT write any scene voiceover where only Speaker 1 or only Speaker 2 speaks. Every scene must be a back-and-forth conversation between the two.

   CRITICAL DIALOGUE IDENTITY RULE: Under no circumstances should a speaker address themselves by their own name or talk in the third person as if they are someone else.
   - Speaker 1 (${speaker1NameClean}) must ONLY address Speaker 2 as "${speaker2NameClean}" (e.g., "Selin, bu konuda ne düşünüyorsun?" or "Selin, harika bir gol!"). Speaker 1 must NEVER say his own name "${speaker1NameClean}" in his speech.
   - Speaker 2 (${speaker2NameClean}) must ONLY address Speaker 1 as "${speaker1NameClean}" (e.g., "Kesinlikle Mert, veriler bunu doğruluyor" or "Mert, haklısın"). Speaker 2 must NEVER say her own name "${speaker2NameClean}" in her speech.

   Introductory Rule: "At the beginning of the script (Beat 1), the speakers must:
        a) Introduce themselves briefly and casually using their specific names (e.g., 'I am Leo, and here with me is Sarah.'). Keep the introductions minimal, conversational, and podcast-like.
        b) Explicitly state that the match has been simulated 10,000 times by our advanced AI model.
        c) Avoid fluffy, grandiose cliches like 'this historic match', 'giant clash', 'huge derby', or 'breath-taking showdown'.
        d) Pivot immediately to a punchy, back-and-forth teaser sequence covering the critical narrative hooks of the simulated match:
           - Significant absences or injuries (e.g., 'Did their missing stars hurt their chances?')
           - Disciplinary incidents or cards (e.g., 'there are key yellow cards in this match.')
           - Tactical shift and play dominance (e.g., 'did one team completely dominate the play?')
           - Score legitimacy (e.g., 'is the final scoreline actually fair?')
           - Transition into the analysis: 'let\'s dive into the details right now!'
        e) Discuss the specific, researched team history and head-to-head statistics of the two national teams (or clubs) provided in the TEAM FOOTBALL HISTORY & HEAD-TO-HEAD RECORDS.
           - Use this data to create a context-rich opening, referencing real historical records, past encounters, or long-standing rivalries found in the historyData provided above.
           - Instead of generic, repetitive phrases, they must comment on real history: e.g., 'Did you know Team A hasn't beaten Team B in 20 years?' or 'Team A has 4 World Cup titles, but Team B is ranked higher in the FIFA rankings!'.
           - Create a highly customized, natural, and engaging opening dialogue unique to this matchup.
        f) Deliver a high-stakes, specific teaser hook unique to this match instance—such as a shock tactical change, an unexpected statistical outlier, or a moment of individual brilliance that decided the simulation—to immediately command the listener's attention."

   Dialogue Rule: "During the conversation, they must address each other by their names (e.g., 'What do you think, ${names.speaker2.replace(/Dr(a)?\.\s*/, '').split(' ')[0]}?' or 'Well, ${names.speaker1}...')."

   CRITICAL INTRO VARIATION INSTRUCTION: In Beat 1 (Introduction), Speaker 1 and Speaker 2 MUST introduce themselves. To prevent a monotone introduction in our videos, you MUST dynamically use or adapt one of these example introduction styles (do not copy word-for-word, but vary the phrasing and flow organically and include the 10,000 simulation run context and hook/teaser details):
${names.introExamples.map((ex, i) => `   Style ${i + 1}: ${ex}`).join('\n')}

   CRITICAL CONVERSATIONAL INSTRUCTION: Both Speaker 1 and Speaker 2 MUST actively mention and discuss the news, gossip, transfer rumors, coach pressure, or country/fan expectations about key or famous players, coaches, or figures that were retrieved in the grounded search. Ensure these rumors and gossip are naturally woven into their dialogue across multiple scenes (e.g. arguing about a manager's locker-room dispute or debating a star player's transfer rumor) to keep the analysis deeply engaging and relevant to off-pitch drama.

2. Voice Inflection & Brackets: You MUST put expressive tone, emotion, or action markers in square brackets immediately after the speaker name, e.g., "Speaker 1: [excitedly] Welcome to..." or "Speaker 2: [calm] Let's look at the stats...".
   Use tags like: [excitedly], [sarcastically], [sighs], [laughs], [dramatically], [coughs], [gasps], [calm], [surprised], [stepping in], [screaming], [amazed], [shouting], [laughing in disbelief] naturally to guide the performance. Keep bracket inflections in front of sentences.

3. Narrative Structure: The script flow must follow this exact sequence distributed evenly across the ${sceneCount} scenes:
   - Beat 1: Introduction (The Hook) - A casual welcome, quick self-introductions by name, mentioning the 10,000 simulation runs, and presenting an intriguing teaser/hook through banter or a sharp question, avoiding fluffy cliches.
   - Beat 2: System Parameters & Tactical Setup - Explaining the simulation engine parameters (squad profiles, player forms, tactics used for the 10,000 runs) and starting the pre-match tactical overview.
   - Beat 3: Stats, Injuries, & Key Squads Performance - Evaluating player absences, form, and overall numbers.
   - Beat 4: Key Tactical Matchups - Formations clashing, head-to-head duels, pressing patterns.
   - Beat 5: Breaking Points (xG, specific scenarios) - Where the game breaks, xG projections, and critical simulation moments.
   - Beat 6: Cards, Player Changes - Discipline, card probabilities, substitutions, and referee factors.
   - Beat 7: Final Score Probabilities - Showcasing the final simulation statistics, outlining alternative scorelines and their probabilities (e.g. outlining multiple potential scorelines and their percentages).
   
   Ensure that the final scene (outro) clearly presents the final simulated score of ${scoreDecision.finalScore}.

4. Final Score & Event Timeline Constraints: The dialog must strictly align with the pre-decided final score of ${scoreDecision.finalScore}, halftime score of ${scoreDecision.halfTimeScore}, and match events timeline.

5. Visual Asset Generation & Art Style Selection: For each scene, you MUST choose one of the following art styles in accordance with the scene topic, content, and voice-over script:
    - "Cinematic", "Anime", "Comic", "Watercolour"
    
    The 'visual_description' (image generation prompt) for each scene MUST describe a 'Modern Tactical Room' infographic or visual asset. Choose the best fit from the following styles in accordance with the scene content:
    - A clean 2D vector style tactical pitch with tactical arrows showing team movements.
    - A premium broadcast data card showing stats/match details.
    - A minimalist player comparison radar chart, or team heat maps using a dark corporate color palette (navy blue, stadium green, white).
     
     STRICTLY avoid realistic/cinematic action-heavy photos of players running on the pitch. Keep the visuals static, data-driven, and informative, like a premium sports analysis show.
     - Note on Art Styles & Text: Since the image will be generated using the scene's selected art style, ensure the visual prompt describes these data visuals contextually (e.g. "A clean vector-style 2D tactical pitch with stadium green background"). Do NOT include any text, titles, scoreboards, letters, labels, or numbers directly inside the visual_description. All match stats, minutes, and scores will be overlayed programmatically in post-production. The prompt must describe only clean, text-free data visuals.

── LANGUAGE RULES ──
- 'voiceover' → in ${targetLanguage} (keeping the "Speaker 1:" and "Speaker 2:" tags, and bracket inflections like "[excitedly]")
- 'visual_description' → in ENGLISH (for image generation), describing a clean text-free tactical visualization. Do NOT describe text or scoreboard names on it.
- 'overlays' → array of exactly 3 text overlays in ${targetLanguage}. Format MUST be context/informational, not dialogue.

── STATISTICAL CONSISTENCY RULE (CRITICAL) ──
Any match statistics (e.g. possession%, shots, pass accuracy, xG, cards, goals, substitutions) discussed in the dialogue (voiceover) or described in the visual descriptions (visual_description) MUST exactly match the values and details in the MATCH STATISTICS and MATCH EVENTS TIMELINE JSON objects. Do not make up or hallucinate different statistics or event details.

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
      "voiceover": "Speaker 1: [excitedly] Dialogue here...\\nSpeaker 2: [calm] Response here...",
      "overlays": [
        { "text": "Context Info 1", "startSecond": 0.5, "duration": 7.0 },
        { "text": "Context Info 2", "startSecond": 3.0, "duration": 4.5 },
        { "text": "Context Info 3", "startSecond": 5.5, "duration": 2.0 }
      ],
      "visual_description": "A detailed image generation prompt in ENGLISH describing the Modern Tactical Room asset (vector pitch, data card, or chart) without any text or labels. Be specific about colors and data points.",
      "art_style": "Cinematic",
      "match_minute": 14,
      "background_audio_id": "music_thrilling",
      "sfx_audio_id": "ambience_crowd"
    }
  ]
}

CRITICAL RULE: Do not hallucinate player names, statistics, or injuries that are not present in the provided JSON data. Make the commentary feel alive, as if the match is unfolding in real-time.

CRITICAL CHARACTER NAME RULE: In the visual_description of each scene, if a specific player or coach is participating in the matchup, card event, or tactical action, you MUST refer to them directly by their exact name (e.g., 'Vitinha', 'Bruno Fernandes', 'Abdukodir Khusanov') rather than using generic descriptions like 'a midfielder', 'the player with a green uniform', or 'his rival'. Describe their specific actions using their exact names.

CRITICAL SAFETY RULE: You MUST NOT mention or discuss any political disputes, regional conflicts, historical country friction, war, or sensitive non-sport national issues in the dialogue, overlays, or script context. Keep the focus entirely on sportsmanship, tactics, player performance, and locker-room news.
    `;

    const scriptSchema = {
      type: Type.OBJECT,
      properties: {
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              narrative_beat: { type: Type.STRING },
              voiceover: { type: Type.STRING },
              overlays: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    startSecond: { type: Type.NUMBER },
                    duration: { type: Type.NUMBER }
                  },
                  required: ["text", "startSecond", "duration"]
                }
              },
              visual_description: { type: Type.STRING },
              art_style: {
                type: Type.STRING,
                description: 'Must be one of: "Cinematic", "Anime", "Comic", "Watercolour"'
              },
              match_minute: {
                type: Type.INTEGER,
                description: 'The simulated match minute for this scene (between 1 and 90+, e.g. 14, 45, 87) based on the match timeline events.'
              },
              background_audio_id: { type: Type.STRING },
              sfx_audio_id: { type: Type.STRING },
              involved_character_ids: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of character/player IDs from the provided CHARACTER REGISTRY active or visible in this scene.'
              }
            },
            required: [
              "narrative_beat",
              "voiceover",
              "overlays",
              "visual_description",
              "art_style",
              "match_minute",
              "background_audio_id",
              "sfx_audio_id",
              "involved_character_ids"
            ]
          }
        }
      },
      required: ["scenes"]
    };

    const finalResponse = await ai.models.generateContent({
      model: MODELS.scriptGen, // mapped to 'gemini-3.1-flash-lite'
      contents: finalPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: scriptSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } // High thinking enabled for high-quality writing
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

      const overlays: Overlay[] = (s.overlays || []).slice(0, 3).map((o: any, oIdx: number) => ({
        text: o.text || '',
        style: determineOverlayStyle(o.text || '', oIdx),
        startSecond: typeof o.startSecond === 'number' ? o.startSecond : 0,
        duration: typeof o.duration === 'number' ? o.duration : 5
      }));
      while (overlays.length < 3) {
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
        selectedArtStyle: (() => {
          if (!s.art_style) return undefined;
          const normalized = s.art_style.trim().toLowerCase();
          if (normalized.includes('cinematic')) return ArtStyle.Cinematic;
          if (normalized.includes('sketch')) return ArtStyle.Sketch;
          if (normalized.includes('anime')) return ArtStyle.Anime;
          if (normalized.includes('comic')) return ArtStyle.Comic;
          if (normalized.includes('watercolour') || normalized.includes('watercolor')) return ArtStyle.Watercolour;
          if (normalized.includes('vectorgraphic') || normalized.includes('vector graphic')) return ArtStyle.Cinematic;
          if (normalized.includes('flatlaypapercut') || normalized.includes('flat lay paper cut')) return ArtStyle.FlatLayPaperCut;
          return undefined;
        })(),
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
        hasShortVideo: false,
        involvedCharacterIds: s.involved_character_ids || [],
        matchMinute: typeof s.match_minute === 'number' ? s.match_minute : undefined
      };
    });

    console.info(`⚽ [Script:Football] Complete. ${scenes.length} scenes, ${characters.length} characters.`);
    return {
      scenes: scenes.length > 0 ? scenes : [],
      storyContext: `Tactical simulation analysis of ${teamA} vs ${teamB} in ${competition || 'friendly'}.`,
      characters,
      historyData
    };
  } catch (error) {
    console.error(`❌ [Script:Football] Generation failed:`, error);
    throw error;
  } finally {
    console.timeEnd('⚽ [Script:Football] Generation Duration');
  }
};

/**
 * Generates the common visual storyboard prompts and art styles for the match.
 */
export const generateMatchVisualPrompts = async (
  teamA: string,
  teamB: string,
  competition: string,
  extraContext: string,
  scoreDecision: any,
  sceneCount: number,
  teamAData?: any,
  teamBData?: any
): Promise<{ id: number; narrative_beat: string; visual_description: string; art_style: string }[]> => {
  console.info(`⚽ [Script:Football] Generating Match Visual Storyboard. Scenes: ${sceneCount}`);
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const parsedComp = competition.trim() || 'FIFA-2026 World Cup, Group-A';

    const visualPromptSchema = {
      type: Type.OBJECT,
      properties: {
        visual_scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              narrative_beat: { type: Type.STRING },
              visual_description: { type: Type.STRING },
              art_style: {
                type: Type.STRING,
                description: 'Must be one of: "Cinematic", "Anime", "Comic", "Watercolour"'
              }
            },
            required: ["id", "narrative_beat", "visual_description", "art_style"]
          }
        }
      },
      required: ["visual_scenes"]
    };

    const coachA = teamAData?.head_coach?.name || 'Head Coach A';
    const coachB = teamBData?.head_coach?.name || 'Head Coach B';
    const playerA = teamAData?.key_players?.[0]?.name || 'Key Player A';
    const playerB = teamBData?.key_players?.[0]?.name || 'Key Player B';

    let kitAInstruction = `${teamA} kit colors are not specified.`;
    let kitBInstruction = `${teamB} kit colors are not specified.`;
    
    if (teamAData?.kit_colors?.home) {
      const home = teamAData.kit_colors.home;
      const away = teamAData.kit_colors.away;
      kitAInstruction = `Home Kit: Jersey with a ${home.pattern} pattern in ${home.primary_color} primary color and ${home.secondary_color} accents. Away Kit: Jersey with a ${away.pattern} pattern in ${away.primary_color} primary color and ${away.secondary_color} accents.`;
    }
    if (teamBData?.kit_colors?.home) {
      const home = teamBData.kit_colors.home;
      const away = teamBData.kit_colors.away;
      kitBInstruction = `Home Kit: Jersey with a ${home.pattern} pattern in ${home.primary_color} primary color and ${home.secondary_color} accents. Away Kit: Jersey with a ${away.pattern} pattern in ${away.primary_color} primary color and ${away.secondary_color} accents.`;
    }

    const prompt = `
You are a Lead Visual Director and Storyboard Artist for a premium football documentary.
Your task is to generate a visual storyboard of exactly ${sceneCount} scenes mapping the match flow for the fixture between ${teamA} and ${teamB} in ${parsedComp}.

You must base your visual storyboard on the pre-decided simulation match timeline:
--- MATCH SIMULATION RESULT ---
FINAL SCORE: ${scoreDecision.finalScore}
HT SCORE: ${scoreDecision.halfTimeScore}
MATCH STATISTICS:
${JSON.stringify(scoreDecision.teamStats, null, 2)}
TIMELINE: ${JSON.stringify(scoreDecision.matchTimeline, null, 2)}
TACTICAL SUMMARY: ${scoreDecision.tacticalSummary}
-------------------------------
ADDITIONAL CONTEXT: ${extraContext || "None"}

INSTRUCTIONS:
1. Divide the match narrative flow chronologically into exactly ${sceneCount} visual scenes from intro to outro.
2. For each scene, select one of the following art styles:
   "Cinematic", "Anime", "Comic", "Watercolour"
   Try to distribute them reasonably across the scenes. Do NOT use any other styles (specifically do NOT use "Sketch" or "FlatLayPaperCut").
3. For the visual_description (which will serve as an image generation prompt in English), you MUST describe a dynamic, artistic scene capture from a real-life match environment.
   - STRICT CRITICAL RULE: You MUST NOT generate any infographics, charts, radar charts, data cards, heatmaps, tables, diagrams, or tactical rooms. All data overlays are generated programmatically using CSS. The generated image must be a clean, text-free artistic visual capture.
   - Describe physical actions, gameplay, fouls, sliding tackles, goals being celebrated, high-action passes, close-up details of players/coaches/audience showing vivid emotions (happiness, despair, focus, excitement, intensity), fans cheering in the stadium stands, stadium architecture/ambiance under bright stadium lights, etc.
   - Keep it entirely text-free: NO text, words, numbers, scoreboards, labels, overlays, banners, letters, or UI elements should be present in the described image. Do not allow spelling text or names to be rendered directly on the image itself.
   - **CHARACTER NAME RULE**: In the visual_description of each scene involving players or coaches, you MUST refer to them directly by their exact names (e.g., use 'Vinicius Junior' instead of 'a Brazilian player', use 'Scott McTominay' instead of 'the midfielder', use 'Steve Clarke' instead of 'the coach'). Do NOT use generic terms like 'a player', 'players', or 'his rival'. Specifying the exact player names is crucial to guide the image generator to draw the correct characters and preserve their gender and identity.
   - **TEAM JERSEY/KIT COLOR RULE**: You MUST describe the kit and jersey colors of both teams using their official colors and patterns, specifically ignoring badges and sponsors.
     Use these kit details to write explicit kit/jersey prompts for players:
     * ${teamA}: ${kitAInstruction}
     * ${teamB}: ${kitBInstruction}
     To ensure the colors don't clash and are clearly distinguishable across the video scenes:
     * If ${teamA} is the home team, use ${teamA}'s Home Kit and ${teamB}'s Away Kit (or ${teamB}'s Home Kit if colors do not clash, e.g. blue vs yellow).
     * If a specific player is described, make sure they are wearing their team's home/away kit as selected for the match. Keep this assignment consistent in all scenes.

4. CRITICAL CHRONOLOGY AND NARRATIVE BEAT DIRECTIVES:
   - Scene 1 (index 0) [Intro/Pre-Match Setup]: Artistic visual showing the stadium atmosphere before the match, players walking out, fans waving flags, or a premium stadium exterior.
   - Scene 2 (index 1) [Coach Comparison]: Depict the two head coaches (${coachA} and ${coachB}) in a high-contrast side-by-side comparison active on the sidelines, showing contrasting coach emotions (one gesturing, one intense/calm) against a realistic modern stadium sideline/bench background. Clean and text-free.
   - Scene 3 (index 2) [Player Comparison]: Depict the two key players (${playerA} and ${playerB}) in a side-by-side or split-screen action pose on the pitch (e.g., running, ready to strike), against a vivid green pitch and stadium lights. Clean and text-free. Make sure they are wearing their correct respective team jersey colors.
   - Scenes 4 to ${sceneCount - 3} [Match Highlights]: Depict chronological match gameplay, key fouls, goalkeeper saves, yellow/red cards, goal scoring actions, and celebrations, in strict chronological order according to the TIMELINE, referring to all active players by their exact names and describing them in their correct team kit colors.
   - Scene index ${sceneCount - 2} [Match End & Statistics]: Depict a majestic scene at the final whistle (e.g., players celebrating on the pitch with confetti, coaches shaking hands, or a wide shot of a glowing stadium at night, or fans waving flags in the stands). Refer to the celebrating players directly by their exact names (e.g., '${playerA}' celebrating, or other named players from the rosters). Absolutely NO charts, tables, graphs, heatmaps, or data cards. The stats and scores will be overlayed programmatically in post-production.
   - Scene index ${sceneCount - 1} [Outro]: A majestic, clean artistic shot of the empty football pitch under sunset/night stadium lights, or fans leaving the stadium. Absolutely no text or charts.

5. CRITICAL: Do not describe any text overlays, score numbers, or charts in the visual_description. Keep it purely artistic and clean.

Output the result strictly as a valid JSON matching the requested schema.
    `;

    const response = await ai.models.generateContent({
      model: MODELS.scriptGen,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: visualPromptSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    });

    const parsed = robustParseJson(response.text || "{}");
    return Array.isArray(parsed.visual_scenes) ? parsed.visual_scenes : [];
  } catch (error) {
    console.error(`❌ [Script:Football] Visual Storyboard generation failed:`, error);
    throw error;
  }
};

/**
 * Generates the localized dialogue script, overlays, and thumbnail prompts for a target language from scratch.
 */
export const generateLocalizedFootballScript = async (
  targetLanguage: Language,
  teamA: string,
  teamB: string,
  competition: string,
  extraContext: string,
  scoreDecision: any,
  visualScenes: any[],
  sceneCount: number,
  durationMinutes: number,
  defaultVoice: VoiceOption,
  characters: Character[] = [],
  historyData?: any,
  teamAData?: any,
  teamBData?: any
): Promise<{
  scenes: {
    id: number;
    narrative_beat: string;
    voiceover: string;
    overlays: { text: string; startSecond: number; duration: number }[];
    visual_description: string;
    art_style: string;
    match_minute: number;
    background_audio_id: string;
    sfx_audio_id: string;
    involved_character_ids: string[];
  }[];
  thumbnail: {
    topLeftText: string;
    titleText: string;
    subtitleText: string;
    topRightText: string;
    customVisualPrompt: string;
  };
}> => {
  console.info(`⚽ [Script:Football] Generating script in ${targetLanguage} for "${teamA} vs ${teamB}". Scenes: ${sceneCount}`);
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const targetLangStr = targetLanguage === Language.Portuguese ? "Portuguese (specifically Brazilian Portuguese, Português Brasileiro)" : targetLanguage;
    const parsedComp = competition.trim() || 'FIFA-2026 World Cup, Group-A';

    const totalDurationSeconds = durationMinutes * 60;
    const durationPerSceneSeconds = totalDurationSeconds / sceneCount;
    const targetWordCount = Math.floor((durationPerSceneSeconds / 60) * 135); // 135 WPM speaking rate

    const musicList = AUDIO_LIBRARY.filter(a => a.category === 'music').map(a => `- ID: "${a.id}" (${a.label})`).join('\n');
    const sfxList = AUDIO_LIBRARY.filter(a => a.category !== 'music').map(a => `- ID: "${a.id}" (${a.label})`).join('\n');

    const scriptSchema = {
      type: Type.OBJECT,
      properties: {
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              narrative_beat: { type: Type.STRING },
              voiceover: { type: Type.STRING },
              overlays: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    startSecond: { type: Type.NUMBER },
                    duration: { type: Type.NUMBER }
                  },
                  required: ["text", "startSecond", "duration"]
                }
              },
              visual_description: { type: Type.STRING },
              art_style: { type: Type.STRING },
              match_minute: {
                type: Type.INTEGER,
                description: 'The simulated match minute for this scene (between 1 and 90+, e.g. 14, 45, 87) based on the match timeline events.'
              },
              background_audio_id: { type: Type.STRING },
              sfx_audio_id: { type: Type.STRING },
              involved_character_ids: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of character/player IDs from the provided CHARACTER REGISTRY active or visible in this scene.'
              }
            },
            required: ["id", "narrative_beat", "voiceover", "overlays", "visual_description", "art_style", "match_minute", "background_audio_id", "sfx_audio_id", "involved_character_ids"]
          }
        },
        thumbnail: {
          type: Type.OBJECT,
          properties: {
            topLeftText: { type: Type.STRING },
            titleText: { type: Type.STRING },
            subtitleText: { type: Type.STRING },
            topRightText: { type: Type.STRING },
            customVisualPrompt: { type: Type.STRING }
          },
          required: ["topLeftText", "titleText", "subtitleText", "topRightText", "customVisualPrompt"]
        }
      },
      required: ["scenes", "thumbnail"]
    };

    const names = getSpeakerNamesForLanguage(targetLanguage);
    const speaker1NameClean = names.speaker1.replace(/Dr(a)?\.\s*/, '').split(' ')[0];
    const speaker2NameClean = names.speaker2.replace(/Dr(a)?\.\s*/, '').split(' ')[0];

    const characterRegistryText = characters.length > 0
      ? `\n--- CHARACTER REGISTRY (Use these exact character IDs when mapping characters to scenes) ---\n` +
      characters.map(c => `- ID: "${c.id}" | Name: "${c.name}" | Description: "${c.description}"`).join('\n') + `\n`
      : "";

    let kitAInstruction = `${teamA} kit colors are not specified.`;
    let kitBInstruction = `${teamB} kit colors are not specified.`;
    
    if (teamAData?.kit_colors?.home) {
      const home = teamAData.kit_colors.home;
      const away = teamAData.kit_colors.away;
      kitAInstruction = `Home Kit: Jersey with a ${home.pattern} pattern in ${home.primary_color} primary color and ${home.secondary_color} accents. Away Kit: Jersey with a ${away.pattern} pattern in ${away.primary_color} primary color and ${away.secondary_color} accents.`;
    }
    if (teamBData?.kit_colors?.home) {
      const home = teamBData.kit_colors.home;
      const away = teamBData.kit_colors.away;
      kitBInstruction = `Home Kit: Jersey with a ${home.pattern} pattern in ${home.primary_color} primary color and ${home.secondary_color} accents. Away Kit: Jersey with a ${away.pattern} pattern in ${away.primary_color} primary color and ${away.secondary_color} accents.`;
    }

    const prompt = `
You are an expert football tactical analyst and a highly passionate match commentator running a premium, data-driven sports analysis podcast channel (similar to Tifo Football and Opta).
Write a highly engaging, two-speaker conversational script in ${targetLangStr} presenting the simulation results for ${teamA} vs ${teamB} in ${parsedComp}.

You must base your commentary strictly on this pre-decided simulation match data:
--- MATCH DATA ---
FINAL SCORE: ${scoreDecision.finalScore}
HT SCORE: ${scoreDecision.halfTimeScore}
MATCH STATISTICS:
${JSON.stringify(scoreDecision.teamStats, null, 2)}
TIMELINE: ${JSON.stringify(scoreDecision.matchTimeline, null, 2)}
TACTICAL SUMMARY: ${scoreDecision.tacticalSummary}
GOSSIP & EXTRA CONTEXT: ${extraContext || "None"}
------------------
--- TEAM FOOTBALL HISTORY & HEAD-TO-HEAD RECORDS ---
${historyData ? JSON.stringify(historyData, null, 2) : "None"}
----------------------------------------------------
${characterRegistryText}
COMMON VISUAL STORYBOARD REFERENCE (Generate script corresponding to these scenes):
${JSON.stringify(visualScenes, null, 2)}

INSTRUCTIONS FOR THE SCRIPT AND DIALOGUE:
1. Two-Speaker Screenplay System: Write a natural, fast-paced dialogue using exactly two speakers:
   - Speaker 1 (Host): Named ${names.speaker1} (addressed in dialogue as "${speaker1NameClean}"). Passionate, representing the fan's perspective. Male.
   - Speaker 2 (Data Analyst): Named ${names.speaker2} (addressed in dialogue as "${speaker2NameClean}"). Calm, objective, analytical data expert. Female.
   Every dialogue line in the voiceover MUST start with either "Speaker 1: " or "Speaker 2: " exactly (DO NOT use their actual names as prefixes like "${names.speaker1}:" or "${names.speaker2}:", use "Speaker 1:" and "Speaker 2:" tags for code parsing. However, in the spoken text itself, they must address each other by their names: "${speaker1NameClean}" and "${speaker2NameClean}").

   CRITICAL DIALOGUE STRUCTURE RULE: For EVERY single scene in the generated script, the "voiceover" text MUST contain a dialogue exchange where BOTH Speaker 1 and Speaker 2 speak at least once. Do NOT write any scene voiceover where only Speaker 1 or only Speaker 2 speaks. Every scene must be a back-and-forth conversation between the two.
   CRITICAL DIALOGUE IDENTITY RULE: Under no circumstances should a speaker address themselves by their own name or talk in the third person as if they are someone else.
   - Speaker 1 (${speaker1NameClean}) must ONLY address Speaker 2 as "${speaker2NameClean}" (e.g., "Selin, bu konuda ne düşünüyorsun?" or "Selin, harika bir gol!"). Speaker 1 must NEVER say his own name "${speaker1NameClean}" in his speech.
   - Speaker 2 (${speaker2NameClean}) must ONLY address Speaker 1 as "${speaker1NameClean}" (e.g., "Kesinlikle Mert, veriler bunu doğruluyor" or "Mert, haklısın"). Speaker 2 must NEVER say her own name "${speaker2NameClean}" in her speech.

   CRITICAL LANGUAGE RULE: Every single line of dialogue for both Speaker 1 and Speaker 2 MUST be written entirely in ${targetLangStr}. You MUST NOT write any dialogue in English or mix English phrases into their speech. Ensure 100% native flow and expression in ${targetLangStr}. In particular, make sure Speaker 2 (the female Data Analyst) does not speak or slip into English, and that all her analytical insights, statistics, and tactical statements are fully drafted in ${targetLangStr}.

   Introductory Rule: "At the beginning of the script (Beat 1), the speakers must:
        a) Introduce themselves briefly and casually using their specific names, setting the stage for a deep-dive analysis. Keep the introductions minimal, conversational, and aligned with the energy of a professional sports podcast.
        b) State clearly that the upcoming match simulation is the result of 10,000 rigorous iterations by an advanced AI engine.
        c) Avoid overly theatrical or cliché buzzwords (e.g., 'historic encounter', 'colossal clash', 'monumental showdown'). Maintain a professional yet enthusiastic tone.
        d) Pivot immediately to a punchy, back-and-forth teaser sequence covering the critical narrative hooks of the simulated match:
           - Significant absences or late-hour injury reports (e.g., 'Takımın bel kemiği bu maçta yok muydu?')
           - Key disciplinary incidents (e.g., 'hakem kartına ne kadar başvurdu?')
           - Tactical shift and play dominance (e.g., 'sahada ${teamA} fırtınası mı vardı?')
           - Score legitimacy (e.g., 'skorun arkasında ne var?')
           - Transition into the analysis: 'hadi, tüm detayları masaya yatıralım!'
        e) Integrate the specific historical data provided in the TEAM FOOTBALL HISTORY & HEAD-TO-HEAD RECORDS section. They should discuss these as seasoned analysts, commenting on the significance of the rivalry or the historical weight of the fixture (e.g., 'Yıllardır süren bu rekabetin verileri ne diyor?').
        f) Deliver a high-stakes, specific teaser hook unique to this match instance—such as a shock tactical change, an unexpected statistical outlier, or a moment of individual brilliance that decided the simulation—to immediately command the listener's attention."

     Dialogue Rule: "During the conversation, they must address each other by their names (e.g., 'What do you think, ${names.speaker2.replace(/Dr(a)?\.\s*/, '').split(' ')[0]}?' or 'Well, ${names.speaker1}...')."

     CRITICAL INTRO VARIATION INSTRUCTION: In Beat 1 (Introduction), Speaker 1 and Speaker 2 MUST introduce themselves in ${targetLangStr}. To prevent a monotone introduction in our videos, you MUST dynamically use or adapt one of these example introduction styles (do not copy word-for-word, but vary the phrasing and flow organically in ${targetLangStr}):
${names.introExamples.map((ex, i) => `   Style ${i + 1}: ${ex}`).join('\n')}

2. Preserving Tone & Inflections: Preserve expressive tags in square brackets immediately after the speaker name, e.g. "Speaker 1: [excitedly] ...", "Speaker 2: [calm] ...". Keep bracket inflections in English (e.g. [excitedly], [sighs], [surprised], [dramatically], [laughs]).
3. Gossip Integration: Naturally weave the gossip and rumors into the dialogue to make it feel organic.
4. On-Screen Overlays: For EACH scene, generate an array of exactly 3 text overlays in ${targetLangStr}. Format MUST be context/informational, not dialogue. Ensure no English is used in the overlays.
5. Visual Descriptions & Artistic Image Directives:
   - You MUST NOT generate any infographics, charts, radar charts, data cards, heatmaps, tables, diagrams, or tactical rooms in the visual descriptions. Keep the images purely artistic match scenes.
   - For each scene, describe a dynamic, text-free, artistic visual capture from the match environment matching the reference storyboard. This includes physical play, stadium lights, crowd reactions, player or coach emotions, fouls, slide tackles, goals, or empty sunset stadiums.
   - You MUST describe player uniforms and kits using the exact team colors and patterns defined below (do NOT include badges/sponsorships/brand logos):
     * ${teamA}: ${kitAInstruction}
     * ${teamB}: ${kitBInstruction}
     Ensure that one team is wearing their Home Kit and the other is wearing their Away Kit (or Home Kit if colors do not clash) consistently in all scene visual descriptions.
   - Absolutely no text/letters/numbers/scoreboards should be described in the visual descriptions.
6. Localized Thumbnail Info:
   - topLeftText: A short, high-impact top-left badge text (drama/teaser "Open Loop" hook) in ${targetLangStr} (e.g. "WINNER PREDICTED!", "90'+5 DRAMA!", "RED CARD!" or localized equivalents). Keep it max 2-3 words.
   - titleText: Strictly in the format "Team A vs Team B" translated/localized to ${targetLangStr} if needed (e.g. "TEAM A contra TEAM B" or "TEAM A vs TEAM B"). No extra badges/titles.
   - subtitleText: High-CTR subtitle in ${targetLangStr} (translating/localizing '${parsedComp}').
   - topRightText: High-CTR badge text in ${targetLanguage} (translating '10K Times Simulated with AI').
   - customVisualPrompt: A unique, detailed, high-contrast visual prompt in English for the thumbnail image generator. Any text overlays, team/player names, scores, or labels depicted in the thumbnail image must be localized and translated into the target language (${targetLangStr}).
7. Character Continuity: For each scene, identify which players or coaches from the CHARACTER REGISTRY are active, visible, or referenced in the visual_description. List their exact IDs in the "involved_character_ids" array. If no registered characters are visible/active, return an empty array [].
8. STRICT SCENE COUNT AND CHRONOLOGY (CRITICAL): The output JSON "scenes" array MUST contain EXACTLY ${sceneCount} elements. Do not combine, skip, or modify storyboard scenes. Each element in your output "scenes" array MUST correspond one-to-one to the scene at the same index in the COMMON VISUAL STORYBOARD REFERENCE. The dialogue voiceover and match minutes MUST be strictly chronological:
   - Scene 1 (index 0): Intro/Pre-Match Setup.
   - Scene 2 (index 1): Head Coach Comparison.
   - Scene 3 (index 2): Key Player Comparison.
   - Scenes 4 to (sceneCount - 3): Match gameplay action highlights, in order of timeline events.
   - Scene (sceneCount - 2) (penultimate scene): The final whistle blows, and the speakers MUST review the final score and full match statistics (possession%, shots, xG, corners, fouls). Do NOT discuss any cards, goals, substitutions, or other match events after this scene.
   - Scene (sceneCount - 1) (final scene): Outro/wrap-up. Do not discuss any stats here.

── STATISTICAL CONSISTENCY RULE (CRITICAL) ──
Any match statistics (e.g. possession%, shots, pass accuracy, xG, cards, goals, substitutions) discussed in the dialogue (voiceover) or described in the visual descriptions (visual_description) MUST exactly match the values and details in the MATCH STATISTICS and TIMELINE JSON objects. Do not make up or hallucinate different statistics or event details.

Ensure each scene's voiceover is approximately ${targetWordCount} words.
Select background audio IDs and SFX IDs:
[BACKGROUND MUSIC]
${musicList}
[SFX / AMBIENCE]
${sfxList}

Return the response strictly as a JSON object matching the requested schema.
    `;

    const response = await ai.models.generateContent({
      model: MODELS.scriptGen,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: scriptSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    });

    const parsed = robustParseJson(response.text || "{}");
    if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length !== sceneCount) {
      throw new Error(`[Script:Football] Generated script has ${parsed.scenes?.length || 0} scenes, but expected exactly ${sceneCount}.`);
    }
    return parsed;
  } catch (error) {
    console.error(`❌ [Script:Football] Localized script generation failed for ${targetLanguage}:`, error);
    throw error;
  }
};

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
          performance_stats: { type: Type.STRING },
          age: { type: Type.INTEGER },
          goals: { type: Type.INTEGER },
          assists: { type: Type.INTEGER }
        },
        required: ["name", "position", "market_value", "performance_stats", "age", "goals", "assists"]
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
    },
    kit_colors: {
      type: Type.OBJECT,
      properties: {
        home: {
          type: Type.OBJECT,
          properties: {
            primary_color: { type: Type.STRING, description: "Main color of the home jersey, e.g. Red, White" },
            secondary_color: { type: Type.STRING, description: "Secondary color of the home jersey" },
            pattern: { type: Type.STRING, description: "Pattern of the home jersey, e.g. solid, vertical stripes, hoops, sash" }
          },
          required: ["primary_color", "secondary_color", "pattern"]
        },
        away: {
          type: Type.OBJECT,
          properties: {
            primary_color: { type: Type.STRING, description: "Main color of the away jersey" },
            secondary_color: { type: Type.STRING, description: "Secondary color of the away jersey" },
            pattern: { type: Type.STRING, description: "Pattern of the away jersey" }
          },
          required: ["primary_color", "secondary_color", "pattern"]
        }
      },
      required: ["home", "away"]
    }
  },
  required: ["team_name", "head_coach", "key_players", "injuries_and_absences", "kit_colors"]
};

const getTeamSearchPrompt = (name: string): string => `
You are an expert football data researcher. Using the Google Search tool, you MUST perform three SEPARATE and distinct searches to gather verified information about the ${name} football team for the 2026 season. 

Execute the following searches step-by-step:

1. First Search Query: "${name} national team squad goals assists 2025 2026" or "${name} team key players stats transfermarkt"
   -> Task: Identify the top 3 most valuable, active, and in-form players currently in the squad. For each key player:
      - Search specifically to find their real age (do NOT default to N/A or 25; search for the player's birth date or age on transfermarkt/wikipedia).
      - Find their actual goals scored and assists in the most recent season or tournament (2024, 2025, or 2026). Do NOT return 0 or N/A unless they actually have 0 goals/assists. Search thoroughly.
      - Extract their market value (e.g. €45m, €80m) and position.
      - Summarize their recent performance statistics (e.g. pass completion %, key passes, tackles per game, or clean sheets) in the 'performance_stats' field.

2. Second Search Query: "${name} football team current injuries suspensions 2026"
   -> Task: Identify key players who are currently injured, suspended, or officially excluded from the squad. Note the reason for their absence.

3. Third Search Query: "${name} football team head coach tactics formation 2026"
   -> Task: Determine the head coach's name, their preferred tactical formation (e.g., 4-3-3), and core playing style.
   -> Also, search for the official home and away kit/jersey colors and pattern (e.g. solid, vertical stripes, horizontal stripes, hoops, sash, etc.) of the ${name} team. Do NOT search for or include any badges, sponsorships, or brand names.

CRITICAL INSTRUCTION: You MUST synthesize your findings and output the final response STRICTLY as a valid JSON object matching the requested schema.
`;

export const getTeamProfileHelper = async (name: string, ai: any): Promise<any> => {
  let cachedTeamsList: { filename: string; team_name: string }[] = [];
  try {
    const listRes = await fetch('http://localhost:3001/api/teams');
    if (listRes.ok) {
      cachedTeamsList = await listRes.json();
    }
  } catch (err) {
    console.warn('⚠️ [getTeamProfileHelper] Failed to fetch cached teams list:', err);
  }

  let matchedTeam: { filename: string; team_name: string } | null = null;
  if (cachedTeamsList.length > 0) {
    const cachedNames = cachedTeamsList.map(t => t.team_name);
    const prompt = `
      You are a football data assistant.
      A user is searching for information about the team: "${name}".
      We have a list of cached teams: ${JSON.stringify(cachedNames)}.
      
      Task: Determine if the team "${name}" is semantically the same as one of the cached teams.
      
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
        config: { responseMimeType: "application/json" }
      });
      const result = robustParseJson(response.text || "{}");
      if (result.isMatched && result.matchedTeamName) {
        const match = cachedTeamsList.find(t => t.team_name.toLowerCase() === result.matchedTeamName.toLowerCase());
        if (match) matchedTeam = match;
      }
    } catch (err) {
      console.error("❌ Error matching cached team:", err);
    }

    if (!matchedTeam) {
      const directMatch = cachedTeamsList.find(t => t.team_name.toLowerCase() === name.toLowerCase());
      if (directMatch) matchedTeam = directMatch;
    }
  }

  let fallbackCachedData: any = null;

  if (matchedTeam) {
    try {
      const res = await fetch(`http://localhost:3001/api/teams/${encodeURIComponent(matchedTeam.team_name)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.team_name && data.head_coach && data.key_players && data.key_players.length > 0) {
          // Check if it is a default mock template: e.g. all players have age 25 and 0 goals/assists
          const isMockTemplate = data.key_players.every((p: any) => (!p.age || p.age === 25) && !p.goals && !p.assists);

          // Helper to normalize the fields (ensure schema requirements are met)
          const normalized = {
            ...data,
            key_players: data.key_players.map((p: any) => ({
              name: p.name || 'Unknown Player',
              position: p.position || 'Forward',
              market_value: p.market_value || 'N/A',
              performance_stats: p.performance_stats || 'N/A',
              age: typeof p.age === 'number' ? p.age : 25,
              goals: typeof p.goals === 'number' ? p.goals : 0,
              assists: typeof p.assists === 'number' ? p.assists : 0
            }))
          };

          if (!isMockTemplate) {
            console.info(`⚽ [getTeamProfileHelper] Using cached profile for: ${matchedTeam.team_name}`);
            return normalized;
          } else {
            fallbackCachedData = normalized;
            console.info(`⚽ [getTeamProfileHelper] Cached profile for "${matchedTeam.team_name}" is a default template. Attempting Google Search for fresh stats...`);
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️ Failed to load cached file for ${matchedTeam.team_name}:`, err);
    }
  }

  console.info(`⚽ [getTeamProfileHelper] Cache miss or re-fetching stats for "${name}". Running Google Search...`);
  const searchPrompt = getTeamSearchPrompt(name);
  const searchTools = [{ googleSearch: {} }];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: searchPrompt,
      config: {
        tools: searchTools,
        responseMimeType: 'application/json',
        responseSchema: teamSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    });

    const parsedData = robustParseJson(response.text || "{}");

    if (parsedData && parsedData.team_name && parsedData.head_coach) {
      try {
        await fetch(`http://localhost:3001/api/teams/${encodeURIComponent(parsedData.team_name)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedData)
        });
        console.info(`⚽ [getTeamProfileHelper] Successfully cached profile for: ${parsedData.team_name}`);
      } catch (err) {
        console.warn(`⚠️ Failed to save team cache for ${parsedData.team_name}:`, err);
      }
      return parsedData;
    }
  } catch (err) {
    console.error(`❌ [getTeamProfileHelper] Google Search reasoning failed for ${name}:`, err);
    console.info(`⚽ [getTeamProfileHelper] Retrying WITHOUT search tools to generate fallback profile for "${name}"...`);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: searchPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: teamSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        }
      });
      const parsedData = robustParseJson(response.text || "{}");
      if (parsedData && parsedData.team_name && parsedData.head_coach) {
        try {
          await fetch(`http://localhost:3001/api/teams/${encodeURIComponent(parsedData.team_name)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsedData)
          });
        } catch (e) { }
        return parsedData;
      }
    } catch (fallbackErr) {
      console.error(`❌ [getTeamProfileHelper] Fallback generation without search also failed for ${name}:`, fallbackErr);
    }
  }

  // Fallback to cached profile if search failed/empty
  if (fallbackCachedData) {
    console.info(`⚽ [getTeamProfileHelper] Search failed or returned empty. Falling back to cached data for ${name}`);
    return fallbackCachedData;
  }

  // Programmatic fallback to ensure we never return empty objects
  console.info(`⚽ [getTeamProfileHelper] Generating programmatic fallback profile for "${name}"`);
  return {
    team_name: name,
    head_coach: {
      name: `Coach of ${name}`,
      preferred_formation: '4-3-3',
      play_style_summary: `${name} plays a balanced, transition-focused style with defensive compact organization and quick wing play.`
    },
    key_players: [
      {
        name: `Star Player of ${name}`,
        position: 'Forward',
        market_value: '€25m',
        performance_stats: `A vital attacking player for the team, showing clinical efficiency, great positioning, and strong work rate in crucial match phases.`,
        age: 26,
        goals: 10,
        assists: 4
      }
    ],
    injuries_and_absences: [],
    kit_colors: {
      home: {
        primary_color: "Red",
        secondary_color: "White",
        pattern: "solid"
      },
      away: {
        primary_color: "White",
        secondary_color: "Red",
        pattern: "solid"
      }
    }
  };
};

/**
 * Runs gossip search, collects team profiles, and decides match simulation score and timeline.
 */
export const runMatchSimulationEngine = async (
  teamA: string,
  teamB: string,
  competition: string,
  extraContext: string
): Promise<{ gossipSummary: string; teamAData: any; teamBData: any; scoreDecision: any; historyData: any }> => {
  console.info(`⚽ [SimEngine] Running simulation reasoning for ${teamA} vs ${teamB}`);
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let gossipSummary = "";
  try {
    console.info(`⚽ [SimEngine] Gathering rumors, news, and gossip via gemini-3.1-flash-lite with Google Search grounding...`);
    const gossipPrompt = `
You are a top sports journalist and investigative football reporter. Use the Google Search tool to gather recent news, rumors, gossip, and controversies about the teams "${teamA}" and "${teamB}", their key players, coaches, and related countries (fan expectations, national press drama, tactical debates, or off-pitch incidents) for the 2026 season.
Focus on:
- Player transfers, team morale, and locker room atmosphere.
- Coach/manager statements, pressure, potential sack rumors, or tactical choices.
- Key player drama, disputes, or injury controversy.
- Country/fan base expectations and media hype.
Provide a detailed, organized summary of your findings.

CRITICAL SAFETY RULE: You MUST NOT gather or include any details regarding political disputes, regional conflicts, historical country friction, war, or sensitive non-sport national issues. Keep the context purely about football tactics and sports entertainment.
    `;
    const searchTools = [{ googleSearch: {} }];
    const gossipResponse = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: gossipPrompt,
      config: {
        tools: searchTools,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    });
    gossipSummary = gossipResponse.text || "";
  } catch (err) {
    console.error(`❌ [SimEngine] Failed to retrieve gossip via search grounding:`, err);
  }

  const [teamAData, teamBData, historyData] = await Promise.all([
    getTeamProfileHelper(teamA, ai),
    getTeamProfileHelper(teamB, ai),
    fetchTeamHistory(teamA, teamB, ai)
  ]);

  const simulationSchema = {
    type: Type.OBJECT,
    properties: {
      winner: { type: Type.STRING, description: 'Name of the winning team, or "Draw"' },
      finalScore: { type: Type.STRING, description: 'Formatted as "A-B" e.g., "2-1" or "0-0"' },
      halfTimeScore: { type: Type.STRING, description: 'Formatted as "A-B" e.g., "1-0" or "0-0"' },
      tacticalSummary: { type: Type.STRING },
      teamStats: {
        type: Type.OBJECT,
        properties: {
          teamA: {
            type: Type.OBJECT,
            properties: {
              possessionPercent: { type: Type.INTEGER },
              totalShots: { type: Type.INTEGER },
              shotsOnTarget: { type: Type.INTEGER },
              expectedGoalsXg: { type: Type.NUMBER },
              totalPasses: { type: Type.INTEGER },
              passAccuracyPercent: { type: Type.INTEGER },
              foulsCommitted: { type: Type.INTEGER },
              cornerKicks: { type: Type.INTEGER },
              bigChancesCreated: { type: Type.INTEGER },
              bigChancesMissed: { type: Type.INTEGER },
              ppdaPress: { type: Type.NUMBER }
            },
            required: [
              "possessionPercent", "totalShots", "shotsOnTarget", "expectedGoalsXg",
              "totalPasses", "passAccuracyPercent", "foulsCommitted", "cornerKicks",
              "bigChancesCreated", "bigChancesMissed", "ppdaPress"
            ]
          },
          teamB: {
            type: Type.OBJECT,
            properties: {
              possessionPercent: { type: Type.INTEGER },
              totalShots: { type: Type.INTEGER },
              shotsOnTarget: { type: Type.INTEGER },
              expectedGoalsXg: { type: Type.NUMBER },
              totalPasses: { type: Type.INTEGER },
              passAccuracyPercent: { type: Type.INTEGER },
              foulsCommitted: { type: Type.INTEGER },
              cornerKicks: { type: Type.INTEGER },
              bigChancesCreated: { type: Type.INTEGER },
              bigChancesMissed: { type: Type.INTEGER },
              ppdaPress: { type: Type.NUMBER }
            },
            required: [
              "possessionPercent", "totalShots", "shotsOnTarget", "expectedGoalsXg",
              "totalPasses", "passAccuracyPercent", "foulsCommitted", "cornerKicks",
              "bigChancesCreated", "bigChancesMissed", "ppdaPress"
            ]
          }
        },
        required: ["teamA", "teamB"]
      },
      matchTimeline: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            minute: { type: Type.INTEGER },
            team: { type: Type.STRING },
            event: { type: Type.STRING, description: 'Must be one of: "Goal", "Yellow Card", "Red Card", "Substitution"' },
            player: { type: Type.STRING },
            detail: { type: Type.STRING }
          },
          required: ["minute", "team", "event", "player", "detail"]
        }
      }
    },
    required: ["winner", "finalScore", "halfTimeScore", "matchTimeline", "tacticalSummary", "teamStats"]
  };

  const simulationPrompt = `
You are an advanced football simulation data engine.
Using the team squad, tactical, and injury profiles provided below in JSON format, run a simulated match reasoning process.
We want to simulate the fixture between ${teamA} and ${teamB} ${competition ? `in ${competition}` : ''} extremely realistically, taking into account tactical styles, coaching, key players' forms, and missing players due to injuries.

--- TEAM DATA INPUTS ---
TEAM A (${teamA}):
${JSON.stringify(teamAData, null, 2)}

TEAM B (${teamB}):
${JSON.stringify(teamBData, null, 2)}

ADDITIONAL CONTEXT:
${extraContext || "None"}
GOSSIP SUMMARY:
${gossipSummary || "None"}
-------------------------

Task:
1. Reason about the matchup: how do the formations, playstyles, and squads clash?
2. Run a detailed match simulation to decide:
   - The winner ("${teamA}", "${teamB}", or "Draw").
   - The final score (formatted as "Team A Score - Team B Score", e.g. "2-1" or "0-0").
   - The halftime score (formatted similarly, e.g. "1-0" or "0-0").
   - A realistic timeline of events (e.g., goals, red cards, key substitutions/injuries during the match) with exact minutes. Ensure it is chronologically ordered and matches the final score exactly. For cards (Yellow and Red cards):
     * Do NOT generate just a single "tactical yellow card" (taktiksel sarı kart) every time. Real matches have multiple cards (typically 2 to 6 yellow cards in total across both teams, and occasionally a direct red or double-yellow red card, about a 15-20% chance).
     * Provide realistic, varied reasons for the cards, such as reckless tackles, holding back a counter-attacker, dissent/arguing with the referee, simulation, time wasting, or a dangerous slide tackle, rather than always labeling it as tactical.
     * Assign cards to realistic players from the squad profiles or realistic position designations.
   - Realistic team statistics. Ensure possessionPercent for teamA and teamB sum up to exactly 100.
   - A brief tactical summary explaining how the goals were scored or why the match ended this way based on the squads.

Return the result strictly as a valid JSON matching the requested schema.
  `;

  const simulationResponse = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: simulationPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: simulationSchema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    }
  });

  const scoreDecision = robustParseJson(simulationResponse.text || "{}");

  return { gossipSummary, teamAData, teamBData, scoreDecision, historyData };
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
export const generateTTS = async (
  text: string,
  voiceName: string,
  tone: TTSTone,
  speaker1Voice?: string,
  speaker2Voice?: string,
  targetLanguage?: Language
): Promise<{ audioUrl: string; correctedText?: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let normalizedText = normalizeSpeakerTags(text);

  // Check if text is structured for multi-speaker or if speaker voices are provided
  const isMultiSpeakerRequested = !!(speaker1Voice && speaker2Voice);
  let isMultiSpeaker = isMultiSpeakerRequested || /speaker\s+1\b/i.test(normalizedText) || /speaker\s+2\b/i.test(normalizedText);

  let correctedTextResult: string | undefined;

  if (isMultiSpeaker) {
    const lang = targetLanguage || Language.English;
    const names = getSpeakerNamesForLanguage(lang);
    const speaker1NameClean = names.speaker1.replace(/Dr(a)?\.\s*/, '').split(' ')[0];
    const speaker2NameClean = names.speaker2.replace(/Dr(a)?\.\s*/, '').split(' ')[0];

    const hasSpeaker1 = /speaker\s*1\b/i.test(normalizedText);
    const hasSpeaker2 = /speaker\s*2\b/i.test(normalizedText);
    const isMissingSpeaker = !hasSpeaker1 || !hasSpeaker2;

    if (isMissingSpeaker) {
      console.info(`🔧 [TTS:Correction] Single speaker dialogue detected. Correcting before TTS...`);
      const correctionPrompt = `
You are a screenplay editor. Correct the following single scene's dialogue in ${lang} so that it is a natural, back-and-forth conversation between Speaker 1 (Host: ${speaker1NameClean}) and Speaker 2 (Analyst: ${speaker2NameClean}).

Rules:
1. BOTH Speaker 1 and Speaker 2 MUST speak at least once.
2. The dialogue lines MUST start with "Speaker 1:" and "Speaker 2:" respectively.
3. Speaker 1 (${speaker1NameClean}) must address Speaker 2 as "${speaker2NameClean}".
4. Speaker 2 (${speaker2NameClean}) must address Speaker 1 as "${speaker1NameClean}".
5. Preserve the exact meaning, factual match details, and the brackets for tone inflections (e.g. [excitedly], [calm]) from the original text.

Original text:
${text}

Return ONLY the corrected script, matching this exact format (do not write any json, markdown blocks, or other text):
Speaker 1: [excitedly] ...
Speaker 2: [calm] ...
`;

      try {
        const fixResponse = await ai.models.generateContent({
          model: MODELS.scriptGen,
          contents: correctionPrompt
        });
        const fixText = fixResponse.text?.trim();
        if (fixText && /speaker\s*1\b/i.test(fixText) && /speaker\s*2\b/i.test(fixText)) {
          console.info(`🔧 [TTS:Correction] Successfully corrected text:`, fixText);
          normalizedText = normalizeSpeakerTags(fixText);
          correctedTextResult = normalizedText;
        }
      } catch (err) {
        console.error("❌ [TTS:Correction] Failed to correct text via LLM:", err);
      }
    }
  }

  // Clean [whisper] or [whispers] out of the voiceover prompt to prevent it from being spoken/generating issues
  const sanitizedText = normalizedText.replace(/\[whispers?\]/gi, '');

  // Format transcript so that each Speaker starts on a new line with a blank line before it
  let formattedText = sanitizedText;
  if (isMultiSpeaker) {
    formattedText = sanitizedText
      .replace(/\s*(Speaker\s*1\b)/gi, '\n\nSpeaker 1')
      .replace(/\s*(Speaker\s*2\b)/gi, '\n\nSpeaker 2')
      .trim();
  }

  let response;
  if (isMultiSpeaker) {
    const languageString = targetLanguage || 'English';
    const isEnglish = languageString.toLowerCase() === 'english';
    const speaker1Accent = isEnglish ? 'North American' : `Native ${languageString}`;
    const speaker2Accent = isEnglish ? 'British' : `Native ${languageString}`;

    const languageInstruction = isEnglish
      ? ""
      : `Language: ${languageString}. Both Speaker 1 and Speaker 2 MUST speak entirely in ${languageString} with an authentic native ${languageString} accent and native pronunciation. Under no circumstances should they speak or switch to English.`;

    const directorsNote = `Read the following transcript in ${languageString} based on the audio profile and director's note.

# Audio Profile
For Speaker 1: Energetic and professional male
For Speaker 2: Calm and fast-medium female

# Director's note
For Speaker 1: Style: High energy, passionate, enthusiastic, punchy consonants, elongated vowels on excitement words, representing the emotional football fan. Pace: Fast, energetic, no dead air. Sentences overlap slightly. Accent: ${speaker1Accent}.
For Speaker 2: Style: Calm, authoritative, objective, rational, intellectual, clear enunciated, emphasizing data and statistics. Pace: Fast, yet confident and measured. Accent: ${speaker2Accent}.
${languageInstruction ? `For both speakers: ${languageInstruction}` : ''}

## Scene:
A premium, modern sports broadcasting studio. Professional high-end podcast setup with clean, crisp acoustics. No background noise. The atmosphere is energetic, intellectual, and serious, exactly like a top-tier pre-match analysis television show.

## Sample Context:
Two people are hosting a football analysis podcast. Speaker 1 is a passionate, energetic sports host who represents the emotional football fan. Speaker 2 is a calm, highly analytical data scientist who relies only on 10,000 match simulations and statistics. They are engaging in a dynamic, fast-paced back-and-forth conversation, contrasting emotional sports hype with data logic.

## Transcript:
${formattedText}`;

    // Log the multi-speaker prompt to local server
    try {
      await fetch('http://localhost:3001/api/log-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: directorsNote,
          text: formattedText,
          isMultiSpeaker: true,
          voiceName: `${speaker1Voice || 'Enceladus'} & ${speaker2Voice || 'Kore'}`,
          tone: tone
        })
      });
    } catch (e) {
      console.warn("⚠️ Failed to call /api/log-tts:", e);
    }

    response = await ai.models.generateContent({
      model: MODELS.tts,
      contents: [{ parts: [{ text: directorsNote }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: 'Speaker 1',
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: (speaker1Voice as any) || 'Enceladus' }
                }
              },
              {
                speaker: 'Speaker 2',
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: (speaker2Voice as any) || 'Kore' }
                }
              }
            ]
          }
        }
      }
    });
  } else {
    const textWithTone = `(Spoken in a ${tone} tone) ${sanitizedText}`;

    // Log the single speaker prompt to local server
    try {
      await fetch('http://localhost:3001/api/log-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textWithTone,
          text: sanitizedText,
          isMultiSpeaker: false,
          voiceName: voiceName,
          tone: tone
        })
      });
    } catch (e) {
      console.warn("⚠️ Failed to call /api/log-tts:", e);
    }

    response = await ai.models.generateContent({
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
  }

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("TTS failed");

  const pcmBytes = base64ToUint8Array(base64Audio);
  const wavBytes = addWavHeader(pcmBytes, 24000, 1, 16);
  const wavBase64 = uint8ArrayToBase64(wavBytes);

  return {
    audioUrl: `data:audio/wav;base64,${wavBase64}`,
    correctedText: correctedTextResult
  };
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
  customVisualPrompt?: string,
  imageGenerator?: 'xAI' | 'Gemini'
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const contentParts: any[] = [];
  let charInstructions = "";

  const detailedStyle = resolveArtStyleDescription(style);

  // Segment characters to focus strictly on 1 or 2 key players, as requested by strict composition rules
  let characterFocusPrompt = "";
  let mainFocusChar: Character | null = null;
  let secondaryFocusChar: Character | null = null;

  if (characters.length > 0) {
    const players = characters.filter(c =>
      c.description.toLowerCase().includes("player") ||
      c.description.toLowerCase().includes("striker") ||
      c.description.toLowerCase().includes("goalkeeper") ||
      c.description.toLowerCase().includes("midfielder") ||
      c.description.toLowerCase().includes("defender") ||
      c.description.toLowerCase().includes("captain")
    );

    mainFocusChar = players.length > 0 ? players[0] : characters[0];
    secondaryFocusChar = players.length > 1 ? players[1] : null;

    characterFocusPrompt = `
      CHARACTER COMPOSITION & LIMITS:
      - STRICT LIMIT: Include ONLY one or two key player characters in the thumbnail. Do NOT clutter the background with other characters, head coaches, referees, or extra background actors.
      - PRIMARY FOCAL CHARACTER: ${mainFocusChar.name}. Place them in sharp, hyper-detailed focus in the foreground with an intense, raw emotional reaction (screaming in passion, celebration, or shock).
    `;
    if (secondaryFocusChar) {
      characterFocusPrompt += `- SECONDARY FOCAL CHARACTER: ${secondaryFocusChar.name}. Positioned near the center-ground, sharing dynamic spotlight. \n`;
    }
  }

  // Filter for valid references of ONLY the focal characters to keep composition strictly clean
  const activeFocalChars = [mainFocusChar, secondaryFocusChar].filter((c): c is Character => !!c);
  const charsWithRefs = activeFocalChars.filter(c => c.referenceImageUrl);

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

  const premiumTemplate = `
      ROLE: Master YouTube CTR Thumbnail Artist.
      TASK: Create a professional, high-impact YouTube Thumbnail in 16:9 widescreen format designed for maximum CTR.

      ART STYLE RULE:
      ${detailedStyle}. Widescreen cinematic CGI render, octane render, rich textures, deep shadows, dramatic highlights, volumetric light shafts.

      VISUAL STAGE DIRECTIVE (Variable Context Injected):
      ${customVisualPrompt || storyContext}

      ${characterFocusPrompt}

      ${charInstructions}

      HIGH-CTR COMPOSITION & LIGHTING PROTOCOLS:
      1. RULE OF THIRDS: The primary face and character must be positioned off-center (left or right third) with clear sightlines.
      2. DRAMATIC split-screen or color contrast dividing the background with saturated glowing colors (e.g., neon team-colored energy clashing).
      3. CINEMATIC DEPTH: Moody stadium atmosphere at night, volumetric fog/dust particles catching the bright spotlights, shallow depth of field.
      4. TEXT LAYOUT SPACE: Keep the middle-center, bottom-left area clean and high-contrast to allow bold text overlays without obscuring important character faces.
      
      REQUIREMENTS:
      - 16:9 widescreen ratio.
      - Vibrant colors, ultra-high contrast, hyper-realistic skin textures, sweat and emotion.
      - NO spelling text, names, team names, labels, letters, or spelling graphics generated directly on the image. Make it a clean, professional, completely text-free visual cover.
      - Ensure there is proper empty space in the middle-center bottom area and the top corners, leaving room for programmatic overlay text and flag elements.
  `;

  if (imageGenerator === 'xAI') {
    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      console.warn("⚠️ XAI_API_KEY not found in environment variables. Falling back to Gemini for thumbnail.");
    } else {
      try {
        const imageUrls: string[] = [];
        if (charsWithRefs.length > 0) {
          for (const char of charsWithRefs) {
            if (char.referenceImageUrl) {
              const base64Data = await urlToBase64(char.referenceImageUrl);
              if (base64Data) {
                imageUrls.push(`data:image/png;base64,${base64Data}`);
              }
            }
          }
        }

        // Log the thumbnail prompt to local server
        try {
          await fetch('http://localhost:3001/api/log-image-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: premiumTemplate,
              type: 'thumbnail',
              identifier: projectTitle || 'YouTube Thumbnail',
              style: style,
              aspectRatio: '16:9'
            })
          });
        } catch (e) {
          console.warn("⚠️ Failed to call /api/log-image-prompt for thumbnail:", e);
        }

        return await generateImageXAI(premiumTemplate, '16:9', imageUrls);
      } catch (err) {
        console.error("❌ xAI Thumbnail generation failed:", err);
        console.warn("⚠️ Falling back to Gemini for thumbnail generation due to xAI error.");
      }
    }
  }

  // Log the thumbnail prompt to local server for Gemini
  try {
    await fetch('http://localhost:3001/api/log-image-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: premiumTemplate,
        type: 'thumbnail',
        identifier: projectTitle || 'YouTube Thumbnail',
        style: style,
        aspectRatio: '16:9'
      })
    });
  } catch (e) {
    console.warn("⚠️ Failed to call /api/log-image-prompt for thumbnail:", e);
  }

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
): Promise<{ topLeftText: string; titleText: string; subtitleText: string; topRightText: string; customVisualPrompt: string }> => {
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
    2. The generated image must be a high-contrast split-screen or diagonal split composition showing the star player from Team A on one side and the star player from Team B on the other side directly inside the single generated image (no separate player cutout PNG overlays will be used).
    3. The background base image must be completely clean and text-free. Do NOT write any spelling text, names, team names, scores, country flags, labels, letters, or spelling graphics on the image. Scores, text badges, and country flags are burned programmatically in post-production.
    4. STRICT LIMIT: Include ONLY one or two key player characters in the thumbnail. Do NOT clutter the background with other characters, head coaches, referees, or extra background actors.
    5. Generate a highly clickable, dramatic Title Text in the target language: ${targetLanguage}. The Title Text MUST follow the format "Team A vs Team B" (translated/localized for the target language if necessary, e.g. "TEAM A vs TEAM B", "TEAM A contra TEAM B", "TEAM A vs. TEAM B" etc.). Do NOT add any extra slogan, suffix, or descriptive text (such as ": World Cup Clash" or similar). Maintain case sensitivity.
    6. Generate a Subtitle Text in the target language: ${targetLanguage}. Default to translating/localizing the template "${parsedComp}". Maintain case sensitivity.
    7. Generate a Top-Right badge text in the target language: ${targetLanguage}. Default to translating/localizing the template "10K Times Simulated with AI". Maintain case sensitivity.
    8. Generate a short, high-impact Top-Left badge text (representing drama, spoiler-free "Open Loop" teaser) in the target language: ${targetLanguage}.
       Examples based on the match context:
       - Default/General: "WINNER PREDICTED!", "AI PREDICTED!"
       - Late Goal / Drama / Tension in Match: "90'+5 DRAMA!", "LAST SECOND!", "90'+2 DECIDER!"
       - Red Card / High Controversy: "RED CARD!", "CONTROVERSY!"
       Keep it very short (max 2-3 words).
    9. Generate a highly detailed, professional visual prompt in ENGLISH for an image generator AI model describing the visual composition perfectly.
    
    VISUAL PROMPT TEMPLATE to follow:
    "An epic, high-contrast YouTube Thumbnail for the ${parsedComp} match between ${teamA} and ${teamB}. Split-screen or diagonal dynamic split composition showing a star player from Team A on one side and a star player from Team B on the other side.
    [Vivid description of only one or two key player characters from Team A and/or Team B in sharp focus, screaming in triumph/emotion, hyper-detailed faces, wearing their team kits, rendered directly on their respective sides of the split screen].
    CRITICAL: The background image must be completely clean and text-free. Do NOT write any spelling text, names, team names, scores, flags, labels, letters, or spelling graphics on the image. Ensure the middle-center bottom area and the top corners are kept relatively clear of faces and clutter to leave space for programmatic overlay text and flags.
    Background: A massive, packed football stadium at night under bright stadium floodlights with dramatic volumetric fog, neon stadium lights representing [Team A color] and [Team B color] clashing on their respective halves of the split.
    Cinematic lighting, dynamic low-angle wide shot, rule of thirds, highly detailed, Unreal Engine 5 style."

    Return a JSON response exactly in this format:
    {
      "topLeftText": "High-CTR top-left badge text in ${targetLanguage} (representing drama/teaser, e.g. 'WINNER PREDICTED!', '90\\'+5 GOAL!')",
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
    topLeftText: parsed.topLeftText || "WINNER PREDICTED!",
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
  topLeftText: string,
  targetLanguage: Language
): Promise<{ titleText: string; subtitleText: string; topRightText: string; topLeftText: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const targetLangStr = targetLanguage === Language.Portuguese ? "Portuguese (specifically Brazilian Portuguese, Português Brasileiro)" : targetLanguage;
  const prompt = `
    You are a professional localizer and growth hacker.
    Translate and adapt these four YouTube thumbnail texts to ${targetLangStr}.
    Maintain the same high emotional energy and click-worthiness. 
    Keep them concise but fully translated, preserving the meaning and case structure of the original texts.

    CRITICAL RULE FOR TITLE: The titleText MUST follow the format "Team A vs Team B" (where 'vs' is translated/adapted to target language if necessary, e.g. 'vs', 'vs.', 'contra', 'karşı karşıya'). Do NOT add any extra slogan, suffix, or descriptive text (such as ": World Cup Clash" or similar).

    Original Top-Left Badge: "${topLeftText}"
    Original Title: "${titleText}"
    Original Subtitle: "${subtitleText}"
    Original Top-Right Badge: "${topRightText}"

    Output JSON format:
    {
      "topLeftText": "Translated top-left badge (drama/teaser)",
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
    let finalTopLeft = parsed.topLeftText || topLeftText;
    if (targetLanguage === Language.Turkish && (!parsed.topLeftText || parsed.topLeftText.toUpperCase().includes("WINNER PREDICTED") || parsed.topLeftText.toUpperCase().includes("KAZANAN TAHMIN") || parsed.topLeftText.toUpperCase().includes("KAZANAN ÖNGÖRÜ"))) {
      finalTopLeft = parsed.topLeftText || "KAZANAN TAHMİN EDİLDİ!";
    }
    return {
      topLeftText: finalTopLeft,
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
    let fallbackTopLeft = topLeftText;
    if (targetLanguage === Language.Turkish && topLeftText.toUpperCase().includes("WINNER PREDICTED")) {
      fallbackTopLeft = "KAZANAN TAHMİN EDİLDİ!";
    }
    return { topLeftText: fallbackTopLeft, titleText, subtitleText, topRightText: fallbackTopRight };
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
  targetLanguage: Language,
  appMode?: AppMode,
  footballInput?: { teamA: string; teamB: string; competition: string; extraContext: string }
): Promise<Record<number, any>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const sceneData = scenes.map(s => ({
    id: s.id,
    voiceover: s.voiceoverScript,
    overlays: s.overlays.map(o => o.text),
    imageOverlayText: s.imageOverlayText
  }));

  const targetLangStr = targetLanguage === Language.Portuguese ? "Portuguese (specifically Brazilian Portuguese, Português Brasileiro)" : targetLanguage;

  let prompt = "";

  if (appMode === AppMode.Football && footballInput) {
    const { teamA, teamB, competition } = footballInput;
    prompt = `
      You are an expert native sports analyst, television commentator, and football writer.
      Your task is to write an engaging, natural, and completely native dialogue script in ${targetLangStr} for a football analysis podcast about the simulated match between "${teamA}" and "${teamB}" in the competition "${competition}".
      
      You will be given the original English scenes as a FACTUAL source. You MUST keep all original facts 100% correct, including:
      - Match details, player names, and statistics.
      - Minute numbers of goals, red cards, or substitutions.
      - Disagreements, talking points, and tactical options mentioned.
      
      STRICT WRITING RULES:
      1. NATIVE GENERATION (DO NOT DO A LITERAL TRANSLATION): Do not translate the English text word-for-word. Rewrite the entire dialogue in ${targetLangStr} to sound like a natural, native conversation between a passionate host and an analytical data expert. Use local football commentary slang, idioms, and natural sentence flows. Every word of the generated dialogue for both Speaker 1 and Speaker 2 MUST be in ${targetLangStr}. In particular, prevent Speaker 2 (the female Data Analyst) from speaking or slipping into English.
      2. TWO-SPEAKER SYSTEM: Every scene voiceover MUST consist of dialogue lines alternating between:
         - "Speaker 1:" (Host: male, high energy, enthusiastic football fan)
         - "Speaker 2:" (Data Analyst: female, calm, objective, analytical data expert)
         Each line in the script MUST start with "Speaker 1:" or "Speaker 2:" exactly.
      3. TONE & PERFORMANCE BRACKETS: You MUST preserve the expressive emotion or performance tags in square brackets immediately after the speaker name, e.g. "Speaker 1: [excitedly] ..." or "Speaker 2: [calm] ...". Keep these tags in English (e.g. [excitedly], [sighs], [surprised], [dramatically], [laughs], [screaming]) at the start of sentences. Do NOT translate or modify any text inside the square brackets.
      4. PACING & LENGTH: Keep the dialogue length and word count per scene roughly similar to the original English scenes to align with the visual and audio pacing of the video.
      5. ON-SCREEN OVERLAYS: Translate and localize the on-screen overlays text into natural, native ${targetLangStr} expressions.
      
      Original English Scenes:
      ${JSON.stringify(sceneData, null, 2)}
      
      Output JSON format:
      {
        "localizations": [
          {
            "id": 0,
            "voiceover": "Natively drafted dialogue script in ${targetLangStr} following the strict rules...",
            "overlays": ["Translated/localized overlay 1", "Translated/localized overlay 2", "Translated/localized overlay 3"],
            "imageOverlayText": "Translated/localized image overlay text"
          }
        ]
      }
    `;
  } else {
    prompt = `
      You are an expert native writer, creative localizer, and dialogue script editor.
      Your task is to write an engaging, natural, and completely native script in ${targetLangStr} for a storytelling video.
      
      You will be given the original English scenes as a FACTUAL source. You MUST keep the storyline, characters, plot points, and sequence 100% correct and identical.
      
      STRICT WRITING RULES:
      1. NATIVE DIALOGUE (DO NOT DO A LITERAL TRANSLATION): Do not translate the English text word-for-word. Rewrite the text natively in ${targetLangStr} using local idioms, colloquial phrasing, and a flow that sounds native and engaging when spoken by a voice actor. The dialogue lines for all speakers must be drafted entirely in ${targetLangStr} with no English words or phrases mixed in.
      2. DIALOGUE FORMAT: If the voiceover has speaker tags (e.g., "Speaker 1:", "Speaker 2:"), you MUST preserve them exactly at the beginning of the lines.
      3. PERFORMANCE BRACKETS: Keep the bracketed performance directions (like [excitedly], [whispering], [sighs]) exactly as they are in English inside the translated script. Do NOT translate the text inside the brackets.
      4. PACING & LENGTH: Keep the script length and pacing similar to the original to fit the visual scene timing.
      5. ON-SCREEN OVERLAYS: Localize the on-screen overlay text into natural, native ${targetLangStr} expressions.
      
      Original English Scenes:
      ${JSON.stringify(sceneData, null, 2)}
      
      Output JSON format:
      {
        "localizations": [
          {
            "id": 0,
            "voiceover": "Natively drafted script in ${targetLangStr} following the strict rules...",
            "overlays": ["Translated/localized overlay 1", "Translated/localized overlay 2", "Translated/localized overlay 3"],
            "imageOverlayText": "Translated/localized image overlay text"
          }
        ]
      }
    `;
  }

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
      const originalScene = scenes.find(s => String(s.id) === String(loc.id));
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

export const translateTeamData = async (teamData: any, targetLang: string): Promise<any> => {
  if (!teamData) return null;
  const isEnglish = targetLang.toLowerCase() === 'english' || targetLang.toLowerCase() === 'en';
  if (isEnglish) return teamData;

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const playStyleSummary = teamData.head_coach?.play_style_summary || '';
  const position = teamData.key_players?.[0]?.position || '';
  const performanceStats = teamData.key_players?.[0]?.performance_stats || '';

  if (!playStyleSummary && !position && !performanceStats) {
    return teamData;
  }

  const prompt = `
    You are a professional sports translator. Translate the following football-related texts into the target language: "${targetLang}".
    
    Texts to translate:
    1. Coach Play Style Summary: "${playStyleSummary}"
    2. Player Position: "${position}"
    3. Player Performance Stats Summary: "${performanceStats}"
    
    Rules:
    - Keep the translation natural, accurate, and specific to football terminology in the target language.
    - Translate text 1 into a concise, natural phrase or sentence.
    - Translate text 2 into the standard, common player position name in "${targetLang}" (e.g. "Attacking Midfielder" -> "Ofansif Orta Saha" in Turkish, "Offensiver Mittelfeldspieler" in German, etc.).
    - Translate text 3 (which can be a long sentence/description) into a natural, grammatically correct sentence in "${targetLang}".
    - Return ONLY a JSON object matching this structure:
    {
      "playStyleSummary": "translated text 1",
      "position": "translated text 2",
      "performanceStats": "translated text 3"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODELS.scriptGen,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const parsed = robustParseJson(response.text || "{}");

    const translated = JSON.parse(JSON.stringify(teamData));

    if (translated.head_coach && parsed.playStyleSummary) {
      translated.head_coach.play_style_summary = parsed.playStyleSummary;
    }
    if (translated.key_players?.[0]) {
      if (parsed.position) {
        translated.key_players[0].position = parsed.position;
      }
      if (parsed.performanceStats) {
        translated.key_players[0].performance_stats = parsed.performanceStats;
      }
    }
    return translated;
  } catch (err) {
    console.error(`❌ [translateTeamData] Error translating team data for ${targetLang}:`, err);
    return teamData;
  }
};

