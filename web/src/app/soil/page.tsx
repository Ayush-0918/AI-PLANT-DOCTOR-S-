'use client';

import { useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, FlaskConical, ChevronRight,
  CheckCircle2, AlertTriangle, Loader2,
  Sprout, RefreshCw, ClipboardList, ImageIcon, ScanLine, Calculator,
  Sparkles, Droplets, Flame
} from 'lucide-react';
import Link from 'next/link';
import { useFarmerProfile } from '@/context/FarmerProfileContext';
import { useLanguage } from '@/context/LanguageContext';
import { getBackendBaseUrl } from '@/lib/api';
import { normalizeSoilType } from '@/lib/soil';

// ── Soil types with soft pastel background coloring ──────────
const SOIL_TYPES = [
  {
    id: 'clay',
    emoji: '🟤',
    labelEn: 'Clay Soil',
    labelHi: 'चिकनी मिट्टी',
    descEn: 'Retains water, heavy structure',
    descHi: 'पानी रोके, भारी बनावट',
    badgeGradient: 'from-amber-700 to-amber-950',
    lightBg: 'from-amber-500/15 via-amber-500/8 to-amber-500/2',
    borderColor: 'border-amber-500/40 dark:border-amber-500/30',
  },
  {
    id: 'loam',
    emoji: '🌿',
    labelEn: 'Loam Soil',
    labelHi: 'दोमट मिट्टी',
    descEn: 'Best balanced soil for most crops',
    descHi: 'सभी फसलों के लिए सर्वोत्तम',
    badgeGradient: 'from-emerald-500 to-teal-700',
    lightBg: 'from-emerald-500/15 via-teal-500/8 to-emerald-500/2',
    borderColor: 'border-emerald-500/40 dark:border-emerald-500/30',
  },
  {
    id: 'sandy',
    emoji: '🏜️',
    labelEn: 'Sandy Soil',
    labelHi: 'रेतीली मिट्टी',
    descEn: 'Fast draining, light porous text',
    descHi: 'हल्की व जल्दी सूखने वाली',
    badgeGradient: 'from-amber-400 to-yellow-600',
    lightBg: 'from-amber-400/15 via-yellow-500/8 to-amber-400/2',
    borderColor: 'border-amber-400/40 dark:border-amber-400/30',
  },
  {
    id: 'black',
    emoji: '⬛',
    labelEn: 'Black Soil',
    labelHi: 'काली मिट्टी',
    descEn: 'Cotton belt, high moisture retention',
    descHi: 'कपास के लिए उत्तम, नमी वाली',
    badgeGradient: 'from-slate-700 to-slate-950',
    lightBg: 'from-slate-700/15 via-slate-800/8 to-slate-700/2',
    borderColor: 'border-slate-600/40 dark:border-slate-600/30',
  },
  {
    id: 'red',
    emoji: '🔴',
    labelEn: 'Red Soil',
    labelHi: 'लाल मिट्टी',
    descEn: 'Iron-rich, porous & well-drained',
    descHi: 'आयरन-युक्त, भुरभुरी बनावट',
    badgeGradient: 'from-rose-500 to-red-700',
    lightBg: 'from-rose-500/15 via-red-500/8 to-rose-500/2',
    borderColor: 'border-rose-500/40 dark:border-rose-500/30',
  },
  {
    id: 'alluvial',
    emoji: '🌊',
    labelEn: 'Alluvial Soil',
    labelHi: 'जलोढ़ मिट्टी',
    descEn: 'River plains, highly fertile',
    descHi: 'नदी मैदानों की अत्यधिक उपजाऊ',
    badgeGradient: 'from-cyan-500 to-blue-700',
    lightBg: 'from-cyan-500/15 via-blue-500/8 to-cyan-500/2',
    borderColor: 'border-cyan-500/40 dark:border-cyan-500/30',
  },
];

const PH_OPTIONS = [
  {
    id: 'acidic',
    label: 'Acidic (< 6)',
    labelHi: 'अम्लीय (< 6)',
    descHi: 'चूना (Lime) प्रयोग आवश्यक — pH कम है',
    descEn: 'Lime treatment recommended — pH is low',
    color: '#ef4444',
    lightBg: 'from-rose-500/15 via-red-500/8 to-rose-500/2',
    borderColor: 'border-rose-500/40 dark:border-rose-500/30',
    textColor: 'text-rose-700 dark:text-rose-300',
    iconBg: 'from-rose-500 to-red-600',
    badgeIcon: Flame,
  },
  {
    id: 'neutral',
    label: 'Neutral (6–7)',
    labelHi: 'उदासीन (6–7)',
    descHi: 'सर्वोत्तम pH संतुलन — सभी फसलों हेतु',
    descEn: 'Optimal pH balance — suitable for all crops',
    color: '#22c55e',
    lightBg: 'from-emerald-500/15 via-teal-500/8 to-emerald-500/2',
    borderColor: 'border-emerald-500/40 dark:border-emerald-500/30',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    iconBg: 'from-emerald-500 to-teal-600',
    badgeIcon: CheckCircle2,
  },
  {
    id: 'alkaline',
    label: 'Alkaline (> 7)',
    labelHi: 'क्षारीय (> 7)',
    descHi: 'जिप्सम (Gypsum) / गंधक प्रयोग आवश्यक',
    descEn: 'Gypsum / Sulphur application required',
    color: '#3b82f6',
    lightBg: 'from-blue-500/15 via-indigo-500/8 to-blue-500/2',
    borderColor: 'border-blue-500/40 dark:border-blue-500/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    iconBg: 'from-blue-500 to-indigo-600',
    badgeIcon: Droplets,
  },
];

