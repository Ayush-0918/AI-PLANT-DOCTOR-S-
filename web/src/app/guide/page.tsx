'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Sprout, Loader2, RefreshCw, ChevronRight,
  AlertTriangle, CheckCircle2, Info, CloudRain, Sun,
  Wind, Beaker, Droplets, Sparkles, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { useFarmerProfile } from '@/context/FarmerProfileContext';
import { useLanguage } from '@/context/LanguageContext';
import { getBackendBaseUrl } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const CROPS = ['Wheat','Rice','Tomato','Potato','Corn','Cotton','Soybean','Sugarcane'];
const CROP_ICONS: Record<string,string> = {
  Wheat:'🌾', Rice:'🌿', Tomato:'🍅', Potato:'🥔',
  Corn:'🌽', Cotton:'☁️', Soybean:'🫘', Sugarcane:'🎋',
};

const CROP_TINTS: Record<string, { badge: string; lightBg: string; border: string }> = {
  Wheat:     { badge: 'from-amber-500 to-yellow-600',   lightBg: 'from-amber-500/15 via-yellow-500/5 to-transparent', border: 'border-amber-500/30' },
  Rice:      { badge: 'from-emerald-500 to-teal-600',   lightBg: 'from-emerald-500/15 via-teal-500/5 to-transparent', border: 'border-emerald-500/30' },
  Tomato:    { badge: 'from-rose-500 to-red-600',       lightBg: 'from-rose-500/15 via-red-500/5 to-transparent', border: 'border-rose-500/30' },
  Potato:    { badge: 'from-amber-700 to-amber-900',   lightBg: 'from-amber-700/15 via-amber-600/5 to-transparent', border: 'border-amber-700/30' },
  Corn:      { badge: 'from-yellow-400 to-amber-500',  lightBg: 'from-yellow-400/15 via-amber-500/5 to-transparent', border: 'border-yellow-400/30' },
  Cotton:    { badge: 'from-slate-400 to-slate-600',    lightBg: 'from-slate-400/15 via-slate-500/5 to-transparent', border: 'border-slate-400/30' },
  Soybean:   { badge: 'from-lime-500 to-emerald-600',   lightBg: 'from-lime-500/15 via-emerald-500/5 to-transparent', border: 'border-lime-500/30' },
  Sugarcane: { badge: 'from-teal-500 to-emerald-700',   lightBg: 'from-teal-500/15 via-emerald-600/5 to-transparent', border: 'border-teal-500/30' },
};

const CROP_TRANSLATIONS: Record<string, Record<string, string>> = {
  'हिंदी': { Wheat: 'गेहूं', Rice: 'धान', Tomato: 'टमाटर', Potato: 'आलू', Corn: 'मक्का', Cotton: 'कपास', Soybean: 'सोयाबीन', Sugarcane: 'गन्ना' },
  'भोजपुरी': { Wheat: 'गेहूं', Rice: 'धान', Tomato: 'टमाटर', Potato: 'आलू', Corn: 'मक्का', Cotton: 'कपास', Soybean: 'सोयाबीन', Sugarcane: 'गन्ना' },
  'मैथिली': { Wheat: 'गहूम', Rice: 'धान', Tomato: 'टमाटर', Potato: 'आलू', Corn: 'मकई', Cotton: 'कपास', Soybean: 'सोयाबीन', Sugarcane: 'गन्ना' },
  'ਪੰਜਾਬੀ': { Wheat: 'ਕਣਕ', Rice: 'ਧਾਨ', Tomato: 'ਟਮਾਟਰ', Potato: 'ਆਲੂ', Corn: 'ਮੱਕੀ', Cotton: 'ਕਪਾਹ', Soybean: 'ਸੋਇਆਬੀਨ', Sugarcane: 'ਗੰਨਾ' },
  'मराठी': { Wheat: 'गहू', Rice: 'भात', Tomato: 'टोमॅटो', Potato: 'बटाटा', Corn: 'मका', Cotton: 'कापूस', Soybean: 'सोयाबीन', Sugarcane: 'ऊस' },
  'ગુજરાતી': { Wheat: 'ઘઉં', Rice: 'ધાન', Tomato: 'ટામેટા', Potato: 'બટાકા', Corn: 'મકાઈ', Cotton: 'કપાસ', Soybean: 'સોયાબીન', Sugarcane: 'શેરડી' },
  'తెలుగు': { Wheat: 'గోధుమ', Rice: 'వరి', Tomato: 'టమాట', Potato: 'బంగాళాదుంప', Corn: 'మొక్కజొన్న', Cotton: 'పత్తి', Soybean: 'సోయాబీన్', Sugarcane: 'చెరకు' },
};

