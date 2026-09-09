'use client';

import {
  Bell, Camera, Check, ChevronRight, HelpCircle, Languages, Leaf,
  Lock, Mail, MapPin, Mic, Moon, Pencil, PhoneCall, RotateCcw,
  Shield, ShieldCheck, Smartphone, Sun, Tractor, X, CheckCircle2,
  Sparkles, Layers, Compass, Award, Heart, User, CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useState, useCallback, useEffect } from 'react';
import { useFarmerProfile } from '@/context/FarmerProfileContext';
import { useLanguage } from '@/context/LanguageContext';
import { useAtmosphere } from '@/context/AtmosphericContext';
import { APP_LANGUAGES } from '@/lib/languages';
import { formatSoilTypeLabel } from '@/lib/soil';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const CROP_ICONS: Record<string, string> = {
  Wheat: '🌾', Rice: '🌿', Tomato: '🍅', Potato: '🥔',
  Corn: '🌽', Cotton: '☁️', Soybean: '🫘', Sugarcane: '🎋',
};

const CROP_HINDI_NAMES: Record<string, string> = {
  Wheat: 'गेहूँ', Rice: 'चावल', Tomato: 'टमाटर', Potato: 'आलू',
  Corn: 'मक्का', Cotton: 'कपास', Soybean: 'सोयाबीन', Sugarcane: 'गन्ना',
};

const SOIL_HINDI_NAMES: Record<string, string> = {
  loamy: 'दोमट मिट्टी',
  alluvial: 'जलोढ़ मिट्टी',
  sandy: 'बलुई मिट्टी',
  sandy_loam: 'बलुई दोमट',
  clay: 'चिकनी मिट्टी',
  black_soil: 'काली मिट्टी',
  red: 'लाल मिट्टी',
  laterite: 'लैटेराइट मिट्टी',
};

const cardVariant = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: 'easeOut' as const },
  }),
};

type ActivityHistory = {
  scans: Array<Record<string, unknown>>;
  calls: Array<Record<string, unknown>>;
  feedback: Array<Record<string, unknown>>;
};

// ── SOFT GLASS TOGGLE SWITCH ──────────────────────────────
function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      type="button"
      className={`relative h-7 w-12 rounded-full p-1 transition-all duration-300 ${
        enabled
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/25 border border-emerald-400/40'
          : 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-white/10'
      }`}
    >
      <motion.div
        animate={{ x: enabled ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="h-5 w-5 rounded-full bg-white shadow-sm flex items-center justify-center"
      >
        {enabled && <Check size={10} className="text-emerald-600 font-bold" />}
      </motion.div>
    </button>
  );
}