const MOISTURE_OPTIONS = [
  {
    id: 'dry',
    label: 'Dry / सूखी',
    descHi: 'सिंचाई की तुरंत आवश्यकता',
    icon: '🏜️',
    color: '#f59e0b',
    gradient: 'from-amber-400 to-yellow-600',
    lightBg: 'from-amber-500/15 via-yellow-500/8 to-amber-500/2',
    borderColor: 'border-amber-500/40 dark:border-amber-500/30',
  },
  {
    id: 'moderate',
    label: 'Moderate / सामान्य',
    descHi: 'आदर्श नमी संतुलन',
    icon: '🌤️',
    color: '#22c55e',
    gradient: 'from-emerald-400 to-teal-600',
    lightBg: 'from-emerald-500/15 via-teal-500/8 to-emerald-500/2',
    borderColor: 'border-emerald-500/40 dark:border-emerald-500/30',
  },
  {
    id: 'wet',
    label: 'Wet / गीली',
    descHi: 'सिंचाई रोकें — पर्याप्त नमी',
    icon: '💧',
    color: '#3b82f6',
    gradient: 'from-blue-400 to-cyan-600',
    lightBg: 'from-blue-500/15 via-cyan-500/8 to-blue-500/2',
    borderColor: 'border-blue-500/40 dark:border-blue-500/30',
  },
  {
    id: 'waterlogged',
    label: 'Waterlogged / जलजमाव',
    descHi: 'त्वरित जल निकासी आवश्यक',
    icon: '🌊',
    color: '#7c3aed',
    gradient: 'from-purple-500 to-violet-700',
    lightBg: 'from-purple-500/15 via-violet-500/8 to-purple-500/2',
    borderColor: 'border-purple-500/40 dark:border-purple-500/30',
  },
];

