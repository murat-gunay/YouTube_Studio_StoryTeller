/// <reference lib="dom" />
import React, { useState, useRef } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(blob);
        setHasRecorded(true);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-600 rounded-xl bg-slate-800/50">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all duration-300 ${isRecording ? 'bg-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-indigo-600'}`}>
        {isRecording ? (
           <div className="w-6 h-6 bg-white rounded-sm" />
        ) : (
           <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
           </svg>
        )}
      </div>
      
      <div className="flex gap-4">
        {!isRecording ? (
          <button 
            onClick={startRecording}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium transition-colors"
          >
            {hasRecorded ? 'Record Again' : 'Start Recording'}
          </button>
        ) : (
          <button 
            onClick={stopRecording}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-colors"
          >
            Stop Recording
          </button>
        )}
      </div>
      
      <p className="mt-4 text-slate-400 text-sm">
        {isRecording ? 'Recording... Tell your story in Turkish.' : hasRecorded ? 'Recording saved!' : 'Click to start recording your story.'}
      </p>
    </div>
  );
};