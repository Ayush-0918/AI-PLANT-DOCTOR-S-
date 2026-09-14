'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Sparkles,
  Leaf,
  Camera,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  RotateCcw,
  ShoppingBag,
  CloudSun,
  Sprout,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useFarmerProfile } from '@/context/FarmerProfileContext';
import {
  ChatMessageItem,
  askFarmerAssistant,
  transcribeAudioBlob,
  synthesizeSpeech,
  analyzeLeafImage,
  resetConversationSession,
} from '@/services/aiAssistantService';

const GREETINGS: Record<string, string> = {
  English: 'Namaste Kisan Ji! Ask anything about your crops, diseases, or prices.',
  'हिंदी': 'नमस्ते किसान जी! अपनी फसल, बीमारी या मंडी भाव के बारे में पूछें।',
  'भोजपुरी': 'प्रणाम किसान भाई! फसल, बीमारी या मंडी भाव के बारे में पूछीं।',
  'ਪੰਜਾਬੀ': 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਕਿਸਾਨ ਵੀਰ ਜੀ! ਫ਼ਸਲ, ਬਿਮਾਰੀ ਜਾਂ ਮੰਡੀ ਭਾਅ ਬਾਰੇ ਪੁੱਛੋ।',
};

const LABELS: Record<
  string,
  {
    title: string;
    subTitle: string;
    listening: string;
    thinking: string;
    speaking: string;
    placeholder: string;
    tapToSpeak: string;
    stopListening: string;
    clearChat: string;
    photoAction: string;
    mandiAction: string;
    weatherAction: string;
    dosageAction: string;
  }
> = {
  English: {
    title: 'Sahayak',
    subTitle: 'AI',
    listening: 'Listening… speak clearly',
    thinking: 'Understanding your question…',
    speaking: 'Sahayak is speaking…',
    placeholder: 'Ask your farming question…',
    tapToSpeak: 'Tap to Speak',
    stopListening: 'Stop Listening',
    clearChat: 'Reset',
    photoAction: '📷 Send Photo',
    mandiAction: '💰 Mandi Rates',
    weatherAction: '🌤️ Weather',
    dosageAction: '🌾 Fertilizer Advice',
  },
  'हिंदी': {
    title: 'सहायक',
    subTitle: 'AI',
    listening: '🔴 सुन रहा हूँ जी... बोलिए',
    thinking: '⏳ सवाल समझ रहा हूँ...',
    speaking: '🔊 जवाब बोल रहा हूँ...',
    placeholder: 'अपना सवाल लिखें या बोलें…',
    tapToSpeak: '🎙️ बोलकर पूछें (Tap to Speak)',
    stopListening: 'रोकें',
    clearChat: 'रीसेट',
    photoAction: '📷 फोटो भेजें',
    mandiAction: '💰 मंडी भाव',
    weatherAction: '🌤️ मौसम',
    dosageAction: '🌾 खाद सलाह',
  },
  'भोजपुरी': {
    title: 'सहायक',
    subTitle: 'AI',
    listening: '🔴 सुनत बानी जी... बोलीं',
    thinking: '⏳ बात समझत बानी...',
    speaking: '🔊 जवाब बोलत बानी...',
    placeholder: 'अपन सवाल लिखीं या बोलीं…',
    tapToSpeak: '🎙️ बोल के पूछीं (Tap to Speak)',
    stopListening: 'रोकीं',
    clearChat: 'रीसेट',
    photoAction: '📷 फोटो भेजीं',
    mandiAction: '💰 मंडी भाव',
    weatherAction: '🌤️ मौसम',
    dosageAction: '🌾 खाद सलाह',
  },
  'ਪੰਜਾਬੀ': {
    title: 'ਸਹਾਇਕ',
    subTitle: 'AI',
    listening: '🔴 ਮੈਂ ਸੁਣ ਰਿਹਾ ਹਾਂ ਜੀ... ਬੋਲੋ',
    thinking: '⏳ ਸਵਾਲ ਸਮਝ ਰਿਹਾ ਹਾਂ...',
    speaking: '🔊 ਜਵਾਬ ਸੁਣਾ ਰਿਹਾ ਹਾਂ...',
    placeholder: 'ਆਪਣਾ ਸਵਾਲ ਲਿਖੋ ਜਾਂ ਬੋਲੋ…',
    tapToSpeak: '🎙️ ਬੋਲ ਕੇ ਪੁੱਛੋ (Tap to Speak)',
    stopListening: 'ਰੋਕੋ',
    clearChat: 'ਰੀਸੈੱਟ',
    photoAction: '📷 ਫੋਟੋ ਭੇਜੋ',
    mandiAction: '💰 ਮੰਡੀ ਭਾਅ',
    weatherAction: '🌤️ ਮੌਸਮ',
    dosageAction: '🌾 ਖਾਦ ਸਲਾਹ',
  },
};