// ── AI soil advice engine ───────────────────────────────────
function generateSoilAdvice(soil: string, ph: string, moisture: string, crop: string, lang: string) {
  const isHindi = lang !== 'English';

  const adviceDB: Record<string, Record<string, string[]>> = {
    clay: {
      acidic:   [ isHindi ? 'चूना (Lime) डालें — 2-4 क्विंटल/एकड़' : 'Apply Agricultural Lime — 2-4 qtl/acre to raise pH',
                  isHindi ? 'जल निकासी के लिए नाली बनाएं' : 'Install drainage channels to prevent waterlogging',
                  isHindi ? 'जैविक खाद (FYM) 5-8 टन/एकड़ मिलाएं' : 'Mix 5-8 ton FYM/acre to improve porosity' ],
      neutral:  [ isHindi ? 'N:P:K = 60:30:30 kg/acre डालें' : 'Apply N:P:K = 60:30:30 kg/acre balanced dose',
                  isHindi ? 'सरसों/गेहूं के लिए आदर्श है' : 'Ideal for mustard, wheat, paddy crops',
                  isHindi ? 'गहरी जुताई करें — 8-10 इंच' : 'Deep tillage 8-10 inches for better aeration' ],
      alkaline: [ isHindi ? 'जिप्सम 2-3 क्विंटल/एकड़ डालें' : 'Apply Gypsum 2-3 qtl/acre to lower pH',
                  isHindi ? 'हरी खाद (Dhaincha) उगाएं' : 'Grow green manure (Dhaincha) before crop season',
                  isHindi ? 'सल्फर 8-10 kg/acre मिट्टी में मिलाएं' : 'Incorporate Elemental Sulphur 8-10 kg/acre' ],
    },
    loam: {
      acidic:   [ isHindi ? 'यह मिट्टी सुधार के बाद सर्वोत्तम है' : 'Loam is excellent after pH correction',
                  isHindi ? 'चूना 1-2 क्विंटल/एकड़ डालें' : 'Light lime application 1-2 qtl/acre sufficient',
                  isHindi ? 'टमाटर, मिर्च, सब्जियां लगाएं' : 'Suitable for tomato, chili, vegetables after correction' ],
      neutral:  [ isHindi ? 'यह मिट्टी सभी फसलों के लिए सर्वोत्तम है!' : 'Perfect soil! Suitable for all crops',
                  isHindi ? 'N:P:K अनुसार खाद डालें' : 'Follow crop-specific N:P:K schedule',
                  isHindi ? 'जैविक खाद से उर्वरकता बनाए रखें' : 'Maintain fertility with 3-4 ton FYM yearly' ],
      alkaline: [ isHindi ? 'जिप्सम और गंधक का उपयोग करें' : 'Use Gypsum + Sulphur for pH correction',
                  isHindi ? 'सिंचाई में फेरस सल्फेट मिलाएं' : 'Mix Ferrous Sulphate in irrigation water',
                  isHindi ? 'नीम की खली 50 kg/एकड़ डालें' : 'Apply Neem Cake 50 kg/acre as amendment' ],
    },
    sandy: {
      acidic:   [ isHindi ? 'जैविक खाद बड़ी मात्रा में डालें — 10+ टन' : 'Heavy organic matter application essential 10+ ton',
                  isHindi ? 'ड्रिप सिंचाई करें — पानी बचाएं' : 'Use drip irrigation to conserve water',
                  isHindi ? 'मूंगफली, तरबूज, खरबूजा अच्छे रहेंगे' : 'Go for groundnut, watermelon, melon crops' ],
      neutral:  [ isHindi ? 'ड्रिप सिंचाई से साथ-साथ खाद दें' : 'Fertigation through drip irrigation is most effective',
                  isHindi ? 'पोटाश 40-50 kg/एकड़ जरूरी है' : 'Potash application 40-50 kg/acre critical for sandy soil',
                  isHindi ? 'हल्की फसलें लगाएं — मूंग, तिल' : 'Light crops recommended — mungbean, sesame' ],
      alkaline: [ isHindi ? 'सल्फर + गंधक से pH कम करें' : 'Sulphur application to correct high pH',
                  isHindi ? 'गहरी सिंचाई से लवण बाहर निकालें' : 'Leach salts with deep irrigation + drainage',
                  isHindi ? 'हरी खाद उगाकर कार्बन बढ़ाएं' : 'Grow cover crops to build organic carbon' ],
    },
    black: {
      neutral:  [ isHindi ? 'काली मिट्टी कपास के लिए आदर्श है' : 'Black soil is ideal for cotton cultivation',
                  isHindi ? 'जुताई नम अवस्था में करें' : 'Till when slightly moist to avoid clod formation',
                  isHindi ? 'सोयाबीन, चना, ज्वार भी अच्छे विकल्प हैं' : 'Soybean, chickpea, sorghum are excellent alternatives' ],
      acidic:   [ isHindi ? 'चूना डालें, pH 6.5-7 पर लाएं' : 'Lime application to bring pH to 6.5-7 range',
                  isHindi ? 'कपास के लिए बोरॉन 0.5 kg/एकड़ जरूरी' : 'Boron 0.5 kg/acre essential for cotton yield' ],
      alkaline: [ isHindi ? 'जिप्सम 3-4 क्विंटल/एकड़ से शुरू करें' : 'Start with Gypsum 3-4 qtl/acre for sodic correction',
                  isHindi ? 'वर्मीकम्पोस्ट मिलाएं — मिट्टी की संरचना सुधरेगी' : 'Vermicompost improves structure and reduces alkalinity' ],
    },
    red:    { neutral: [ isHindi ? 'लाल मिट्टी में लोहा अधिक होता है' : 'Red soil is iron-rich but low in N, P, organic matter', isHindi ? 'N:P:K 50:25:25 + जिंक सल्फेट डालें' : 'N:P:K 50:25:25 + Zinc Sulphate 5 kg/acre essential', isHindi ? 'दलहनी फसलें नाइट्रोजन बढ़ाएंगी' : 'Legume crops (pulses) will fix nitrogen naturally' ], acidic: [isHindi?'चूना 1.5 क्विंटल/एकड़':'Lime 1.5 qtl/acre to correct acidity'], alkaline:[isHindi?'गंधक 10 kg/एकड़':'Sulphur 10 kg/acre for pH correction'] },
    alluvial:{ neutral: [ isHindi ? 'जलोढ़ मिट्टी उत्तरी भारत की सबसे उपजाऊ मिट्टी है' : 'Alluvial soil is most fertile — found in Indo-Gangetic plains', isHindi ? 'गेहूं, धान, गन्ना के लिए सर्वोत्तम' : 'Best for wheat, paddy, sugarcane, mustard crops', isHindi ? 'N:P:K:S अनुसार संतुलित खाद दें' : 'Follow balanced N:P:K:S fertilization schedule' ], acidic:[isHindi?'चूना 1 qtl/एकड़':'Lime 1 qtl/acre'], alkaline:[isHindi?'जिप्सम 2 qtl/एकड़':'Gypsum 2 qtl/acre + organic matter'] },
  };

  const moistureAdvice: Record<string, string> = {
    dry:          isHindi ? '⚠️ सिंचाई तुरंत करें। ड्रिप सिंचाई सबसे अच्छी है।' : '⚠️ Irrigate immediately. Drip irrigation saves 40% water.',
    moderate:     isHindi ? '✅ मिट्टी की नमी आदर्श है। नियमित सिंचाई जारी रखें।' : '✅ Soil moisture is optimal. Maintain with regular irrigation.',
    wet:          isHindi ? '⚠️ सिंचाई रोकें। अतिरिक्त पानी जड़ सड़न कर सकता है।' : '⚠️ Stop irrigation. Excess water causes root rot diseases.',
    waterlogged:  isHindi ? '🚨 तुरंत जल निकासी करें! फसल 48 घंटे में खराब हो सकती है।' : '🚨 Drain immediately! Crop can die in 48 hours from waterlogging.',
  };

  const soilAdvices = adviceDB[soil]?.[ph] || adviceDB[soil]?.neutral || [
    isHindi ? 'मिट्टी जांच कराएं (मृदा परीक्षण)' : 'Get soil test done at nearest Krishi Kendra',
    isHindi ? 'जैविक खाद डालें' : 'Apply organic manure to improve soil health',
    isHindi ? 'KVK से संपर्क करें' : 'Contact your local KVK for soil-specific advice',
  ];

  const cropAdvice = crop
    ? (isHindi
        ? `${crop} के लिए: नियमित निगरानी और समय पर खाद डालने से 20-30% अतिरिक्त उपज संभव है।`
        : `For ${crop}: Regular monitoring + timely fertilization can increase yield by 20-30%.`)
    : '';

  return { soilAdvices, moistureNote: moistureAdvice[moisture] || '', cropAdvice };
}

