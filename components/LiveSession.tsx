
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

interface LiveSessionProps {
  onClose: () => void;
}

export const LiveSession: React.FC<LiveSessionProps> = ({ onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'active' | 'error'>('connecting');
  const [transcription, setTranscription] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Helper: Base64 decoding
  function decode(base64: string) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Helper: PCM decoding
  async function decodeAudioData(data: Uint8Array, ctx: AudioContext) {
    const dataInt16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  }

  // Helper: Base64 encoding
  function encode(bytes: Uint8Array) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  useEffect(() => {
    let scriptProcessor: ScriptProcessorNode;
    let micStream: MediaStream;

    const startSession = async () => {
      try {
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = { input: inputCtx, output: outputCtx };

        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
            systemInstruction: 'You are a supportive, gentle, and non-judgmental listener for a teenager. Keep responses short and focused on empathy. Encourage them to vent. Do not offer clinical medical advice.',
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              setStatus('active');
              const source = inputCtx.createMediaStreamSource(micStream);
              scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                if (isMuted) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                
                sessionPromise.then(s => s.sendRealtimeInput({
                  media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' }
                }));
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
              if (msg.serverContent?.outputTranscription) {
                setTranscription(prev => (prev + ' ' + msg.serverContent!.outputTranscription!.text).slice(-200));
              }

              const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioData && outputCtx) {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const buffer = await decodeAudioData(decode(audioData), outputCtx);
                const source = outputCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(outputCtx.destination);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
              }

              if (msg.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
              }
            },
            onerror: () => setStatus('error'),
            onclose: () => onClose(),
          }
        });

        sessionRef.current = await sessionPromise;
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    };

    startSession();

    return () => {
      if (sessionRef.current) sessionRef.current.close();
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) {
        audioContextRef.current.input.close();
        audioContextRef.current.output.close();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="absolute top-6 right-6">
        <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>

      <div className="relative mb-12">
        <div className={`w-48 h-48 rounded-full bg-blue-500/20 flex items-center justify-center ${status === 'active' ? 'animate-pulse' : ''}`}>
          <div className={`w-32 h-32 rounded-full bg-blue-500/40 flex items-center justify-center`}>
            <div className={`w-20 h-20 rounded-full bg-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.5)] flex items-center justify-center`}>
              <i className="fa-solid fa-microphone text-3xl"></i>
            </div>
          </div>
        </div>
        {status === 'connecting' && <p className="mt-8 text-blue-300 font-medium">Connecting to MindEase Listener...</p>}
        {status === 'active' && <p className="mt-8 text-blue-200 font-medium">I'm listening. Tell me what's on your mind.</p>}
        {status === 'error' && <p className="mt-8 text-red-400 font-medium">Oops! Something went wrong with the connection.</p>}
      </div>

      <div className="max-w-md w-full mb-12 h-20 overflow-hidden text-slate-400 italic text-sm">
        {transcription || "..."}
      </div>

      <div className="flex gap-6">
        <button 
          onClick={() => setIsMuted(!isMuted)}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}
        >
          <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
        </button>
        <button 
          onClick={onClose}
          className="px-10 py-4 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-100 transition-colors"
        >
          End Session
        </button>
      </div>
      
      <p className="mt-8 text-[10px] text-slate-500 uppercase tracking-widest">Live Empathy Session Powered by Gemini</p>
    </div>
  );
};
