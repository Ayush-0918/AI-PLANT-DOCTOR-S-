'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Wheat, Droplets, FlaskConical, Wind,
  AlertCircle, CheckCircle2, Volume2, ShieldCheck, Sparkles,
  Info, RefreshCw, Layers, Compass
} from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useFarmerProfile } from '@/context/FarmerProfileContext';

// Crop Dosage Rules Database
const DOSAGE_DATABASE: Record<string, {
  name: string;
  nameHi: string;
  waterPerAcreLiters: number;
  tankSizeLiters: number;
  chemicals: Array<{
    type: 'fungicide' | 'insecticide' | 'herbicide' | 'micronutrient';
    name: string;
    nameHi: string;
    dosagePerTank: string;
    dosagePerAcre: string;
    safetyTip: string;
    safetyTipHi: string;
  }>;
}> = {
  Wheat: {
    name: 'Wheat',
    nameHi: 'गेहूँ',
    waterPerAcreLiters: 150,
    tankSizeLiters: 15,
    chemicals: [
      {
        type: 'fungicide',
        name: 'Propiconazole 25% EC (Yellow Rust)',
        nameHi: 'प्रोपिकोनाज़ोल 25% (पीला रतुआ)',
        dosagePerTank: '15-20 ml',
        dosagePerAcre: '200 ml',
        safetyTip: 'Spray during morning hours when dew dries.',
        safetyTipHi: 'ओस सूखने के बाद सुबह 8-11 बजे के बीच छिड़काव करें।',
      },
      {
        type: 'herbicide',
        name: 'Clodinafop-propargyl 15% WP (Phalaris minor)',
        nameHi: 'क्लोडिनाफॉप 15% (गुल्ली डंडा / मंडूसी)',
        dosagePerTank: '16 grams',
        dosagePerAcre: '160 grams',
        safetyTip: 'Use flat-fan nozzle for uniform soil coverage.',
        safetyTipHi: 'समान छिड़काव के लिए कट नोजल (फ़्लैट फैन) का प्रयोग करें।',
      },
      {
        type: 'micronutrient',
        name: 'Zinc Sulphate 21%',
        nameHi: 'जिंक सल्फेट 21%',
        dosagePerTank: '50 grams',
        dosagePerAcre: '500 grams',
        safetyTip: 'Mix with 2.5 kg Urea per acre for optimal absorption.',
        safetyTipHi: 'बेहतर अवशोषण के लिए 2.5 किलो यूरिया के साथ मिलाकर स्प्रे करें।',
      }
    ]
  },
  Rice: {
    name: 'Rice / Paddy',
    nameHi: 'धान',
    waterPerAcreLiters: 200,
    tankSizeLiters: 15,
    chemicals: [
      {
        type: 'fungicide',
        name: 'Tricyclazole 75% WP (Rice Blast)',
        nameHi: 'ट्राइसाइक्लाज़ोल 75% (धान का झुलसा/ब्लास्ट)',
        dosagePerTank: '12-15 grams',
        dosagePerAcre: '160 grams',
        safetyTip: 'Apply at first sign of leaf blast spots.',
        safetyTipHi: 'पत्तियों पर भूरे धब्बे दिखते ही पहला छिड़काव करें।',
      },
      {
        type: 'insecticide',
        name: 'Imidacloprid 17.8% SL (Brown Plant Hopper)',
        nameHi: 'इमिडाक्लोप्रिड 17.8% (माहू / बीपीएच)',
        dosagePerTank: '5-7 ml',
        dosagePerAcre: '60-80 ml',
        safetyTip: 'Direct spray towards the base of paddy hills.',
        safetyTipHi: 'पौधे की जड़ों के पास नीचे की तरफ स्प्रे का रुख रखें।',
      }
    ]
  },
  Tomato: {
    name: 'Tomato',
    nameHi: 'टमाटर',
    waterPerAcreLiters: 160,
    tankSizeLiters: 15,
    chemicals: [
      {
        type: 'fungicide',
        name: 'Mancozeb 75% WP (Early / Late Blight)',
        nameHi: 'मैनकोज़ेब 75% (अगेती/पछेती झुलसा)',
        dosagePerTank: '30-35 grams',
        dosagePerAcre: '350-400 grams',
        safetyTip: 'Ensure under-leaf coverage where spores stay.',
        safetyTipHi: 'पत्तियों के निचले हिस्से पर भी दवा पहुँचाना ज़रूरी है।',
      },
      {
        type: 'insecticide',
        name: 'Spinosad 45% SC (Fruit Borer)',
        nameHi: 'स्पिनोसाड 45% (फल छेदक इल्ली)',
        dosagePerTank: '6-8 ml',
        dosagePerAcre: '75 ml',
        safetyTip: 'Rotate with different mode-of-action chemicals.',
        safetyTipHi: 'कीट प्रतिरोध से बचने के लिए दवा बदलकर छिड़कें।',
      }
    ]
  },
  Potato: {
    name: 'Potato',
    nameHi: 'आलू',
    waterPerAcreLiters: 180,
    tankSizeLiters: 15,
    chemicals: [
      {
        type: 'fungicide',
        name: 'Cymoxanil + Mancozeb (Late Blight Special)',
        nameHi: 'साइमोक्सानिल + मैनकोज़ेब (पछेती झुलसा)',
        dosagePerTank: '30 grams',
        dosagePerAcre: '300 grams',
        safetyTip: 'Favorable condition: Foggy weather + humidity > 85%.',
        safetyTipHi: 'कोहरा और नमी 85% से ऊपर होने पर तुरंत स्प्रे करें।',
      }
    ]
  }
};

