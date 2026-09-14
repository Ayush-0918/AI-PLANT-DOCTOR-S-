'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Sprout, Loader2, RefreshCw, ChevronRight,
  AlertTriangle, CheckCircle2, Info, CloudRain, Sun,
  Wind, Beaker, Droplets, Sparkles, ShieldCheck, Calendar,
  TrendingUp, Award, Layers
} from 'lucide-react';
import Link from 'next/link';
import { useFarmerProfile } from '@/context/FarmerProfileContext';
import { useLanguage } from '@/context/LanguageContext';

const CROPS = ['Wheat', 'Rice', 'Tomato', 'Potato', 'Corn', 'Cotton', 'Soybean', 'Sugarcane'];

const CROP_ICONS: Record<string, string> = {
  Wheat: '🌾', Rice: '🌿', Tomato: '🍅', Potato: '🥔',
  Corn: '🌽', Cotton: '☁️', Soybean: '🫘', Sugarcane: '🎋',
};

const ENGLISH_CROPS: Record<string, string> = {
  'गेहूं': 'Wheat', 'गेहूँ': 'Wheat', 'धान': 'Rice', 'टमाटर': 'Tomato', 'आलू': 'Potato',
  'मक्का': 'Corn', 'मकई': 'Corn', 'कपास': 'Cotton', 'सोयाबीन': 'Soybean', 'गन्ना': 'Sugarcane'
};

const HINDI_CROPS: Record<string, string> = {
  'Wheat': 'गेहूँ', 'Rice': 'धान', 'Tomato': 'टमाटर', 'Potato': 'आलू',
  'Corn': 'मक्का', 'Cotton': 'कपास', 'Soybean': 'सोयाबीन', 'Sugarcane': 'गन्ना'
};

function getDisplayCropName(cropStr: string, isHindi: boolean): string {
  const englishName = ENGLISH_CROPS[cropStr] || cropStr;
  if (!isHindi) {
    return englishName;
  }
  return HINDI_CROPS[englishName] || cropStr;
}

const STAGES = [
  { id: 'germination', labelEn: 'Germination (0-21 Days)', labelHi: 'अंकुरण (0-21 दिन)', icon: '🌱' },
  { id: 'vegetative', labelEn: 'Vegetative (21-60 Days)', labelHi: 'वानस्पतिक वृद्धि (21-60 दिन)', icon: '🌿' },
  { id: 'flowering', labelEn: 'Flowering & Grain Fill (60-90 Days)', labelHi: 'फूल व दाना भराव (60-90 दिन)', icon: '🌸' },
  { id: 'maturity', labelEn: 'Maturity & Harvest (90+ Days)', labelHi: 'परिपक्वता व कटाई (90+ दिन)', icon: '🌾' },
];