// ── Steps ───────────────────────────────────────────────────
type Step = 'photo-scan' | 'photo-result' | 'soil' | 'ph' | 'moisture' | 'result';

type SoilFertilizerPlanItem = {
  nutrient: string;
  product_name: string;
  dosage_kg_per_acre: number;
  dosage_for_farm_kg: number;
  estimated_cost_inr: number;
  estimated_cost_label: string;
  application_method: string;
  advisory: string;
};

type SoilScanResult = {
  success: boolean;
  soil_type?: string;
  confidence_pct?: number | null;
  analysis_method?: string;
  source_model?: string;
  crop_focus?: string;
  area_acres?: number;
  overall_advice?: string;
  nitrogen_advice: string;
  phosphorus_advice?: string;
  potassium_advice?: string;
  estimated_cost?: string;
  estimated_cost_per_acre?: string;
  recommended_fertilizers?: SoilFertilizerPlanItem[];
  raw_text: string;
};

export default function SoilGuidePage() {
  const { profile, updateProfile } = useFarmerProfile();
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const isHindi = language !== 'English';
  const isPunjabi = language === 'ਪੰਜਾਬੀ';

  // If came from scanner with ?scan=1, start in photo-scan mode
  const initialStep: Step = searchParams?.get('scan') === '1' ? 'photo-scan' : 'soil';

  const [step, setStep]         = useState<Step>(initialStep);
  const [soilType, setSoilType] = useState('');
  const [phLevel, setPhLevel]   = useState('');
  const [moisture, setMoisture] = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<ReturnType<typeof generateSoilAdvice> | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<SoilScanResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentCrop = profile.crops?.[0] || '';
  const farmAreaAcres = parseFloat(profile.farmSize) || 1;

  const goNext = (next: Step) => {
    if (navigator.vibrate) navigator.vibrate(12);
    setStep(next);
  };

  const handleSoilImageUpload = useCallback(async (file: File) => {
    setScanLoading(true);
    setScanResult(null);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('crop', currentCrop);
      formData.append('area_acres', String(farmAreaAcres));
      formData.append('growth_stage', 'vegetative');
      formData.append('language', language);
      const res = await fetch(`${getBackendBaseUrl()}/api/v1/ai/soil-scan`, {
        method: 'POST',
        body: formData,
      });
      const data: SoilScanResult = await res.json();
      setScanResult(data);
      if (data?.success && data.soil_type) {
        updateProfile({ soilType: normalizeSoilType(data.soil_type) });
      }
      setStep('photo-result');
    } catch {
      setScanResult({
        success: false,
        nitrogen_advice: 'AI analysis failed. Please retry.',
        phosphorus_advice: '',
        potassium_advice: '',
        raw_text: '',
      });
      setStep('photo-result');
    } finally {
      setScanLoading(false);
    }
  }, [currentCrop, farmAreaAcres, language, updateProfile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleSoilImageUpload(file);
  };

  const handleGetAdvice = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    const advice = generateSoilAdvice(soilType, phLevel, moisture, currentCrop, language);
    setResult(advice);
    setLoading(false);
    setStep('result');
  };

  const reset = () => {
    setStep(searchParams?.get('scan') === '1' ? 'photo-scan' : 'soil');
    setSoilType(''); setPhLevel(''); setMoisture(''); setResult(null);
    setScanResult(null); setImagePreview(null);
  };

  const progressSteps = ['soil', 'ph', 'moisture', 'result'];
  const progressIdx   = progressSteps.indexOf(step);

  return (
    <div className="min-h-screen pb-6 sm:pb-8 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative overflow-hidden">

      {/* Soft Ambient Background Orbs */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 px-4 py-3.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard"
              className="h-10 w-10 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-emerald-500 animate-pulse" />
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                  {isPunjabi ? 'AI ਮਿੱਟੀ ਵਿਸ਼ਲੇਸ਼ਣ' : isHindi ? 'AI मृदा विश्लेषण' : 'AI Soil Analysis'}
                </p>
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {isPunjabi ? 'ਮਿੱਟੀ ਗਾਈਡ' : isHindi ? 'मिट्टी गाइड' : 'Soil Guide'}
              </h1>
            </div>
          </div>
          {step !== 'soil' && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-xs font-black text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 hover:bg-emerald-100 transition-all shadow-sm"
            >
              <RefreshCw size={13} /> {isHindi ? 'दोबारा' : 'Reset'}
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mt-3">
          {progressSteps.slice(0,-1).map((s, i) => (
            <div key={s} className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200/70 dark:bg-slate-800">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50"
                animate={{ width: i <= progressIdx - 1 ? '100%' : (i === progressIdx && step !== 'result' ? '50%' : '0%') }}
                transition={{ duration: 0.4 }}
              />
            </div>
          ))}
        </div>
      </header>

      <div className="px-4 py-5 max-w-xl mx-auto space-y-4">
        <AnimatePresence mode="wait">

          {/* ── PHOTO SCAN MODE ── */}
          {step === 'photo-scan' && (
            <motion.div key="photo-scan" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }} className="space-y-6">
              <div className="text-center pt-2">
                <div
                  className="h-20 w-20 rounded-[1.6rem] flex items-center justify-center mx-auto mb-4 relative"
                  style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.1))', border: '1px solid rgba(34,197,94,0.4)', boxShadow: '0 8px 32px rgba(34,197,94,0.15)' }}
                >
                  <ScanLine size={36} className="text-emerald-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isHindi ? '📸 मिट्टी की फोटो लें' : '📸 Photograph Your Soil'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {isHindi ? 'खेत की मिट्टी का क्लोज़-अप फोटो खींचें — AI मिट्टी का प्रकार व पोषण क्षमता पहचानेगा' : 'Take a close-up photo of your field soil. AI will identify its type, moisture & NPK needs.'}
                </p>
              </div>

              {scanLoading ? (
                <motion.div
                  initial={{ opacity:0 }} animate={{ opacity:1 }}
                  className="rounded-[2.2rem] p-10 flex flex-col items-center gap-4 text-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-emerald-500/30 shadow-xl shadow-emerald-500/10"
                >
                  {imagePreview && (
                    <img src={imagePreview} alt="soil" className="h-32 w-32 rounded-2xl object-cover shadow-md" />
                  )}
                  <Loader2 size={36} className="text-emerald-500 animate-spin" />
                  <p className="font-black text-slate-800 dark:text-white text-base">{isHindi ? 'AI मिट्टी विश्लेषण कर रहा है...' : 'AI analysing your soil sample...'}</p>
                  <p className="text-xs text-slate-400 font-medium">{isHindi ? 'बस कुछ ही सेकंड का समय लगेगा' : 'This may take a few seconds'}</p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {/* Upload button */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-[2.2rem] p-6 flex items-center gap-4 text-left relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 dark:from-emerald-950/40 dark:to-teal-950/30 backdrop-blur-2xl border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 transition-all shadow-lg shadow-emerald-500/5"
                  >
                    <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
                      <ImageIcon size={26} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-black text-slate-900 dark:text-white">{isHindi ? '📁 गैलरी या कैमरा से चुनें' : '📁 Select from Gallery or Camera'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{isHindi ? 'JPG, PNG — मिट्टी का साफ़ फोटो अपलोड करें' : 'Upload a clear photo of your field soil'}</p>
                    </div>
                    <ChevronRight size={20} className="text-emerald-500 shrink-0" />
                  </motion.button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{isHindi ? 'या' : 'OR'}</span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                  </div>

                  {/* Manual analysis */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setStep('soil')}
                    className="w-full rounded-[1.8rem] p-4.5 flex items-center gap-3.5 text-left bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800/70 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="h-11 w-11 rounded-[1.1rem] bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                      <ClipboardList size={20} />
                    </div>
                    <div>
                      <p className="font-black text-slate-800 dark:text-white text-sm">{isHindi ? 'मैन्युअल मिट्टी जांच करें' : 'Manual Soil Analysis'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{isHindi ? '3 त्वरित सवालों के जवाब देकर सलाह पाएं' : 'Answer quick questions to get advice'}</p>
                    </div>
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── PHOTO RESULT ── */}
          {step === 'photo-result' && scanResult && (
            <motion.div
              key="photo-result"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 pb-20"
            >
              {/* Top Banner / Image */}
              <div className="relative h-64 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-emerald-500/20 border border-slate-200/60 dark:border-slate-800/60">
                <img
                  src={imagePreview || '/api/placeholder/400/320'}
                  alt="Soil sample"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />

                {/* Confidence Badge */}
                <div className="absolute top-4 right-4 px-4 py-2 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/20">
                  <p className="text-[10px] font-black text-white/70 uppercase tracking-widest text-center">Confidence</p>
                  <p className="text-lg font-black text-emerald-400 text-center">
                    {scanResult.confidence_pct ? `${scanResult.confidence_pct}%` : 'Estimate'}
                  </p>
                </div>

                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">
                      {isHindi ? 'विश्लेषण पूर्ण' : 'Analysis Complete'}
                    </p>
                  </div>
                  <h2 className="text-3xl font-black text-white leading-tight">
                    {scanResult.soil_type || (isHindi ? 'मिट्टी की रिपोर्ट' : 'Soil Report')}
                  </h2>
                </div>
              </div>

              {/* Analysis Summary Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2rem] p-6 border border-slate-200/70 dark:border-slate-800/70 shadow-lg shadow-slate-200/30 dark:shadow-none relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-[0.04]">
                  <FlaskConical size={90} />
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60">
                    <ScanLine className="text-emerald-600 dark:text-emerald-400" size={20} />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    {isHindi ? 'AI मृदा विश्लेषण रिपोर्ट' : 'AI Soil Analysis Report'}
                  </p>
                </div>
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-medium text-sm">
                  {scanResult.overall_advice}
                </p>
              </motion.div>

              {/* NPK Grid */}
              <div className="grid grid-cols-1 gap-4">
                {[
                  {
                    label: isHindi ? 'N नाइट्रोजन' : 'N Nitrogen',
                    value: scanResult.nitrogen_advice,
                    icon: 'N',
                    gradient: 'from-emerald-500 to-teal-600',
                  },
                  {
                    label: isHindi ? 'P फॉस्फोरस' : 'P Phosphorus',
                    value: scanResult.phosphorus_advice,
                    icon: 'P',
                    gradient: 'from-blue-500 to-indigo-600',
                  },
                  {
                    label: isHindi ? 'K पोटैशियम' : 'K Potassium',
                    value: scanResult.potassium_advice,
                    icon: 'K',
                    gradient: 'from-purple-500 to-violet-700',
                  },
                ].filter(item => item.value).map((item, idx) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1 }}
                    className="p-5 rounded-[2rem] border border-slate-200/70 dark:border-slate-800/70 flex gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-sm"
                  >
                    <div
                      className={`h-14 w-14 rounded-[1.3rem] shrink-0 flex items-center justify-center text-xl font-black text-white bg-gradient-to-br ${item.gradient} shadow-md`}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                        {item.label}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        {item.value}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Fertilizer Recommendation Section */}
              {scanResult.recommended_fertilizers && scanResult.recommended_fertilizers.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      {isHindi ? 'सुझाया गया खाद प्लान' : 'Suggested Fertilizer Plan'}
                    </h3>
                    <div className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase border border-emerald-200 dark:border-emerald-800">
                      {scanResult.crop_focus || 'Crop Specific'}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {scanResult.recommended_fertilizers.map((item, idx) => (
                      <motion.div
                        key={idx}
                        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2rem] border border-slate-200/70 dark:border-slate-800/70 p-5 shadow-sm"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 + idx * 0.1 }}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5">
                              {item.nutrient}
                            </p>
                            <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase">{item.product_name}</h4>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900 dark:text-white">{item.estimated_cost_label}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{isHindi ? 'अनुमानित' : 'Estimated'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="bg-slate-100/80 dark:bg-slate-800/80 p-3 rounded-2xl text-center border border-slate-200/40 dark:border-slate-700/40">
                            <p className="text-[9px] font-black text-slate-400 uppercase">{isHindi ? 'खुराक/एकड़' : 'Dose/Acre'}</p>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">{item.dosage_kg_per_acre} kg</p>
                          </div>
                          <div className="bg-slate-100/80 dark:bg-slate-800/80 p-3 rounded-2xl text-center border border-slate-200/40 dark:border-slate-700/40">
                            <p className="text-[9px] font-black text-slate-400 uppercase">{isHindi ? 'कुल' : 'Total'}</p>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">{item.dosage_for_farm_kg} kg</p>
                          </div>
                          <div className="bg-slate-100/80 dark:bg-slate-800/80 p-3 rounded-2xl text-center border border-slate-200/40 dark:border-slate-700/40">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{isHindi ? 'विधि' : 'Method'}</p>
                            <p className="text-[10px] font-bold text-slate-800 dark:text-slate-100 leading-tight">{item.application_method.split(' ')[0]}</p>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60">
                          <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium leading-relaxed italic">
                            {item.advisory}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Global Bill Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-slate-900 dark:bg-slate-900 rounded-[2.5rem] p-7 text-white relative overflow-hidden border border-slate-800 shadow-xl"
              >
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Calculator size={120} />
                </div>

                <div className="flex justify-between items-center mb-6">
                  <span className="px-4 py-1.5 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-[0.2em]">
                    {isHindi ? 'अनुमानित कुल बिल' : 'Estimated Total Bill'}
                  </span>
                  <span className="text-xs text-white/50 font-bold">{scanResult.area_acres || farmAreaAcres} acre</span>
                </div>

                <div className="mb-6">
                  <p className="text-5xl font-black mb-1">{scanResult.estimated_cost || '₹0'}</p>
                  <p className="text-xs text-white/40 font-medium tracking-widest uppercase">
                    {isHindi ? 'प्रति एकड़:' : 'Per acre:'} {scanResult.estimated_cost_per_acre}
                  </p>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <p className="text-[10px] text-white/30 leading-relaxed">
                    {isHindi
                      ? '*कीमतें भारतीय मानक दरों पर आधारित अनुमान हैं (Urea, DAP, Potash)'
                      : '*Costs are estimated using standard Indian fertilizer rates (Urea, DAP, Potash)'}
                  </p>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={reset}
                  className="p-4.5 rounded-[1.8rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm"
                >
                  <RefreshCw size={18} /> {isHindi ? 'फिर से स्कैन' : 'Scan Again'}
                </button>
                <button
                   onClick={() => setStep('soil')}
                  className="p-4.5 rounded-[1.8rem] bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <ChevronRight size={18} /> {isHindi ? 'विस्तार जांच' : 'Full Analysis'}
                </button>
              </div>

              {scanResult.raw_text && (
                <details className="px-4 group cursor-pointer">
                  <summary className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-open:mb-4">
                    {isHindi ? 'OCR कच्चा डेटा देखें' : 'View raw OCR data'}
                  </summary>
                  <div className="p-4 rounded-3xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] text-slate-500 dark:text-slate-400 whitespace-pre-wrap">
                    {scanResult.raw_text}
                  </div>
                </details>
              )}
            </motion.div>
          )}


          {/* ── STEP 1: SOIL TYPE ── */}
          {step === 'soil' && (
            <motion.div key="soil" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }} className="space-y-4">

              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isHindi ? '🌍 आपकी मिट्टी का प्रकार?' : '🌍 What type of soil do you have?'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {isHindi ? 'अपने खेत की मिट्टी छुकर देखें — वह कैसी है?' : 'Touch your field soil — what does it feel like?'}
                </p>
              </div>

              {/* Soft Glass Prism Soil Grid */}
              <div className="grid grid-cols-2 gap-3.5">
                {SOIL_TYPES.map(s => {
                  const isSelected = soilType === s.id;
                  return (
                    <motion.button
                      key={s.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setSoilType(s.id);
                        updateProfile({ soilType: normalizeSoilType(s.id) });
                        goNext('ph');
                      }}
                      className={`p-4.5 rounded-[2rem] text-left transition-all relative overflow-hidden group border backdrop-blur-2xl ${
                        isSelected
                          ? `bg-gradient-to-br ${s.lightBg} border-2 ${s.borderColor} ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/10`
                          : `bg-gradient-to-br ${s.lightBg} bg-white/90 dark:bg-slate-900/90 ${s.borderColor} shadow-sm hover:shadow-md hover:scale-[1.01]`
                      }`}
                    >
                      {/* Ambient card tint glow */}
                      <div className={`absolute -top-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br ${s.lightBg} blur-xl pointer-events-none group-hover:scale-125 transition-transform`} />

                      {/* Squircle Emoji Badge */}
                      <div className={`h-12 w-12 rounded-[1.2rem] bg-gradient-to-br ${s.badgeGradient} flex items-center justify-center shrink-0 shadow-md shadow-slate-900/10 mb-3 border border-white/20 relative z-10`}>
                        <span className="text-2xl">{s.emoji}</span>
                      </div>

                      {/* Label & Description */}
                      <p className="text-base font-black text-slate-900 dark:text-white leading-tight tracking-tight relative z-10">
                        {isHindi ? s.labelHi : s.labelEn}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1 leading-snug relative z-10">
                        {isHindi ? s.descHi : s.descEn}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: pH LEVEL ── */}
          {step === 'ph' && (
            <motion.div key="ph" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }} className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{SOIL_TYPES.find(s => s.id === soilType)?.emoji}</span>
                  <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                    {isHindi ? SOIL_TYPES.find(s => s.id === soilType)?.labelHi : SOIL_TYPES.find(s => s.id === soilType)?.labelEn}
                  </p>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                  {isHindi ? '🧪 मिट्टी का pH स्तर?' : '🧪 What is your soil pH?'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {isHindi ? 'मृदा परीक्षण रिपोर्ट देखें या अनुमान लगाएं' : 'Check your soil test report or estimate below'}
                </p>
              </div>

              {/* pH visual scale */}
              <div className="rounded-[2rem] p-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800/70 shadow-sm space-y-3">
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>0 — Acidic</span><span>7 — Neutral</span><span>14 — Alkaline</span>
                </div>
                <div className="h-4 rounded-full overflow-hidden p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
                  <div className="h-full rounded-full w-full"
                    style={{ background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 25%, #22c55e 50%, #3b82f6 75%, #7c3aed 100%)' }} />
                </div>
              </div>

              <div className="space-y-3.5">
                {PH_OPTIONS.map(p => {
                  const isSelected = phLevel === p.id;
                  const BadgeIcon = p.badgeIcon;
                  return (
                    <motion.button
                      key={p.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setPhLevel(p.id); goNext('moisture'); }}
                      className={`w-full flex items-center justify-between p-5 rounded-[2rem] text-left transition-all relative overflow-hidden backdrop-blur-2xl border ${
                        isSelected
                          ? `bg-gradient-to-r ${p.lightBg} border-2 ${p.borderColor} ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/10`
                          : `bg-gradient-to-r ${p.lightBg} bg-white/90 dark:bg-slate-900/90 ${p.borderColor} shadow-sm hover:shadow-md hover:scale-[1.01]`
                      }`}
                    >
                      {/* Soft background glow orb */}
                      <div className={`absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-gradient-to-br ${p.lightBg} blur-2xl pointer-events-none`} />

                      <div className="relative z-10 flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-[1.2rem] bg-gradient-to-br ${p.iconBg} flex items-center justify-center shrink-0 shadow-md text-white border border-white/20`}>
                          <BadgeIcon size={22} />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-white text-base tracking-tight">{isHindi ? p.labelHi : p.label}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">{isHindi ? p.descHi : p.descEn}</p>
                        </div>
                      </div>

                      <div className="relative z-10 flex items-center gap-2 shrink-0">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${p.textColor} bg-white/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50`}>
                          pH {p.id === 'acidic' ? '< 6' : p.id === 'neutral' ? '6-7' : '> 7'}
                        </span>
                        <ChevronRight size={18} className="text-slate-400" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: MOISTURE ── */}
          {step === 'moisture' && (
            <motion.div key="moisture" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }} className="space-y-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isHindi ? '💧 अभी मिट्टी कैसी महसूस हो रही है?' : '💧 Current soil moisture status?'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {isHindi ? 'खेत की मौजूदा नमी स्थिति चुनें' : 'Select current field moisture condition'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {MOISTURE_OPTIONS.map(m => {
                  const isSelected = moisture === m.id;
                  return (
                    <motion.button
                      key={m.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setMoisture(m.id)}
                      className={`p-4.5 rounded-[2rem] text-center transition-all border backdrop-blur-2xl relative overflow-hidden ${
                        isSelected
                          ? `bg-gradient-to-br ${m.lightBg} border-2 ${m.borderColor} ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/10`
                          : `bg-gradient-to-br ${m.lightBg} bg-white/90 dark:bg-slate-900/90 ${m.borderColor} shadow-sm hover:shadow-md`
                      }`}
                    >
                      <div className={`h-12 w-12 rounded-[1.2rem] bg-gradient-to-br ${m.gradient} flex items-center justify-center mx-auto mb-2.5 shadow-md border border-white/20 relative z-10`}>
                        <span className="text-2xl">{m.icon}</span>
                      </div>
                      <p className="text-sm font-black text-slate-900 dark:text-white leading-tight relative z-10">{m.label}</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium mt-1 relative z-10">{m.descHi}</p>
                    </motion.button>
                  );
                })}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={!moisture || loading}
                onClick={handleGetAdvice}
                className="w-full py-4 rounded-[1.8rem] font-black text-white flex items-center justify-center gap-2 disabled:opacity-40 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/30 hover:scale-[1.01] active:scale-95 transition-all text-base mt-2"
              >
                {loading ? (
                  <><Loader2 size={20} className="animate-spin" /> {isHindi ? 'विश्लेषण हो रहा है...' : 'Analysing...'}</>
                ) : (
                  <><ClipboardList size={20} /> {isHindi ? 'मृदा सलाह रिपोर्ट प्राप्त करें' : 'Get Soil Advice Report'}</>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* ── STEP 4: RESULT ── */}
          {step === 'result' && result && (
            <motion.div key="result" initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} className="space-y-4">

              {/* Summary pill */}
              <div className="rounded-[2rem] p-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800/70 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-3">
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                  {isHindi ? 'आपकी मिट्टी का सारांश' : 'Your Soil Summary'}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: isHindi ? 'प्रकार' : 'Type',     value: SOIL_TYPES.find(s=>s.id===soilType)?.emoji + ' ' + soilType },
                    { label: 'pH',                              value: phLevel },
                    { label: isHindi ? 'नमी' : 'Moisture',     value: moisture },
                    { label: isHindi ? 'फसल' : 'Crop',         value: currentCrop || '—' },
                  ].map(item => (
                    <div key={item.label} className="px-3.5 py-2.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{item.label}</p>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-100 capitalize">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Moisture alert */}
              {result.moistureNote && (
                <div className="rounded-[1.8rem] p-4.5 flex items-start gap-3.5 backdrop-blur-xl border shadow-sm"
                  style={{
                    background: moisture === 'waterlogged' ? 'rgba(254,242,242,0.85)' : moisture === 'dry' ? 'rgba(255,251,235,0.85)' : 'rgba(240,253,244,0.85)',
                    borderColor: moisture === 'waterlogged' ? '#fecaca' : moisture==='dry' ? '#fde68a' : '#bbf7d0'
                  }}>
                  {moisture === 'waterlogged' || moisture === 'dry'
                    ? <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    : <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />}
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-900 leading-relaxed">{result.moistureNote}</p>
                </div>
              )}

              {/* Soil recommendations */}
              <div className="rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800/70 shadow-lg shadow-slate-200/30 dark:shadow-none">
                <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center gap-2.5">
                  <FlaskConical size={18} className="text-white" />
                  <p className="text-sm font-black text-white">
                    {isHindi ? 'मृदा सुधार विशेषज्ञ सलाह' : 'Expert Soil Improvement Advice'}
                  </p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {result.soilAdvices.map((advice, i) => (
                    <div key={i} className="px-5 py-4 flex items-start gap-3.5">
                      <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        <span className="text-xs font-black text-white">{i+1}</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-200 font-semibold leading-relaxed">{advice}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Crop-specific tip */}
              {result.cropAdvice && (
                <div className="rounded-[1.8rem] p-4.5 flex items-start gap-3.5 bg-violet-50/80 dark:bg-violet-950/40 border border-violet-200/70 dark:border-violet-800/70">
                  <Sprout size={18} className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-violet-900 dark:text-violet-200 leading-relaxed">{result.cropAdvice}</p>
                </div>
              )}

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <button onClick={reset}
                  className="py-4 rounded-[1.8rem] font-black text-sm text-slate-800 dark:text-white flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                  <RefreshCw size={16} /> {isHindi ? 'दोबारा जांचें' : 'Check Again'}
                </button>
                <Link href="/scanner"
                  className="py-4 rounded-[1.8rem] font-black text-sm text-white flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 hover:scale-[1.01] active:scale-95 transition-all">
                  <Sprout size={16} /> {isHindi ? 'फसल स्कैन करें' : 'Scan Crop'}
                </Link>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