const STAGES = [
  { id:'germination', label:'Germination', labelHi:'अंकुरण' },
  { id:'vegetative',  label:'Vegetative',  labelHi:'वानस्पतिक' },
  { id:'flowering',   label:'Flowering',   labelHi:'फूल आना' },
  { id:'maturity',    label:'Maturity',    labelHi:'परिपक्वता' },
];

const RISKS = [
  { id:'low',    label:'Low Risk',    labelHi:'कम जोखिम',    gradient:'from-emerald-500 to-teal-600', lightBg:'from-emerald-500/15 via-teal-500/5 to-transparent', border:'border-emerald-500/30', color:'#22c55e' },
  { id:'medium', label:'Medium Risk', labelHi:'मध्यम जोखिम', gradient:'from-amber-400 to-yellow-600', lightBg:'from-amber-500/15 via-yellow-500/5 to-transparent', border:'border-amber-500/30', color:'#f59e0b' },
  { id:'high',   label:'High Risk',   labelHi:'अधिक जोखिम',  gradient:'from-rose-500 to-red-600', lightBg:'from-rose-500/15 via-red-500/5 to-transparent', border:'border-rose-500/30', color:'#ef4444' },
];

interface Recommendation {
  type?: string;
  care_area?: string;
  priority: string;
  action?: string;
  advice?: string;
  product?: string;
  dosage?: string;
  timing?: string;
  frequency?: string;
}

const normalizeRec = (rec: Recommendation): { type: string; action: string; priority: string; product?: string; dosage?: string; timing?: string; frequency?: string } => ({
  type: rec.care_area || rec.type || 'monitoring',
  action: rec.advice || rec.action || '',
  priority: rec.priority || 'medium',
  product: rec.product,
  dosage: rec.dosage,
  timing: rec.timing,
  frequency: rec.frequency,
});

const PRIORITY_CARD_STYLE: Record<string, { lightBg: string; border: string; badgeBg: string; text: string }> = {
  critical: { lightBg: 'from-rose-500/15 via-red-500/8 to-transparent', border: 'border-rose-500/40 dark:border-rose-500/30', badgeBg: 'from-rose-500 to-red-600', text: 'text-rose-700 dark:text-rose-300' },
  high:     { lightBg: 'from-amber-500/15 via-yellow-500/8 to-transparent', border: 'border-amber-500/40 dark:border-amber-500/30', badgeBg: 'from-amber-400 to-yellow-600', text: 'text-amber-700 dark:text-amber-300' },
  medium:   { lightBg: 'from-emerald-500/15 via-teal-500/8 to-transparent', border: 'border-emerald-500/40 dark:border-emerald-500/30', badgeBg: 'from-emerald-500 to-teal-600', text: 'text-emerald-700 dark:text-emerald-300' },
  low:      { lightBg: 'from-slate-500/10 via-slate-400/5 to-transparent', border: 'border-slate-300/60 dark:border-slate-700/60', badgeBg: 'from-slate-500 to-slate-700', text: 'text-slate-700 dark:text-slate-300' },
  planned:  { lightBg: 'from-blue-500/15 via-cyan-500/8 to-transparent', border: 'border-blue-500/40 dark:border-blue-500/30', badgeBg: 'from-blue-500 to-indigo-600', text: 'text-blue-700 dark:text-blue-300' },
};

