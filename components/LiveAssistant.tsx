/// <reference lib="dom" />
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MODELS } from '../constants';

// Helper to encode PCM for Live API
const createPcmBlob = (data: Float32Array): { data: string, mimeType: string } => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return {
    data: base64,
    mimeType: 'audio/pcm;rate=16000',
  };
};

// Helper decode
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper decodeAudioData
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const LiveAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  
  // Refs for audio handling
  const nextStartTime = useRef(0);
  const inputAudioContext = useRef<AudioContext | null>(null);
  const outputAudioContext = useRef<AudioContext | null>(null);
  const inputNode = useRef<GainNode | null>(null);
  const outputNode = useRef<GainNode | null>(null);
  const sources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startSession = async () => {
    setIsActive(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    inputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
    outputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    inputNode.current = inputAudioContext.current.createGain();
    outputNode.current = outputAudioContext.current.createGain();
    outputNode.current.connect(outputAudioContext.current.destination);
    
    streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

    const sessionPromise = ai.live.connect({
      model: MODELS.live,
      callbacks: {
        onopen: () => {
          console.log("Live Session Open");
          if (!inputAudioContext.current || !streamRef.current) return;

          const source = inputAudioContext.current.createMediaStreamSource(streamRef.current);
          const scriptProcessor = inputAudioContext.current.createScriptProcessor(4096, 1, 1);
          
          scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
             const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
             const pcmBlob = createPcmBlob(inputData);
             sessionPromise.then(session => {
               session.sendRealtimeInput({ media: pcmBlob });
             });
          };

          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.current.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          
          if (base64EncodedAudioString && outputAudioContext.current && outputNode.current) {
            nextStartTime.current = Math.max(nextStartTime.current, outputAudioContext.current.currentTime);
            
            const audioBuffer = await decodeAudioData(
              decode(base64EncodedAudioString),
              outputAudioContext.current,
              24000,
              1
            );

            const source = outputAudioContext.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputNode.current);
            
            source.addEventListener('ended', () => {
              sources.current.delete(source);
            });

            source.start(nextStartTime.current);
            nextStartTime.current += audioBuffer.duration;
            sources.current.add(source);
          }
        },
        onclose: () => {
          console.log("Live Session Closed");
          setIsActive(false);
        },
        onerror: (err) => {
          console.error("Live Session Error", err);
          setIsActive(false);
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
        },
        systemInstruction: "You are a creative assistant helping a YouTuber brainstorm story ideas. Be brief, energetic, and helpful."
      }
    });
    
    sessionPromiseRef.current = sessionPromise;
  };

  const stopSession = () => {
    // Close stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    // Close context
    if (inputAudioContext.current) inputAudioContext.current.close();
    if (outputAudioContext.current) outputAudioContext.current.close();
    
    // Close session
    sessionPromiseRef.current?.then(session => session.close());
    setIsActive(false);
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full shadow-lg hover:shadow-2xl hover:scale-105 transition-all z-50 group"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <span className="absolute right-full mr-3 top-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
          Brainstorm with Gemini
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-fade-in">
      <div className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
        <h3 className="text-white font-medium flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          Creative Assistant
        </h3>
        <button onClick={() => { stopSession(); setIsOpen(false); }} className="text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      
      <div className="p-6 flex flex-col items-center justify-center gap-4 bg-slate-800/90 h-48">
         <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.3)]' : 'bg-slate-700'}`}>
            <div className={`w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 ${isActive ? 'animate-bounce' : ''}`}></div>
         </div>
         <p className="text-slate-300 text-sm text-center">
           {isActive ? 'Listening... Speak to brainstorm.' : 'Start a live conversation to get ideas.'}
         </p>
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-700">
         {!isActive ? (
           <button onClick={startSession} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm font-medium transition-colors">
             Start Voice Chat
           </button>
         ) : (
           <button onClick={stopSession} className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-colors">
             End Session
           </button>
         )}
      </div>
    </div>
  );
};