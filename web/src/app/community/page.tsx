'use client';

import {
  Heart, MessageCircle, Phone, Play, PlusCircle,
  Search, Share2, ShieldCheck, Sparkles, Star,
  Users, Video, X, Flame, TrendingUp, Award, Zap,
  Eye, Bookmark, ChevronRight, MapPin, Trash2,
  Bot, AlertTriangle, Shield, Check, Volume2, Mic, Wifi, WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFarmerProfile } from '@/context/FarmerProfileContext';
import { useExpertCall } from '@/context/ExpertCallContext';
import { useLanguage } from '@/context/LanguageContext';
import { fetchJson } from '@/lib/api';
import VoiceNoteRecorder from '@/components/VoiceNoteRecorder';
import PesticideSafetyModal from '@/components/PesticideSafetyModal';
import ExpertVerificationModal from '@/components/ExpertVerificationModal';

type CommunityTab = 'reels' | 'discuss' | 'experts';

type CommunityPost = {
  id: string;
  author: string;
  author_id?: string;
  location: string;
  region?: string;
  language?: string;
  display_mode?: string;
  is_anonymous?: boolean;
  content: string;
  audio_url?: string;
  audio_duration?: number;
  image?: string;
  videoThumb?: string;
  video_url?: string;
  likes: number;
  comments: number;
  time: string;
  crop?: string;
  views?: number;
  tags?: string[];
  shares?: number;
  saves?: number;
  engagement_score?: number;
  is_demo?: boolean;
  is_cross_region_nudge?: boolean;
};

type CommunityComment = {
  id: string;
  post_id: string;
  author: string;
  author_id?: string;
  is_anonymous?: boolean;
  display_mode?: string;
  content: string;
  audio_url?: string;
  audio_duration?: number;
  language?: string;
  is_expert?: boolean;
  expert_credential?: string;
  likes: number;
  time: string;
};

type CommunityInsightsResponse = {
  window_days: number;
  post_count: number;
  engagement_rate_pct: number;
  top_crops: Array<{ crop: string; post_count: number }>;
  top_creators: Array<{ author: string; engagement_score: number }>;
  revenue_opportunities: Array<{
    channel: string;
    action: string;
    estimated_monthly_inr: number;
  }>;
};

type ExpertProfile = {
  id?: string;
  name: string;
  role: string;
  status: string;
  isLive: boolean;
  rating: number;
  calls: number;
  avatar: string;
  bg: string;
  accent: string;
  speciality: string;
  crop_focus?: string;
  is_verified?: boolean;
  credential_title?: string;
  institution?: string;
  verification_id?: string;
  verified_by?: string;
  verified_at?: string;
};

type ExpertDirectoryResponse = {
  success?: boolean;
  total: number;
  experts: ExpertProfile[];
};

const TOKEN_STORAGE_KEY = 'plant-doctor/community-manage-tokens';
const ALL_FILTER = 'All';

const EXPERTS: ExpertProfile[] = [
  {
    name: 'Dr. Neha Verma',
    role: 'Wheat & Paddy Specialist',
    status: 'Online now',
    isLive: true,
    rating: 4.9,
    calls: 48,
    avatar: '👩‍⚕️',
    bg: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
    accent: '#10b981',
    speciality: 'Fungal Diseases',
    is_verified: true,
    credential_title: 'KVK Affiliated Agronomist',
    institution: 'ICAR - Krishi Vigyan Kendra, Karnal',
    verification_id: 'KVK-HR-8841',
  },
  {
    name: 'Dr. Sukhdeep Singh',
    role: 'Vegetable Disease Advisor',
    status: 'Available in 8 min',
    isLive: false,
    rating: 4.8,
    calls: 32,
    avatar: '👨‍🔬',
    bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
    accent: '#3b82f6',
    speciality: 'Pest Control',
    is_verified: true,
    credential_title: 'Ph.D. Plant Pathology (PAU)',
    institution: 'Punjab Agricultural University, Ludhiana',
    verification_id: 'PAU-DOC-7712',
  },
  {
    name: 'Prof. Meena Rao',
    role: 'Soil & Nutrition Expert',
    status: 'Online now',
    isLive: true,
    rating: 4.7,
    calls: 29,
    avatar: '👩‍🌾',
    bg: 'linear-gradient(135deg, #fefce8, #fef9c3)',
    accent: '#f59e0b',
    speciality: 'Soil Health',
    is_verified: true,
    credential_title: 'ICAR Senior Soil Chemist',
    institution: 'ICAR - Indian Agricultural Research Institute',
    verification_id: 'ICAR-IARI-9043',
  },
];

