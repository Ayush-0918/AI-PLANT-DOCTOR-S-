'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Leaf, Mic, Camera, Send, Sparkles, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useAssistant } from '@/context/AssistantContext';

const GREETINGS: Record<string, string> = {
  English: '“Namaste Kisan Ji! Ask anything about your crops, diseases, or prices.”',
  en: '“Namaste Kisan Ji! Ask anything about your crops, diseases, or prices.”',
  'हिंदी': '“नमस्ते किसान जी! अपनी फसल, बीमारी या मंडी भाव के बारे में पूछें।”',
  hi: '“नमस्ते किसान जी! अपनी फसल, बीमारी या मंडी भाव के बारे में पूछें।”',
  'भोजपुरी': '“प्रणाम किसान भाई! फसल, बीमारी या मंडी भाव के बारे में पूछीं।”',
  bho: '“प्रणाम किसान भाई! फसल, बीमारी या मंडी भाव के बारे में पूछीं।”',
  'ਪੰਜਾਬੀ': '“ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਕਿਸਾਨ ਵੀਰ ਜੀ! ਫ਼ਸਲ, ਬਿਮਾਰੀ ਜਾਂ ਮੰਡੀ ਭਾਅ ਬਾਰੇ ਪੁੱਛੋ।”',
  pa: '“ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਕਿਸਾਨ ਵੀਰ ਜੀ! ਫ਼ਸਲ, ਬਿਮਾਰੀ ਜਾਂ ਮੰਡੀ ਭਾਅ ਬਾਰੇ ਪੁੱਛੋ।”',
};

const CARD_LABELS: Record<string, { title: string; subTitle: string; tapToSpeak: string; placeholder: string; openBadge: string }> = {
  English: {
    title: 'Sahayak AI',
    subTitle: '24x7 AI Plant Doctor',
    tapToSpeak: 'Tap to Speak',
    placeholder: 'Ask your farming question…',
    openBadge: 'Open',
  },
  en: {
    title: 'Sahayak AI',
    subTitle: '24x7 AI Plant Doctor',
    tapToSpeak: 'Tap to Speak',
    placeholder: 'Ask your farming question…',
    openBadge: 'Open',
  },
  'हिंदी': {
    title: 'सहायक AI',
    subTitle: '24x7 किसान मित्र',
    tapToSpeak: 'बोलकर पूछें',
    placeholder: 'अपना सवाल लिखें या बोलें…',
    openBadge: 'खोलें',
  },
  hi: {
    title: 'सहायक AI',
    subTitle: '24x7 किसान मित्र',
    tapToSpeak: 'बोलकर पूछें',
    placeholder: 'अपना सवाल लिखें या बोलें…',
    openBadge: 'खोलें',
  },
  'भोजपुरी': {
    title: 'सहायक AI',
    subTitle: '24x7 किसान मित्र',
    tapToSpeak: 'बोल के पूछीं',
    placeholder: 'अपन सवाल लिखीं या बोलीं…',
    openBadge: 'खोलीं',
  },
  bho: {
    title: 'सहायक AI',
    subTitle: '24x7 किसान मित्र',
    tapToSpeak: 'बोल के पूछीं',
    placeholder: 'अपन सवाल लिखीं या बोलीं…',
    openBadge: 'खोलीं',
  },
  'ਪੰਜਾਬੀ': {
    title: 'ਸਹਾਇਕ AI',
    subTitle: '24x7 ਕਿਸਾਨ ਮਿੱਤਰ',
    tapToSpeak: 'ਬੋਲ ਕੇ ਪੁੱਛੋ',
    placeholder: 'ਆਪਣਾ ਸਵਾਲ ਲਿਖੋ ਜਾਂ ਬੋਲੋ…',
    openBadge: 'ਖੋਲ੍ਹੋ',
  },
  pa: {
    title: 'ਸਹਾਇਕ AI',
    subTitle: '24x7 ਕਿਸਾਨ ਮਿੱਤਰ',
    tapToSpeak: 'ਬੋਲ ਕੇ ਪੁੱਛੋ',
    placeholder: 'ਆਪਣਾ ਸਵਾਲ ਲਿਖੋ ਜਾਂ ਬੋਲੋ…',
    openBadge: 'ਖੋਲ੍ਹੋ',
  },
};

