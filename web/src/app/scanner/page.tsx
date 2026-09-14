'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
   Camera,
   ChevronLeft,
   ClipboardList,
   Image as ImageIcon,
   Loader2,
   RefreshCcw,
   ShieldCheck,
   ShoppingBag,
   Sparkles,
   Droplets,
   ScanLine,
   ChevronRight,
   FileText,
   Phone,
   Leaf,
   Mountain,
   FlaskConical,
   Layers,
   Sprout,
} from 'lucide-react';
import Link from 'next/link';
import {
   useCallback,
   useEffect,
   useRef,
   useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { useFarmerProfile } from '@/context/FarmerProfileContext';
import { useLanguage } from '@/context/LanguageContext';
import { useExpertCall } from '@/context/ExpertCallContext';
import { fetchJson, getBackendBaseUrl } from '@/lib/api';
import dynamic from 'next/dynamic';

const ThreeLeafModel = dynamic(() => import('@/components/ThreeLeafModel'), { ssr: false });

type ScanMode = 'choose' | 'camera' | 'scanning' | 'result';
type PipelineStep = 'Scan' | 'Diagnose' | 'Prevent' | 'Dosage' | 'Precaution';

type Treatment = {
   medicine?: string;
   raw_medicine?: string;
   dosage?: string;
   instructions?: string;
};

type ScanResponse = {
   success?: boolean;
   prediction_id?: string;
   escalation_required?: boolean;
   escalation_reason?: string;
   confidence_threshold?: number;
   context?: {
      language?: string;
      stage?: string;
      severity?: string;
   };
   disease_risk?: {
      risk_level?: string;
   };
   recommendation?: {
      action?: string;
      action_en?: string;
      action_hi?: string;
   };
   diagnosis: {
      name: string;
      class_id?: string;
      confidence?: number;
      treatment?: Treatment;
   };
};

type DosageResponse = {
   dosage_exact?: {
      chemical?: string;
      water_mix?: string;
   };
   instructions?: string;
   warnings?: string;
};

const PIPELINE_STEPS: PipelineStep[] = ['Scan', 'Diagnose', 'Prevent', 'Dosage', 'Precaution'];

const formatDiseaseName = (rawName: string) => {
   if (!rawName) return '';
   return rawName.replace(/___/g, ' — ').replace(/_/g, ' ');
};

const extractCropFromDiagnosis = (rawName: string) => {
   if (!rawName || !rawName.includes('___')) return '';
   return rawName.split('___')[0].replace(/_\(maize\)/g, ' (maize)').replace(/_/g, ' ').trim();
};

const formatSeverityCode = (raw?: string) => {
   const normalized = (raw || '').trim().toLowerCase();
   if (normalized === 'critical' || normalized === 'high') return 'High Severity';
   if (normalized === 'medium') return 'Medium Severity';
   if (normalized === 'low') return 'Early Detection';
   return '';
};

export default function ScannerPage() {
   const { t, language } = useLanguage();
   const { profile } = useFarmerProfile();
   const { openCallModal } = useExpertCall();
   const router = useRouter();

   const [mode, setMode] = useState<ScanMode>('choose');
   const [activeStep, setActiveStep] = useState<PipelineStep>('Scan');
   const [result, setResult] = useState<ScanResponse | null>(null);
   const [dosage, setDosage] = useState<DosageResponse | null>(null);
   const [imagePreview, setImagePreview] = useState<string | null>(null);
   const [cameraError, setCameraError] = useState<string | null>(null);
   const [isCameraReady, setIsCameraReady] = useState(false);
   const [isMixLoading, setIsMixLoading] = useState(false);
   const [showLanguagePdfModal, setShowLanguagePdfModal] = useState(false);
   const [isPdfLoading, setIsPdfLoading] = useState(false);
   const [scanProgress, setScanProgress] = useState(0);
   const [scanError, setScanError] = useState<string | null>(null);

   const videoRef = useRef<HTMLVideoElement>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const streamRef = useRef<MediaStream | null>(null);

   const diagnosis = result?.diagnosis;
   const diagnosisConfidence = Number(diagnosis?.confidence ?? 0);
   const contextualSeverityLabel = formatSeverityCode(result?.context?.severity);
   const severityLabel =
      contextualSeverityLabel || (diagnosisConfidence >= 90 ? 'High Severity' : diagnosisConfidence >= 75 ? 'Medium Severity' : 'Early Detection');
   const severityColor = severityLabel === 'High Severity' ? '#fda4af' : severityLabel === 'Medium Severity' ? '#fdba74' : '#6ee7d8';

   const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
   const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

   const stopCamera = useCallback(() => {
      if (streamRef.current) {
         streamRef.current.getTracks().forEach((track) => track.stop());
         streamRef.current = null;
      }
      setCameraStream(null);
      setIsCameraReady(false);
   }, []);

   const startCamera = useCallback(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
         setCameraError('Camera not available in this browser.');
         return;
      }
      stopCamera();

      let stream: MediaStream | null = null;
      try {
         // Fallback tier 1: requested facing mode with standard HD resolution
         stream = await navigator.mediaDevices.getUserMedia({
            video: {
               facingMode: { ideal: facingMode },
               width: { ideal: 1280 },
               height: { ideal: 720 },
            },
            audio: false,
         });
      } catch {
         try {
            // Fallback tier 2: opposite facing mode
            const altFacing = facingMode === 'environment' ? 'user' : 'environment';
            stream = await navigator.mediaDevices.getUserMedia({
               video: { facingMode: { ideal: altFacing } },
               audio: false,
            });
         } catch {
            try {
               // Fallback tier 3: generic video constraint (laptop webcams, virtual cameras)
               stream = await navigator.mediaDevices.getUserMedia({
                  video: true,
                  audio: false,
               });
            } catch (err) {
               console.error('Camera stream error:', err);
               setCameraError('Camera permission blocked or device unavailable. Scan from gallery instead.');
               return;
            }
         }
      }

      if (stream) {
         streamRef.current = stream;
         setCameraStream(stream);
         setCameraError(null);
      }
   }, [facingMode, stopCamera]);

   useEffect(() => {
      if (mode !== 'camera') {
         stopCamera();
         return undefined;
      }
      startCamera();
      return () => stopCamera();
   }, [mode, facingMode, startCamera, stopCamera]);

   // Reactive binding effect: ensures video element gets srcObject as soon as mounted
   useEffect(() => {
      if (mode === 'camera' && cameraStream && videoRef.current) {
         const video = videoRef.current;
         video.srcObject = cameraStream;
         
         const playPromise = video.play();
         if (playPromise !== undefined) {
            playPromise
               .then(() => setIsCameraReady(true))
               .catch(() => undefined);
         }
      }
   }, [mode, cameraStream]);

   const toggleFacingMode = () => {
      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
   };

   useEffect(() => {
      if (mode === 'scanning') {
         setScanProgress(0);
         const interval = setInterval(() => {
            setScanProgress(p => {
               if (p >= 92) { clearInterval(interval); return p; }
               return p + Math.random() * 8;
            });
         }, 200);
         return () => clearInterval(interval);
      }
   }, [mode]);

   const scanBlob = async (blob: Blob) => {
      setMode('scanning');
      setActiveStep('Diagnose');
      setDosage(null);
      setScanError(null);
      if (navigator.vibrate) navigator.vibrate(40);

      const buildPayload = () => {
         const payload = new FormData();
         payload.append('image', new File([blob], 'plant-scan.jpg', { type: 'image/jpeg' }));
         payload.append('lat', `${profile.latitude ?? 25.0}`);
         payload.append('lon', `${profile.longitude ?? 85.3}`);
         payload.append('language', language || 'English');
         payload.append('stage', 'vegetative');
         return payload;
      };

      try {
         const data = await fetchJson<ScanResponse>(`${getBackendBaseUrl()}/api/v1/ai/scan`, {
            method: 'POST',
            body: buildPayload(),
         });

         if (!data?.diagnosis?.name) {
            throw new Error('Invalid scan response');
         }

         setResult(data);
         setMode('result');
         setActiveStep('Prevent');
         if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      } catch (error) {
         const message = error instanceof Error ? error.message : 'Scan failed. Please retry.';
         setScanError(message);
         setMode('camera');
         setActiveStep('Scan');
      }
   };

   const captureFromCamera = async () => {
      if (!videoRef.current) return;
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const width = video.videoWidth || 1080;
      const height = video.videoHeight || 1350;
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')?.drawImage(video, 0, 0, width, height);
      const previewDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setImagePreview(previewDataUrl);
      canvas.toBlob(async (blob) => { if (blob) await scanBlob(blob); }, 'image/jpeg', 0.92);
   };

   const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      await scanBlob(file);
   };

   const getSmartDosage = async () => {
      if (!diagnosis) return;
      setIsMixLoading(true);
      setActiveStep('Dosage');
      try {
         const data = await fetchJson<DosageResponse>(`${getBackendBaseUrl()}/api/v1/ai/dosage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               crop: profile.crops[0] || 'Unknown',
               area_acres: parseFloat(profile.farmSize) || 2.5,
               disease: diagnosis.name,
               language: language || 'English',
            }),
         });
         setDosage(data);
         setActiveStep('Precaution');
      } catch (error) {
         console.error(error);
      } finally {
         setIsMixLoading(false);
      }
   };

   const downloadPDF = async (selectedLanguage: string) => {
      if (!diagnosis) return;
      setIsPdfLoading(true);
      try {
         const langName = selectedLanguage.split(' ')[0]; 
         const diagnosedCrop = extractCropFromDiagnosis(diagnosis.name);
         const reportSeverity = (result?.context?.severity || '').toLowerCase();
         const data = await fetchJson<{ report_url?: string }>(`${getBackendBaseUrl()}/api/v1/ai/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               language: langName,
               farmer_name: profile.name || 'Farmer',
               location: profile.locationLabel || '',
               crop: diagnosedCrop || profile.crops?.[0] || 'Unknown',
               diagnosis_name: diagnosis.name,
               confidence: diagnosisConfidence,
               recommendation: result?.recommendation?.action || '',
               stage: result?.context?.stage || 'vegetative',
               severity: reportSeverity || (severityLabel === 'High Severity' ? 'high' : severityLabel === 'Medium Severity' ? 'medium' : 'low'),
               weather_risk: result?.disease_risk?.risk_level || 'medium',
               treatment: diagnosis.treatment || {},
            }),
         });
         
         if (data?.report_url) {
            window.open(getBackendBaseUrl() + data.report_url, '_blank');
         } else {
            throw new Error('PDF URL missing');
         }
      } catch (error) {
         console.error('Failed to generate PDF:', error);
         alert('Failed to generate PDF. Please try again.');
      } finally {
         setIsPdfLoading(false);
         setShowLanguagePdfModal(false);
      }
   };

   const resetScanner = () => {
      setMode('choose'); setActiveStep('Scan');
      setResult(null); setDosage(null);
      setImagePreview(null); setCameraError(null); setScanError(null);
   };   return (
      <div
         className="min-h-screen text-slate-900 pb-52 sm:pb-56 relative overflow-hidden"
         style={{
            background: 'linear-gradient(180deg, #f0fdf4 0%, #fff7ed 35%, #f8fafc 100%)',
         }}
      >
         {/* Background Soft Glow Orbs */}
         <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-gradient-to-tr from-emerald-200/40 via-teal-100/30 to-amber-200/30 blur-3xl pointer-events-none rounded-full" />
         <div className="absolute bottom-1/4 right-0 w-[24rem] h-[24rem] bg-gradient-to-br from-emerald-100/40 via-sky-100/30 to-amber-100/40 blur-3xl pointer-events-none rounded-full" />

         {/* ── PIPELINE PROGRESS HEADER ── */}
         <div
            className="px-5 pt-4 pb-4 sticky top-0 z-40"
            style={{
               background: 'rgba(255, 255, 255, 0.82)',
               backdropFilter: 'blur(24px)',
               borderBottom: '1px solid rgba(16, 185, 129, 0.12)',
               boxShadow: '0 4px 20px -2px rgba(16, 185, 129, 0.05)',
            }}
         >
            <div className="flex items-center justify-between mb-3">
               <Link
                  href="/dashboard"
                  className="h-9 w-9 rounded-2xl flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-sm"
                  style={{ background: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(226, 232, 240, 0.9)' }}
               >
                  <ChevronLeft size={18} className="text-slate-700" />
               </Link>

               <div className="flex items-center gap-2">
                  <div
                     className="h-9 w-9 rounded-2xl flex items-center justify-center shadow-sm"
                     style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)' }}
                  >
                     <ScanLine size={17} className="text-emerald-700" />
                  </div>
                  <h1 className="text-base font-black text-slate-900 tracking-tight">{t('scanner_app_title')}</h1>
               </div>

               <Link
                  href="/history"
                  className="h-9 w-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{ background: 'rgba(255, 255, 255, 0.9)', border: '1px solid rgba(226, 232, 240, 0.9)' }}
               >
                  <ClipboardList size={16} className="text-slate-700" />
               </Link>
            </div>

            <div className="flex items-center gap-1.5">
               {PIPELINE_STEPS.map((step, idx) => {
                  const isActive = activeStep === step;
                  const isPast = PIPELINE_STEPS.indexOf(activeStep) > idx;
                  return (
                     <div key={step} className="flex-1 flex flex-col gap-1">
                        <div
                           className="h-1.5 rounded-full transition-all duration-500"
                           style={{
                              background: isActive
                                 ? 'linear-gradient(90deg, #10b981, #14b8a6, #059669)'
                                 : isPast
                                 ? 'rgba(16, 185, 129, 0.4)'
                                 : 'rgba(226, 232, 240, 0.9)',
                              boxShadow: isActive ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none',
                           }}
                        />
                        <p
                           className="text-[8px] font-black uppercase tracking-widest text-center transition-colors duration-300"
                           style={{ color: isActive ? '#047857' : isPast ? '#059669' : '#94a3b8' }}
                        >
                           {t(`scanner_pipeline_${step.toLowerCase()}`)}
                        </p>
                     </div>
                  );
               })}
            </div>
         </div>

         <AnimatePresence mode="wait">

            {/* ── CHOOSE SCAN TYPE ── */}
            {mode === 'choose' && (
               <motion.div
                  key="choose"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center min-h-[65vh] px-6 gap-6 pt-6 relative z-10"
               >
                  <div className="text-center pt-2">
                     <div
                        className="h-20 w-20 rounded-[1.8rem] flex items-center justify-center mx-auto mb-4 relative backdrop-blur-2xl"
                        style={{
                           background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(236, 253, 245, 0.9))',
                           border: '1px solid rgba(167, 243, 208, 0.8)',
                           boxShadow: '0 12px 36px rgba(16, 185, 129, 0.12)',
                        }}
                     >
                        <ScanLine size={36} className="text-emerald-600" />
                     </div>
                     <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                        {language === 'हिंदी' || language === 'भोजपुरी' ? 'क्या स्कैन करना है?' : 'What to Scan?'}
                     </h2>
                     <p className="text-sm text-slate-600 mt-1.5 font-medium">
                        {language === 'हिंदी' || language === 'भोजपुरी' ? 'अपने खेत के पौधे या मिट्टी का चुनाव करें' : 'Choose your scan target below'}
                     </p>
                  </div>

                  <div className="w-full max-w-sm space-y-3.5">
                     {/* Plant Scan Card */}
                     <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setMode('camera')}
                        className="w-full rounded-[2rem] p-4 sm:p-5 text-left flex items-center gap-3.5 relative overflow-hidden backdrop-blur-2xl bg-white/80 border border-emerald-200/90 shadow-xl shadow-emerald-500/5 hover:border-emerald-400 group transition-all"
                     >
                        {/* Soft ambient card glow orb */}
                        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-gradient-to-br from-emerald-300/20 to-teal-200/10 blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

                        <div className="h-12 w-12 rounded-[1.1rem] bg-emerald-50 border border-emerald-200 backdrop-blur-xl flex items-center justify-center shrink-0 shadow-sm relative z-10 text-emerald-600 group-hover:scale-105 transition-transform">
                           <Leaf size={22} className="text-emerald-600" />
                        </div>
                        <div className="relative z-10 flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1 flex-wrap sm:flex-nowrap">
                              <p className="text-base font-black text-slate-900 tracking-tight whitespace-nowrap">
                                 {language === 'हिंदी' || language === 'भोजपुरी' ? '🌿 पौधा स्कैन' : '🌿 Plant Scan'}
                              </p>
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                                 AI Leaf RX
                              </span>
                           </div>
                           <p className="text-xs text-slate-600 font-medium leading-snug">
                              {language === 'हिंदी' || language === 'भोजपुरी' ? 'पत्ती की बीमारी पहचानें, सटीक दवाई पाएं' : 'Detect leaf disease, get medicine & dosage'}
                           </p>
                        </div>
                        <ChevronRight size={20} className="text-emerald-600 shrink-0 relative z-10 ml-auto" />
                     </motion.button>

                     {/* Soil Scan Card */}
                     <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => router.push('/soil?scan=1')}
                        className="w-full rounded-[2rem] p-4 sm:p-5 text-left flex items-center gap-3.5 relative overflow-hidden backdrop-blur-2xl bg-white/80 border border-amber-200/90 shadow-xl shadow-amber-500/5 hover:border-amber-400 group transition-all"
                     >
                        {/* Soft ambient card glow orb */}
                        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-gradient-to-br from-amber-300/20 to-orange-200/10 blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

                        <div className="h-12 w-12 rounded-[1.1rem] bg-amber-50 border border-amber-200 backdrop-blur-xl flex items-center justify-center shrink-0 shadow-sm relative z-10 text-amber-600 group-hover:scale-105 transition-transform">
                           <FlaskConical size={22} className="text-amber-600" />
                        </div>
                        <div className="relative z-10 flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1 flex-wrap sm:flex-nowrap">
                              <p className="text-base font-black text-slate-900 tracking-tight whitespace-nowrap">
                                 {language === 'हिंदी' || language === 'भोजपुरी' ? '🧪 मिट्टी स्कैन' : '🧪 Soil Scan'}
                              </p>
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                                 NPK & pH
                              </span>
                           </div>
                           <p className="text-xs text-slate-600 font-medium leading-snug">
                              {language === 'हिंदी' || language === 'भोजपुरी' ? 'मिट्टी की फोटो से NPK व pH सलाह पाएं' : 'Upload soil photo to detect type, NPK & pH advice'}
                           </p>
                        </div>
                        <ChevronRight size={20} className="text-amber-600 shrink-0 relative z-10 ml-auto" />
                     </motion.button>
                  </div>

                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-2">
                     {language === 'हिंदी' || language === 'भोजपुरी' ? 'AI द्वारा संचालित • 100% मुफ्त' : 'Powered by Edge AI • 100% Free'}
                  </p>
               </motion.div>
            )}

            {/* ── CAMERA MODE ── */}
            {mode === 'camera' && (
               <motion.div
                  key="camera"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  className="flex flex-col relative z-10"
               >
                  <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-white/80 mx-4 mt-2" style={{ height: '62vh' }}>
                     {cameraError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center bg-slate-900 text-white">
                           <div
                              className="h-20 w-20 rounded-3xl flex items-center justify-center bg-white/10 border border-white/20"
                           >
                              <Camera size={36} className="text-white/60" />
                           </div>
                           <div>
                              <p className="text-lg font-bold text-white">{t('scanner_camera_unavailable')}</p>
                              <p className="mt-1.5 text-sm text-white/60">{cameraError}</p>
                           </div>
                           <button
                              onClick={startCamera}
                              className="px-8 py-3 rounded-2xl text-sm font-bold text-white bg-white/20 border border-white/30 active:scale-95 transition-transform"
                           >
                              {t('scanner_try_again')}
                           </button>
                        </div>
                     ) : (
                        <>
                           <video
                              ref={videoRef}
                              autoPlay
                              muted
                              playsInline
                              onLoadedMetadata={() => {
                                 if (videoRef.current) {
                                    videoRef.current.play().catch(() => undefined);
                                    setIsCameraReady(true);
                                 }
                              }}
                              onCanPlay={() => setIsCameraReady(true)}
                              className="h-full w-full object-cover"
                           />

                           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 70% at center, transparent 40%, rgba(0,0,0,0.6) 100%)' }} />

                              <div className="relative w-[70%] aspect-[3/4]">
                                 <div className="scanner-corner scanner-corner-tl" />
                                 <div className="scanner-corner scanner-corner-tr" />
                                 <div className="scanner-corner scanner-corner-bl" />
                                 <div className="scanner-corner scanner-corner-br" />

                                 {isCameraReady && <div className="scan-line" />}

                                 <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-white shadow-lg">
                                       <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest text-center">
                                          {t('scanner_center_leaf')}
                                       </p>
                                    </div>
                                 </div>
                              </div>
                           </div>

                           {isCameraReady && (
                              <div className="absolute top-4 left-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-xl border border-emerald-300 shadow-md">
                                 <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                 <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">{t('scanner_live_badge')}</span>
                              </div>
                           )}

                           {/* Camera Switch/Flip Button */}
                           <button
                              onClick={toggleFacingMode}
                              className="absolute top-4 right-4 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-xl border border-slate-200 text-slate-800 shadow-md active:scale-95 transition-transform z-20 pointer-events-auto font-bold text-[10px]"
                           >
                              <RefreshCcw size={12} className="text-emerald-600" />
                              <span className="uppercase tracking-wider">
                                 {facingMode === 'environment' ? 'Rear Cam 🔄' : 'Front Cam 🔄'}
                              </span>
                           </button>
                        </>
                     )}
                  </div>


                  <div
                     className="px-6 py-6 flex items-center justify-around gap-4 bg-white/80 backdrop-blur-2xl border-t border-slate-200/80 relative z-20 shadow-lg mt-4"
                  >
                     {/* Upload from gallery */}
                     <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="h-14 w-14 rounded-[1.3rem] bg-slate-100 hover:bg-slate-200/80 border border-slate-200 flex flex-col items-center justify-center text-slate-700 shadow-sm transition-transform"
                        aria-label="Upload from gallery"
                     >
                        <ImageIcon size={20} className="text-emerald-600" />
                        <span className="text-[9px] font-bold text-slate-600 mt-0.5">Gallery</span>
                     </motion.button>

                     <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*" />

                     {/* Capture Photo button */}
                     <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={captureFromCamera}
                        disabled={!isCameraReady && !cameraError}
                        className="relative h-20 w-20 rounded-full flex flex-col items-center justify-center disabled:opacity-40 p-1 bg-gradient-to-tr from-emerald-500 via-teal-400 to-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                        aria-label="Capture Photo"
                     >
                        <div
                           className="absolute inset-0 rounded-full animate-ping opacity-25 bg-emerald-400 pointer-events-none"
                        />
                        <div className="h-full w-full rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600 flex flex-col items-center justify-center text-white font-black shadow-inner">
                           <Camera size={26} className="text-white relative z-10" />
                           <span className="text-[10px] font-black text-white tracking-tight uppercase relative z-10 mt-0.5">Capture</span>
                        </div>
                     </motion.button>

                     {/* Stop Camera button */}
                     <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => setMode('choose')}
                        className="h-14 w-14 rounded-[1.3rem] bg-rose-50 hover:bg-rose-100 border border-rose-200 flex flex-col items-center justify-center text-rose-600 shadow-sm transition-transform"
                        aria-label="Stop Camera"
                     >
                        <span className="text-rose-600 font-bold text-base leading-none">✕</span>
                        <span className="text-[9px] font-bold text-rose-600 mt-1">Stop</span>
                     </motion.button>
                  </div>

                  <p className="text-center text-xs text-slate-500 font-medium mt-2">
                     {t('scanner_upload_gallery')}
                  </p>
                  {scanError && (
                     <p className="px-5 pb-4 text-center text-xs font-semibold text-rose-600">
                        {scanError}
                     </p>
                  )}
               </motion.div>
            )}

            {/* ── SCANNING STATE ── */}
            {mode === 'scanning' && (
               <motion.div
                  key="scanning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center gap-8 relative z-10"
               >
                  {imagePreview && (
                     <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative w-36 h-44 rounded-3xl overflow-hidden bg-white p-1 border-2 border-emerald-300 shadow-[0_0_32px_rgba(16,185,129,0.2)]"
                     >
                        <img src={imagePreview} alt="Scanning" className="h-full w-full object-cover rounded-2xl" />
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 rounded-2xl">
                           <Loader2 size={28} className="text-white animate-spin" />
                        </div>
                        <div className="scan-line" />
                     </motion.div>
                  )}

                  <div>
                     <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('scanner_analyzing_leaf')}</h2>
                     <p className="text-sm text-slate-500 mt-2 font-medium">{t('scanner_checking_pathogens')}</p>
                  </div>

                  <div className="w-full max-w-xs">
                     <div className="flex justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500">{t('scanner_ai_processing')}</span>
                        <span className="text-xs font-extrabold text-emerald-600">{Math.min(Math.round(scanProgress), 99)}%</span>
                     </div>
                     <div className="h-2 rounded-full overflow-hidden bg-slate-200/80">
                        <motion.div
                           className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                           animate={{ width: `${Math.min(scanProgress, 99)}%` }}
                           transition={{ duration: 0.3 }}
                        />
                     </div>
                  </div>

                  <div className="space-y-2.5 w-full max-w-xs">
                     {[t('scanner_step_0'), t('scanner_step_1'), t('scanner_step_2')].map((step, i) => (
                        <motion.div
                           key={step}
                           initial={{ opacity: 0, x: -10 }}
                           animate={{ opacity: 1, x: 0 }}
                           transition={{ delay: i * 0.4, duration: 0.3 }}
                           className="flex items-center gap-3 bg-white/80 backdrop-blur-md border border-slate-200/80 p-3 rounded-2xl shadow-sm"
                        >
                           <div
                              className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 bg-emerald-50 border border-emerald-200"
                           >
                              <Loader2 size={12} className="text-emerald-600 animate-spin" />
                           </div>
                           <span className="text-xs font-semibold text-slate-700">{step}</span>
                        </motion.div>
                     ))}
                  </div>
               </motion.div>
            )}

            {/* ── RESULT MODE (ULTRA PREMIUM SOFT GLASSMORPHISM) ── */}
            {mode === 'result' && diagnosis && (
               <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="px-4 pb-32 pt-4 space-y-5 max-w-lg mx-auto relative z-10"
               >
                  {/* Premium Intelligence Suite Header */}
                  <div className="flex items-center justify-between px-2 mb-1">
                     <div>
                       <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
                         {t('pd_suite')}
                       </h2>
                       <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                         Powered by PlantVillage AI
                       </p>
                     </div>
                     <div className="flex h-6 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0 border border-emerald-300 text-[9px] font-black text-emerald-800 shadow-sm">
                        <Sparkles size={11} className="text-emerald-600" />
                        <span>ULTRA-HD ANALYZED</span>
                     </div>
                  </div>

                  {/* Hero Result Leaf Card */}
                  <div
                     className="relative overflow-hidden rounded-[2.5rem] bg-white/90 border border-white shadow-xl shadow-slate-200/70"
                  >
                     <div className="relative h-64 bg-slate-100">
                        {imagePreview ? (
                           <img src={imagePreview} alt="Scanned plant" className="h-full w-full object-cover" />
                        ) : (
                           <div className="h-full w-full flex items-center justify-center">
                              <ThreeLeafModel />
                           </div>
                        )}
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 60%)' }} />

                        <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-emerald-300 shadow-sm">
                           <div className="h-2 w-2 rounded-full animate-pulse bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-emerald-900">
                                {severityLabel === 'High Severity' ? t('scanner_high_severity') : severityLabel === 'Medium Severity' ? t('scanner_medium_severity') : t('scanner_early_detection')}
                           </span>
                        </div>

                        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 border border-white/80 backdrop-blur-md shadow-sm">
                           <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">ID: {result?.prediction_id?.slice(0,8) || 'AUTO'}</span>
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-6">
                           <h2 className="text-3xl font-black text-white leading-tight drop-shadow-md">
                               {formatDiseaseName(diagnosis.name)}
                           </h2>
                           <div className="flex items-center gap-2 mt-2">
                              <div className="flex -space-x-1">
                                 {[1,2,3].map(i => (
                                    <div key={i} className="h-4 w-4 rounded-full border border-white bg-emerald-500 flex items-center justify-center overflow-hidden">
                                        <div className="w-full h-full bg-emerald-400/80" />
                                    </div>
                                 ))}
                              </div>
                              <p className="text-[10px] font-bold text-slate-200/90">{t('scanner_based_on_visual')}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* AI Action Card (Smart Prescription) */}
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-[2rem] bg-gradient-to-br from-emerald-500/10 via-white/80 to-teal-500/5 backdrop-blur-xl border border-emerald-200/80 p-6 relative overflow-hidden group shadow-lg shadow-emerald-900/5"
                  >
                     <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-emerald-300/20 blur-2xl rounded-full" />
                     <div className="flex items-center gap-3 mb-3.5">
                        <div className="h-10 w-10 rounded-2xl bg-emerald-500 flex items-center justify-center border border-emerald-400 text-white shadow-md shadow-emerald-500/30">
                           <Sparkles size={20} className="text-white" />
                        </div>
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800">{t('scanner_ai_action')}</p>
                           <p className="text-xs font-bold text-slate-500">{t('scanner_smart_rx')}</p>
                        </div>
                     </div>
                     <p className="text-base font-extrabold text-slate-900 leading-relaxed">
                        {result?.recommendation?.action || 'No specific treatment action generated. Consult an expert.'}
                     </p>
                  </motion.div>

                  {/* Medicine & Dosage Cards */}
                  <div className="grid grid-cols-2 gap-4">
                     <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="rounded-[1.8rem] p-5 bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-md shadow-slate-200/50"
                     >
                        <div className="flex items-center gap-2 mb-3">
                           <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
                              <ShieldCheck size={17} className="text-emerald-700" />
                           </div>
                           <span className="text-[10px] font-black text-emerald-800 uppercase tracking-[0.15em]">{t('scanner_medicine')}</span>
                        </div>
                        <p className="text-sm font-black text-slate-900 leading-snug">
                          {diagnosis.treatment?.medicine || 'Supportive Care'}
                        </p>
                     </motion.div>

                     <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-[1.8rem] p-5 bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-md shadow-slate-200/50"
                     >
                        <div className="flex items-center gap-2 mb-3">
                           <div className="h-8 w-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
                              <Droplets size={17} className="text-amber-700" />
                           </div>
                           <span className="text-[10px] font-black text-amber-800 uppercase tracking-[0.15em]">{t('scanner_dosage')}</span>
                        </div>
                        <p className="text-sm font-black text-slate-900 leading-snug">
                           {diagnosis.treatment?.dosage || 'Variable Rate'}
                        </p>
                     </motion.div>
                  </div>

                  {result?.escalation_required && (
                     <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-[2rem] p-5 relative overflow-hidden bg-rose-50/90 border border-rose-200 shadow-md shadow-rose-500/5"
                     >
                        <div className="flex items-start gap-4">
                           <div className="h-10 w-10 rounded-2xl bg-rose-100 flex items-center justify-center border border-rose-200 shrink-0 text-rose-600">
                              <Phone size={20} className="text-rose-600" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-rose-700 mb-1">{t('scanner_human_review')}</p>
                              <p className="text-sm font-bold text-slate-900">
                                 Confidence below safety threshold ({result.confidence_threshold ?? 75}%).
                              </p>
                              <p className="mt-1 text-xs text-slate-600 leading-relaxed italic">
                                 {t('scanner_spray_decision')}
                              </p>
                           </div>
                        </div>
                     </motion.div>
                  )}

                  {dosage && (
                     <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-[2.2rem] p-6 overflow-hidden bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-xl shadow-slate-200/50"
                     >
                        <div className="flex items-center gap-3 mb-5">
                           <div className="h-10 w-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center border border-teal-200">
                              <ClipboardList size={20} className="text-teal-700" />
                           </div>
                           <div>
                              <span className="text-[10px] font-black text-teal-800 uppercase tracking-[0.2em] block">{t('scanner_treatment_plan')}</span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase">{profile.farmSize} Acres Area</span>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-5">
                           {[
                              { label: t('scanner_chemical_req'), value: dosage.dosage_exact?.chemical, color: 'emerald' },
                              { label: t('scanner_water_mix'), value: dosage.dosage_exact?.water_mix, color: 'teal' },
                           ].map(({ label, value }) => (
                              <div key={label} className="rounded-2xl p-4 bg-slate-50 border border-slate-200/60">
                                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">{label}</p>
                                 <p className="text-base font-black text-slate-900">{value || 'N/A'}</p>
                              </div>
                           ))}
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                           <p className="text-xs font-medium text-slate-700 leading-relaxed italic">
                              {dosage.instructions || 'Ensure complete canopy coverage. Do not spray during peak heat hours.'}
                           </p>
                        </div>
                     </motion.div>
                  )}

                  <div className="space-y-4 pt-4">
                     {result?.escalation_required && (
                        <motion.button
                           whileTap={{ scale: 0.95 }}
                           onClick={openCallModal}
                           className="w-full py-5 rounded-full font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 haptic-btn bg-slate-900 hover:bg-slate-800 text-white shadow-xl"
                        >
                           <Phone size={18} /> {t('scanner_btn_talk')}
                        </motion.button>
                     )}

                     {!dosage && (
                        <motion.button
                           whileTap={{ scale: 0.95 }}
                           onClick={getSmartDosage}
                           disabled={isMixLoading}
                           className="w-full py-5 rounded-full font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 haptic-btn bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white shadow-[0_12px_32px_-8px_rgba(16,185,129,0.4)] disabled:opacity-40 transition-all"
                        >
                           {isMixLoading ? <Loader2 size={18} className="animate-spin" /> : <Droplets size={18} />}
                           {t('scanner_btn_compute')}
                        </motion.button>
                     )}

                     <div className="flex gap-4">
                        <Link
                           href={`/marketplace?category=Pesticides&search=${encodeURIComponent(diagnosis.treatment?.raw_medicine || diagnosis.treatment?.medicine || '')}`}
                           className="flex-1 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 haptic-btn bg-white/90 hover:bg-white border border-slate-200/80 text-slate-800 shadow-sm transition-all"
                        >
                           <ShoppingBag size={16} className="text-emerald-600" /> {t('scanner_btn_shop')}
                        </Link>

                        <button
                           onClick={resetScanner}
                           className="flex-1 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 haptic-btn bg-white/90 hover:bg-white border border-slate-200/80 text-slate-800 shadow-sm transition-all"
                        >
                           <RefreshCcw size={16} className="text-slate-600" /> {t('scanner_btn_new')}
                        </button>
                     </div>

                     <button
                        onClick={() => setShowLanguagePdfModal(true)}
                        disabled={isPdfLoading}
                        className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 transition-colors shadow-sm"
                     >
                        {isPdfLoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        {t('scanner_btn_download_report')}
                     </button>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>

         <AnimatePresence>
            {showLanguagePdfModal && (
               <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                  <motion.div
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     onClick={() => setShowLanguagePdfModal(false)}
                     className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
                  />
                  <motion.div
                     initial={{ opacity: 0, scale: 0.9, y: 20 }}
                     animate={{ opacity: 1, scale: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.9, y: 20 }}
                     className="relative w-full max-w-sm rounded-[2.5rem] bg-white/95 border border-white p-8 text-center text-slate-900 shadow-2xl"
                     style={{ backdropFilter: 'blur(32px)' }}
                  >
                     <div className="h-16 w-16 rounded-3xl bg-emerald-100 flex items-center justify-center mx-auto mb-5 border border-emerald-200 text-emerald-600 shadow-sm">
                        <FileText size={32} />
                     </div>
                     <h3 className="text-xl font-black text-slate-900 mb-1.5">Select Report Language</h3>
                     <p className="text-sm text-slate-500 mb-6 font-medium">Choose your preferred language for the localized Health Report.</p>
                     
                     <div className="grid grid-cols-1 gap-3">
                        {['English (Global)', 'हिंदी (Hindi)', 'मराठी (Marathi)', 'ਪੰਜਾਬੀ (Punjabi)'].map((lang) => (
                           <button
                              key={lang}
                              onClick={() => downloadPDF(lang)}
                              className="w-full py-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all font-black text-sm text-slate-800 hover:text-emerald-800 shadow-sm"
                           >
                              {lang}
                           </button>
                        ))}
                     </div>
                     
                     <button
                        onClick={() => setShowLanguagePdfModal(false)}
                        className="mt-6 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
                     >
                        Cancel
                      </button>
                  </motion.div>
               </div>
            )}
         </AnimatePresence>
      </div>
   );
}
