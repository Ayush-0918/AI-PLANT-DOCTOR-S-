'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, Sparkles, Loader2, Volume2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceNoteRecorderProps {
  language?: string;
  onTranscriptionComplete?: (text: string) => void;
  onAudioRecorded?: (audioUrl: string, durationSeconds: number) => void;
  isCompact?: boolean;
}

export default function VoiceNoteRecorder({
  language = 'Hindi',
  onTranscriptionComplete,
  onAudioRecorded,
  isCompact = false,
}: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedSuccess, setTranscribedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setErrorMessage(null);
    setAudioUrl(null);
    setTranscribedSuccess(false);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Convert to base64 data URL for offline/state persistence
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          if (onAudioRecorded) {
            onAudioRecorded(base64data, recordingDuration);
          }
        };

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setErrorMessage('Microphone access is needed to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleTranscribe = async () => {
    if (audioChunksRef.current.length === 0) return;
    setIsTranscribing(true);
    setErrorMessage(null);

    try {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || 'audio/webm',
      });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voicenote.webm');
      formData.append('language', language);

      const res = await fetch('/api/v1/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Speech recognition server busy');
      }

      const data = await res.json();
      if (data.success && data.text) {
        setTranscribedSuccess(true);
        if (onTranscriptionComplete) {
          onTranscriptionComplete(data.text);
        }
      } else {
        throw new Error('Could not clearly transcribe audio. Please try speaking closer.');
      }
    } catch (err: any) {
      console.error('STT Transcription error:', err);
      setErrorMessage(err.message || 'Voice recognition error. Please speak clearly.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current || !audioUrl) return;

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const resetRecording = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setIsPlaying(false);
    setAudioUrl(null);
    setRecordingDuration(0);
    setTranscribedSuccess(false);
    setErrorMessage(null);
    audioChunksRef.current = [];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className={`rounded-2xl border transition-all ${
      isRecording
        ? 'bg-rose-50/70 border-rose-300'
        : audioUrl
        ? 'bg-emerald-50/60 border-emerald-300'
        : 'bg-slate-50 border-slate-200'
    } p-3.5`}>
      {audioUrl && (
        <audio
          ref={audioPlayerRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      <div className="flex items-center justify-between gap-3">
        {/* Left side: status and timer */}
        <div className="flex items-center gap-2.5">
          {isRecording ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <span className="text-xs font-black text-rose-600 tracking-wide animate-pulse">
                Recording ({formatTime(recordingDuration)} / 1:00)
              </span>
            </div>
          ) : audioUrl ? (
            <div className="flex items-center gap-2">
              <Volume2 size={16} className="text-emerald-600 shrink-0" />
              <span className="text-xs font-bold text-emerald-800">
                Voice Note ({formatTime(recordingDuration)})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Mic size={16} className="text-slate-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-600">
                बोलकर पूछें / Record Voice Note
              </span>
            </div>
          )}
        </div>

        {/* Right side: Action controls */}
        <div className="flex items-center gap-1.5">
          {!isRecording && !audioUrl && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={startRecording}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black text-white shadow-sm"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              <Mic size={14} />
              <span>Record</span>
            </motion.button>
          )}

          {isRecording && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={stopRecording}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black text-white bg-rose-600 shadow-sm"
            >
              <Square size={13} fill="white" />
              <span>Stop</span>
            </motion.button>
          )}

          {audioUrl && (
            <>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={togglePlayback}
                className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-600 text-white shadow-sm"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" className="ml-0.5" />}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={resetRecording}
                className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-200 text-slate-600"
                title="Rerecord"
              >
                <RotateCcw size={13} />
              </motion.button>

              {onTranscriptionComplete && (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black text-sky-700 bg-sky-100 border border-sky-200"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Transcribing...</span>
                    </>
                  ) : transcribedSuccess ? (
                    <>
                      <Check size={12} className="text-emerald-600" />
                      <span>Transcribed!</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      <span>Convert to Text</span>
                    </>
                  )}
                </motion.button>
              )}
            </>
          )}
        </div>
      </div>

      {errorMessage && (
        <p className="mt-2 text-[11px] font-medium text-rose-600 bg-rose-100/70 rounded-lg px-2.5 py-1">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