export default function DosageCalculatorPage() {
  const { language } = useLanguage();
  const { profile } = useFarmerProfile();
  const isHindi = language !== 'English';

  const [selectedCropKey, setSelectedCropKey] = useState<string>(profile.activeCrop || 'Wheat');
  const [areaValue, setAreaValue] = useState<number>(1);
  const [areaUnit, setAreaUnit] = useState<'acre' | 'bigha' | 'hectare'>('acre');
  const [selectedChemIndex, setSelectedChemIndex] = useState<number>(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const cropData = DOSAGE_DATABASE[selectedCropKey] || DOSAGE_DATABASE.Wheat;
  const currentChem = cropData.chemicals[selectedChemIndex] || cropData.chemicals[0];

  // Convert area to Acres
  const areaInAcres = useMemo(() => {
    if (areaUnit === 'bigha') return areaValue * 0.625; // approx 1 acre = 1.6 bigha
    if (areaUnit === 'hectare') return areaValue * 2.47;
    return areaValue;
  }, [areaValue, areaUnit]);

  // Calculations
  const totalWaterNeededLiters = Math.round(cropData.waterPerAcreLiters * areaInAcres);
  const totalTanksNeeded = Math.ceil(totalWaterNeededLiters / cropData.tankSizeLiters);

  // Handle Text-to-Speech audio readout
  const speakDosage = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    const textHi = `${areaValue} ${areaUnit === 'acre' ? 'एकड़' : areaUnit === 'bigha' ? 'बीघा' : 'हेक्टेयर'} ${cropData.nameHi} के लिए आपको कुल ${totalTanksNeeded} टंकी पानी चाहिए। दवा ${currentChem.nameHi} की मात्रा ${currentChem.dosagePerTank} प्रति 15 लीटर टंकी में मिलाएँ। ${currentChem.safetyTipHi}`;
    const textEn = `For ${areaValue} ${areaUnit} of ${cropData.name}, you need approximately ${totalTanksNeeded} spray tanks. Add ${currentChem.dosagePerTank} of ${currentChem.name} per 15 liter tank. ${currentChem.safetyTip}`;

    const utterance = new SpeechSynthesisUtterance(isHindi ? textHi : textEn);
    utterance.lang = isHindi ? 'hi-IN' : 'en-US';
    utterance.rate = 0.9;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 pb-12 transition-colors duration-300">
      
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
                <Wheat size={13} className="text-emerald-500" />
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                  {isHindi ? 'सटीक स्प्रे कैलकुलेटर' : 'Precision Spray Calculator'}
                </span>
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {isHindi ? 'खुराक कैलकुलेटर' : 'Dosage Calc'}
              </h1>
            </div>
          </div>

          <button
            onClick={speakDosage}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-black transition-all ${
              isSpeaking
                ? 'bg-emerald-500 text-white animate-pulse shadow-md shadow-emerald-500/30'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70'
            }`}
          >
            <Volume2 size={15} />
            <span>{isSpeaking ? (isHindi ? 'बोल रहा है...' : 'Speaking...') : (isHindi ? 'सुने' : 'Listen')}</span>
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
        
        {/* HERO BANNER FOR JUDGES & FARMERS */}
        <div className="rounded-[2.2rem] p-5 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 text-white shadow-xl shadow-emerald-600/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between gap-4 relative z-10">
            <div>
              <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/20 backdrop-blur-md text-emerald-100 border border-white/20">
                {isHindi ? 'स्मार्ट स्प्रे सुरक्षा' : 'Smart Spray Intelligence'}
              </span>
              <h2 className="text-lg font-black mt-2 leading-snug">
                {isHindi ? 'खेती में सही मात्रा, सही असर!' : 'Exact Chemical & Water Dosage'}
              </h2>
              <p className="text-xs text-emerald-100 font-medium mt-1 opacity-90 leading-relaxed">
                {isHindi
                  ? 'दवा का नुकसान बचाएं और अपनी फसल को सही खुराक दें।'
                  : 'Prevent chemical burn & over-use with field-verified tank ratios.'}
              </p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0 text-2xl shadow-inner">
              🧪
            </div>
          </div>
        </div>

        {/* STEP 1: CROP SELECTOR */}
        <div className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Layers size={13} className="text-emerald-500" />
            <span>1. {isHindi ? 'फसल चुनें' : 'Select Crop'}</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {Object.keys(DOSAGE_DATABASE).map((cropKey) => {
              const item = DOSAGE_DATABASE[cropKey];
              const isSelected = selectedCropKey === cropKey;
              return (
                <button
                  key={cropKey}
                  onClick={() => {
                    setSelectedCropKey(cropKey);
                    setSelectedChemIndex(0);
                  }}
                  className={`py-3 px-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center gap-1 border ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="text-lg">
                    {cropKey === 'Wheat' ? '🌾' : cropKey === 'Rice' ? '🌿' : cropKey === 'Tomato' ? '🍅' : '🥔'}
                  </span>
                  <span>{isHindi ? item.nameHi : item.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: LAND AREA INPUT */}
        <div className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Compass size={13} className="text-emerald-500" />
              <span>2. {isHindi ? 'खेत का आकार चुनें' : 'Farm Land Area'}</span>
            </label>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-[10px] font-black">
              {(['acre', 'bigha', 'hectare'] as const).map((unit) => (
                <button
                  key={unit}
                  onClick={() => setAreaUnit(unit)}
                  className={`px-2.5 py-1 rounded-lg uppercase tracking-wider transition-all ${
                    areaUnit === unit
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {unit === 'acre' ? (isHindi ? 'एकड़' : 'Acre') : unit === 'bigha' ? (isHindi ? 'बीघा' : 'Bigha') : (isHindi ? 'हेक्टेयर' : 'Hectare')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => setAreaValue(Math.max(0.25, areaValue - 0.25))}
              className="h-11 w-11 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-lg font-black text-slate-700 dark:text-slate-200 flex items-center justify-center active:scale-95 shadow-sm"
            >
              -
            </button>
            <div className="flex-1 text-center">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {areaValue}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1.5 uppercase">
                {areaUnit}
              </span>
            </div>
            <button
              onClick={() => setAreaValue(areaValue + 0.25)}
              className="h-11 w-11 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-lg font-black text-slate-700 dark:text-slate-200 flex items-center justify-center active:scale-95 shadow-sm"
            >
              +
            </button>
          </div>
        </div>

        {/* STEP 3: CHEMICAL TYPE SELECTOR */}
        <div className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <FlaskConical size={13} className="text-emerald-500" />
            <span>3. {isHindi ? 'दवा / स्प्रे का प्रकार चुनें' : 'Select Chemical / Treatment'}</span>
          </label>
          <div className="space-y-2">
            {cropData.chemicals.map((chem, idx) => {
              const isSelected = selectedChemIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedChemIndex(idx)}
                  className={`w-full text-left p-3.5 rounded-2xl text-xs font-bold transition-all border flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <span className="font-black text-sm block">
                      {isHindi ? chem.nameHi : chem.name}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {isHindi ? `अनुशंसित: ${chem.dosagePerAcre} प्रति एकड़` : `Standard: ${chem.dosagePerAcre} / acre`}
                    </span>
                  </div>
                  {isSelected && <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* OUTPUT DISPLAY CARDS */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Water card */}
          <div className="rounded-[2rem] p-4.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 mb-2">
                <Droplets size={16} />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {isHindi ? 'कुल पानी' : 'Total Water'}
                </span>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {totalWaterNeededLiters} <span className="text-sm font-bold text-slate-500">Liters</span>
              </p>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-3">
              {isHindi ? `150-200 लीटर प्रति एकड़ मानक माना जाता है` : `Based on ${cropData.waterPerAcreLiters}L/acre standard`}
            </p>
          </div>

          {/* Spray Tanks Card */}
          <div className="rounded-[2rem] p-4.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-2">
                <Layers size={16} />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {isHindi ? 'कुल स्प्रे टंकी' : 'Spray Tanks'}
                </span>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {totalTanksNeeded} <span className="text-sm font-bold text-slate-500">{isHindi ? 'टंकी' : 'Tanks'}</span>
              </p>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-3">
              {isHindi ? `15 लीटर क्षमता प्रति नैपसैक टंकी` : `Assuming 15L Knapsack tank capacity`}
            </p>
          </div>
        </div>

        {/* EXACT DOSAGE PER TANK HIGHLIGHT */}
        <div className="rounded-[2rem] p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 dark:border-amber-500/20 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Sparkles size={18} />
            <span className="text-xs font-black uppercase tracking-wider">
              {isHindi ? 'प्रति टंकी सटीक दवा मात्रा' : 'Exact Dosage Per 15L Tank'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-amber-200 dark:border-amber-800 flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-amber-900 dark:text-amber-300">
                {currentChem.dosagePerTank}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-bold mt-0.5">
                {isHindi ? `प्रति 15 लीटर टंकी में मिलाएं` : `per 15 Liters water tank`}
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-amber-500 text-white font-black text-xs">
              {isHindi ? 'सटीक अनुपात' : 'Exact Ratio'}
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed pt-1">
            <ShieldCheck size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <span>
              {isHindi ? currentChem.safetyTipHi : currentChem.safetyTip}
            </span>
          </div>
        </div>

        {/* FOOTER ADVISORY */}
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
          💡 {isHindi ? 'सुरक्षा टिप: हवा की विपरीत दिशा में कभी भी छिड़काव न करें। चश्मा और मास्क पहनें।' : 'Safety Tip: Never spray against wind direction. Wear gloves and mask while mixing chemicals.'}
        </div>
      </div>
    </div>
  );
}
