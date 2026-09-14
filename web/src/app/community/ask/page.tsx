'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Lightbulb, Loader2, Play, Send, Sparkles, User, UserX, Shield, Mic, Volume2 } from 'lucide-react';
import { useFarmerProfile } from '@/context/FarmerProfileContext';
import { useLanguage } from '@/context/LanguageContext';
import { fetchJson } from '@/lib/api';
import VoiceNoteRecorder from '@/components/VoiceNoteRecorder';
import PesticideSafetyModal from '@/components/PesticideSafetyModal';

type AskAssistResponse = {
  formatted_post: string;
  crop: string;
  tags: string[];
  suggested_actions: string[];
  monetization_tip: string;
};

type CreatePostResponse = {
  success?: boolean;
  post?: {
    id: string;
  };
  manage_token?: string;
  business_hint?: {
    next_best_action?: string;
  };
};

type PostMode = 'post' | 'reel';
type PostTemplate = 'roi' | 'lifecycle' | '';
type DisplayMode = 'full' | 'first_name' | 'anonymous';

const TOKEN_STORAGE_KEY = 'plant-doctor/community-manage-tokens';

function getTemplateTags(template: PostTemplate): string[] {
  if (template === 'roi') return ['roi', 'profitability', 'farm-finance'];
  if (template === 'lifecycle') return ['lifecycle', 'crop-plan', '90-day-plan'];
  return [];
}