export default function SahayakPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const { profile } = useFarmerProfile();

  const labels = LABELS[language] || LABELS['English'];
  const greetingText = GREETINGS[language] || GREETINGS['English'];

  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'greeting_msg',
      role: 'assistant',
      content: greetingText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoTts, setAutoTts] = useState(true);
  const [conversationId, setConversationId] = useState<string>('');

  // Manage unique session conversation ID
  useEffect(() => {
    let cid = typeof window !== 'undefined' ? sessionStorage.getItem('sahayak_conversation_id') : null;
    if (!cid) {
      cid = typeof window !== 'undefined' && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('sahayak_conversation_id', cid);
      }
    }
    setConversationId(cid);
  }, []);

  // Image attachment
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const initialHandledRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, isSpeaking, scrollToBottom]);

  // Handle URL parameters (e.g. ?q=... or ?mode=voice)
  useEffect(() => {
    if (initialHandledRef.current) return;
    const q = searchParams?.get('q');
    const mode = searchParams?.get('mode');

    if (q && q.trim()) {
      initialHandledRef.current = true;
      handleSend(q.trim());
    } else if (mode === 'voice') {
      initialHandledRef.current = true;
      startRecording();
    }
  }, [searchParams]);

  // Auto-stop speaking audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([12]);
    }
  };

  // Play audio response string
  const playAudio = useCallback((audioData: string) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    const audio = new Audio(audioData);
    currentAudioRef.current = audio;
    setIsSpeaking(true);
    audio.play().catch(() => setIsSpeaking(false));
    audio.onended = () => setIsSpeaking(false);
    audio.onerror = () => setIsSpeaking(false);
  }, []);

  // Speak text via TTS API
  const speakMessage = async (text: string) => {
    if (isSpeaking && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    try {
      const audioUrl = await synthesizeSpeech(text, language);
      if (audioUrl) {
        playAudio(audioUrl);
      } else {
        // Fallback to SpeechSynthesis API if backend fails
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(text.replace(/NAVIGATE:\S+/g, ''));
          u.lang = language === 'English' ? 'en-IN' : 'hi-IN';
          u.onend = () => setIsSpeaking(false);
          u.onerror = () => setIsSpeaking(false);
          window.speechSynthesis.speak(u);
        } else {
          setIsSpeaking(false);
        }
      }
    } catch {
      setIsSpeaking(false);
    }
  };

  // Process sending a text or image message
  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText !== undefined ? overrideText : inputText).trim();
    if (!textToSend && !selectedImage) return;

    triggerHaptic();

    const userMsg: ChatMessageItem = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: textToSend,
      image: imagePreview || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    const curImg = selectedImage;
    setSelectedImage(null);
    setImagePreview(null);
    setIsThinking(true);

    try {
      let res: { answer: string; audio?: string | null; navigate?: string | null; conversation_id?: string };

      if (curImg) {
        const cropName = profile.crops?.[0] || '';
        res = await analyzeLeafImage(curImg, textToSend || 'Please analyze this plant sample.', cropName, language, conversationId);
      } else {
        const history = messages
          .filter((m) => m.id !== 'greeting_msg')
          .slice(-6)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        res = await askFarmerAssistant({
          message: textToSend,
          conversation_id: conversationId,
          language,
          crop: profile.crops?.[0] || '',
          location: `${profile.village}, ${profile.state}`,
          history,
          context: {
            farmer_profile: profile,
          },
        });
      }

      if (res.conversation_id && res.conversation_id !== conversationId) {
        setConversationId(res.conversation_id);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('sahayak_conversation_id', res.conversation_id);
        }
      }

      setIsThinking(false);

      const botMsg: ChatMessageItem = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: res.answer || 'Sahayak service is temporarily unavailable. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);

      // Automatic TTS if enabled or requested via voice
      if (autoTts && res.answer) {
        if (res.audio) {
          playAudio(res.audio);
        } else {
          speakMessage(res.answer);
        }
      }

      // Handle embedded navigation intents
      if (res.navigate) {
        setTimeout(() => {
          router.push(res.navigate!);
        }, 1500);
      }
    } catch {
      setIsThinking(false);
      const errMsg: ChatMessageItem = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: 'सेवा में अस्थायी समस्या है। कृपया अपना इंटरनेट कनेक्शन जांचें और पुनः प्रयास करें।',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  };

  // Auto silence detection & Speech Recognition refs
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Voice recording handlers with Auto-Silence Detection
  const startRecording = async () => {
    triggerHaptic();
    setIsRecording(true);

    // 1. Try Browser SpeechRecognition for instant live transcript & silence auto-stop
    const SpeechRecognition =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch {}
        }
        const rec = new SpeechRecognition();
        recognitionRef.current = rec;
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = language === 'English' ? 'en-IN' : (language === 'ਪੰਜਾਬੀ' ? 'pa-IN' : 'hi-IN');

        let recognizedText = '';

        rec.onresult = (e: any) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const transcript = e.results[i][0].transcript;
            if (e.results[i].isFinal) {
              recognizedText += transcript;
            } else {
              interim += transcript;
            }
          }
          const currentText = (recognizedText + interim).trim();
          if (currentText) {
            setInputText(currentText);
          }

          // Reset silence timer on every spoken word
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (rec) {
              try { rec.stop(); } catch {}
            }
          }, 1400);
        };

        rec.onend = async () => {
          setIsRecording(false);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          const finalPrompt = (inputText || recognizedText).trim();
          if (finalPrompt) {
            await handleSend(finalPrompt);
          }
        };

        rec.onerror = () => {
          setIsRecording(false);
        };

        rec.start();
        return;
      } catch {
        // Fallback to MediaRecorder + VAD AudioContext below if SpeechRecognition fails
      }
    }

    // 2. Fallback MediaRecorder + AudioContext Silence Detector
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      // AudioContext volume analyzer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let speechDetected = false;
      let silenceStart = Date.now();

      const checkSilence = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;

        if (average > 15) {
          speechDetected = true;
          silenceStart = Date.now();
        } else if (speechDetected && Date.now() - silenceStart > 1400) {
          // Auto stop after 1.4s silence after speech
          stopRecording();
          return;
        }
        requestAnimationFrame(checkSilence);
      };

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        stream.getTracks().forEach((track) => track.stop());
        if (audioCtx.state !== 'closed') try { audioCtx.close(); } catch {}
        setIsThinking(true);

        try {
          const sttRes = await transcribeAudioBlob(audioBlob, language);
          if (sttRes.text && sttRes.text.trim()) {
            await handleSend(sttRes.text);
          } else {
            setIsThinking(false);
          }
        } catch {
          setIsThinking(false);
        }
      };

      recorder.start();
      requestAnimationFrame(checkSilence);
    } catch {
      setIsRecording(false);
      alert('Microphone access denied or unavailable. Please enable microphone permissions in your browser.');
    }
  };

  const stopRecording = () => {
    triggerHaptic();
    setIsRecording(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // Image upload selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Reset conversation
  const handleReset = () => {
    triggerHaptic();
    if (conversationId) {
      resetConversationSession(conversationId, language);
    }
    const newId = typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    setConversationId(newId);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('sahayak_conversation_id', newId);
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
    setMessages([
      {
        id: `greeting_${Date.now()}`,
        role: 'assistant',
        content: greetingText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="relative flex flex-col flex-1 h-full min-h-0 bg-[#f8fafc] dark:bg-[#0b1322] overflow-hidden">
      {/* ── HEADER ── */}
      <header className="shrink-0 px-3.5 py-2.5 relative overflow-hidden z-30 bg-emerald-50/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-emerald-200/50 dark:border-slate-800 shadow-sm">
        {/* Ambient emerald orb */}
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => {
                triggerHaptic();
                router.back();
              }}
              className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white border border-emerald-200/60 dark:border-slate-700 shadow-sm transition-colors"
              aria-label="Go Back"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" style={{ boxShadow: '0 0 0 3px rgba(16,185,129,0.2)', animation: 'glow-pulse 2s ease-in-out infinite' }} />
              <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                {labels.title}
                <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/80 border border-emerald-200/70 dark:border-emerald-800/80 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                  {labels.subTitle}
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setAutoTts(!autoTts)}
              className={`h-8 w-8 rounded-xl border text-xs font-bold transition-all flex items-center justify-center shrink-0 shadow-sm ${
                autoTts
                  ? 'bg-emerald-100/80 border-emerald-300/80 text-emerald-700 dark:bg-emerald-950/70 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-white/80 border-slate-200/80 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
              }`}
              title="Toggle Auto Voice Response"
              aria-label="Toggle Auto Voice Response"
            >
              {autoTts ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>

            <button
              onClick={handleReset}
              className="h-8 flex items-center gap-1.5 px-3 rounded-xl bg-white/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white transition-colors shadow-sm whitespace-nowrap shrink-0"
            >
              <RefreshCw size={13} />
              <span>{labels.clearChat}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── CHAT MESSAGES AREA ── */}
      <div
        ref={chatContainerRef}
        className="flex-1 min-h-0 px-4 pt-4 pb-3 space-y-4 overflow-y-auto overscroll-contain hide-scrollbar"
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-[1.75rem] p-4 text-sm leading-relaxed ${
                  isUser
                    ? 'chat-bubble-user text-white rounded-br-none'
                    : 'chat-bubble-bot text-slate-800 dark:text-slate-100 rounded-bl-none'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100/80 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Sahayak • सहायक
                      </span>
                    </div>
                    <button
                      onClick={() => speakMessage(msg.content)}
                      className="p-1 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                )}

                {msg.image && (
                  <div className="mb-3 rounded-2xl overflow-hidden border border-white/20">
                    <img
                      src={msg.image}
                      alt="Attached plant leaf sample"
                      className="max-h-48 w-full object-cover"
                      onLoad={scrollToBottom}
                    />
                  </div>
                )}

                <p className="whitespace-pre-line font-medium">{msg.content.replace(/NAVIGATE:\S+/g, '')}</p>
              </div>

              <span className="text-[10px] text-slate-400 font-bold mt-1 px-1">
                {msg.timestamp}
              </span>
            </motion.div>
          );
        })}

        {/* Thinking Indicator */}
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start"
          >
            <div className="chat-bubble-bot rounded-[1.5rem] rounded-bl-none p-4 flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="h-2 w-2 rounded-full bg-emerald-400"
                    style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {labels.thinking}
              </span>
            </div>
          </motion.div>
        )}

        {/* Speaking Status */}
        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center my-2"
          >
            <div className="px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
              <Volume2 size={14} className="text-emerald-600 dark:text-emerald-400 animate-bounce" />
              <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                {labels.speaking}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── QUICK ACTION CHIPS (REAL ACTIONS) ── */}
      <div className="shrink-0 px-4 py-2 bg-[#f8fafc] dark:bg-[#0b1322] border-t border-slate-200/50 dark:border-slate-800/50 flex items-center gap-2 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 px-3.5 py-2 rounded-full bg-white dark:bg-[#182339] border border-slate-200 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 transition-all flex items-center gap-1.5 shadow-sm"
        >
          {labels.photoAction}
        </button>

        <Link
          href="/mandi"
          className="shrink-0 px-3.5 py-2 rounded-full bg-white dark:bg-[#182339] border border-slate-200 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 transition-all flex items-center gap-1.5 shadow-sm"
        >
          {labels.mandiAction}
        </Link>

        <Link
          href="/dashboard"
          className="shrink-0 px-3.5 py-2 rounded-full bg-white dark:bg-[#182339] border border-slate-200 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-sky-50 transition-all flex items-center gap-1.5 shadow-sm"
        >
          {labels.weatherAction}
        </Link>

        <button
          onClick={() => handleSend('गेहूँ और फसलों में खाद की सही मात्रा तथा समय क्या है?')}
          className="shrink-0 px-3.5 py-2 rounded-full bg-white dark:bg-[#182339] border border-slate-200 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 transition-all flex items-center gap-1.5 shadow-sm"
        >
          {labels.dosageAction}
        </button>
      </div>

      {/* Hidden file input for image analysis */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/*"
        className="hidden"
      />

      {/* Image Preview attachment badge */}
      {imagePreview && (
        <div className="shrink-0 px-4 py-2 bg-white dark:bg-[#182339] border-t border-slate-200/50 dark:border-slate-800/50">
          <div className="relative inline-block bg-white dark:bg-[#182339] p-2 rounded-2xl border border-emerald-200 shadow-md">
            <img src={imagePreview} alt="Selected sample" className="h-16 w-16 rounded-xl object-cover" />
            <button
              onClick={() => {
                setSelectedImage(null);
                setImagePreview(null);
              }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ── BOTTOM VOICE & INPUT CONTROL ── */}
      <div className="shrink-0 px-4 pt-2 pb-3 sm:pb-4 border-t border-slate-200/60 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-lg z-30">
        <div className="chat-input-bar rounded-[2rem] p-1.5 flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80">
          {/* Main Voice Assistant Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={isRecording ? stopRecording : startRecording}
            className={`h-10 px-3.5 rounded-full flex items-center gap-1.5 font-black text-xs shrink-0 transition-all ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
            }`}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            <span className="whitespace-nowrap text-[11px]">
              {isRecording ? labels.stopListening : (language === 'English' ? 'Speak' : 'बोलें')}
            </span>
          </motion.button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={labels.placeholder}
            className="flex-1 min-w-0 bg-transparent border-none outline-none px-2 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
          />

          {/* Send Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSend()}
            disabled={!inputText.trim() && !selectedImage}
            className="h-9 w-9 rounded-full text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none shrink-0 shadow-md"
            style={{
              background: (!inputText.trim() && !selectedImage)
                ? '#94a3b8'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              transition: 'all 0.2s',
            }}
          >
            <Send size={15} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