export default function FarmerAssistantCard() {
  const router = useRouter();
  const { language } = useLanguage();
  const { openAssistant } = useAssistant();
  const [typedText, setTypedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const greeting = GREETINGS[language] || GREETINGS['English'];
  const labels = CARD_LABELS[language] || CARD_LABELS['English'];

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    openAssistant('image', '', { file, preview });
    router.push('/assistant');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedText.trim()) return;
    const query = typedText.trim();
    setTypedText('');
    router.push(`/assistant?q=${encodeURIComponent(query)}`);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04, duration: 0.45 }}
      className="relative overflow-hidden rounded-[2.25rem] p-5 shadow-[0_12px_40px_rgba(16,185,129,0.12)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)] prism-ring bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-amber-500/10 dark:from-emerald-950/40 dark:via-slate-900/90 dark:to-teal-950/40 backdrop-blur-2xl border border-emerald-500/20 dark:border-emerald-500/20 text-slate-800 dark:text-slate-100 transition-all"
    >
      {/* Hidden file input for camera upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleImagePick}
      />

      {/* Atmospheric soft lighting glow behind card */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/20 dark:bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-amber-400/15 dark:bg-teal-500/15 blur-3xl" />

      {/* Header Row */}
      <div className="relative z-10 flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-[0_4px_16px_rgba(16,185,129,0.3)] border border-white/30">
            <Leaf size={19} className="drop-shadow-sm" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">{labels.title}</h3>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            </div>
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {labels.subTitle}
            </p>
          </div>
        </div>

        <Link
          href="/assistant"
          className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-sm transition-all hover:bg-emerald-500/20 active:scale-95 backdrop-blur-md"
        >
          <Sparkles size={13} className="text-emerald-500 dark:text-emerald-400" />
          <span>{labels.openBadge}</span>
          <ArrowUpRight size={13} className="opacity-75" />
        </Link>
      </div>

      {/* Greeting Quote Box */}
      <div className="relative z-10 p-3 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-white/80 dark:border-slate-700/60 backdrop-blur-md mb-3.5 shadow-sm">
        <p className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-200 font-medium italic">
          {greeting}
        </p>
      </div>

      {/* Action Buttons Row */}
      <div className="relative z-10 flex items-center gap-2.5 mb-3">
        {/* Big Tap to Speak button with soft glass gradient */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/assistant?mode=voice')}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 py-3 px-4 text-xs font-bold text-white shadow-[0_6px_20px_rgba(16,185,129,0.3)] border border-emerald-300/30 transition-all hover:brightness-105 active:scale-[0.98]"
        >
          <Mic size={16} className="animate-pulse text-emerald-100" />
          <span>{labels.tapToSpeak}</span>
        </motion.button>

        {/* Camera Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-emerald-600 dark:text-emerald-400 shadow-sm hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95 shrink-0"
          title="Upload leaf photo"
        >
          <Camera size={18} />
        </button>
      </div>

      {/* Input Box Form */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex items-center gap-2 rounded-2xl border border-emerald-200/60 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 px-3.5 py-1 backdrop-blur-md shadow-inner focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all"
      >
        <input
          type="text"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          placeholder={labels.placeholder}
          className="flex-1 bg-transparent py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400/80 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!typedText.trim()}
          className="flex h-7 w-7 items-center justify-center rounded-xl text-white disabled:opacity-25 transition-all active:scale-95 shrink-0"
          style={{
            background: typedText.trim()
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : 'rgba(148, 163, 184, 0.3)',
            boxShadow: typedText.trim() ? '0 4px 12px rgba(16,185,129,0.4)' : 'none',
          }}
        >
          <Send size={13} />
        </button>
      </form>
    </motion.section>
  );
}
