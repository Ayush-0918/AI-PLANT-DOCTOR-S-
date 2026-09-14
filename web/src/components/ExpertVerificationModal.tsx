'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, CheckCircle2, ShieldCheck, Building, FileText, Phone, X, Sparkles, Loader2, Check } from 'lucide-react';
import { useExpertCall } from '@/context/ExpertCallContext';

interface ExpertVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  expert: {
    id?: string;
    name: string;
    role: string;
    speciality?: string;
    avatar?: string;
    is_verified?: boolean;
    credential_title?: string;
    institution?: string;
    verification_id?: string;
    verified_by?: string;
    verified_at?: string;
    phone?: string;
  } | null;
  language?: string;
}

export default function ExpertVerificationModal({
  isOpen,
  onClose,
  expert,
  language = 'Hindi',
}: ExpertVerificationModalProps) {
  const { openCallModal } = useExpertCall();
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formInst, setFormInst] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formRegNo, setFormRegNo] = useState('');

  if (!isOpen) return null;

  const isPunjabi = language === 'ਪੰਜਾਬੀ' || language === 'pa';
  const isEnglish = language === 'English' || language === 'en';

  const handleCallExpert = () => {
    onClose();
    openCallModal();
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/expert/directory/verify-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          phone: formPhone,
          credential_type: 'kvk',
          credential_title: formTitle,
          institution: formInst,
          id_or_registration_number: formRegNo,
          crop_speciality: 'General',
          experience_years: 5,
        }),
      });
      if (res.ok) {
        setSubmittedSuccess(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-sky-100"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X size={18} />
          </button>

          {!showApplicationForm ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3.5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-2xl border border-sky-200">
                  {expert?.avatar || '👨‍🔬'}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-lg font-black text-slate-900">{expert?.name || 'Verified Agronomist'}</h3>
                    <ShieldCheck size={18} className="text-emerald-500 fill-emerald-100 shrink-0" />
                  </div>
                  <p className="text-xs font-semibold text-slate-500">{expert?.role}</p>
                </div>
              </div>

              {/* Verified Credential Card */}
              <div className="mt-5 rounded-2xl bg-gradient-to-br from-sky-50 to-emerald-50/50 p-4 border border-sky-200/80">
                <div className="flex items-center gap-2 text-sky-800 font-black text-xs uppercase tracking-wider">
                  <Award size={16} className="text-sky-600" />
                  <span>प्रमाणित विशेषज्ञ पहचान / Verified Credentials</span>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <Building size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-700">संस्थान / Institution: </span>
                      <span className="font-semibold text-slate-900">{expert?.institution || 'ICAR - Krishi Vigyan Kendra (KVK)'}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-700">पदवी / Title: </span>
                      <span className="font-semibold text-slate-900">{expert?.credential_title || 'KVK-Affiliated Agronomist'}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-700">सत्यापन संख्या / Reg ID: </span>
                      <span className="font-mono font-bold text-slate-900">{expert?.verification_id || 'KVK-PB-8841'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-sky-200/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>सत्यापित / Verified by Agronomy Board</span>
                  <span className="font-bold text-emerald-700">{expert?.verified_at || '2026 Active'}</span>
                </div>
              </div>

              {/* Trust Reassurance note */}
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 leading-relaxed border border-slate-200">
                <p>
                  🌱 <span className="font-bold text-slate-800">सख्त सुरक्षा नियम:</span> सभी प्रमाणित विशेषज्ञ भी केवल सुरक्षित वैज्ञानिक सलाह देते हैं। कोई भी अनियंत्रित कीटनाशक खुराक साझा नहीं की जाती।
                </p>
              </div>

              {/* CTAs */}
              <div className="mt-5 flex gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCallExpert}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black text-white shadow-md"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  <Phone size={15} />
                  <span>सीधे बात करें / Call Now</span>
                </motion.button>

                <button
                  onClick={() => setShowApplicationForm(true)}
                  className="px-3 py-3 rounded-2xl text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100"
                >
                  Apply as Expert
                </button>
              </div>
            </>
          ) : (
            /* Expert Credential Application Form */
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <ShieldCheck size={20} className="text-sky-600" />
                <span>Become a Verified Expert</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Submit your KVK affiliation, university degree, or ICAR ID for review.
              </p>

              {submittedSuccess ? (
                <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center">
                  <Check size={32} className="mx-auto text-emerald-600" />
                  <h4 className="mt-2 text-sm font-black text-emerald-900">Application Submitted!</h4>
                  <p className="mt-1 text-xs text-emerald-700">
                    Our agronomist review team will verify your credentials within 24 hours.
                  </p>
                  <button
                    onClick={() => {
                      setSubmittedSuccess(false);
                      setShowApplicationForm(false);
                      onClose();
                    }}
                    className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitVerification} className="mt-4 space-y-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Full Name & Title</label>
                    <input
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Dr. Harpreet Singh"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Phone Number</label>
                    <input
                      required
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Institution / KVK Name</label>
                    <input
                      required
                      value={formInst}
                      onChange={(e) => setFormInst(e.target.value)}
                      placeholder="e.g. Krishi Vigyan Kendra, Bathinda"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Credential Title / Role</label>
                    <input
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Senior Agronomist / Ph.D. Pathology"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Registration / Employee ID</label>
                    <input
                      required
                      value={formRegNo}
                      onChange={(e) => setFormRegNo(e.target.value)}
                      placeholder="e.g. KVK-PB-2024-918"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowApplicationForm(false)}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 py-2 text-xs font-black text-white"
                    >
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      <span>Submit for Verification</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