function saveManageToken(postId: string, token: string) {
  if (!postId || !token || typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Record<string, string> : {};
    parsed[postId] = token;
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
}

export default function AskCommunityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useFarmerProfile();
  const { language } = useLanguage();
  const isEnglish = language === 'English';
  const isPunjabi = language === 'ਪੰਜਾਬੀ';

  const text = isEnglish
    ? {
        back: 'Back to Community',
        title: 'Ask Community',
        subtitle: 'Get genuine field advice from fellow farmers and verified experts.',
        share: 'Share with 12K+ farmers',
        shareSub: 'Clear crop context + symptoms = fast, helpful answers.',
        crop: 'Crop',
        askType: 'Share Type',
        postType: 'Post',
        reelType: 'Reel',
        identityTitle: 'Post Identity',
        fullName: 'Full Name',
        firstName: 'First Name Only',
        anonymous: 'Anonymous Farmer',
        anonymousNote: 'No fear of judgment! Ask freely about pest outbreaks or crop failure. Safety rules apply equally to all.',
        question: 'What do you want to ask?',
        questionPh: 'Example: white spots on leaves after rain, what to do?',
        mediaLabel: 'Reel media URL',
        mediaPh: 'Paste image/video URL for your reel preview',
        draft: 'Generate smart draft',
        drafting: 'Preparing draft...',
        yourPost: 'Your content',
        yourPostPh: 'Describe what happened in your field, symptoms, and what advice you need...',
        voiceTab: 'Voice Note',
        typeTab: 'Type Text',
        checklist: 'Better replies checklist',
        postNow: 'Post to Community',
        reelNow: 'Post Reel',
        posting: 'Posting...',
        minError: 'Please write at least 6 characters or record a voice note.',
        reelError: 'For reel, add image/video URL first.',
        posted: 'Posted successfully.',
      }
    : isPunjabi
    ? {
        back: 'ਕਮਿਊਨਿਟੀ ਤੇ ਵਾਪਸ ਜਾਓ',
        title: 'ਕਮਿਊਨਿਟੀ ਵਿੱਚ ਪੁੱਛੋ',
        subtitle: 'ਹੋਰ ਕਿਸਾਨਾਂ ਅਤੇ ਪ੍ਰਮਾਣਿਤ ਖੇਤੀ ਮਾਹਿਰਾਂ ਤੋਂ ਭਰੋਸੇਯੋਗ ਸਲਾਹ ਲਓ।',
        share: 'ਹਜ਼ਾਰਾਂ ਕਿਸਾਨਾਂ ਨਾਲ ਸਾਂਝਾ ਕਰੋ',
        shareSub: 'ਫ਼ਸਲ ਅਤੇ ਲੱਛਣ ਸਾਫ਼ ਲਿਖੋਗੇ ਤਾਂ ਸਹੀ ਜਵਾਬ ਮਿਲੇਗਾ।',
        crop: 'ਫ਼ਸਲ',
        askType: 'ਕਿਸਮ',
        postType: 'ਪੋਸਟ',
        reelType: 'ਰੀਲ',
        identityTitle: 'ਤੁਹਾਡੀ ਪਛਾਣ',
        fullName: 'ਪੂਰਾ ਨਾਮ',
        firstName: 'ਕੇਵਲ ਪਹਿਲਾ ਨਾਮ',
        anonymous: 'ਗੁਮਨਾਮ ਕਿਸਾਨ (Anonymous)',
        anonymousNote: 'ਬਿਨਾਂ ਕਿਸੇ ਝਿਝਕ ਦੇ ਪੁੱਛੋ! ਫ਼ਸਲ ਦੇ ਨੁਕਸਾਨ ਜਾਂ ਸ਼ੰਕਾਵਾਂ ਬਾਰੇ ਖੁੱਲ੍ਹ ਕੇ ਗੱਲ ਕਰੋ।',
        question: 'ਤੁਸੀਂ ਕੀ ਪੁੱਛਣਾ ਚਾਹੁੰਦੇ ਹੋ?',
        questionPh: 'ਉਦਾਹਰਨ: ਮੀਂਹ ਤੋਂ ਬਾਅਦ ਕਣਕ ਦੇ ਪੱਤੇ ਪੀਲੇ ਹੋ ਰਹੇ ਹਨ, ਕੀ ਕਰੀਏ?',
        mediaLabel: 'ਰੀਲ ਮੀਡੀਆ ਲਿੰਕ',
        mediaPh: 'ਵੀਡੀਓ ਜਾਂ ਫੋਟੋ ਲਿੰਕ ਪਾਓ',
        draft: 'ਸਮਾਰਟ ਡਰਾਫਟ ਬਣਾਓ',
        drafting: 'ਡਰਾਫਟ ਬਣ ਰਿਹਾ ਹੈ...',
        yourPost: 'ਤੁਹਾਡੀ ਪੋਸਟ',
        yourPostPh: 'ਖੇਤ ਦੀ ਸਮੱਸਿਆ, ਲੱਛਣ ਅਤੇ ਕਿਸ ਤਰ੍ਹਾਂ ਦੀ ਮਦਦ ਚਾਹੀਦੀ ਹੈ ਲਿਖੋ...',
        voiceTab: 'ਬੋਲ ਕੇ ਦੱਸੋ (Voice Note)',
        typeTab: 'ਲਿਖ ਕੇ ਦੱਸੋ',
        checklist: 'ਸਹੀ ਜਵਾਬ ਲਈ ਸੁਝਾਅ',
        postNow: 'ਕਮਿਊਨਿਟੀ ਵਿੱਚ ਪੋਸਟ ਕਰੋ',
        reelNow: 'ਰੀਲ ਪੋਸਟ ਕਰੋ',
        posting: 'ਪੋਸਟ ਹੋ ਰਿਹਾ ਹੈ...',
        minError: 'ਪੋਸਟ ਕਰਨ ਲਈ ਕੁਝ ਸ਼ਬਦ ਲਿਖੋ ਜਾਂ ਵੌਇਸ ਨੋਟ ਰਿਕਾਰਡ ਕਰੋ।',
        reelError: 'ਰੀਲ ਲਈ ਵੀਡੀਓ/ਫੋਟੋ ਲਿੰਕ ਜ਼ਰੂਰੀ ਹੈ।',
        posted: 'ਸਫਲਤਾਪੂਰਵਕ ਪੋਸਟ ਹੋ ਗਿਆ।',
      }
    : {
        back: 'समुदाय पर वापस जाएं',
        title: 'कम्युनिटी में पूछें',
        subtitle: 'साथी किसानों और प्रमाणित कृषि वैज्ञानिकों से विश्वसनीय सलाह पाएं।',
        share: 'हजारों किसानों के साथ साझा करें',
        shareSub: 'फसल और लक्षण साफ लिखेंगे तो सबसे सटीक जवाब मिलेंगे।',
        crop: 'फसल',
        askType: 'शेयर प्रकार',
        postType: 'पोस्ट',
        reelType: 'रील',
        identityTitle: 'आपकी पहचान (Identity)',
        fullName: 'पूरा नाम',
        firstName: 'सिर्फ पहला नाम',
        anonymous: 'गुमनाम किसान (Anonymous)',
        anonymousNote: 'बिना किसी झिझक के पूछें! फसल नुकसान या बीमारी के बारे में निसंकोच सवाल करें। आपका नाम गोपनीय रहेगा।',
        question: 'आप क्या पूछना चाहते हैं?',
        questionPh: 'उदाहरण: बारिश के बाद पत्तों पर पीले धब्बे हैं, क्या करें?',
        mediaLabel: 'रील मीडिया URL',
        mediaPh: 'रील के लिए image/video लिंक डालें',
        draft: 'स्मार्ट ड्राफ्ट बनाएं',
        drafting: 'ड्राफ्ट तैयार हो रहा है...',
        yourPost: 'आपकी सामग्री',
        yourPostPh: 'खेत में क्या समस्या है, क्या लक्षण दिखे, और कैसी सलाह चाहिए लिखें...',
        voiceTab: 'बोलकर पूछें (Voice Note)',
        typeTab: 'टाइप करें',
        checklist: 'बेहतर जवाब चेकलिस्ट',
        postNow: 'कम्युनिटी में पोस्ट करें',
        reelNow: 'रील पोस्ट करें',
        posting: 'पोस्ट हो रहा है...',
        minError: 'कृपया कम से कम 6 अक्षर लिखें या वॉयस नोट रिकॉर्ड करें।',
        reelError: 'रील के लिए image/video URL डालना जरूरी है।',
        posted: 'सफलतापूर्वक पोस्ट हो गया।',
      };

  const queryCrop = searchParams.get('crop')?.trim();
  const queryQuestion = searchParams.get('q')?.trim();
  const queryPrefill = searchParams.get('prefill')?.trim();
  const queryPrefillQuestion = searchParams.get('prefill_question')?.trim();
  const queryTemplateRaw = (searchParams.get('template') || '').trim().toLowerCase();
  const queryTemplate: PostTemplate =
    queryTemplateRaw === 'roi' || queryTemplateRaw === 'lifecycle' ? queryTemplateRaw : '';
  const queryModeRaw = (searchParams.get('mode') || '').trim().toLowerCase();
  const queryMode: PostMode = queryModeRaw === 'reel' ? 'reel' : 'post';
  const cropList = useMemo(
    () => (profile.crops.length ? profile.crops : ['Wheat', 'Rice', 'Tomato', 'Cotton']),
    [profile.crops]
  );

  const [crop, setCrop] = useState(queryCrop || cropList[0]);
  const [postMode, setPostMode] = useState<PostMode>(queryMode);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('full');
  const [inputTab, setInputTab] = useState<'type' | 'voice'>('type');
  const [question, setQuestion] = useState(queryQuestion || queryPrefillQuestion || '');
  const [content, setContent] = useState(queryPrefill || '');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);
  const [mediaUrl, setMediaUrl] = useState('');
  const [assistTips, setAssistTips] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAssistLoading, setIsAssistLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Safety filter modal states
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [safetyViolationData, setSafetyViolationData] = useState<any>(null);

  useEffect(() => {
    if (queryPrefill) {
      setContent(queryPrefill);
      return;
    }
    if (!queryQuestion) return;
    void generateDraft(queryQuestion, queryCrop || cropList[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateDraft = async (seedQuestion?: string, seedCrop?: string) => {
    const questionText = (seedQuestion ?? question).trim();
    const cropText = seedCrop ?? crop;
    const fallbackQuestion = questionText || (isEnglish ? `Need urgent help in ${cropText}.` : `${cropText} में तुरंत मदद चाहिए।`);

    setError('');
    setSuccess('');
    setIsAssistLoading(true);
    try {
      const assist = await fetchJson<AskAssistResponse>('/api/v1/community/ask-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: fallbackQuestion,
          crop: cropText,
          location: profile.locationLabel || 'India',
        }),
      });
      setQuestion(fallbackQuestion);
      setCrop(assist.crop || cropText);
      setContent(assist.formatted_post || fallbackQuestion);
      setAssistTips(Array.isArray(assist.suggested_actions) ? assist.suggested_actions : []);
    } catch {
      setContent(
        isEnglish
          ? `Need quick advice in ${cropText} from ${profile.locationLabel || 'my area'}. ${fallbackQuestion}`
          : `${cropText} में ${profile.locationLabel || 'मेरे क्षेत्र'} से तुरंत मदद चाहिए। ${fallbackQuestion}`
      );
    } finally {
      setIsAssistLoading(false);
    }
  };

  const handleVoiceTranscription = (transcribedText: string) => {
    setContent((prev) => (prev ? `${prev}\n${transcribedText}` : transcribedText));
  };

  const handleAudioRecorded = (dataUrl: string, duration: number) => {
    setAudioUrl(dataUrl);
    setAudioDuration(duration);
  };

  const submitPost = async () => {
    const finalContent = content.trim();
    const finalMedia = mediaUrl.trim();

    if ((finalContent.length < 6 && !audioUrl) || isPosting) {
      setError(text.minError);
      return;
    }
    if (postMode === 'reel' && !finalMedia) {
      setError(text.reelError);
      return;
    }

    setError('');
    setSuccess('');
    setIsPosting(true);

    const langCode = isPunjabi ? 'pa' : isEnglish ? 'en' : 'hi';

    try {
      const res = await fetch('/api/v1/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: finalContent || 'Voice Note Attached',
          location: profile.locationLabel || 'India',
          region: profile.state || (profile.locationLabel?.includes('Punjab') ? 'Punjab' : 'All India'),
          language: langCode,
          display_mode: displayMode,
          is_anonymous: displayMode === 'anonymous',
          audio_url: audioUrl,
          audio_duration: audioDuration,
          crop,
          tags: getTemplateTags(queryTemplate),
          author: profile.name || '',
          media_type: postMode,
          image: postMode === 'reel' ? finalMedia : '',
          video_url: postMode === 'reel' ? finalMedia : '',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Intercept 422 pre-publish safety scan
        if (data.detail?.safety_violation) {
          setSafetyViolationData(data.detail);
          setIsSafetyModalOpen(true);
          return;
        }
        throw new Error(data.detail || data.message || 'Could not post right now');
      }

      if (data.post?.id && data.manage_token) {
        saveManageToken(data.post.id, data.manage_token);
      }

      setSuccess(text.posted);
      if (navigator.vibrate) navigator.vibrate([20, 50, 20]);

      window.setTimeout(() => {
        router.push('/community?tab=discuss&posted=1');
      }, 500);
    } catch (postError: any) {
      setError(postError.message || 'Could not post right now. Try again.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="min-h-full bg-[#f8fafc] text-slate-800" style={{ paddingBottom: '220px' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-4 pb-3 pt-4"
        style={{
          background: 'rgba(248,250,252,0.92)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        <button
          onClick={() => router.push('/community?tab=discuss')}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          <ArrowLeft size={15} />
          {text.back}
        </button>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{text.title}</h1>
        <p className="mt-1 text-xs font-semibold text-slate-500">{text.subtitle}</p>
      </div>

      <div className="space-y-4 px-4 pt-4 max-w-2xl mx-auto">
        {/* Banner */}
        <div
          className="rounded-3xl border p-4"
          style={{ background: 'linear-gradient(135deg, #ecfeff, #f0fdf4)', borderColor: '#99f6e4' }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{text.share}</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{text.shareSub}</p>
        </div>

        {/* Identity Selector */}
        <div className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200/80">
          <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            {text.identityTitle}
          </label>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {[
              { id: 'full', label: text.fullName, icon: User },
              { id: 'first_name', label: text.firstName, icon: User },
              { id: 'anonymous', label: text.anonymous, icon: UserX },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setDisplayMode(id as DisplayMode)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all ${
                  displayMode === id
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <Icon size={16} className={displayMode === id ? 'text-emerald-600' : 'text-slate-400'} />
                <span className="mt-1 text-[11px] leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {displayMode === 'anonymous' && (
            <div className="mt-3 rounded-xl bg-amber-50/70 border border-amber-200/80 p-2.5 flex items-start gap-2">
              <Shield size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                {text.anonymousNote}
              </p>
            </div>
          )}
        </div>

        {/* Crop Selector */}
        <div className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200/80">
          <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{text.crop}</label>
          <div className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar">
            {cropList.map((cropName) => (
              <button
                key={cropName}
                onClick={() => setCrop(cropName)}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-black"
                style={{
                  background: crop === cropName ? '#10b981' : '#f8fafc',
                  border: crop === cropName ? '1px solid #10b981' : '1px solid #e2e8f0',
                  color: crop === cropName ? '#ffffff' : '#334155',
                }}
              >
                {cropName}
              </button>
            ))}
          </div>
        </div>

        {/* Input Method Switcher */}
        <div className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{text.yourPost}</label>
            <div className="flex rounded-full bg-slate-100 p-0.5 border border-slate-200">
              <button
                onClick={() => setInputTab('type')}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  inputTab === 'type' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                <span>{text.typeTab}</span>
              </button>
              <button
                onClick={() => setInputTab('voice')}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  inputTab === 'voice' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Mic size={12} />
                <span>{text.voiceTab}</span>
              </button>
            </div>
          </div>

          {/* Voice recorder */}
          <VoiceNoteRecorder
            language={isPunjabi ? 'pa' : isEnglish ? 'en' : 'hi'}
            onTranscriptionComplete={handleVoiceTranscription}
            onAudioRecorded={handleAudioRecorded}
          />

          {/* Text Area */}
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={text.yourPostPh}
            className="w-full rounded-2xl border border-slate-200 p-3.5 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 placeholder:text-slate-400"
          />

          {/* Safety rule reminder badge */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 pt-1">
            <Shield size={13} className="text-emerald-600 shrink-0" />
            <span>Pre-publish safety check active (No synthetic chemical dosage without KVK verification)</span>
          </div>
        </div>

        {/* Mode Selector (Post vs Reel) */}
        <div className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200/80">
          <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{text.askType}</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => setPostMode('post')}
              className={`rounded-2xl p-3 text-xs font-black transition-all ${
                postMode === 'post' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              {text.postType}
            </button>
            <button
              onClick={() => setPostMode('reel')}
              className={`rounded-2xl p-3 text-xs font-black transition-all ${
                postMode === 'reel' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              {text.reelType}
            </button>
          </div>

          {postMode === 'reel' && (
            <div className="mt-3">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">{text.mediaLabel}</label>
              <input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder={text.mediaPh}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800">
            {success}
          </p>
        )}

        {/* Submit button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={submitPost}
          disabled={isPosting}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white shadow-xl shadow-emerald-500/25 transition-all"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
        >
          {isPosting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          <span>{isPosting ? text.posting : postMode === 'reel' ? text.reelNow : text.postNow}</span>
        </motion.button>
      </div>

      {/* Pesticide Safety Filter Modal */}
      <PesticideSafetyModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        language={language}
        currentContent={content}
        violationDetails={safetyViolationData}
        onApplyRevision={(revised) => {
          setContent(revised);
          setError('');
        }}
      />
    </div>
  );
}