export default function CropGuidePage() {
  const { profile } = useFarmerProfile();
  const { language } = useLanguage();
  const isHindi = language !== 'English';
  const isPunjabi = language === 'ਪੰਜਾਬੀ';
  const localCropName = (value: string) => CROP_TRANSLATIONS[language]?.[value] || value;

  const typeLabel = (value: string) => {
    if (!isHindi) return value;
    const map: Record<string, string> = {
      irrigation: 'सिंचाई',
      nutrition: 'पोषण',
      protection: 'सुरक्षा',
      monitoring: 'निगरानी',
      scouting: 'निगरानी',
      canopy: 'पत्तों की देखभाल',
      planned: 'योजना',
      harvest: 'कटाई',
      nursery: 'नर्सरी',
    };
    return map[value] || value;
  };

  const [crop, setCrop]       = useState(profile.crops?.[0] || 'Wheat');
  const [stage, setStage]     = useState('vegetative');
  const [risk, setRisk]       = useState('medium');
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState<{ recommendations: Recommendation[]; crop: string; stage: string } | null>(null);
  const [error, setError]     = useState('');

  // Crop-specific fallback knowledge base
  const CROP_FALLBACK: Record<string, Record<string, Record<string, {action:string; product?:string; dosage?:string; timing?:string; priority:string; type:string}[]>>> = {
    Wheat: {
      germination: { low: [
        {type:'irrigation', priority:'high', action: isHindi?'अंकुरण के लिए 5-7 cm मिट्टी नम रखें':'Keep 5-7 cm topsoil moist for uniform germination', timing: isHindi?'बुआई के बाद तुरंत':'Immediately after sowing'},
        {type:'nutrition',  priority:'medium', action: isHindi?'DAP 50 kg/एकड़ बुआई पर डालें':'Apply DAP 50 kg/acre at sowing for strong root development', product:'DAP (Di-ammonium phosphate)', dosage:'50 kg/acre'},
        {type:'protection', priority:'low', action: isHindi?'बीज उपचार Thiram 3g/kg से करें':'Seed treatment with Thiram 3g/kg to prevent seed-borne diseases', product:'Thiram 75% WP', dosage:'3g per kg seed'},
      ]},
      vegetative: { medium: [
        {type:'nutrition',  priority:'high', action: isHindi?'यूरिया 33 kg/एकड़ — पहली सिंचाई के साथ':'Apply Urea 33 kg/acre with first irrigation (CRI stage)', product:'Urea 46% N', dosage:'33 kg/acre', timing: isHindi?'CRI stage (21 दिन)':'CRI stage ~21 days'},
        {type:'irrigation', priority:'high', action: isHindi?'CRI + बालेसर → 6 सिंचाई दें गेहूं को':'Wheat needs 6 irrigations: CRI, Tillering, Jointing, Heading, Flowering, Milking'},
        {type:'protection', priority:'medium', action: isHindi?'पीला रतुआ की निगरानी करें — पत्तियों पर पीली धारियां':'Monitor Yellow Rust — look for yellow stripes on leaves', product:'Propiconazole 25% EC', dosage:'1 ml/L water'},
        {type:'monitoring', priority:'low', action: isHindi?'कल्लों की गिनती करें — 8-10 कल्ले/पौधा आदर्श है':'Count tillers — 8-10 per plant is ideal for good yield'},
      ]},
      flowering: { high: [
        {type:'protection', priority:'critical', action: isHindi?'करनाल बंट का खतरा — Tebuconazole स्प्रे करें':'High risk of Karnal Bunt in flowering — spray Tebuconazole immediately', product:'Tebuconazole 25.9% EC', dosage:'1 ml/L water', timing: isHindi?'50% फूल आने पर':'At 50% heading'},
        {type:'irrigation', priority:'high', action: isHindi?'फूल अवस्था में सिंचाई जरूरी — सूखा न पड़ने दें':'Critical irrigation at flowering — water stress reduces grain weight 30%'},
        {type:'nutrition',  priority:'medium', action: isHindi?'Potash 20 kg/एकड़ — दाने भराव के लिए':'Potassium 20 kg/acre via fertigation for grain filling', product:'MOP (0-0-60)', dosage:'20 kg/acre'},
      ]},
      maturity: { low: [
        {type:'monitoring', priority:'high', action: isHindi?'दाने सख्त होने पर कटाई शुरू करें — 14% नमी पर':'Harvest at 14% grain moisture for best quality and storage life'},
        {type:'protection', priority:'low', action: isHindi?'गोदाम को Malathion से उपचारित करें':'Treat storage facility with Malathion before storing wheat', product:'Malathion 50% EC', dosage:'1L/100L water'},
      ]},
    },
    Rice: {
      germination: { low: [{type:'irrigation',priority:'high',action:isHindi?'नर्सरी में 2-3 cm पानी बनाए रखें':'Maintain 2-3 cm standing water in nursery for paddy',timing:isHindi?'बुआई से 24 घंटे पहले भिगोएं':'Soak seeds 24h before sowing'},{type:'nutrition',priority:'medium',action:isHindi?'नर्सरी में Zinc Sulphate 5 kg/एकड़ डालें':'Apply Zinc Sulphate 5 kg/acre in nursery — prevents Khaira disease',product:'Zinc Sulphate 21%', dosage:'5 kg/acre'}]},
      vegetative: { medium: [
        {type:'nutrition',  priority:'high', action: isHindi?'N:P:K = 60:30:30 kg/एकड़ — रोपाई के 2 हफ्ते बाद':'N:P:K 60:30:30 kg/acre — split N in 3 doses', product:'Urea + DAP + MOP', dosage:'As per soil test'},
        {type:'irrigation', priority:'high', action: isHindi?'AWD तकनीक — 5 cm तक सूखने दो, फिर पानी दो':'Use Alternate Wetting-Drying (AWD) — saves 30% water'},
        {type:'protection', priority:'medium', action: isHindi?'Brown Plant Hopper की निगरानी करें':'Scout for Brown Plant Hopper (BPH) — check under leaves at tillering', product:'Imidacloprid 17.8% SL', dosage:'0.3 ml/L water'},
        {type:'monitoring', priority:'low', action: isHindi?'कल्ले 20-25 प्रति स्टंप होने चाहिए':'Tiller count should be 20-25 per stump at active tillering stage'},
      ]},
      flowering: { high: [
        {type:'protection', priority:'critical', action: isHindi?'ब्लास्ट रोग का उच्च जोखिम — Tricyclazole तुरंत स्प्रे करें':'High Blast risk in wet conditions — spray Tricyclazole immediately', product:'Tricyclazole 75% WP', dosage:'0.6g/L water', timing: isHindi?'बाली निकलने पर':'At panicle initiation'},
        {type:'irrigation', priority:'high', action: isHindi?'फूल अवस्था में सूखा बिल्कुल न होने दें':'Maintain flooding at flowering — water stress causes chaffy grains'},
      ]},
      maturity: { low: [{type:'monitoring',priority:'high',action:isHindi?'80% दाने सुनहरे होने पर कटाई करें':'Harvest when 80% grains turn golden-yellow — avoid over-maturity'},{type:'protection',priority:'low',action:isHindi?'दाने धूप में 3-4 दिन सुखाएं 14% नमी तक':'Sun-dry harvested paddy 3-4 days to reach 14% moisture for safe storage'}]},
    },
    Tomato: {
      germination: {low:[{type:'nutrition',priority:'high',action:isHindi?'नर्सरी मिश्रण: 1:1:1 मिट्टी+रेत+खाद':'Nursery mix: 1:1:1 soil+sand+compost for seedling establishment'},{type:'protection',priority:'medium',action:isHindi?'Captan से बीज उपचार करें':'Seed treatment with Captan 2g/kg to prevent damping-off',product:'Captan 50% WP',dosage:'2g/kg seed'}]},
      vegetative: {medium:[
        {type:'nutrition',priority:'high',action:isHindi?'Ca + B स्प्रे करें — Blossom End Rot रोकने के लिए':'Spray Calcium Nitrate + Borax to prevent Blossom End Rot',product:'Calcium Nitrate 15.5%',dosage:'3g/L water',timing:isHindi?'फूल आने से पहले':'Before flowering'},
        {type:'irrigation',priority:'high',action:isHindi?'ड्रिप सिंचाई — असमान पानी से फल फटते हैं':'Drip irrigation essential — irregular watering causes fruit cracking'},
        {type:'protection',priority:'medium',action:isHindi?'अर्ली ब्लाइट — Mancozeb + Carbendazim स्प्रे':'Early Blight spray with Mancozeb+Carbendazim at first symptoms',product:'Mancozeb 64% + Carbendazim 8%',dosage:'2.5g/L'},
        {type:'monitoring',priority:'low',action:isHindi?'व्हाइटफ्लाई — पीला चिपचिपा जाल लगाएं':'Install yellow sticky traps for Whitefly monitoring (25-30 traps/acre)'},
      ]},
      flowering:{high:[{type:'protection',priority:'critical',action:isHindi?'लेट ब्लाइट का खतरा — Cymoxanil + Mancozeb तुरंत स्प्रे':'Late Blight emergency — spray Cymoxanil+Mancozeb immediately',product:'Curzate M8',dosage:'2.5g/L',timing:isHindi?'सुबह जल्दी':'Early morning'},{type:'nutrition',priority:'high',action:isHindi?'K2O 50 kg/एकड़ — फल की गुणवत्ता के लिए':'Potash 50 kg/acre for fruit quality and shelf life',product:'SOP (0-0-50)',dosage:'50 kg/acre'}]},
      maturity:{low:[{type:'monitoring',priority:'high',action:isHindi?'Breaker stage पर तोड़ें — परिवहन के लिए':'Harvest at breaker stage for transport or full red for local market'},{type:'protection',priority:'low',action:isHindi?'कोल्ड स्टोरेज 12-13°C पर रखें':'Store at 12-13°C cold storage to extend shelf life 15-20 days'}]},
    },
    Potato: {
      vegetative:{medium:[
        {type:'nutrition',priority:'high',action:isHindi?'N:P:K = 150:100:120 kg/एकड़ — आलू की उच्च मांग':'N:P:K 150:100:120 kg/acre — potato has high nutrient demand',product:'Urea + SSP + MOP',dosage:'Split in 3 doses'},
        {type:'protection',priority:'high',action:isHindi?'लेट ब्लाइट — आलू का सबसे खतरनाक रोग, Metalaxyl स्प्रे':'Late Blight is #1 threat — preventive Metalaxyl spray every 7-10 days',product:'Metalaxyl 8% + Mancozeb 64%',dosage:'2.5g/L water'},
        {type:'irrigation',priority:'medium',action:isHindi?'मिट्टी में 60-70% नमी बनाए रखें — कंद विकास के लिए':'Maintain 60-70% soil moisture during tuber initiation stage'},
        {type:'monitoring',priority:'low',action:isHindi?'अर्थिंग-अप करें — हरे कंद बनने से बचाएं':'Earth up properly to prevent greening of tubers (toxic solanine)'},
      ]},
    },
    Corn: {vegetative:{medium:[{type:'nutrition',priority:'high',action:isHindi?'मक्का को N:P:K = 120:60:40 kg/एकड़ चाहिए':'Maize needs N:P:K 120:60:40 kg/acre with split N application',product:'Urea + DAP',dosage:'Split in 3'},{type:'protection',priority:'medium',action:isHindi?'Fall Armyworm — Spinosad स्प्रे 15 दिन पर करें':'Fall Armyworm — apply Spinosad spray every 15 days from early stage',product:'Spinosad 45% SC',dosage:'0.3 ml/L'},{type:'irrigation',priority:'high',action:isHindi?'Knee-high, tasseling, grain fill — 3 जरूरी सिंचाई':'3 critical irrigations: Knee-high, Tasseling, and Grain filling stages'}]}},
    Cotton:{vegetative:{medium:[{type:'nutrition',priority:'high',action:isHindi?'N:P:K = 150:60:60 kg/एकड़ — कपास की उच्च मांग':'N:P:K 150:60:60 kg/acre — cotton high nutrient demand',product:'Urea + DAP + MOP'},{type:'protection',priority:'high',action:isHindi?'Bollworm फेरोमोन जाल 5/एकड़ लगाएं':'Install Bollworm pheromone traps 5/acre for early warning and trapping',product:'Helilure Pheromone Trap',dosage:'5 traps/acre'},{type:'monitoring',priority:'medium',action:isHindi?'Sucking Pest — पत्तियों के नीचे सफेद, हरी उड़न बीमारी चेक करें':'Check for sucking pests (jassids, whitefly) on leaf undersides weekly'}]}},
    Soybean:{vegetative:{medium:[{type:'nutrition',priority:'high',action:isHindi?'Rhizobium टीका — जैविक नाइट्रोजन स्थिरीकरण':'Rhizobium inoculation at sowing — fixes 50-100 kg N/acre naturally',product:'Rhizobium + PSB Culture',dosage:'500g/acre'},{type:'protection',priority:'medium',action:isHindi?'सफेद मक्खी से Yellow Mosaic Virus — Imidacloprid बीज उपचार':'Whitefly spreads Yellow Mosaic Virus — seed treatment with Imidacloprid',product:'Imidacloprid 70% WS',dosage:'5g/kg seed'}]}},
    Sugarcane:{vegetative:{medium:[{type:'nutrition',priority:'high',action:isHindi?'N:P:K = 250:60:60 kg/एकड़ — गन्ने की बहुत ज्यादा मांग':'N:P:K 250:60:60 kg/acre — sugarcane has very high nutrient demand',product:'Urea + DAP + MOP',dosage:'Split over 6 months'},{type:'irrigation',priority:'high',action:isHindi?'ड्रिप सिंचाई — 30% पानी बचाएं, 15% ज्यादा उपज':'Drip irrigation saves 30% water and increases yield by 15%'},{type:'protection',priority:'medium',action:isHindi?'Internode Borer — Trichogramma 50,000/एकड़ छोड़ें':'Release Trichogramma parasites 50,000/acre for biological control of borer'}]}},
  };

  const fetchGuide = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/v1/ai/growth-care?crop=${encodeURIComponent(crop)}&stage=${stage}&weather_risk=${risk}&language=${encodeURIComponent(language)}`
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      if (json.recommendations && json.recommendations.length > 0) {
        setData(json);
        setLoading(false);
        return;
      }
      throw new Error('No recommendations');
    } catch {
      const cropData = CROP_FALLBACK[crop];
      const stageData = cropData?.[stage] || cropData?.['vegetative'];
      const riskData  = stageData?.[risk] || stageData?.['medium'] || stageData?.['low'] || Object.values(stageData || {})[0];

      if (riskData) {
        setData({ crop, stage, recommendations: riskData as Recommendation[] });
      } else {
        setData({
          crop, stage,
          recommendations: [
            {type:'nutrition', priority:'high', action: isHindi?`${crop} की ${stage} अवस्था में N:P:K संतुलित खाद दें`:`Apply balanced N:P:K fertilizer for ${crop} at ${stage} stage`, product:'As per soil test report'},
            {type:'irrigation', priority:'medium', action: isHindi?'मिट्टी की नमी जांचकर सिंचाई करें':'Irrigate based on soil moisture — avoid stress at critical stages'},
            {type:'protection', priority:'low', action: isHindi?'साप्ताहिक खेत निरीक्षण करें — रोग/कीट जल्दी पकड़ें':'Weekly field scouting — early detection saves crop losses', timing: isHindi?'हर सोमवार-शुक्रवार':'Every Mon & Thu'},
          ],
        });
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop, stage, risk, language]);

  useEffect(() => { fetchGuide(); }, [fetchGuide]);

  return (
    <div className="min-h-screen pb-6 sm:pb-8 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative overflow-hidden">

      {/* Soft Ambient Background Orbs */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 px-4 py-3.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="h-10 w-10 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 hover:scale-105 active:scale-95 transition-all shadow-sm">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-emerald-500 animate-pulse" />
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                  {isPunjabi ? 'AI ਫਸਲ ਸਹਾਇਕ' : isHindi ? 'AI फसल सहायक' : 'AI Crop Assistant'}
                </p>
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {isPunjabi ? 'ਫਸਲ ਗਾਈਡ' : isHindi ? 'फसल गाइड' : 'Crop Guide'}
              </h1>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={fetchGuide}
            className="h-10 w-10 rounded-2xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 shadow-sm hover:scale-105 transition-all"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </motion.button>
        </div>
      </header>

      <div className="px-4 py-5 max-w-xl mx-auto space-y-4">

        {/* ── CROP SELECTOR ── */}
        <div className="rounded-[2rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800/70 p-5 shadow-sm space-y-3 relative overflow-hidden">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isHindi ? 'फसल चुनें' : 'Select Crop'}
          </p>
          <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
            {CROPS.map(c => {
              const isSelected = crop === c;
              const tint = CROP_TINTS[c] || CROP_TINTS.Wheat;
              return (
                <motion.button
                  key={c}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCrop(c)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all border backdrop-blur-2xl relative overflow-hidden ${
                    isSelected
                      ? `bg-gradient-to-br ${tint.lightBg} border-2 ${tint.border} ring-2 ring-emerald-500/30 text-emerald-800 dark:text-emerald-300 shadow-md shadow-emerald-500/10`
                      : 'bg-slate-100/70 dark:bg-slate-800/70 border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="text-xl">{CROP_ICONS[c] || '🌱'}</span>
                  <span>{isHindi ? localCropName(c) : c}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── STAGE + RISK ── */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Stage */}
          <div className="rounded-[2rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800/70 p-4 space-y-2.5 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {isHindi ? 'विकास की अवस्था' : 'Growth Stage'}
            </p>
            <div className="space-y-1.5">
              {STAGES.map(s => {
                const isSelected = stage === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStage(s.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/5 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <span>{isHindi ? s.labelHi : s.label}</span>
                    {isSelected && <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weather risk */}
          <div className="rounded-[2rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/70 dark:border-slate-800/70 p-4 space-y-2.5 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {isHindi ? 'मौसम जोखिम' : 'Weather Risk'}
            </p>
            <div className="space-y-1.5">
              {RISKS.map(r => {
                const isSelected = risk === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRisk(r.id)}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      isSelected
                        ? `bg-gradient-to-r ${r.lightBg} ${r.border} text-slate-900 dark:text-white shadow-sm`
                        : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isSelected ? 'animate-pulse' : ''}`} style={{ background: r.color }} />
                    <span className="flex-1 text-left">{isHindi ? r.labelHi : r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── APPLY BUTTON ── */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={fetchGuide}
          className="w-full py-4 rounded-[1.8rem] font-black text-white flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/30 hover:scale-[1.01] active:scale-95 transition-all text-base"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> {isHindi ? 'सलाह आ रही है...' : 'Getting advice...'}</>
          ) : (
            <><Sprout size={18} /> {isHindi ? `${CROP_ICONS[crop] || '🌱'} ${localCropName(crop)} की सलाह पाएं` : `Get ${CROP_ICONS[crop] || '🌱'} ${crop} Advice`}</>
          )}
        </motion.button>

        {/* ── RESULTS ── */}
        <AnimatePresence>
          {!loading && data && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3.5"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-1 pt-1">
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {isHindi ? '📋 आपके खेत के लिए विशेषज्ञ सलाह' : '📋 Field Recommendations'}
                </p>
                <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {data.recommendations?.length || 0} {isHindi ? 'सुझाव' : 'tips'}
                </span>
              </div>

              {/* Recommendation cards */}
              {(data.recommendations || []).map((rec, i) => {
                const norm = normalizeRec(rec);
                const pStyle = PRIORITY_CARD_STYLE[norm.priority] || PRIORITY_CARD_STYLE.low;
                const typeIcons: Record<string,React.ReactNode> = {
                  irrigation: <Droplets size={20} className="text-blue-500" />,
                  nutrition:  <Beaker size={20} className="text-purple-500" />,
                  protection: <AlertTriangle size={20} className="text-amber-500" />,
                  monitoring: <CheckCircle2 size={20} className="text-emerald-500" />,
                  scouting:   <CheckCircle2 size={20} className="text-teal-500" />,
                  canopy:     <Wind size={20} className="text-sky-500" />,
                  harvest:    <Sun size={20} className="text-orange-500" />,
                  nursery:    <CloudRain size={20} className="text-blue-400" />,
                };
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={`rounded-[2rem] p-5 space-y-2.5 backdrop-blur-2xl border bg-gradient-to-br ${pStyle.lightBg} ${pStyle.border} shadow-sm relative overflow-hidden`}
                  >
                    {/* Soft ambient background tint glow */}
                    <div className={`absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-gradient-to-br ${pStyle.lightBg} blur-2xl pointer-events-none`} />

                    <div className="flex items-start gap-3.5 relative z-10">
                      <div className="h-11 w-11 rounded-[1.1rem] bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center shrink-0 shadow-sm">
                        {typeIcons[norm.type] || <Info size={20} className="text-slate-400" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {typeLabel(norm.type)}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white bg-gradient-to-r ${pStyle.badgeBg}`}>
                            {norm.priority}
                          </span>
                        </div>

                        <p className="text-sm font-black text-slate-900 dark:text-white leading-relaxed">{norm.action}</p>

                        {norm.product && (
                          <div className="mt-2.5 p-3 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            🧪 {norm.product} {norm.dosage ? `— ${norm.dosage}` : ''}
                          </div>
                        )}

                        {norm.timing && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1.5 flex items-center gap-1">
                            <span>🕐</span> {isHindi ? 'समय:' : 'Timing:'} {norm.timing}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Scan CTA */}
              <Link
                href="/scanner"
                className="flex items-center justify-between px-5 py-4 rounded-[1.8rem] bg-gradient-to-r from-violet-600 to-purple-600 text-white font-black text-sm shadow-xl shadow-violet-500/25 hover:scale-[1.01] active:scale-95 transition-all mt-4"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={20} />
                  <span>{isHindi ? '🔍 बीमारी के लिए अभी फसल स्कैन करें' : '🔍 Scan Crop for Diseases'}</span>
                </div>
                <ChevronRight size={18} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="rounded-[1.8rem] p-4.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 font-medium">{error}</div>
        )}
      </div>
    </div>
  );
}