export default function GrowthCareGuidePage() {
  const { profile } = useFarmerProfile();
  const { language } = useLanguage();
  const isHindi = language !== 'English';

  const [rawCrop, setRawCrop] = useState<string>(profile.activeCrop || 'Wheat');
  const [stage, setStage] = useState<string>('vegetative');

  // Normalize crop name string
  const activeCropEn = useMemo(() => ENGLISH_CROPS[rawCrop] || rawCrop, [rawCrop]);
  const activeCropDisplay = useMemo(() => getDisplayCropName(rawCrop, isHindi), [rawCrop, isHindi]);

  const currentStageObj = useMemo(() => STAGES.find(s => s.id === stage) || STAGES[1], [stage]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 pb-16 transition-colors duration-300">
      
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 px-4 py-3.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="h-10 w-10 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 hover:scale-105 active:scale-95 transition-all"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-purple-500" />
                <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                  {isHindi ? 'फसल विकास एवं देखभाल' : 'Crop Growth & Care Intelligence'}
                </span>
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {isHindi ? 'ग्रोथ केयर' : 'Growth Care'}
              </h1>
            </div>
          </div>

          <Link
            href="/dosage"
            className="px-3.5 py-2 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-black text-xs flex items-center gap-1.5 hover:scale-105 transition-all"
          >
            <span>🧪 {isHindi ? 'खुराक कैलकुलेटर' : 'Dosage Calc'}</span>
          </Link>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-5">
        
        {/* HERO BANNER */}
        <div className="rounded-[2.2rem] p-5 bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 text-white shadow-xl shadow-purple-600/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between gap-4 relative z-10">
            <div>
              <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/20 backdrop-blur-md text-purple-100 border border-white/20">
                {isHindi ? 'फसल स्वास्थ्य निर्देश' : 'Smart Field Advisory'}
              </span>
              <h2 className="text-lg font-black mt-2 leading-snug">
                {isHindi ? `${activeCropDisplay} विकास और देखभाल चक्र` : `${activeCropDisplay} Growth Cycle & Care`}
              </h2>
              <p className="text-xs text-purple-100 font-medium mt-1 opacity-90 leading-relaxed">
                {isHindi
                  ? 'बुवाई से लेकर कटाई तक - पोषण, सिंचाई और कीट सुरक्षा की पूरी जानकारी।'
                  : 'Stage-by-stage NPK nutrients, irrigation schedules, and pest advisories.'}
              </p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0 text-3xl shadow-inner">
              {CROP_ICONS[activeCropEn] || '🌱'}
            </div>
          </div>
        </div>

        {/* CROP SELECTOR BAR */}
        <div className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 shadow-sm space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
            {isHindi ? 'अपनी फसल चुनें' : 'Select Crop'}
          </p>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {CROPS.map(cEn => {
              const isSelected = activeCropEn === cEn;
              const displayName = getDisplayCropName(cEn, isHindi);
              return (
                <button
                  key={cEn}
                  onClick={() => setRawCrop(cEn)}
                  className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-black transition-all border ${
                    isSelected
                      ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span className="text-base">{CROP_ICONS[cEn] || '🌱'}</span>
                  <span>{displayName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* VISUAL GROWTH STAGE TIMELINE */}
        <div className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Calendar size={13} className="text-purple-500" />
              <span>{isHindi ? 'फसल विकास अवस्था चुनें' : 'Select Growth Stage'}</span>
            </p>
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              {currentStageObj.icon} {isHindi ? currentStageObj.labelHi : currentStageObj.labelEn}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STAGES.map((s) => {
              const isSelected = stage === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStage(s.id)}
                  className={`p-3 rounded-2xl text-xs font-bold transition-all text-left border flex items-center gap-2.5 ${
                    isSelected
                      ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xl shrink-0">{s.icon}</span>
                  <div className="min-w-0">
                    <span className="font-black block truncate">
                      {isHindi ? s.labelHi.split(' ')[0] : s.labelEn.split(' ')[0]}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 block">
                      {s.id === 'germination'
                        ? (isHindi ? '0-21 दिन' : '0-21 Days')
                        : s.id === 'vegetative'
                        ? (isHindi ? '21-60 दिन' : '21-60 Days')
                        : s.id === 'flowering'
                        ? (isHindi ? '60-90 दिन' : '60-90 Days')
                        : (isHindi ? '90+ दिन' : '90+ Days')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* DETAILED CARE CARDS FOR THE SELECTED STAGE */}
        <div className="space-y-3.5">
          
          {/* Card 1: Nutrition & Fertilizer */}
          <div className="rounded-[2rem] p-5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 dark:border-emerald-500/20 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Beaker size={18} />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {isHindi ? '1. पोषण व खाद योजना (NPK)' : '1. Nutrition & Fertilizer Plan'}
                </h3>
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500 text-white">
                {isHindi ? 'आवश्यक' : 'Required'}
              </span>
            </div>
            
            <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-emerald-200 dark:border-emerald-800 text-xs font-semibold space-y-2 text-slate-700 dark:text-slate-300">
              <p className="font-black text-sm text-slate-900 dark:text-white">
                {activeCropEn === 'Wheat'
                  ? (isHindi ? 'यूरिया 33 किग्रा/एकड़ + जिंक सल्फेट 5 किग्रा/एकड़' : 'Urea 33 kg/acre + Zinc Sulphate 5 kg/acre')
                  : activeCropEn === 'Rice'
                  ? (isHindi ? 'N:P:K 60:30:30 किग्रा/एकड़ संतुलित मात्रा' : 'N:P:K 60:30:30 kg/acre balanced dose')
                  : (isHindi ? 'कैल्शियम नाइट्रेट 3 ग्राम/लीटर पानी स्प्रे करें' : 'Calcium Nitrate 3g/L water spray for fruit strength')}
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                💡 {isHindi ? 'खाद डालते समय खेत में हल्की नमी होना अनिवार्य है।' : 'Ensure light soil moisture before top-dressing nitrogen.'}
              </p>
            </div>
          </div>

          {/* Card 2: Smart Irrigation */}
          <div className="rounded-[2rem] p-5 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent border border-sky-500/30 dark:border-sky-500/20 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400">
                <Droplets size={18} />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {isHindi ? '2. स्मार्ट सिंचाई सलाह' : '2. Smart Irrigation Interval'}
                </h3>
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-500 text-white">
                {isHindi ? '7-10 दिन चक्र' : '7-10 Days Cycle'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-sky-200 dark:border-sky-800 text-xs font-semibold text-slate-700 dark:text-slate-300 space-y-1.5">
              <p className="font-black text-sm text-slate-900 dark:text-white">
                {isHindi ? 'इस विकास चरण पर हल्की व नियमित सिंचाई करें।' : 'Light and regular irrigation recommended at this growth phase.'}
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                {isHindi ? 'खेत में पानी जमा न होने दें ताकि जड़ों का सड़न न हो।' : 'Avoid standing water logging to prevent root rot diseases.'}
              </p>
            </div>
          </div>

          {/* Card 3: Disease & Pest Protection */}
          <div className="rounded-[2rem] p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 dark:border-amber-500/20 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle size={18} />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {isHindi ? '3. कीट व बीमारी सुरक्षा चेतावनी' : '3. Disease & Pest Protection'}
                </h3>
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-white">
                {isHindi ? 'साप्ताहिक निगरानी' : 'Weekly Scouting'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-amber-200 dark:border-amber-800 text-xs font-semibold space-y-2 text-slate-700 dark:text-slate-300">
              <p className="font-black text-sm text-amber-900 dark:text-amber-300">
                {activeCropEn === 'Wheat'
                  ? (isHindi ? 'पीला रतुआ (Yellow Rust) की पत्तियों पर पीली धारियां जांचें' : 'Check leaf undersides for Yellow Rust stripes')
                  : (isHindi ? 'अगेती झुलसा और कीट प्रकोप की निगरानी करें' : 'Monitor early blight and sucking pests weekly')}
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                🛡️ {isHindi ? 'बीमारी का लक्षण दिखने पर प्रोपिकोनाज़ोल का छिड़काव करें।' : 'Spray preventive fungicide at first visual spot detection.'}
              </p>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION CTA */}
        <Link
          href="/dosage"
          className="flex items-center justify-between p-4.5 rounded-[1.8rem] bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm shadow-xl shadow-purple-600/25 active:scale-95 transition-all mt-4"
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} />
            <span>{isHindi ? '🧪 छिड़काव के लिए खुराक कैलकुलेटर खोलें' : 'Open Spray Dosage Calculator'}</span>
          </div>
          <ChevronRight size={18} />
        </Link>
      </div>
    </div>
  );
}