export default function ProfilePage() {
  const { profile, resetProfile, updateProfile } = useFarmerProfile();
  const { language, setLanguage, t } = useLanguage();
  const { isDark, toggleTheme } = useAtmosphere();

  const isEnglish = language === 'English';

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const [history, setHistory] = useState<ActivityHistory>({ scans: [], calls: [], feedback: [] });
  const [showHelp, setShowHelp] = useState(false);

  // ── Notification preferences ──
  const [scanAlerts, setScanAlerts] = useState(true);
  const [diseaseAlerts, setDiseaseAlerts] = useState(true);
  const [marketAlerts, setMarketAlerts] = useState(false);

  // ── Privacy preferences ──
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [crashReports, setCrashReports] = useState(true);

  // ── Expanded Accordion Panels ──
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showPrivacyPanel, setShowPrivacyPanel] = useState(false);
  const [showPrefsPanel, setShowPrefsPanel] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/users/me/history`)
      .then(res => res.json())
      .then(data => {
        if (data && data.scans) {
          setHistory({ scans: data.scans || [], calls: data.calls || [], feedback: data.feedback || [] });
        }
      })
      .catch(() => {});
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = profile.name
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'KK';

  // Clean farm size number to avoid "3.5 acres acres" duplication
  const rawSize = profile.farmSize || '3.5';
  const numericFarmSize = rawSize.replace(/[^0-9.]/g, '') || '3.5';

  // Clean farmer type text
  const cleanFarmerType = (raw?: string) => {
    if (!raw || raw.toLowerCase().includes('grow crops') || raw.toLowerCase().includes('field crop farmer')) {
      return isEnglish ? 'Field Crop Farmer' : 'मैदानी फ़सल किसान';
    }
    return raw;
  };

  const getSoilTypeLabel = (raw?: string) => {
    const formatted = formatSoilTypeLabel(raw);
    if (isEnglish) return formatted;
    const key = (raw || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return SOIL_HINDI_NAMES[key] || SOIL_HINDI_NAMES['loamy'] || formatted;
  };

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) updateProfile({ avatarUrl: ev.target.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [updateProfile]);

  const saveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) updateProfile({ name: trimmed });
    setEditingName(false);
  };

  const stats = [
    {
      label: t('profile_stats_scans'),
      value: (history.scans?.length || 0).toString(),
      icon: Leaf,
      gradient: 'from-emerald-500/20 via-teal-500/10 to-emerald-500/5',
      border: 'border-emerald-400/35',
      iconColor: 'text-emerald-500 dark:text-emerald-300',
      glow: 'shadow-emerald-500/10',
    },
    {
      label: t('profile_stats_posts'),
      value: (history.calls?.length || 0).toString(),
      icon: Mic,
      gradient: 'from-sky-500/20 via-blue-500/10 to-sky-500/5',
      border: 'border-sky-400/35',
      iconColor: 'text-sky-500 dark:text-sky-300',
      glow: 'shadow-sky-500/10',
    },
    {
      label: t('profile_stats_orders'),
      value: (history.feedback?.length || 0).toString(),
      icon: Tractor,
      gradient: 'from-amber-500/20 via-orange-500/10 to-amber-500/5',
      border: 'border-amber-400/35',
      iconColor: 'text-amber-500 dark:text-amber-300',
      glow: 'shadow-amber-500/10',
    },
  ];

  return (
    <div
      className="min-h-full text-slate-900 dark:text-white pb-52 sm:pb-56 px-4 pt-4 space-y-4 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.12), transparent 60%), radial-gradient(circle at 90% 40%, rgba(253,186,116,0.08), transparent 50%), linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
      }}
    >
      
      {/* Soft Ambient Floating Orbs */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-tr from-emerald-500/12 via-teal-500/8 to-sky-500/12 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-1/2 right-0 w-80 h-80 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent blur-3xl pointer-events-none rounded-full" />

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="user" onChange={handlePhotoChange} className="hidden" />

      {/* ── HERO PROFILE CARD ── */}
      <motion.div
        custom={0}
        variants={cardVariant}
        initial="hidden"
        animate="show"
        className="relative rounded-[2.2rem] p-6 overflow-hidden backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-900/5 dark:shadow-black/40 group"
      >
        {/* Glowing Top Edge Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400" />

        <div className="flex items-start justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <motion.div
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="h-20 w-20 rounded-[1.6rem] flex items-center justify-center text-2xl font-black text-white relative overflow-hidden cursor-pointer shadow-xl shadow-emerald-500/25 border-2 border-white/60 dark:border-white/20 group-hover:scale-105 transition-transform"
                style={{
                  background: profile.avatarUrl
                    ? 'transparent'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                }}
              >
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="Profile Avatar" className="h-full w-full object-cover rounded-[1.5rem]" />
                ) : (
                  <>
                    <span>{initials}</span>
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/15 rounded-t-[1.5rem]" />
                  </>
                )}
              </motion.div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-xl flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/15 shadow-md hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors"
                aria-label="Upload photo"
              >
                <Camera size={13} className="text-emerald-600 dark:text-emerald-400" />
              </motion.button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  {t('prof_heading')}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              <AnimatePresence mode="wait">
                {editingName ? (
                  <motion.div key="editing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 mt-1">
                    <input
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName();
                        if (e.key === 'Escape') setEditingName(false);
                      }}
                      className="text-lg font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border border-emerald-400 rounded-xl px-2.5 py-1 outline-none w-36 shadow-inner"
                    />
                    <button onClick={saveName} className="h-8 w-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-md transition-all">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingName(false)} className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <X size={14} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 mt-0.5">
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                      {profile.name}
                    </h1>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => { setNameInput(profile.name); setEditingName(true); }}
                      className="h-7 w-7 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0 transition-colors"
                      aria-label="Edit name"
                    >
                      <Pencil size={12} className="text-slate-500 dark:text-slate-400" />
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-1.5 mt-1.5">
                <MapPin size={12} className="text-rose-500 shrink-0" />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                  {profile.locationLabel || 'Nalanda, Bihar'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stat Counter Grid */}
        <div className="mt-5 grid grid-cols-3 gap-3 relative z-10">
          {stats.map(({ label, value, icon: Icon, gradient, border, iconColor, glow }) => (
            <motion.div
              key={label}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className={`rounded-[1.4rem] p-3.5 text-center backdrop-blur-xl bg-gradient-to-br ${gradient} border ${border} shadow-md ${glow} transition-all`}
            >
              <div className="h-9 w-9 rounded-xl flex items-center justify-center mx-auto mb-1.5 bg-white/80 dark:bg-white/10 border border-white/30 shadow-sm">
                <Icon size={16} className={iconColor} />
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── FARM IDENTITY ── */}
      <motion.div
        custom={1}
        variants={cardVariant}
        initial="hidden"
        animate="show"
        className="rounded-[2.2rem] p-6 backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-900/5 dark:shadow-black/40 space-y-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.25em]">
            🌾 {t('prof_farm_identity')}
          </p>
          <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 size={10} className="text-emerald-500" />
            {isEnglish ? 'Verified Farm' : 'प्रमाणित फ़ार्म'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <div>
            <p className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-snug">
              {cleanFarmerType(profile.farmerType)}
            </p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {isEnglish ? 'Primary Agricultural Focus' : 'मुख्य कृषि कार्य'}
            </p>
          </div>

          <div className="px-4 py-3 rounded-[1.4rem] bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border border-emerald-400/30 backdrop-blur-xl text-right shrink-0">
            <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              {t('prof_farm_size')}
            </p>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {numericFarmSize} <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{isEnglish ? 'acres' : 'एकड़'}</span>
            </p>
          </div>
        </div>

        <div className="h-px bg-slate-200/60 dark:bg-white/10 my-2" />

        {/* Soil Profile Banner */}
        <div className="rounded-[1.4rem] p-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-400/30 backdrop-blur-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-500 shrink-0">
              <Layers size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                {isEnglish ? 'Soil Classification' : 'मिट्टी का प्रकार'}
              </p>
              <p className="text-base font-black text-amber-950 dark:text-amber-200 mt-0.5">
                {getSoilTypeLabel(profile.soilType)}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-600 dark:text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-400/30">
            {isEnglish ? 'Optimal NPK' : 'उत्कृष्ट NPK मात्रा'}
          </span>
        </div>

        {/* Mode Indicators */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {[
            { icon: Mic, labelKey: 'prof_voice', value: profile.voiceEnabled ? t('prof_enabled') : t('prof_disabled'), active: profile.voiceEnabled },
            { icon: ShieldCheck, labelKey: 'prof_location', value: profile.locationAllowed ? t('prof_allowed') : t('prof_skipped'), active: profile.locationAllowed },
          ].map(({ icon: Icon, labelKey, value, active }) => (
            <div
              key={labelKey}
              className={`rounded-[1.3rem] p-3.5 border transition-all ${
                active
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-400/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100/70 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className={active ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400'} />
                <span className="text-[9px] font-black uppercase tracking-widest">{t(labelKey)}</span>
              </div>
              <p className="text-sm font-black">{value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── CROP PROFILE ── */}
      <motion.div
        custom={2}
        variants={cardVariant}
        initial="hidden"
        animate="show"
        className="rounded-[2.2rem] p-6 backdrop-blur-2xl bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-900/5 dark:shadow-black/40 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.25em] mb-0.5">
              🌱 {t('prof_crop_profile')}
            </p>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{t('prof_selected_crops')}</h2>
          </div>
          <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-white/10 px-2.5 py-1 rounded-full">
            {profile.crops.length} {isEnglish ? 'Active' : 'सक्रिय'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-1">
          {profile.crops.map((crop) => (
            <motion.span
              key={crop}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-400/30 text-emerald-700 dark:text-emerald-300 shadow-sm flex items-center gap-2"
            >
              <span className="text-base">{CROP_ICONS[crop] || '🌱'}</span>
              <span>{isEnglish ? crop : (CROP_HINDI_NAMES[crop] || crop)}</span>
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* ── APP LANGUAGE ── */}
      <motion.div
        custom={3}
        variants={cardVariant}
        initial="hidden"
        animate="show"
        className="rounded-[2.2rem] p-6 backdrop-blur-2xl bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-900/5 dark:shadow-black/40 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-[1.2rem] flex items-center justify-center bg-emerald-500/15 border border-emerald-400/30 text-emerald-500 dark:text-emerald-300 shrink-0">
            <Languages size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.25em]">
              {t('prof_app_language')}
            </p>
            <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{language}</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {APP_LANGUAGES.map((entry) => {
            const isActive = language === entry.name;
            return (
              <motion.button
                key={entry.name}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(10);
                  setLanguage(entry.name);
                }}
                className={`rounded-[1.4rem] p-4 text-left relative overflow-hidden transition-all border ${
                  isActive
                    ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-emerald-400/60 text-slate-900 dark:text-white shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-100/60 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10'
                }`}
              >
                {isActive && (
                  <CheckCircle2 size={16} className="absolute top-3 right-3 text-emerald-500 dark:text-emerald-400" />
                )}
                <p className="text-sm font-black tracking-tight">{entry.label}</p>
                <p className={`text-xs mt-0.5 font-bold ${isActive ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-400'}`}>
                  {entry.subtitle}
                </p>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* ── NOTIFICATIONS ACCORDION ── */}
      <motion.div
        custom={4}
        variants={cardVariant}
        initial="hidden"
        animate="show"
        className="rounded-[2.2rem] overflow-hidden backdrop-blur-2xl bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-900/5 dark:shadow-black/40"
      >
        <button
          onClick={() => setShowNotifPanel(!showNotifPanel)}
          className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors"
        >
          <div className="h-11 w-11 rounded-[1.2rem] flex items-center justify-center shrink-0 bg-purple-500/15 border border-purple-400/30 text-purple-500 dark:text-purple-300">
            <Bell size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-900 dark:text-white text-base">
              {isEnglish ? 'Notifications' : 'सूचनाएं व अलर्ट'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {isEnglish ? 'Daily alerts, scan results & mandi prices' : 'दैनिक अलर्ट, स्कैन रिपोर्ट और मंडी भाव'}
            </p>
          </div>
          <ChevronRight size={18} className={`text-slate-400 shrink-0 transition-transform duration-300 ${showNotifPanel ? 'rotate-90' : ''}`} />
        </button>

        <AnimatePresence>
          {showNotifPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-slate-200/60 dark:border-white/10"
            >
              <div className="px-6 py-5 space-y-4 bg-slate-100/40 dark:bg-white/5">
                {[
                  {
                    label: isEnglish ? 'Scan Alerts' : 'स्कैन अलर्ट',
                    sub: isEnglish ? 'Get notified immediately after every AI scan result' : 'हर AI स्कैन परिणाम के बाद तुरंत सूचना पाएं',
                    val: scanAlerts,
                    set: setScanAlerts
                  },
                  {
                    label: isEnglish ? 'Disease Warnings' : 'बीमारी चेतावनी',
                    sub: isEnglish ? 'Receive community disease outbreak alerts nearby' : 'आस-पास बीमारी फैलने की सामुदायिक चेतावनी प्राप्त करें',
                    val: diseaseAlerts,
                    set: setDiseaseAlerts
                  },
                  {
                    label: isEnglish ? 'Mandi Price Alerts' : 'मंडी भाव अलर्ट',
                    sub: isEnglish ? 'Daily crop price trends from nearest markets' : 'निकटतम मंडियों से दैनिक फसल मूल्य रुझान',
                    val: marketAlerts,
                    set: setMarketAlerts
                  },
                ].map(({ label, sub, val, set }) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{sub}</p>
                    </div>
                    <Toggle enabled={val} onToggle={() => { set(!val); if (navigator.vibrate) navigator.vibrate(8); }} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── PRIVACY & SECURITY ACCORDION ── */}
      <motion.div
        custom={5}
        variants={cardVariant}
        initial="hidden"
        animate="show"
        className="rounded-[2.2rem] overflow-hidden backdrop-blur-2xl bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-900/5 dark:shadow-black/40"
      >
        <button
          onClick={() => setShowPrivacyPanel(!showPrivacyPanel)}
          className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors"
        >
          <div className="h-11 w-11 rounded-[1.2rem] flex items-center justify-center shrink-0 bg-emerald-500/15 border border-emerald-400/30 text-emerald-500 dark:text-emerald-300">
            <Shield size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-900 dark:text-white text-base">
              {isEnglish ? 'Privacy & Security' : 'गोपनीयता और सुरक्षा'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {isEnglish ? 'Data stays on your device' : 'डेटा केवल आपके डिवाइस पर सुरक्षित रहता है'}
            </p>
          </div>
          <ChevronRight size={18} className={`text-slate-400 shrink-0 transition-transform duration-300 ${showPrivacyPanel ? 'rotate-90' : ''}`} />
        </button>

        <AnimatePresence>
          {showPrivacyPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-slate-200/60 dark:border-white/10"
            >
              <div className="px-6 py-5 space-y-4 bg-slate-100/40 dark:bg-white/5">
                <div className="rounded-[1.4rem] bg-emerald-500/10 border border-emerald-400/30 p-4 flex items-start gap-3">
                  <Lock size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 leading-relaxed">
                    {isEnglish ? (
                      <>All scan data, farm profile info and photos are stored <strong>only on your device</strong>. We never share personal data without consent.</>
                    ) : (
                      <>सभी स्कैन डेटा, फार्म प्रोफ़ाइल जानकारी और फोटो <strong>केवल आपके डिवाइस पर सुरक्षित</strong> रहते हैं। हम आपकी अनुमति के बिना कोई व्यक्तिगत डेटा साझा नहीं करते।</>
                    )}
                  </p>
                </div>
                {[
                  {
                    label: isEnglish ? 'Anonymous Analytics' : 'अनाम एनालिटिक्स',
                    sub: isEnglish ? 'Help improve AI diagnostic accuracy without personal data' : 'व्यक्तिगत डेटा के बिना AI निदान की सटीकता में सुधार करने में मदद करें',
                    val: analyticsEnabled,
                    set: setAnalyticsEnabled
                  },
                  {
                    label: isEnglish ? 'Crash Reports' : 'क्रैश रिपोर्ट',
                    sub: isEnglish ? 'Send crash logs automatically to fix bugs faster' : 'समस्याओं को तेज़ी से ठीक करने के लिए स्वचालित रूप से क्रैश रिपोर्ट भेजें',
                    val: crashReports,
                    set: setCrashReports
                  },
                ].map(({ label, sub, val, set }) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{sub}</p>
                    </div>
                    <Toggle enabled={val} onToggle={() => { set(!val); if (navigator.vibrate) navigator.vibrate(8); }} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── APP PREFERENCES ACCORDION ── */}
      <motion.div
        custom={6}
        variants={cardVariant}
        initial="hidden"
        animate="show"
        className="rounded-[2.2rem] overflow-hidden backdrop-blur-2xl bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-900/5 dark:shadow-black/40"
      >
        <button
          onClick={() => setShowPrefsPanel(!showPrefsPanel)}
          className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors"
        >
          <div className="h-11 w-11 rounded-[1.2rem] flex items-center justify-center shrink-0 bg-sky-500/15 border border-sky-400/30 text-sky-500 dark:text-sky-300">
            <Smartphone size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-900 dark:text-white text-base">
              {isEnglish ? 'App Preferences' : 'ऐप प्राथमिकताएं'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {isEnglish ? 'Voice assistant, dark mode & GPS alerts' : 'वॉयस असिस्टेंट, डार्क मोड और GPS अलर्ट'}
            </p>
          </div>
          <ChevronRight size={18} className={`text-slate-400 shrink-0 transition-transform duration-300 ${showPrefsPanel ? 'rotate-90' : ''}`} />
        </button>

        <AnimatePresence>
          {showPrefsPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-slate-200/60 dark:border-white/10"
            >
              <div className="px-6 py-5 space-y-4 bg-slate-100/40 dark:bg-white/5">
                {/* Voice */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-sky-500/15 text-sky-500 dark:text-sky-300">
                      <Mic size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {isEnglish ? 'Voice Assistant' : 'वॉयस असिस्टेंट'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {isEnglish ? 'Hands-free AI voice interaction' : 'हैंड्स-फ्री AI वॉयस बातचीत'}
                      </p>
                    </div>
                  </div>
                  <Toggle
                    enabled={profile.voiceEnabled}
                    onToggle={() => { updateProfile({ voiceEnabled: !profile.voiceEnabled }); if (navigator.vibrate) navigator.vibrate(8); }}
                  />
                </div>

                {/* Theme */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-amber-500/15 text-amber-500 dark:text-amber-300">
                      {isDark ? <Moon size={16} /> : <Sun size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {isEnglish ? 'Dark Mode' : 'डार्क मोड'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {isDark
                          ? (isEnglish ? 'Dark theme active' : 'डार्क थीम चालू')
                          : (isEnglish ? 'Light theme active' : 'लाइट थीम चालू')}
                      </p>
                    </div>
                  </div>
                  <Toggle enabled={isDark} onToggle={() => { toggleTheme(); if (navigator.vibrate) navigator.vibrate(8); }} />
                </div>

                {/* Location */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-rose-500/15 text-rose-500 dark:text-rose-300">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {isEnglish ? 'Location Access' : 'लोकेशन एक्सेस'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {isEnglish ? 'Required for hyper-local weather & disease alerts' : 'सटीक स्थानीय मौसम और बीमारी अलर्ट के लिए आवश्यक'}
                      </p>
                    </div>
                  </div>
                  <Toggle
                    enabled={profile.locationAllowed}
                    onToggle={() => { updateProfile({ locationAllowed: !profile.locationAllowed }); if (navigator.vibrate) navigator.vibrate(8); }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── HELP & SUPPORT ── */}
      <motion.div
        custom={7}
        variants={cardVariant}
        initial="hidden"
        animate="show"
        className="rounded-[2.2rem] overflow-hidden backdrop-blur-2xl bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-900/5 dark:shadow-black/40"
      >
        <button
          onClick={() => setShowHelp(true)}
          className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors"
        >
          <div className="h-11 w-11 rounded-[1.2rem] flex items-center justify-center shrink-0 bg-blue-500/15 border border-blue-400/30 text-blue-500 dark:text-blue-300">
            <HelpCircle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-900 dark:text-white text-base">
              {isEnglish ? 'Help & Support' : 'सहायता व संपर्क'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {isEnglish ? 'Call or email 24/7 expert agricultural hotline' : '24/7 कृषि विशेषज्ञ हेल्पलाइन से कॉल या ईमेल द्वारा जुड़ें'}
            </p>
          </div>
          <ChevronRight size={18} className="text-slate-400 shrink-0" />
        </button>
      </motion.div>

      {/* ── RESET ONBOARDING BUTTON ── */}
      <motion.button
        custom={8}
        variants={cardVariant}
        initial="hidden"
        animate="show"
        onClick={() => { resetProfile(); updateProfile({ onboardingCompleted: false }); }}
        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-[2.2rem] font-black text-xs uppercase tracking-widest transition-all bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-md active:scale-98"
        whileTap={{ scale: 0.98 }}
      >
        <RotateCcw size={16} />
        {t('prof_restart')}
      </motion.button>

      <p className="text-center text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500 pt-2">
        {isEnglish ? 'Plant Doctor Intelligence Suite · v1.0' : 'प्लांट डॉक्टर इंटेलिजेंस सूट · v1.0'}
      </p>

      {/* ── HELP MODAL ── */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHelp(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm rounded-[2.5rem] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-white/15 p-7 shadow-2xl backdrop-blur-2xl text-slate-900 dark:text-white"
            >
              <div className="absolute right-5 top-5">
                <button
                  onClick={() => setShowHelp(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-blue-500/15 border border-blue-400/30 text-blue-500 dark:text-blue-300">
                <HelpCircle size={28} />
              </div>

              <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {isEnglish ? 'Need Help?' : 'सहायता चाहिए?'}
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                {isEnglish
                  ? 'Our agricultural experts are available 24/7 for any issue. Call or email us anytime.'
                  : 'किसी भी समस्या के लिए हमारी कृषि विशेषज्ञ टीम 24/7 उपलब्ध है। तुरंत कॉल या ईमेल करें।'}
              </p>

              <div className="mt-6 space-y-3">
                <a
                  href="tel:8228858145"
                  className="flex items-center gap-4 rounded-[1.4rem] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 transition-all hover:border-emerald-400/60 hover:bg-emerald-500/10"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-500 dark:text-emerald-300">
                    <PhoneCall size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {isEnglish ? 'Call Us (24/7)' : 'हमें कॉल करें (24/7)'}
                    </p>
                    <p className="font-black text-slate-900 dark:text-white text-lg">8228858145</p>
                  </div>
                </a>

                <a
                  href="mailto:ayushpandey10851@gmail.com"
                  className="flex items-center gap-4 rounded-[1.4rem] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 transition-all hover:border-blue-400/60 hover:bg-blue-500/10"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-500 dark:text-blue-300">
                    <Mail size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {isEnglish ? 'Email Us' : 'हमें ईमेल करें'}
                    </p>
                    <p className="truncate font-black text-slate-900 dark:text-white text-xs">ayushpandey10851@gmail.com</p>
                  </div>
                </a>
              </div>

              <button
                onClick={() => setShowHelp(false)}
                className="mt-6 w-full rounded-[1.4rem] bg-gradient-to-r from-emerald-500 to-teal-500 py-4 font-black text-xs uppercase tracking-widest text-white shadow-lg shadow-emerald-500/25 active:scale-95 transition-transform"
              >
                {isEnglish ? 'Close' : 'बंद करें'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

