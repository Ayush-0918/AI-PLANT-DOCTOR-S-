import { motion } from 'framer-motion';
import { TrendingUp, Share2, Info, ArrowUpRight, Wallet, DollarSign, Sprout } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useFarmerProfile } from '@/context/FarmerProfileContext';
import { useLanguage } from '@/context/LanguageContext';

interface PredictionData {
  crop: string;
  harvest_date: string;
  days_until_harvest: number;
  maturity_progress_pct: number;
  estimated_yield_kg: number;
  projected_revenue_inr: number;
  mandi_price_ref_kg: number;
  confidence_score: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function WealthPredictor() {
  const { profile } = useFarmerProfile();
  const { t, language } = useLanguage();
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPrediction = async () => {
    try {
      const crop = profile.crops[0] || 'Wheat';
      const plantingDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const area = parseFloat(profile.farmSize) || 1.0;

      const res = await fetch(`${API_BASE}/api/v1/intelligence/yield-prediction?crop=${crop}&planting_date=${plantingDate}&area_acres=${area}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setData(json.prediction);
      }
    } catch (e) {
      console.error('Wealth Prediction error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction();
  }, [profile.crops, profile.farmSize]);

  const [fertAdjust, setFertAdjust] = useState(100);

  // Derived calculations for the "Premium breakdown"
  const stats = useMemo(() => {
    if (!data) return null;

    const factor = 1 + (fertAdjust - 100) / 100 * 0.25;
    const income = Math.round(data.projected_revenue_inr * factor);
    const area = parseFloat(profile.farmSize) || 1.0;

    const baseInvestmentPerAcre = 25000;
    const fertilizerBasePerAcre = 5000;

    const investment = Math.round((baseInvestmentPerAcre + (fertAdjust / 100 * fertilizerBasePerAcre)) * area);
    const fertilizerCost = Math.round((fertAdjust / 100 * fertilizerBasePerAcre) * area);
    const profit = income - investment;
    const roi = (profit / investment) * 100;
    const yieldKg = Math.round(data.estimated_yield_kg * factor);

    return {
      income,
      investment,
      fertilizerCost,
      profit,
      roi,
      yieldKg,
    };
  }, [data, fertAdjust, profile.farmSize]);

  if (loading)
    return (
      <div className="h-80 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2.5rem] border border-emerald-200/60 dark:border-slate-800 shadow-sm overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-50/50 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
        <div className="w-12 h-12 bg-emerald-100/60 rounded-2xl mb-4 animate-pulse" />
        <div className="w-32 h-3 bg-slate-200/60 rounded-full mb-2" />
        <div className="w-48 h-2 bg-slate-100/60 rounded-full" />
      </div>
    );

  if (!data || !stats)
    return (
      <div className="h-80 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2.5rem] border border-emerald-200/60 dark:border-slate-800 shadow-sm p-8 text-center">
        <span className="text-2xl mb-2">📉</span>
        <h4 className="text-sm font-black text-slate-800 dark:text-white">No Revenue Data</h4>
        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Check profile settings</p>
      </div>
    );

  const isHindi = language === 'हिंदी';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-emerald-200/60 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.06)]"
    >
      {/* Ambient background Orbs */}
      <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl" />

      {/* Header */}
      <div className="relative z-10 flex justify-between items-start mb-6">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
            <Sprout size={12} className="text-emerald-500" />
            {t('intel_roi_profitability')}
          </h3>
          <div className="flex items-center gap-2.5 mt-0.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              +{stats.roi.toFixed(2)}%
            </span>
            <div className="flex h-6 items-center gap-1 rounded-full bg-emerald-100/80 dark:bg-emerald-950/80 px-2.5 py-0.5 border border-emerald-300/80 dark:border-emerald-800/80 text-[10px] font-black text-emerald-700 dark:text-emerald-300 shadow-sm">
              <TrendingUp size={12} />
              <span>ESTIMATED</span>
            </div>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border border-emerald-200/60 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-emerald-50 transition-colors"
        >
          <Share2 size={17} />
        </motion.button>
      </div>

      {/* Main Breakdown Grid */}
      <div className="relative z-10 space-y-3.5 mb-6">
        {/* Investment Card */}
        <div className="rounded-2xl bg-gradient-to-br from-sky-50/70 via-slate-50/60 to-white dark:from-slate-800/60 dark:to-slate-900/50 p-4 border border-sky-200/60 dark:border-slate-700/60 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Wallet size={12} className="text-sky-500" />
              {t('intel_investment')}
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white">
              ₹{stats.investment.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
            {isHindi ? 'खाद' : 'Fertilizer'}: ₹{stats.fertilizerCost.toLocaleString('en-IN')}
          </p>
        </div>

        {/* Expected Income Card */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50/80 via-teal-50/60 to-white dark:from-emerald-950/40 dark:to-slate-900/50 p-4 border border-emerald-200/70 dark:border-emerald-800/60 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-emerald-500" />
              {t('intel_expected_income')}
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              ₹{stats.income.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[10.5px] font-bold text-emerald-600/90 dark:text-emerald-400/90">
            {t('intel_yield')}: {stats.yieldKg.toLocaleString('en-IN')} kg
          </p>
        </div>

        {/* Net Profit Card — Replaced heavy dark solid box with Soft Glass Prism Gradient */}
        <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white p-4.5 shadow-lg shadow-emerald-600/20 relative overflow-hidden border border-emerald-500/30">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5" />
          <div className="relative z-10 flex justify-between items-center">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-100/90">
              {t('intel_net_profit')}
            </span>
            <span className="text-2xl font-black text-white tracking-tight">
              ₹{stats.profit.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="relative z-10 mt-2.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md border border-white/25 text-[9.5px] font-bold text-white uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
              {t('intel_mandi_signal')}: {isHindi ? 'स्थिर' : 'STABLE'} (0%)
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="relative z-10 flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-slate-100/80 dark:bg-slate-800 flex items-center justify-center border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400">
            <Info size={14} />
          </div>
          <p className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 max-w-[130px] leading-tight">
            {isHindi ? 'मंडी कीमतों के आधार पर दैनिक अपडेट' : 'Updated daily based on Mandi trends'}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-emerald-500/25 flex items-center gap-2 transition-all"
        >
          {t('intel_share_roi')}
          <ArrowUpRight size={13} />
        </motion.button>
      </div>
    </motion.div>
  );
}