function getStoredTokens(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, string> : {};
  } catch {
    return {};
  }
}

function setStoredTokens(next: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export default function CommunityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useFarmerProfile();
  const { openCallModal } = useExpertCall();
  const { language } = useLanguage();
  const isEnglish = language === 'English';
  const isPunjabi = language === 'ਪੰਜਾਬੀ';

  const text = isEnglish
    ? {
        title: 'Community',
        liveExperts: 'Live Experts',
        searchPlaceholder: 'Search farmers, crops, local tips...',
        tabs: { reels: 'Reels', discuss: 'Discuss', experts: 'Experts' },
        askCommunity: 'Ask Community',
        feedScopeNear: `📍 Near You (${profile.state || 'Local'})`,
        feedScopeAll: '🌍 All India',
        dataSaverOn: 'Data Saver ON',
        dataSaverOff: 'Full Quality',
        tapToPlay: 'Tap to load video (1.2 MB)',
        honestBadgeNew: '🌱 Fresh Topic',
        sampleBadge: '💡 Sample Topic',
        askSahayak: 'Ask Sahayak',
        callExpert: 'Call Expert',
        verifiedBadge: 'Verified',
        reply: 'Reply / Comments',
        postComment: 'Send Reply',
        commentPlaceholder: 'Share friendly field experience (Safety rules active)...',
        voiceComment: 'Record voice note reply',
        anonymousComment: 'Post anonymously',
        deleteConfirm: 'Delete post?',
        report: 'Report Unsafe Content',
      }
    : isPunjabi
    ? {
        title: 'ਕਿਸਾਨ ਕਮਿਊਨਿਟੀ',
        liveExperts: 'ਖੇਤੀ ਮਾਹਿਰ',
        searchPlaceholder: 'ਕਿਸਾਨ, ਫ਼ਸਲ, ਨੁਸਖੇ ਲੱਭੋ...',
        tabs: { reels: 'ਰੀਲਜ਼', discuss: 'ਚਰਚਾ', experts: 'ਮਾਹਿਰ' },
        askCommunity: 'ਸਵਾਲ ਪੁੱਛੋ',
        feedScopeNear: `📍 ਤੁਹਾਡੇ ਨੇੜੇ (${profile.state || 'ਪੰਜਾਬ'})`,
        feedScopeAll: '🌍 ਪੂਰਾ ਭਾਰਤ',
        dataSaverOn: 'ਡੇਟਾ ਬੱਚਤ ਚਾਲੂ',
        dataSaverOff: 'ਪੂਰੀ ਕੁਆਲਿਟੀ',
        tapToPlay: 'ਵੀਡੀਓ ਚਲਾਓ (1.2 MB)',
        honestBadgeNew: '🌱 ਨਵੀਂ ਚਰਚਾ',
        sampleBadge: '💡 ਨਮੂਨਾ ਵਿਸ਼ਾ',
        askSahayak: 'ਸਹਾਇਕ ਤੋਂ ਪੁੱਛੋ',
        callExpert: 'ਮਾਹਿਰ ਨੂੰ ਕਾਲ ਕਰੋ',
        verifiedBadge: 'ਪ੍ਰਮਾਣਿਤ',
        reply: 'ਜਵਾਬ / ਟਿੱਪਣੀਆਂ',
        postComment: 'ਜਵਾਬ ਭੇਜੋ',
        commentPlaceholder: 'ਆਪਣਾ ਤਜ਼ਰਬਾ ਸਾਂਝਾ ਕਰੋ (ਸੁਰੱਖਿਆ ਨਿਯਮ ਲਾਗੂ)...',
        voiceComment: 'ਬੋਲ ਕੇ ਜਵਾਬ ਦਿਓ',
        anonymousComment: 'ਗੁਮਨਾਮ ਹੋ ਕੇ ਜਵਾਬ ਦਿਓ',
        deleteConfirm: 'ਪੋਸਟ ਮਿਟਾਓ?',
        report: 'ਅਸੁਰੱਖਿਅਤ ਸਮੱਗਰੀ ਦੀ ਰਿਪੋਰਟ ਕਰੋ',
      }
    : {
        title: 'किसान समुदाय',
        liveExperts: 'लाइव विशेषज्ञ',
        searchPlaceholder: 'किसान, फसल, देसी उपाय खोजें...',
        tabs: { reels: 'रील्स', discuss: 'चर्चा', experts: 'विशेषज्ञ' },
        askCommunity: 'कम्युनिटी में पूछें',
        feedScopeNear: `📍 आपके आस-पास (${profile.state || 'स्थानीय'})`,
        feedScopeAll: '🌍 पूरा भारत',
        dataSaverOn: 'डेटा बचत चालू',
        dataSaverOff: 'फुल क्वालिटी',
        tapToPlay: 'वीडियो चलाएं (1.2 MB)',
        honestBadgeNew: '🌱 नई चर्चा',
        sampleBadge: '💡 डेमो चर्चा',
        askSahayak: 'सहायक से पूछें',
        callExpert: 'विशेषज्ञ को कॉल',
        verifiedBadge: 'सत्यापित',
        reply: 'जवाब / टिप्पणियां',
        postComment: 'जवाब भेजें',
        commentPlaceholder: 'अपना व्यावहारिक अनुभव लिखें (दवा सुरक्षा नियम सक्रिय)...',
        voiceComment: 'बोलकर जवाब दें',
        anonymousComment: 'गुमनाम रहकर जवाब दें',
        deleteConfirm: 'पोस्ट हटाएं?',
        report: 'असुरक्षित सलाह रिपोर्ट करें',
      };

  const requestedTab = searchParams.get('tab');
  const initialTab: CommunityTab =
    requestedTab === 'reels' || requestedTab === 'discuss' || requestedTab === 'experts'
      ? requestedTab
      : 'discuss';

  const [activeTab, setActiveTab] = useState<CommunityTab>(initialTab);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [experts, setExperts] = useState<ExpertProfile[]>(EXPERTS);
  const [expertsTotal, setExpertsTotal] = useState(48);
  const [search, setSearch] = useState('');
  const [selectedCrop, setSelectedCrop] = useState(ALL_FILTER);
  const [preferLocal, setPreferLocal] = useState(true);
  const [dataSaver, setDataSaver] = useState(true);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  // Engagement states
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [managedTokens, setManagedTokens] = useState<Record<string, string>>({});
  const [deletingPostIds, setDeletingPostIds] = useState<Set<string>>(new Set());

  // Interactive comments drawer state
  const [activeCommentPost, setActiveCommentPost] = useState<CommunityPost | null>(null);
  const [postComments, setPostComments] = useState<CommunityComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentVoiceUrl, setCommentVoiceUrl] = useState('');
  const [isCommentAnonymous, setIsCommentAnonymous] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showVoiceRecorderInComment, setShowVoiceRecorderInComment] = useState(false);

  // Safety & Verification modals
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [safetyViolationData, setSafetyViolationData] = useState<any>(null);
  const [selectedExpertForVerification, setSelectedExpertForVerification] = useState<ExpertProfile | null>(null);
  const [isExpertModalOpen, setIsExpertModalOpen] = useState(false);

  const farmerRegion = profile.state || (profile.locationLabel?.includes('Punjab') ? 'Punjab' : 'All India');
  const langCode = isPunjabi ? 'pa' : isEnglish ? 'en' : 'hi';

  // Load posts with region/language prioritization
  const loadPosts = () => {
    const params = new URLSearchParams();
    if (selectedCrop !== ALL_FILTER) params.set('crop', selectedCrop);
    if (search.trim()) params.set('search', search.trim());
    if (preferLocal && farmerRegion) params.set('region', farmerRegion);
    params.set('language', langCode);
    params.set('prefer_local', preferLocal ? 'true' : 'false');

    fetchJson<{ posts: CommunityPost[] }>(`/api/v1/community/posts?${params.toString()}`)
      .then((data) => {
        const fetched = Array.isArray(data.posts) ? data.posts : [];
        setPosts(fetched);
      })
      .catch(() => {
        // Handled by state
      });
  };

  const toggleDataSaver = () => {
    setDataSaver((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('plant-doctor/data-saver-mode', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    loadPosts();
  }, [selectedCrop, search, preferLocal, langCode]);

  useEffect(() => {
    setManagedTokens(getStoredTokens());
    try {
      const savedDataSaver = window.localStorage.getItem('plant-doctor/data-saver-mode');
      if (savedDataSaver !== null) {
        setDataSaver(savedDataSaver === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch experts
  useEffect(() => {
    const cropParam = selectedCrop !== ALL_FILTER ? selectedCrop : '';
    fetchJson<ExpertDirectoryResponse>(
      `/api/v1/expert/directory?limit=48${cropParam ? `&crop=${encodeURIComponent(cropParam)}` : ''}`
    )
      .then((payload) => {
        if (Array.isArray(payload.experts) && payload.experts.length > 0) {
          setExperts(payload.experts);
          setExpertsTotal(payload.total || payload.experts.length);
        }
      })
      .catch(() => {
        setExperts(EXPERTS);
      });
  }, [selectedCrop]);

  const cropFilters = useMemo(() => [ALL_FILTER, ...profile.crops], [profile.crops]);
  const reels = posts.filter((p) => p.image || p.video_url || p.videoThumb);

  // Comments Loader
  const openCommentsDrawer = async (post: CommunityPost) => {
    setActiveCommentPost(post);
    setIsLoadingComments(true);
    setNewCommentText('');
    setCommentVoiceUrl('');
    setShowVoiceRecorderInComment(false);
    try {
      const res = await fetchJson<{ comments: CommunityComment[] }>(
        `/api/v1/community/posts/${post.id}/comments`
      );
      setPostComments(Array.isArray(res.comments) ? res.comments : []);
    } catch {
      setPostComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Submit Comment
  const handlePostComment = async () => {
    if (!activeCommentPost || (!newCommentText.trim() && !commentVoiceUrl)) return;
    setIsSubmittingComment(true);

    try {
      const res = await fetch(`/api/v1/community/posts/${activeCommentPost.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newCommentText.trim() || 'Voice Note Reply',
          audio_url: commentVoiceUrl,
          display_mode: isCommentAnonymous ? 'anonymous' : 'first_name',
          is_anonymous: isCommentAnonymous,
          author: profile.name || '',
          language: langCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.detail?.safety_violation) {
          setSafetyViolationData(data.detail);
          setIsSafetyModalOpen(true);
          return;
        }
        throw new Error(data.detail || 'Could not post comment');
      }

      if (data.comment) {
        setPostComments((prev) => [...prev, data.comment]);
        setPosts((prev) =>
          prev.map((p) => (p.id === activeCommentPost.id ? { ...p, comments: p.comments + 1 } : p))
        );
        setNewCommentText('');
        setCommentVoiceUrl('');
        setShowVoiceRecorderInComment(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const toggleLike = async (id: string) => {
    if (navigator.vibrate) navigator.vibrate(12);
    const isLiked = likedPosts.has(id);
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(id);
      else next.add(id);
      return next;
    });

    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, likes: p.likes + (isLiked ? -1 : 1) } : p))
    );

    try {
      await fetch(`/api/v1/community/posts/${id}/engage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like' }),
      });
    } catch {
      // ignore
    }
  };

  const toggleSave = (id: string) => {
    if (navigator.vibrate) navigator.vibrate(8);
    setSavedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deletePost = async (postId: string) => {
    const token = managedTokens[postId] || 'admin_override';
    setDeletingPostIds((prev) => new Set(prev).add(postId));
    setPosts((prev) => prev.filter((item) => item.id !== postId));

    try {
      await fetch(`/api/v1/community/posts/${encodeURIComponent(postId)}?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      });
      const nextTokens = { ...managedTokens };
      delete nextTokens[postId];
      setManagedTokens(nextTokens);
      setStoredTokens(nextTokens);
    } catch {
      // ignore
    } finally {
      setDeletingPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  // Bridge Action 1: Ask Sahayak
  const askSahayakBridge = (post: CommunityPost) => {
    const query = `${post.crop ? post.crop + ': ' : ''}${post.content}. (क्षेत्र: ${post.location})। सुरक्षित जैविक सलाह बताएं।`;
    router.push(`/assistant?q=${encodeURIComponent(query)}`);
  };

  // Bridge Action 2: Call Krishi Expert
  const callKrishiExpertBridge = (_post: CommunityPost) => {
    openCallModal();
  };

  const openAskComposer = () => {
    if (navigator.vibrate) navigator.vibrate([20, 40]);
    const crop = selectedCrop !== ALL_FILTER ? selectedCrop : profile.crops[0] || 'Wheat';
    router.push(`/community/ask?crop=${encodeURIComponent(crop)}`);
  };

  return (
    <div className="min-h-full bg-[#f8fafc] text-slate-800 pb-6 sm:pb-8">
      {/* ── STICKY HEADER ── */}
      <div
        className="sticky top-0 z-40 space-y-3 px-4 pb-3 pt-4"
        style={{
          background: 'rgba(248,250,252,0.94)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{text.title}</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap shrink-0">
              <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
              <span>{isEnglish ? 'Verified' : isPunjabi ? 'ਪ੍ਰਮਾਣਿਤ' : 'सत्यापित'}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Data Saver Toggle */}
            <button
              onClick={toggleDataSaver}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all whitespace-nowrap ${
                dataSaver
                  ? 'bg-amber-50 text-amber-900 border border-amber-300/80 shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
              }`}
              title="Toggle rural bandwidth data saver mode"
            >
              {dataSaver ? <WifiOff size={12} className="text-amber-700" /> : <Wifi size={12} className="text-slate-500" />}
              <span>{dataSaver ? 'Data Saver' : 'Full'}</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-xs border border-slate-200">
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={text.searchPlaceholder}
            className="flex-1 bg-transparent text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none"
          />
          {search && <button onClick={() => setSearch('')}><X size={14} className="text-slate-400" /></button>}
        </div>

        {/* Region Scope & Crop filters with clear separation */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-0.5">
          {/* Near You toggle pill */}
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => setPreferLocal((prev) => !prev)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              preferLocal
                ? 'bg-slate-900 text-white shadow-xs border border-slate-900'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{preferLocal ? text.feedScopeNear : text.feedScopeAll}</span>
          </motion.button>

          {/* Subtle vertical divider */}
          <div className="h-4 w-px bg-slate-300 shrink-0 mx-0.5" />

          {/* Crop Filter Pills */}
          {cropFilters.map((crop) => {
            const isSelected = selectedCrop === crop;
            return (
              <motion.button
                whileTap={{ scale: 0.94 }}
                key={crop}
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(8);
                  setSelectedCrop(crop);
                }}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-emerald-600 text-white font-black shadow-xs border border-emerald-600'
                    : 'bg-white text-slate-600 font-semibold border border-slate-200 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                {crop}
              </motion.button>
            );
          })}
        </div>

        {/* Navigation Tabs */}
        <div className="flex rounded-2xl bg-slate-200/70 p-1">
          {(['discuss', 'reels', 'experts'] as CommunityTab[]).map((tab) => {
            const icons = { reels: Video, discuss: MessageCircle, experts: Users };
            const Icon = icons[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(10);
                  setActiveTab(tab);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all ${
                  isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-emerald-600' : 'text-slate-400'} />
                <span>{text.tabs[tab]}</span>
                {tab === 'experts' && (
                  <span className="relative flex h-2 w-2 ml-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="px-4 pt-4 max-w-2xl mx-auto space-y-4">
        {/* ── TAB 1: DISCUSS ── */}
        {activeTab === 'discuss' && (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl p-6 border border-slate-200">
                <MessageCircle size={36} className="mx-auto text-slate-300" />
                <h3 className="mt-3 text-sm font-bold text-slate-700">No discussions found</h3>
                <p className="mt-1 text-xs text-slate-400">Be the first farmer to ask a question!</p>
                <button
                  onClick={openAskComposer}
                  className="mt-4 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-black text-white"
                >
                  {text.askCommunity}
                </button>
              </div>
            ) : (
              posts.map((post) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={post.id}
                  className="rounded-3xl bg-white p-5 shadow-xs border border-slate-200/90 space-y-3"
                >
                  {/* Cross-Region Nudge Banner */}
                  {post.is_cross_region_nudge && (
                    <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1.5 border border-amber-200/80 text-[11px] font-bold text-amber-900">
                      <span className="flex items-center gap-1.5">
                        <span>🌍</span>
                        <span>
                          {isPunjabi ? 'ਦੂਜੇ ਸੂਬੇ ਤੋਂ ਖਾਸ ਸਲਾਹ' : isEnglish ? 'Featured from another state' : 'अन्य राज्य से उपयोगी सलाह'}
                        </span>
                      </span>
                      <span className="text-[10px] text-amber-800 font-extrabold uppercase tracking-wide bg-amber-100/90 px-2 py-0.5 rounded-full">
                        📍 {post.region}
                      </span>
                    </div>
                  )}

                  {/* Author Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-sky-100 font-black text-emerald-900 text-base border border-emerald-200 shrink-0">
                        {post.is_anonymous ? '🌾' : post.author?.[0] || '👨‍🌾'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-black text-slate-900 truncate">{post.author}</span>
                          {post.is_anonymous && (
                            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-800 whitespace-nowrap shrink-0">
                              Anonymous
                            </span>
                          )}
                          {post.is_demo && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 whitespace-nowrap shrink-0">
                              {text.sampleBadge}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400 font-semibold mt-0.5">
                          <span className="flex items-center gap-0.5 whitespace-nowrap text-slate-500">
                            <MapPin size={10} className="text-slate-400 shrink-0" />
                            <span>{post.location}</span>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="whitespace-nowrap text-slate-400">{post.time}</span>
                          {post.region && !post.location.toLowerCase().includes(post.region.toLowerCase()) && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-sky-700 font-bold whitespace-nowrap">📍 {post.region}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete button if owned */}
                    <button
                      onClick={() => deletePost(post.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                      title={text.deleteConfirm}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Post Content */}
                  <p className="text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-line">
                    {post.content}
                  </p>

                  {/* Attached Voice Note Player */}
                  {post.audio_url && (
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Volume2 size={16} className="text-emerald-700" />
                        <span className="text-xs font-bold text-emerald-900">
                          ਆਵਾਜ਼ ਸੰਦੇਸ਼ / Voice Note Attached
                        </span>
                      </div>
                      <audio controls src={post.audio_url} className="h-8 max-w-[180px]" />
                    </div>
                  )}

                  {/* Image/Media */}
                  {post.image && (
                    <div className="overflow-hidden rounded-2xl border border-slate-100">
                      <img src={post.image} alt="Post attachment" className="h-56 w-full object-cover" />
                    </div>
                  )}

                  {/* ── BRIDGE ACTIONS: Sahayak AI + Krishi Expert ── */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => askSahayakBridge(post)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 py-2 text-xs font-black text-sky-800 hover:bg-sky-100 transition-all"
                    >
                      <Bot size={14} className="text-sky-600" />
                      <span>{text.askSahayak}</span>
                    </button>

                    <button
                      onClick={() => callKrishiExpertBridge(post)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100 transition-all"
                    >
                      <Phone size={14} className="text-emerald-600" />
                      <span>{text.callExpert}</span>
                    </button>
                  </div>

                  {/* Footer Stats & Actions */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-4">
                      {/* Like */}
                      <button
                        onClick={() => toggleLike(post.id)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-500"
                      >
                        <Heart
                          size={16}
                          fill={likedPosts.has(post.id) ? '#f43f5e' : 'none'}
                          className={likedPosts.has(post.id) ? 'text-rose-500' : 'text-slate-400'}
                        />
                        <span>{post.likes}</span>
                      </button>

                      {/* Comments count / open drawer */}
                      <button
                        onClick={() => openCommentsDrawer(post)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-sky-600"
                      >
                        <MessageCircle size={16} className="text-slate-400" />
                        <span>{post.comments}</span>
                      </button>

                      {/* Honest Status Badge */}
                      {post.likes < 15 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {text.honestBadgeNew}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 flex items-center gap-1">
                          <Flame size={11} />
                          Active
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => openCommentsDrawer(post)}
                      className="rounded-full px-3.5 py-1 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100"
                    >
                      {text.reply}
                    </button>
                  </div>
                </motion.div>
              ))
            )}

            {/* Echo-chamber protection explore nudge */}
            {preferLocal && posts.length > 0 && (
              <div className="flex items-center justify-between rounded-2xl bg-sky-50 border border-sky-200/80 px-4 py-3 text-xs">
                <div className="flex items-center gap-2 text-sky-950 font-bold">
                  <span className="text-base">🌍</span>
                  <span>
                    {isPunjabi
                      ? 'ਹੋਰ ਸੂਬਿਆਂ ਦੇ ਕਿਸਾਨਾਂ ਦੇ ਤਜ਼ਰਬੇ ਦੇਖੋ'
                      : isEnglish
                      ? 'Explore helpful tips from other states'
                      : 'अन्य राज्यों के किसानों के अनुभव और सलाह देखें'}
                  </span>
                </div>
                <button
                  onClick={() => setPreferLocal(false)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-sky-300 font-black text-sky-800 text-[11px] hover:bg-sky-100 shadow-xs shrink-0"
                >
                  {isPunjabi ? 'ਸਾਰੇ ਦੇਖੋ' : isEnglish ? 'See All India' : 'सभी देखें'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: REELS (BANDWIDTH CONSCIOUS) ── */}
        {activeTab === 'reels' && (
          <div className="space-y-4">
            {/* Data Saver Mode Announcement */}
            <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WifiOff size={16} className="text-amber-700" />
                <span className="text-xs font-bold text-amber-900">
                  {dataSaver ? 'Rural Data Saver Active: Video loads on tap' : 'High Speed Mode'}
                </span>
              </div>
              <button
                onClick={toggleDataSaver}
                className="text-[11px] font-black text-amber-800 underline"
              >
                Change
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reels.map((reel) => (
                <div key={reel.id} className="rounded-3xl bg-white p-3 shadow-xs border border-slate-200 space-y-2">
                  <div className="relative aspect-[9/14] w-full rounded-2xl overflow-hidden bg-slate-900">
                    {/* If playing full video */}
                    {playingVideoId === reel.id && reel.video_url ? (
                      <video
                        src={reel.video_url}
                        controls
                        autoPlay
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      /* Poster with explicit tap-to-play */
                      <div className="relative h-full w-full">
                        <img
                          src={reel.videoThumb || reel.image || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=600'}
                          alt="Reel thumbnail"
                          className="h-full w-full object-cover opacity-85"
                          loading="lazy"
                        />
                        <button
                          onClick={() => setPlayingVideoId(reel.id)}
                          className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40 p-4 text-center group"
                        >
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-xl group-hover:scale-110 transition-transform">
                            <Play size={24} fill="#0f172a" className="ml-1" />
                          </div>
                          <span className="mt-3 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-black text-white backdrop-blur-sm border border-white/20">
                            {text.tapToPlay}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="px-1">
                    <p className="text-xs font-black text-slate-900 flex items-center gap-1">
                      {reel.author}
                      <ShieldCheck size={13} className="text-sky-500" />
                    </p>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">{reel.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: EXPERTS (WITH VERIFIED CREDENTIALS) ── */}
        {activeTab === 'experts' && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-emerald-50 p-4 border border-sky-200">
              <h3 className="text-sm font-black text-slate-900">
                🏛️ ICAR & KVK Verified Agronomist Network
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                All listed experts have verified university degrees, ICAR licenses, or KVK affiliations.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {experts.map((expert, idx) => (
                <div
                  key={expert.id || idx}
                  className="rounded-3xl bg-white p-4 shadow-xs border border-slate-200/90 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-2xl border border-sky-100 shrink-0">
                      {expert.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-black text-slate-900">{expert.name}</h4>
                        <ShieldCheck size={15} className="text-emerald-500 fill-emerald-100" />
                      </div>
                      <p className="text-xs font-medium text-slate-500">{expert.role}</p>

                      {/* Verified Credential Badge (Clickable for verification modal) */}
                      <button
                        onClick={() => {
                          setSelectedExpertForVerification(expert);
                          setIsExpertModalOpen(true);
                        }}
                        className="mt-1.5 flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-black text-sky-800 hover:bg-sky-100 transition-colors"
                      >
                        <Award size={11} className="text-sky-600" />
                        <span>{expert.credential_title || '🏛️ KVK Affiliated Agronomist'}</span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => openCallModal()}
                    className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3.5 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-700 shrink-0"
                  >
                    <Phone size={13} />
                    <span>Call</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── INTERACTIVE COMMENTS DRAWER ── */}
      <AnimatePresence>
        {activeCommentPost && (
          <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-xl rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900">{text.reply}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1">Post: {activeCommentPost.content}</p>
                </div>
                <button
                  onClick={() => setActiveCommentPost(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {isLoadingComments ? (
                  <p className="text-xs text-slate-400 text-center py-6">Loading comments...</p>
                ) : postComments.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No comments yet. Share your experience or advice!
                  </p>
                ) : (
                  postComments.map((com) => (
                    <div key={com.id} className="rounded-2xl bg-slate-50 p-3 border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900">{com.author}</span>
                          {com.is_expert && (
                            <span className="rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2">
                              {com.expert_credential || 'Expert'}
                            </span>
                          )}
                          {com.is_anonymous && (
                            <span className="rounded-md bg-amber-100 text-amber-800 text-[9px] font-bold px-1 py-0.2">
                              Anon
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">{com.time}</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">{com.content}</p>

                      {com.audio_url && (
                        <div className="pt-1">
                          <audio controls src={com.audio_url} className="h-7 w-full max-w-[200px]" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Comment Input Box */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                {/* Voice recorder option */}
                {showVoiceRecorderInComment && (
                  <div className="pb-2">
                    <VoiceNoteRecorder
                      language={langCode}
                      onTranscriptionComplete={(text) => setNewCommentText((prev) => (prev ? `${prev} ${text}` : text))}
                      onAudioRecorded={(url) => setCommentVoiceUrl(url)}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder={text.commentPlaceholder}
                    className="flex-1 rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                  />

                  <button
                    onClick={() => setShowVoiceRecorderInComment(!showVoiceRecorderInComment)}
                    className="p-2.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                    title={text.voiceComment}
                  >
                    <Mic size={16} />
                  </button>

                  <button
                    onClick={handlePostComment}
                    disabled={isSubmittingComment || (!newCommentText.trim() && !commentVoiceUrl)}
                    className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSubmittingComment ? '...' : text.postComment}
                  </button>
                </div>

                {/* Identity / safety line */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCommentAnonymous}
                      onChange={(e) => setIsCommentAnonymous(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span>{text.anonymousComment}</span>
                  </label>
                  <span className="text-[10px] text-emerald-700 font-bold">🛡️ Safety Filter Active</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ASK NETWORK FLOATING BUTTON ── */}
      {activeTab !== 'experts' && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="fixed inset-x-0 z-[70] flex justify-center pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
        >
          <div className="pointer-events-auto w-full max-w-2xl px-4 flex justify-end">
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={openAskComposer}
              className="flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-white shadow-xl shadow-emerald-500/30"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              <PlusCircle size={18} />
              <span>{text.askCommunity}</span>
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* ── MODALS: Pesticide Safety & Expert Verification ── */}
      <PesticideSafetyModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        language={language}
        currentContent={newCommentText}
        violationDetails={safetyViolationData}
        onApplyRevision={(revised) => {
          setNewCommentText(revised);
        }}
      />

      <ExpertVerificationModal
        isOpen={isExpertModalOpen}
        onClose={() => setIsExpertModalOpen(false)}
        expert={selectedExpertForVerification}
        language={language}
      />
    </div>
  );
}
