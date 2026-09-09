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
   };

   return (
      <div
         className="min-h-screen text-white pb-52 sm:pb-56 relative overflow-hidden"
         style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(30,64,175,0.22) 0%, transparent 40%), linear-gradient(180deg, #070f1c 0%, #0a1426 46%, #081224 100%)',
         }}
      >
         {/* Background Soft Glow Orbs */}
         <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-sky-500/15 via-indigo-500/10 to-teal-500/15 blur-3xl pointer-events-none rounded-full" />

         {/* ── PIPELINE PROGRESS HEADER ── */}
         <div
            className="px-5 pt-4 pb-4 sticky top-0 z-40"
            style={{
               background: 'linear-gradient(180deg, rgba(8,17,31,0.94), rgba(8,17,31,0.82))',
               backdropFilter: 'blur(24px)',
               borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
         >
            <div className="flex items-center justify-between mb-3">
               <Link
                  href="/dashboard"
                  className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-opacity active:opacity-70"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
               >
                  <ChevronLeft size={18} className="text-white/70" />
               </Link>

               <div className="flex items-center gap-2">
                  <div
                     className="h-8 w-8 rounded-xl flex items-center justify-center"
                     style={{ background: 'rgba(125,211,252,0.16)', border: '1px solid rgba(125,211,252,0.25)' }}
                  >
                     <ScanLine size={15} className="text-sky-200" />
                  </div>
                  <h1 className="text-base font-black text-white tracking-tight">{t('scanner_app_title')}</h1>
               </div>

               <Link
                  href="/history"
                  className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
               >
                  <ClipboardList size={15} className="text-white/60" />
               </Link>
            </div>

            <div className="flex items-center gap-1.5">
               {PIPELINE_STEPS.map((step, idx) => {
                  const isActive = activeStep === step;
                  const isPast = PIPELINE_STEPS.indexOf(activeStep) > idx;
                  return (
                     <div key={step} className="flex-1 flex flex-col gap-1">
                        <div
                           className="h-1 rounded-full transition-all duration-500"
                           style={{
                              background: isActive
                                 ? 'linear-gradient(90deg, #dbeafe, #7dd3fc, #6ee7d8)'
                                 : isPast
                                 ? 'rgba(125,211,252,0.3)'
                                 : 'rgba(255,255,255,0.06)',
                              boxShadow: isActive ? '0 0 8px rgba(125,211,252,0.6)' : 'none',
                           }}
                        />
                        <p
                           className="text-[8px] font-black uppercase tracking-widest text-center transition-colors duration-300"
                           style={{ color: isActive ? '#dbeafe' : isPast ? 'rgba(125,211,252,0.6)' : 'rgba(255,255,255,0.2)' }}
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
                  className="flex flex-col items-center justify-center min-h-[65vh] px-6 gap-6 pt-6"
               >
                  <div className="text-center pt-2">
                     <div
                        className="h-20 w-20 rounded-[1.8rem] flex items-center justify-center mx-auto mb-4 relative backdrop-blur-2xl"
                        style={{
                           background: 'linear-gradient(135deg, rgba(125,211,252,0.25), rgba(56,189,248,0.12))',
                           border: '1px solid rgba(125,211,252,0.4)',
                           boxShadow: '0 12px 36px rgba(56,189,248,0.25)',
                        }}
                     >
                        <ScanLine size={36} className="text-sky-300" />
                     </div>
                     <h2 className="text-3xl font-black text-white tracking-tight">
                        {language === 'हिंदी' || language === 'भोजपुरी' ? 'क्या स्कैन करना है?' : 'What to Scan?'}
                     </h2>
                     <p className="text-sm text-slate-300 dark:text-slate-400 mt-1.5 font-medium">
                        {language === 'हिंदी' || language === 'भोजपुरी' ? 'अपने खेत के पौधे या मिट्टी का चुनाव करें' : 'Choose your scan target below'}
                     </p>
                  </div>

                  <div className="w-full max-w-sm space-y-3.5">
                     {/* Plant Scan Card */}
                     <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setMode('camera')}
                        className="w-full rounded-[2rem] p-4 sm:p-5 text-left flex items-center gap-3.5 relative overflow-hidden backdrop-blur-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/8 to-emerald-500/2 border border-emerald-500/30 hover:border-emerald-400/60 shadow-xl shadow-emerald-500/5 group transition-all"
                     >
                        {/* Soft ambient card glow orb */}
                        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/5 blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

                        <div className="h-12 w-12 rounded-[1.1rem] bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/35 backdrop-blur-xl flex items-center justify-center shrink-0 shadow-inner relative z-10 text-emerald-300 group-hover:scale-105 transition-transform">
                           <Leaf size={22} className="text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                        </div>
                        <div className="relative z-10 flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1 flex-wrap sm:flex-nowrap">
                              <p className="text-base font-black text-white tracking-tight whitespace-nowrap">
                                 {language === 'हिंदी' || language === 'भोजपुरी' ? '🌿 पौधा स्कैन' : '🌿 Plant Scan'}
                              </p>
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                 AI Leaf RX
                              </span>
                           </div>
                           <p className="text-xs text-emerald-200/75 font-medium leading-snug">
                              {language === 'हिंदी' || language === 'भोजपुरी' ? 'पत्ती की बीमारी पहचानें, सटीक दवाई पाएं' : 'Detect leaf disease, get medicine & dosage'}
                           </p>
                        </div>
                        <ChevronRight size={20} className="text-emerald-400/80 shrink-0 relative z-10 ml-auto" />
                     </motion.button>

                     {/* Soil Scan Card */}
                     <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => router.push('/soil?scan=1')}
                        className="w-full rounded-[2rem] p-4 sm:p-5 text-left flex items-center gap-3.5 relative overflow-hidden backdrop-blur-2xl bg-gradient-to-br from-amber-500/15 via-orange-500/8 to-amber-500/2 border border-amber-500/30 hover:border-amber-400/60 shadow-xl shadow-amber-500/5 group transition-all"
                     >
                        {/* Soft ambient card glow orb */}
                        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/5 blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

                        <div className="h-12 w-12 rounded-[1.1rem] bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-400/35 backdrop-blur-xl flex items-center justify-center shrink-0 shadow-inner relative z-10 text-amber-300 group-hover:scale-105 transition-transform">
                           <FlaskConical size={22} className="text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
                        </div>
                        <div className="relative z-10 flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1 flex-wrap sm:flex-nowrap">
                              <p className="text-base font-black text-white tracking-tight whitespace-nowrap">
                                 {language === 'हिंदी' || language === 'भोजपुरी' ? '🧪 मिट्टी स्कैन' : '🧪 Soil Scan'}
                              </p>
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                 NPK & pH
                              </span>
                           </div>
                           <p className="text-xs text-amber-200/75 font-medium leading-snug">
                              {language === 'हिंदी' || language === 'भोजपुरी' ? 'मिट्टी की फोटो से NPK व pH सलाह पाएं' : 'Upload soil photo to detect type, NPK & pH advice'}
                           </p>
                        </div>
                        <ChevronRight size={20} className="text-amber-400/80 shrink-0 relative z-10 ml-auto" />
                     </motion.button>
                  </div>

                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest text-center mt-2">
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
                  className="flex flex-col"
               >
                  <div className="relative bg-black" style={{ height: '65vh' }}>
                     {cameraError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center">
                           <div
                              className="h-20 w-20 rounded-3xl flex items-center justify-center"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                           >
                              <Camera size={36} className="text-white/40" />
                           </div>
                           <div>
                              <p className="text-lg font-bold text-white">{t('scanner_camera_unavailable')}</p>
                              <p className="mt-1.5 text-sm text-white/40">{cameraError}</p>
                           </div>
                           <button
                              onClick={startCamera}
                              className="px-8 py-3 rounded-2xl text-sm font-bold text-white haptic-btn"
                              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
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
                              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 70% at center, transparent 40%, rgba(0,0,0,0.7) 100%)' }} />

                              <div className="relative w-[70%] aspect-[3/4]">
                                 <div className="scanner-corner scanner-corner-tl" />
                                 <div className="scanner-corner scanner-corner-tr" />
                                 <div className="scanner-corner scanner-corner-bl" />
                                 <div className="scanner-corner scanner-corner-br" />

                                 {isCameraReady && <div className="scan-line" />}

                                 <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-lg">
                                       <p className="text-[10px] font-black text-sky-200 uppercase tracking-widest text-center">
                                          {t('scanner_center_leaf')}
                                       </p>
                                    </div>
                                 </div>
                              </div>
                           </div>

                           {isCameraReady && (
                              <div className="absolute top-4 left-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/60 backdrop-blur-xl border border-emerald-500/30 shadow-lg">
                                 <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                 <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">{t('scanner_live_badge')}</span>
                              </div>
                           )}

                           {/* Camera Switch/Flip Button */}
                           <button
                              onClick={toggleFacingMode}
                              className="absolute top-4 right-4 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-950/70 backdrop-blur-xl border border-sky-400/30 text-sky-200 shadow-lg active:scale-95 transition-transform z-20 pointer-events-auto"
                           >
                              <RefreshCcw size={12} className="text-sky-300" />
                              <span className="text-[10px] font-black uppercase tracking-wider">
                                 {facingMode === 'environment' ? 'Rear Cam 🔄' : 'Front Cam 🔄'}
                              </span>
                           </button>
                        </>
                     )}
                  </div>


                  <div
                     className="px-6 py-6 flex items-center justify-around gap-4 bg-slate-950/90 backdrop-blur-2xl border-t border-white/10 relative z-20"
                  >
                     {/* Upload from gallery */}
                     <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="h-14 w-14 rounded-[1.3rem] bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-xl flex flex-col items-center justify-center haptic-btn text-white/80 shadow-lg transition-transform"
                        aria-label="Upload from gallery"
                     >
                        <ImageIcon size={20} className="text-sky-200" />
                        <span className="text-[9px] font-bold text-white/60 mt-0.5">Gallery</span>
                     </motion.button>

                     <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*" />

                     {/* Capture Photo button */}
                     <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={captureFromCamera}
                        disabled={!isCameraReady && !cameraError}
                        className="relative h-20 w-20 rounded-full flex flex-col items-center justify-center disabled:opacity-40 haptic-btn p-1 bg-gradient-to-tr from-sky-400 via-teal-300 to-emerald-400 shadow-[0_0_30px_rgba(56,189,248,0.4)]"
                        aria-label="Capture Photo"
                     >
                        <div
                           className="absolute inset-0 rounded-full animate-ping opacity-25 bg-sky-400 pointer-events-none"
                        />
                        <div className="h-full w-full rounded-full bg-gradient-to-br from-sky-200 via-teal-300 to-emerald-300 flex flex-col items-center justify-center text-slate-950 font-black shadow-inner">
                           <Camera size={26} className="text-slate-950 relative z-10" />
                           <span className="text-[10px] font-black text-slate-950 tracking-tight uppercase relative z-10 mt-0.5">Capture</span>
                        </div>
                     </motion.button>

                     {/* Stop Camera button */}
                     <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => setMode('choose')}
                        className="h-14 w-14 rounded-[1.3rem] bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 flex flex-col items-center justify-center haptic-btn backdrop-blur-xl text-rose-300 shadow-lg transition-transform"
                        aria-label="Stop Camera"
                     >
                        <span className="text-rose-400 font-bold text-base leading-none">✕</span>
                        <span className="text-[9px] font-bold text-rose-300 mt-1">Stop</span>
                     </motion.button>
                  </div>

                  <p className="text-center text-xs text-white/45 font-medium">
                     {t('scanner_upload_gallery')}
                  </p>
                  {scanError && (
                     <p className="px-5 pb-4 text-center text-xs font-semibold text-rose-300/90">
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
                  className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center gap-8"
               >
                  {imagePreview && (
                     <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative w-32 h-40 rounded-3xl overflow-hidden"
                        style={{ border: '2px solid rgba(125,211,252,0.34)', boxShadow: '0 0 32px rgba(125,211,252,0.22)' }}
                     >
                        <img src={imagePreview} alt="Scanning" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                           <Loader2 size={28} className="text-sky-200 animate-spin" />
                        </div>
                        <div className="scan-line" />
                     </motion.div>
                  )}

                  <div>
                     <h2 className="text-2xl font-black text-white tracking-tight">{t('scanner_analyzing_leaf')}</h2>
                     <p className="text-sm text-white/40 mt-2">{t('scanner_checking_pathogens')}</p>
                  </div>

                  <div className="w-full max-w-xs">
                     <div className="flex justify-between mb-2">
                        <span className="text-xs font-bold text-white/40">{t('scanner_ai_processing')}</span>
                        <span className="text-xs font-bold text-sky-200">{Math.min(Math.round(scanProgress), 99)}%</span>
                     </div>
                     <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <motion.div
                           className="h-full rounded-full"
                           style={{ background: 'linear-gradient(90deg, #dbeafe, #7dd3fc, #6ee7d8)', boxShadow: '0 0 8px rgba(125,211,252,0.6)' }}
                           animate={{ width: `${Math.min(scanProgress, 99)}%` }}
                           transition={{ duration: 0.3 }}
                        />
                     </div>
                  </div>

                  <div className="space-y-2 w-full max-w-xs">
                     {[t('scanner_step_0'), t('scanner_step_1'), t('scanner_step_2')].map((step, i) => (
                        <motion.div
                           key={step}
                           initial={{ opacity: 0, x: -10 }}
                           animate={{ opacity: 1, x: 0 }}
                           transition={{ delay: i * 0.4, duration: 0.3 }}
                           className="flex items-center gap-3"
                        >
                           <div
                              className="h-5 w-5 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: 'rgba(125,211,252,0.15)', border: '1px solid rgba(125,211,252,0.3)' }}
                           >
                              <Loader2 size={10} className="text-sky-200 animate-spin" />
                           </div>
                           <span className="text-xs font-semibold text-white/50">{step}</span>
                        </motion.div>
                     ))}
                  </div>
               </motion.div>
            )}

            {/* ── RESULT MODE ── */}
            {mode === 'result' && diagnosis && (
               <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="px-4 pb-32 pt-4 space-y-5 max-w-lg mx-auto"
               >
                  {/* Premium Intelligence Suite Header */}
                  <div className="flex items-center justify-between px-2 mb-1">
                     <div>
                       <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">
                         {t('pd_suite')}
                       </h2>
                       <p className="text-[9px] font-bold text-white/30 uppercase tracking-tighter">
                         Powered by PlantVillage AI
                       </p>
                     </div>
                     <div className="flex h-5 items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0 border border-sky-500/20 text-[9px] font-black text-sky-200">
                        <Sparkles size={10} />
                        <span>ULTRA-HD ANALYZED</span>
                     </div>
                  </div>

                  {/* Hero result card */}
                  <div
                     className="relative overflow-hidden rounded-[2.5rem] bg-white/5 border border-white/10 shadow-2xl"
                     style={{
                        boxShadow: `0 24px 64px -12px rgba(0,0,0,0.5), 0 0 20px ${severityColor}15`,
                     }}
                  >
                     <div className="relative h-64 bg-slate-900">
                        {imagePreview ? (
                           <img src={imagePreview} alt="Scanned plant" className="h-full w-full object-cover opacity-90" />
                        ) : (
                           <div className="h-full w-full flex items-center justify-center">
                              <ThreeLeafModel />
                           </div>
                        )}
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #080c14 0%, transparent 60%)' }} />

                        <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${severityColor}40`, backdropFilter: 'blur(12px)' }}>
                           <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: severityColor }} />
                           <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: severityColor }}>
                               {severityLabel === 'High Severity' ? t('scanner_high_severity') : severityLabel === 'Medium Severity' ? t('scanner_medium_severity') : t('scanner_early_detection')}
                           </span>
                        </div>

                        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                           <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">ID: {result?.prediction_id?.slice(0,8) || 'AUTO'}</span>
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-6">
                           <h2 className="text-3xl font-black text-white leading-tight drop-shadow-lg">
                              {formatDiseaseName(diagnosis.name)}
                           </h2>
                           <div className="flex items-center gap-2 mt-2">
                              <div className="flex -space-x-1">
                                 {[1,2,3].map(i => (
                                    <div key={i} className="h-4 w-4 rounded-full border border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden">
                                        <div className="w-full h-full bg-sky-500/20" />
                                    </div>
                                 ))}
                              </div>
                              <p className="text-[10px] font-bold text-white/40">{t('scanner_based_on_visual')}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* AI Action Card (Prominent Treatment) */}
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-[2rem] bg-gradient-to-br from-sky-500/10 to-teal-500/5 border border-white/10 p-6 relative overflow-hidden group"
                  >
                     <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-sky-500/10 blur-2xl rounded-full" />
                     <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-2xl bg-sky-400 flex items-center justify-center border border-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.4)]">
                           <Sparkles size={20} className="text-sky-900" />
                        </div>
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">{t('scanner_ai_action')}</p>
                           <p className="text-xs font-bold text-white/40">{t('scanner_smart_rx')}</p>
                        </div>
                     </div>
                     <p className="text-base font-bold text-white leading-relaxed">
                        {result?.recommendation?.action || 'No specific treatment action generated. Consult an expert.'}
                     </p>
                  </motion.div>

                  <div className="grid grid-cols-2 gap-4">
                     <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="rounded-[1.8rem] p-5 bg-white/5 border border-white/5 backdrop-blur-sm"
                     >
                        <div className="flex items-center gap-2 mb-3">
                           <div className="h-7 w-7 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
                              <ShieldCheck size={16} className="text-emerald-400" />
                           </div>
                           <span className="text-[9px] font-black text-emerald-400/80 uppercase tracking-[0.15em]">{t('scanner_medicine')}</span>
                        </div>
                        <p className="text-sm font-black text-white leading-snug">
                          {diagnosis.treatment?.medicine || 'Supportive Care'}
                        </p>
                     </motion.div>

                     <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-[1.8rem] p-5 bg-white/5 border border-white/5 backdrop-blur-sm"
                     >
                        <div className="flex items-center gap-2 mb-3">
                           <div className="h-7 w-7 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/20">
                              <Droplets size={16} className="text-amber-400" />
                           </div>
                           <span className="text-[9px] font-black text-amber-400/80 uppercase tracking-[0.15em]">{t('scanner_dosage')}</span>
                        </div>
                        <p className="text-sm font-black text-white leading-snug">
                           {diagnosis.treatment?.dosage || 'Variable Rate'}
                        </p>
                     </motion.div>
                  </div>

                  {result?.escalation_required && (
                     <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-[2rem] p-5 relative overflow-hidden bg-rose-500/5 border border-rose-500/20 shadow-lg shadow-rose-500/5"
                     >
                        <div className="flex items-start gap-4">
                           <div className="h-10 w-10 rounded-2xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30 shrink-0">
                              <Phone size={20} className="text-rose-400" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1">{t('scanner_human_review')}</p>
                              <p className="text-sm font-bold text-white/90">
                                 Confidence below safety threshold ({result.confidence_threshold ?? 75}%).
                              </p>
                              <p className="mt-1 text-xs text-white/40 leading-relaxed italic">
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
                        className="rounded-[2.2rem] p-6 overflow-hidden bg-white/5 border border-white/10 shadow-xl"
                     >
                        <div className="flex items-center gap-3 mb-5">
                           <div className="h-10 w-10 rounded-2xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/20">
                              <ClipboardList size={20} className="text-cyan-400" />
                           </div>
                           <div>
                              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] block">{t('scanner_treatment_plan')}</span>
                              <span className="text-[9px] font-bold text-white/30 uppercase">{profile.farmSize} Acres Area</span>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-5">
                           {[
                              { label: t('scanner_chemical_req'), value: dosage.dosage_exact?.chemical, color: 'emerald' },
                              { label: t('scanner_water_mix'), value: dosage.dosage_exact?.water_mix, color: 'sky' },
                           ].map(({ label, value }) => (
                              <div key={label} className="rounded-2xl p-4 bg-white/5 border border-white/5">
                                 <p className="text-[9px] font-black text-white/30 uppercase tracking-wider mb-2">{label}</p>
                                 <p className="text-base font-black text-white">{value || 'N/A'}</p>
                              </div>
                           ))}
                        </div>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                           <p className="text-xs font-medium text-white/60 leading-relaxed italic">
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
                           className="w-full py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 haptic-btn bg-white text-slate-900 shadow-xl"
                        >
                           <Phone size={18} /> {t('scanner_btn_talk')}
                        </motion.button>
                     )}

                     {!dosage && (
                        <motion.button
                           whileTap={{ scale: 0.95 }}
                           onClick={getSmartDosage}
                           disabled={isMixLoading}
                           className="w-full py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 haptic-btn bg-sky-500 text-white shadow-[0_12px_32px_-8px_rgba(14,165,233,0.5)] disabled:opacity-40"
                        >
                           {isMixLoading ? <Loader2 size={18} className="animate-spin" /> : <Droplets size={18} />}
                           {t('scanner_btn_compute')}
                        </motion.button>
                     )}

                     <div className="flex gap-4">
                        <Link
                           href={`/marketplace?category=Medicines&search=${encodeURIComponent(diagnosis.treatment?.raw_medicine || diagnosis.treatment?.medicine || '')}`}
                           className="flex-1 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 haptic-btn bg-white/5 border border-white/10 hover:bg-white/10"
                        >
                           <ShoppingBag size={16} /> {t('scanner_btn_shop')}
                        </Link>

                        <button
                           onClick={resetScanner}
                           className="flex-1 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 haptic-btn bg-white/5 border border-white/10 hover:bg-white/10"
                        >
                           <RefreshCcw size={16} /> {t('scanner_btn_new')}
                        </button>
                     </div>

                     <button
                        onClick={() => setShowLanguagePdfModal(true)}
                        disabled={isPdfLoading}
                        className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 text-white/40 hover:text-white transition-colors"
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
                     className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                  />
                  <motion.div
                     initial={{ opacity: 0, scale: 0.9, y: 20 }}
                     animate={{ opacity: 1, scale: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.9, y: 20 }}
                     className="relative w-full max-w-sm rounded-[2.5rem] bg-slate-900/50 border border-white/10 p-8 text-center"
                     style={{ backdropFilter: 'blur(32px)', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}
                  >
                     <div className="h-16 w-16 rounded-3xl bg-sky-500/20 flex items-center justify-center mx-auto mb-6 border border-sky-500/30">
                        <FileText size={32} className="text-sky-400" />
                     </div>
                     <h3 className="text-xl font-black text-white mb-2">Select Report Language</h3>
                     <p className="text-sm text-white/40 mb-8 font-medium">Choose your preferred language for the localized Health Report.</p>
                     
                     <div className="grid grid-cols-1 gap-3">
                        {['English (Global)', 'हिंदी (Hindi)', 'मराठी (Marathi)', 'ਪੰਜਾਬੀ (Punjabi)'].map((lang) => (
                           <button
                              key={lang}
                              onClick={() => downloadPDF(lang)}
                              className="w-full py-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all font-black text-sm text-white"
                           >
                              {lang}
                           </button>
                        ))}
                     </div>
                     
                     <button
                        onClick={() => setShowLanguagePdfModal(false)}
                        className="mt-6 text-xs font-black uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors"
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
