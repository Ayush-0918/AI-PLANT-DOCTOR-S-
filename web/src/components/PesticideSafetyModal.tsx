'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Sparkles, Check, ArrowRight, X, Eye, FileText } from 'lucide-react';

interface PesticideSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: string;
  onApplyRevision?: (revisedText: string) => void;
  currentContent?: string;
  violationDetails?: {
    message_hi?: string;
    message_pa?: string;
    message_en?: string;
    safe_alternative?: string;
    detected_chemical?: string;
    detected_dosage?: string;
  } | null;
}

export default function PesticideSafetyModal({
  isOpen,
  onClose,
  language = 'Hindi',
  onApplyRevision,
  currentContent = '',
  violationDetails,
}: PesticideSafetyModalProps) {
  const [confirmedPreview, setConfirmedPreview] = useState(false);

  const isPunjabi = language === 'ਪੰਜਾਬੀ' || language === 'pa';
  const isEnglish = language === 'English' || language === 'en';

  const heading = isPunjabi
    ? 'ਕੀਟਨਾਸ਼ਕ ਸੁਰੱਖਿਆ ਨਿਯਮ'
    : isEnglish
    ? 'Pesticide Safety Pre-Publish Filter'
    : 'कीटनाशक सुरक्षा नियम';

  const explanation = isPunjabi
    ? (violationDetails?.message_pa || 'ਕਿਸੇ ਰਸਾਇਣਕ ਕੀਟਨਾਸ਼ਕ ਦੀ ਸਟੀਕ ਖੁਰਾਕ ਸਾਂਝੀ ਕਰਨਾ ਸੁਰੱਖਿਅਤ ਨਹੀਂ ਹੈ, ਕਿਰਪਾ ਕਰਕੇ ਆਮ ਸਲਾਹ ਦਿਓ ਜਾਂ ਕੇਵੀਕੇ (KVK) ਤੋਂ ਪੁਸ਼ਟੀ ਕਰਵਾਉਣ ਲਈ ਕਹੋ।')
    : isEnglish
    ? (violationDetails?.message_en || 'Sharing exact synthetic chemical dosages is not safe. Please share general advice or ask to confirm with KVK.')
    : (violationDetails?.message_hi || 'सटीक दवा की खुराक साझा करना सुरक्षित नहीं है, कृपया सामान्य सलाह दें या KVK से पुष्टि करने को कहें।');

  const reasonDetail = isPunjabi
    ? 'ਕਿਸਾਨ ਵੀਰੋ, ਹਰ ਖੇਤ ਦੀ ਮਿੱਟੀ ਅਤੇ ਫ਼ਸਲ ਦੀ ਸਥਿਤੀ ਵੱਖ ਹੁੰਦੀ ਹੈ। ਗ਼ਲਤ ਰਸਾਇਣਕ ਖੁਰਾਕ ਨਾਲ ਫ਼ਸਲ ਸੜ ਸਕਦੀ ਹੈ। ਇਸ ਲਈ ਕੇਵਲ ਆਮ ਨਿਰੀਖਣ ਜਾਂ ਜੈਵਿਕ ਤਰੀਕੇ ਸਾਂਝੇ ਕਰੋ।'
    : isEnglish
    ? 'Dear Farmer, soil conditions and crop tolerance vary across fields. Recommending specific chemical dosages peer-to-peer can harm crops or lead to pesticide resistance.'
    : 'किसान साथियों, हर खेत की मिट्टी और फसल की अवस्था अलग होती है। साथी किसान को सटीक केमिकल दवा की मात्रा बताना नुकसानदेह हो सकता है। कृपया जैविक तरीके बताएं या KVK से पूछने की सलाह दें।';

  // Compute proposed safe revision
  const proposedRevision = useMemo(() => {
    const chemicalRegex = /\b(carbaryl|chlorpyrifos|imidacloprid|monocrotophos|cypermethrin|malathion|mancozeb|carbendazim|lambda-cyhalothrin|thiamethoxam|acetamiprid|dimethoate|triazophos|phorate|endosulfan|propiconazole|hexaconazole|glyphosate|paraquat|क्लोरोपायरीफॉस|इमिडाक्लोप्रिड|मोनोक्रोटोफॉस|साइपरमेथ्रिन|मैन्कोजेब|कार्बेंडाजिम|ਕਲੋਰਪਾਇਰੀਫਾਸ)\b/gi;
    const dosageRegex = /(\d+(\.\d+)?\s*(g|gm|gms|ml|kg|l|L|mg)\b|\d+(\.\d+)?\s*g\s*L⁻¹|g\/L|ml\/L|\d+\s*(चम्मच|लीटर|मिली|ग्राम|ਮਿਲੀ|ਗ੍ਰਾਮ))/gi;

    let revised = currentContent;
    const safePhrase = isPunjabi
      ? ' (ਸੁਰੱਖਿਅਤ ਸਲਾਹ: ਸਟੀਕ ਖੁਰਾਕ ਲਈ ਆਪਣੇ ਨੇੜਲੇ ਕ੍ਰਿਸ਼ੀ ਵਿਗਿਆਨ ਕੇਂਦਰ (KVK) ਦੇ ਖੇਤੀ ਮਾਹਿਰ ਨਾਲ ਸੰਪਰਕ ਕਰੋ ਜਾਂ ਨਿੰਮ ਦੇ ਤੇਲ ਦਾ ਛਿੜਕਾਅ ਕਰੋ)'
      : isEnglish
      ? ' (Safe advice: Consult local KVK agricultural officer for exact dosage, or use organic neem oil solution)'
      : ' (सुरक्षित सलाह: सटीक रासायनिक खुराक के लिए नजदीकी कृषि विज्ञान केंद्र (KVK) से सलाह लें या नीम तेल का छिड़काव करें)';

    if (dosageRegex.test(revised)) {
      revised = revised.replace(dosageRegex, '').trim();
    }
    return revised + safePhrase;
  }, [currentContent, isPunjabi, isEnglish]);

  if (!isOpen) return null;

  const handleConfirmAndApply = () => {
    if (onApplyRevision) {
      onApplyRevision(proposedRevision);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 15 }}
          className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl border border-amber-200 max-h-[90vh] overflow-y-auto"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X size={18} />
          </button>

          {/* Header icon */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 border border-amber-300 text-amber-700">
              <ShieldAlert size={26} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">{heading}</h3>
              <p className="text-xs font-semibold text-amber-700">Pre-Publish Peer-to-Peer Safety Guardrail</p>
            </div>
          </div>

          {/* Core Explanation Box */}
          <div className="mt-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 p-4">
            <p className="text-sm font-bold text-amber-900 leading-snug">
              {explanation}
            </p>
            <p className="mt-2 text-xs font-medium text-amber-800/80 leading-relaxed">
              {reasonDetail}
            </p>
          </div>

          {/* Side-by-Side Before vs After Diff Preview */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Eye size={15} className="text-emerald-600" />
              <span>
                {isPunjabi ? 'ਤਬਦੀਲੀ ਦੀ ਝਲਕ (Before vs After Preview)' : isEnglish ? 'Review Proposed Safe Revision (Before vs. After)' : 'बदलाव की समीक्षा (Before vs After Diff)'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* BEFORE (UNSAFE) */}
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold uppercase tracking-wider text-[10px] text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                      {isPunjabi ? 'ਮੂਲ ਸੰਦੇਸ਼ (ਅਸੁਰੱਖਿਅਤ)' : isEnglish ? 'Before (Unsafe)' : 'मूल संदेश (असुरक्षित)'}
                    </span>
                    <AlertTriangle size={14} className="text-rose-600" />
                  </div>
                  <p className="text-slate-800 font-medium leading-relaxed break-words bg-white/70 p-2.5 rounded-xl border border-rose-100 italic">
                    "{currentContent || 'Voice Note Audio Content'}"
                  </p>
                </div>
                <p className="mt-2 text-[10px] font-semibold text-rose-600">
                  ⚠️ {isPunjabi ? 'ਕੈਮੀਕਲ ਜਾਂ ਖੁਰਾਕ ਦਰਜ ਹੈ' : isEnglish ? 'Contains direct chemical dosage' : 'सटीक दवा/मात्रा का उल्लेख है'}
                </p>
              </div>

              {/* AFTER (SAFE REVISION) */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold uppercase tracking-wider text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {isPunjabi ? 'ਸੁਰੱਖਿਅਤ ਸੋਧ (Safe Version)' : isEnglish ? 'After (Safe Revision)' : 'सुरक्षित रूप (Safe Version)'}
                    </span>
                    <Check size={14} className="text-emerald-700" />
                  </div>
                  <p className="text-slate-900 font-medium leading-relaxed break-words bg-white/70 p-2.5 rounded-xl border border-emerald-100">
                    "{proposedRevision}"
                  </p>
                </div>
                <p className="mt-2 text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                  <Sparkles size={12} /> {isPunjabi ? 'ਕੇਵੀਕੇ ਮਾਹਿਰ ਜਾਂ ਜੈਵਿਕ ਸਲਾਹ ਨਾਲ ਸੁਰੱਖਿਅਤ' : isEnglish ? 'KVK referral & organic safety attached' : 'KVK सलाह और जैविक विकल्प सुरक्षित'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex flex-col sm:flex-row items-center gap-2.5">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleConfirmAndApply}
              className="w-full flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-xs font-black text-white shadow-md hover:brightness-105"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              <Check size={16} />
              <span>
                {isPunjabi
                  ? 'ਸੁਰੱਖਿਅਤ ਸੋਧ ਮਨਜ਼ੂਰ ਕਰੋ (Confirm & Post Safe)'
                  : isEnglish
                  ? 'Approve & Apply Safe Revision'
                  : 'सुरक्षित बदलाव स्वीकारें (Confirm & Apply)'}
              </span>
            </motion.button>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-3 rounded-2xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
            >
              {isPunjabi ? 'ਖ਼ੁਦ ਬਦਲੋ (Edit Myself)' : isEnglish ? 'Edit Manually' : 'खुद बदलें (Manual Edit)'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
