'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  BarChart3,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Camera,
  ChevronDown,
  Cloud,
  Droplets,
  Headset,
  Leaf,
  Map,
  MapPin,
  PhoneCall,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  TrendingDown,
  TrendingUp,
  Users,
  Wind,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtmosphere } from '@/context/AtmosphericContext';
import { useFarmerProfile } from '@/context/FarmerProfileContext';
import { useLanguage } from '@/context/LanguageContext';
import { formatSoilTypeLabel, normalizeSoilType } from '@/lib/soil';
import { detectFarmerLocation } from '@/lib/locationDetector';
import LocationSwitcherModal from '@/components/LocationSwitcherModal';
import WealthPredictor from '@/components/WealthPredictor';
import FarmerAssistantCard from '@/components/farmer/FarmerAssistantCard';


const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type WeatherData = {
  temperature: string;
  feels_like: string;
  humidity: string;
  wind_speed: string;
  description: string;
  city: string;
  weather_alerts: string[];
  tomorrow_description?: string;
  risk_level?: string;
  risk_score?: number;
};

type ThreatData = {
  disease: string;
  distance_km: number;
  alert_level: string;
  recommendation: string;
  farmer_count: number;
};

type AlertItem = {
  type: 'disease' | 'weather' | 'market' | 'irrigation' | 'roi';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
};

type SubscriptionStatus = {
  plan_code: string;
  plan_name: string;
  status: string;
};

type SmartIrrigationData = {
  crop?: string;
  soil_type?: string;
  recommendation: string;
  irrigation_interval_days: number;
  source?: string;
  soil_moisture_estimate_pct?: number;
  next_irrigation_due_days?: number;
  irrigation_advisory_hindi?: string;
  recommendation_summary?: string;
  week_plan?: Array<{ date: string; action: string; rain_mm: number; note: string }>;
};

type RoiDashboardData = {
  crop: string;
  market: {
    mandi_price_per_kg: number;
    trend: string;
    delta_pct: number;
    insight: string;
  };
  investment: {
    fertilizer_inr: number;
    operations_inr: number;
    total_inr: number;
  };
  income: {
    estimated_yield_kg: number;
    gross_inr: number;
    net_inr: number;
    roi_pct: number;
    margin_pct: number;
  };
};

const cropIcons: Record<string, string> = {
  Wheat: '🌾', Rice: '🌿', Tomato: '🍅', Potato: '🥔',
  Corn: '🌽', Cotton: '☁️', Soybean: '🫘', Sugarcane: '🎋', Default: '🌱',
};

// Crop name translations per language
const cropTranslations: Record<string, Record<string, string>> = {
  'हिंदी': { Wheat: 'गेहूँ', Rice: 'धान', Tomato: 'टमाटर', Potato: 'आलू', Corn: 'मक्का', Cotton: 'कपास', Soybean: 'सोयाबीन', Sugarcane: 'गन्ना' },
  'भोजपुरी': { Wheat: 'गेहूँ', Rice: 'धान', Tomato: 'टमाटर', Potato: 'आलू', Corn: 'मक्का', Cotton: 'कपास' },
  'ਪੰਜਾਬੀ': { Wheat: 'ਕਣਕ', Rice: 'ਝੋਨਾ', Tomato: 'ਟਮਾਟਰ', Potato: 'ਆਲੂ', Corn: 'ਮੱਕੀ', Cotton: 'ਕਪਾਹ' },
  'मैथिली': { Wheat: 'गहूम', Rice: 'धान', Tomato: 'टमाटर', Potato: 'आलू', Corn: 'मकई' },
  'मराठी': { Wheat: 'गहू', Rice: 'भात', Tomato: 'टोमॅटो', Potato: 'बटाटा', Corn: 'मका', Cotton: 'कापूस' },
  'ગુજરાતી': { Wheat: 'ઘઉં', Rice: 'ડાંગ', Tomato: 'ટામેટા', Potato: 'બટાકા', Corn: 'મકાઈ', Cotton: 'કપાસ' },
  'తెలుగు': { Wheat: 'గోధుమ', Rice: 'వరి', Tomato: 'టమాట', Potato: 'బంగాళా', Corn: 'మొక్కజొన్న' },
};

export default function DashboardPage() {
  const { profile, updateProfile } = useFarmerProfile();
  const { healthScore, setHealthScore, isDark } = useAtmosphere();
  const { language, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  );
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [threatAlert, setThreatAlert] = useState<ThreatData | null>(null);
  const [mandiPrice, setMandiPrice] = useState<{ price: string; market?: string; trend: string; status?: 'up' | 'down' | 'stable' } | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [smartIrrigation, setSmartIrrigation] = useState<SmartIrrigationData | null>(null);
  const [roiData, setRoiData] = useState<RoiDashboardData | null>(null);

  const fetchMandiPrices = useCallback(async (crop: string) => {
    try {
      const [priceRes, trendRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/mandi/prices?commodity=${encodeURIComponent(crop)}&limit=1`),
        fetch(`${API_BASE}/api/v1/mandi/trends?commodity=${encodeURIComponent(crop)}`),
      ]);

      if (priceRes.ok) {
        const data = await priceRes.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const item = data.data[0];
          let trendVal = '0.0%';
          let trendStat: 'up' | 'down' | 'stable' = 'stable';

          if (trendRes.ok) {
            const trendData = await trendRes.json();
            const trends = Array.isArray(trendData?.trends)
              ? (trendData.trends as Array<{ commodity?: string; delta_pct?: number; trend?: 'up' | 'down' | 'stable' }>)
              : [];
            const cropTrend = trends.find((t) => (t.commodity || '').toLowerCase() === crop.toLowerCase());
            if (cropTrend) {
              const delta = Number(cropTrend.delta_pct || 0);
              trendVal = `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
              trendStat = cropTrend.trend || 'stable';
            }
          }

          setMandiPrice({
            price: `₹${Number(item.modal_price).toLocaleString('en-IN')}`,
            market: item.market || item.district || '',
            trend: trendVal,
            status: trendStat,
          });
        } else {
          setMandiPrice(null);
        }
      }
    } catch {
      console.warn('Mandi API error');
    }
  }, []);

  const fetchWeatherAndThreats = useCallback(async (lat: number, lon: number) => {
    try {
      const [wRes, tRes, fRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/geo/weather?lat=${lat}&lon=${lon}`),
        fetch(`${API_BASE}/api/v1/geo/threats?lat=${lat}&lon=${lon}&radius=10`),
        fetch(`${API_BASE}/api/v1/geo/forecast?lat=${lat}&lon=${lon}`),
      ]);

      let tomorrowDesc = '';
      if (fRes.ok) {
        const fData = await fRes.json();
        if (fData.success && Array.isArray(fData.forecast) && fData.forecast.length > 1) {
          tomorrowDesc = fData.forecast[1]?.description || fData.forecast[0]?.description || '';
        }
      }

      if (wRes.ok) {
        const wData = await wRes.json();
        const weatherNode = wData?.weather || {};
        const diseaseRisk = weatherNode?.disease_risk || {};
        setWeather({
          temperature: `${Math.round(weatherNode.temperature_c ?? 0)}°C`,
          feels_like: `${Math.round(weatherNode.feels_like_c ?? 0)}°C`,
          humidity: `${Math.round(weatherNode.humidity_pct ?? 0)}%`,
          wind_speed: `${Math.round(weatherNode.wind_kmh ?? 0)} km/h`,
          description: weatherNode.description || 'Weather unavailable',
          city: weatherNode.city || profile.locationLabel || 'Your location',
          weather_alerts: diseaseRisk?.farming_alerts || [],
          tomorrow_description: tomorrowDesc || weatherNode.description || 'Clear sky',
          risk_level: diseaseRisk?.risk_level || 'low',
          risk_score: diseaseRisk?.risk_score ?? 15,
        });
        const riskScore = Number(diseaseRisk?.risk_score || 0);
        setHealthScore(Math.max(45, 100 - riskScore));
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        if (tData.has_threats && tData.threats?.length > 0) {
          setThreatAlert(tData.threats[0]);
        } else {
          setThreatAlert(null);
        }
      }
    } catch {
      console.warn('Weather API unavailable');
    } finally {
      setWeatherLoading(false);
    }
  }, [profile.locationLabel, setHealthScore]);

  const fetchSubscriptionStatus = useCallback(async (userId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/store/subscription/status?user_id=${encodeURIComponent(userId)}`
      );
      if (!response.ok) return;
      const payload = await response.json();
      if (payload?.success) {
        setSubscription({
          plan_code: payload.plan_code || 'basic',
          plan_name: payload.plan_name || 'Basic',
          status: payload.status || 'trial',
        });
      }
    } catch {
      // keep dashboard working even if subscription endpoint is unavailable
    }
  }, []);

  const fetchIntelligenceInsights = useCallback(async (lat: number, lon: number, crop: string) => {
    try {
      const areaAcre = parseFloat(profile.farmSize) || 1;
      const soilType = normalizeSoilType(profile.soilType);
      const [irrigationRes, roiRes] = await Promise.all([
        fetch(
          `${API_BASE}/api/v1/intelligence/smart-irrigation?crop=${encodeURIComponent(
            crop
          )}&soil_type=${encodeURIComponent(soilType)}&lat=${lat}&lon=${lon}`
        ),
        fetch(
          `${API_BASE}/api/v1/intelligence/roi-dashboard?crop=${encodeURIComponent(
            crop
          )}&area_acres=${areaAcre}&soil_type=${encodeURIComponent(soilType)}&growth_stage=vegetative`
        ),
      ]);

      if (irrigationRes.ok) {
        const irrigationPayload = await irrigationRes.json();
        if (irrigationPayload?.success) {
          setSmartIrrigation(irrigationPayload);
        }
      }

      if (roiRes.ok) {
        const roiPayload = await roiRes.json();
        if (roiPayload?.success) {
          setRoiData(roiPayload);
        }
      }
    } catch {
      // keep dashboard resilient if intelligence APIs are not reachable
    }
  }, [profile.farmSize, profile.soilType]);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setHealthScore(85 + (Math.random() * 5)); // Dynamic base health
    const update = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    const timer = setInterval(update, 60000);

    const derivedUserId = `${profile.name || 'farmer'}-${profile.locationLabel || 'india'}`
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 60);
    void fetchSubscriptionStatus(derivedUserId);

    // Multi-tier Real Location Detection: GPS -> IP -> Profile -> Manual Prompt
    void (async () => {
      const detection = await detectFarmerLocation(profile, true);
      if (detection.success) {
        if (detection.latitude != null && detection.longitude != null) {
          setLat(detection.latitude);
          setLon(detection.longitude);
          void fetchWeatherAndThreats(detection.latitude, detection.longitude);
        }
        if (detection.locationLabel && detection.locationLabel !== profile.locationLabel) {
          updateProfile({
            locationLabel: detection.locationLabel,
            village: detection.village || profile.village,
            state: detection.state || profile.state,
            latitude: detection.latitude ?? profile.latitude,
            longitude: detection.longitude ?? profile.longitude,
            locationAllowed: detection.locationSource === 'gps',
            locationSource: detection.locationSource,
            isApproximateLocation: detection.isApproximateLocation,
          });
        }
      } else {
        // If neither GPS nor IP nor profile location exists, prompt modal
        if (!profile.locationLabel && !profile.latitude) {
          setIsLocationModalOpen(true);
        }
      }
    })();

    return () => clearInterval(timer);
  }, [setHealthScore, fetchWeatherAndThreats, fetchSubscriptionStatus, profile.name, profile.locationLabel, profile.village, profile.state, profile.latitude, profile.longitude, updateProfile]);

  // Refetch crop-specific data whenever the activeCrop or location changes
  useEffect(() => {
    const activeCrop = profile.activeCrop || profile.crops?.[0] || 'Wheat';
    fetchMandiPrices(activeCrop);
    const resolvedLat = lat ?? profile.latitude ?? null;
    const resolvedLon = lon ?? profile.longitude ?? null;
    if (resolvedLat !== null && resolvedLon !== null) {
      void fetchIntelligenceInsights(resolvedLat, resolvedLon, activeCrop);
    }
  }, [profile.activeCrop, profile.crops, lat, lon, profile.latitude, profile.longitude, fetchMandiPrices, fetchIntelligenceInsights]);


  const firstName = useMemo(() => profile.name.split(' ')[0] || 'Kishan', [profile.name]);

  // ── Language-aware strings ────────────────────────────────
  type LangStrings = {
    greeting: ((args: { h: number }) => string) | string; copilot: string; tagline: string; subtitle: string;
    farmHealth: string; activeFields: string; watchAlerts: string;
    scanBtn: string; weather: string; sunny: string; rustRisk: string;
    wind: string; humidity: string; tomorrow: string; lightRain: string;
    actionCenter: string; tools: string;
    soilHealth: string; soilSub: string; fertPlan: string; fertSub: string;
    agriStore: string; agriSub: string; farmerNet: string; farmerSub: string;
    aiDiag: string; scanHeadline: string; scanSub: string; takePic: string;
    marketIntel: string; live: string; pricesSell: string; priceDown: string; perQuintal: string;
    highRust: string; rustMsg: string; rainAlert: string; rainMsg: string;
  };
  const L: Record<string, LangStrings> = {
    English: {
      greeting: ({ h }: { h: number }) => h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening',
      copilot: 'Plant Doctor Copilot', tagline: 'Premium crop intelligence', subtitle: 'Diagnose disease, track field risk, and connect farmers to trusted experts from one mobile-first workspace.',
      farmHealth: 'Field Condition', activeFields: 'Fields Watched', watchAlerts: 'Important Alerts',
      scanBtn: 'Take a Picture', weather: 'Field Weather', sunny: 'Sunny sky · mild breeze', rustRisk: 'Rust Risk',
      wind: 'Wind', humidity: 'Humidity', tomorrow: 'Tomorrow', lightRain: 'Light Rain',
      actionCenter: 'Action Center', tools: 'Tools',
      soilHealth: 'Soil Health', soilSub: 'NPK, pH and moisture',
      fertPlan: 'Fertilizer Plan', fertSub: 'Exact dosage by acreage',
      agriStore: 'Agri Store', agriSub: 'Inputs, rentals, packs',
      farmerNet: 'Farmer Network', farmerSub: 'Ask local experts',
      aiDiag: 'AI Diagnosis', scanHeadline: 'Scan once, get diagnosis and treatment instantly.',
      scanSub: 'Camera-first diagnosis with confidence score, treatment path, dosage calculation, and multilingual report.',
      takePic: 'Take a Picture',
      marketIntel: 'Market Intel', live: 'Wheat • Live', pricesSell: 'SELL', priceDown: 'Prices dropping by ₹120/q', perQuintal: 'per quintal',
      highRust: 'High Rust Fungi Risk', rustMsg: 'Ideal conditions for rust detected. Apply protective spray before 4 PM.',
      rainAlert: 'Rain Expected at 4 PM', rainMsg: 'Complete irrigation cycle early and keep fungicide ready.',
    },
    'हिंदी': {
      greeting: ({ h }: { h: number }) => h < 12 ? 'सुप्रभात' : h < 17 ? 'नमस्कार' : 'शुभ संध्या',
      copilot: 'प्लांट डॉक्टर सहायक', tagline: 'उन्नत फसल जानकारी', subtitle: 'रोग पहचानें, खेत का जोखिम ट्रैक करें, और विशेषज्ञों से जुड़ें — एक जगह।',
      farmHealth: 'खेत की हालत', activeFields: 'नज़र में खेत', watchAlerts: 'ज़रूरी सूचनाएं',
      scanBtn: 'तस्वीर लें', weather: 'खेत का मौसम', sunny: 'साफ आसमान · हल्की हवा', rustRisk: 'रतुआ जोखिम',
      wind: 'हवा', humidity: 'नमी', tomorrow: 'कल', lightRain: 'हल्की बारिश',
      actionCenter: 'कार्य केंद्र', tools: 'औजार',
      soilHealth: 'मिट्टी स्वास्थ्य', soilSub: 'NPK, pH और नमी',
      fertPlan: 'खाद योजना', fertSub: 'एकड़ के हिसाब से सटीक मात्रा',
      agriStore: 'कृषि स्टोर', agriSub: 'इनपुट, किराया, पैक',
      farmerNet: 'किसान नेटवर्क', farmerSub: 'स्थानीय विशेषज्ञ से पूछें',
      aiDiag: 'AI जाँच', scanHeadline: 'एक बार स्कैन करें, तुरंत निदान पाएं।',
      scanSub: 'कैमरा से जाँच, विश्वास स्कोर, उपचार, खुराक और बहुभाषी रिपोर्ट।',
      takePic: 'तस्वीर खींचें',
      marketIntel: 'मंडी भाव', live: 'गेहूँ • लाइव', pricesSell: 'बेचें', priceDown: '₹120/क्विंटल गिरावट', perQuintal: 'प्रति क्विंटल',
      highRust: 'रतुआ रोग का उच्च खतरा', rustMsg: 'रतुआ के अनुकूल परिस्थितियाँ। शाम 4 बजे से पहले सुरक्षात्मक स्प्रे करें।',
      rainAlert: 'शाम 4 बजे बारिश संभव', rainMsg: 'सिंचाई जल्दी पूरी करें और फफूंदनाशक तैयार रखें।',
    },
    'भोजपुरी': {
      greeting: ({ h }: { h: number }) => h < 12 ? 'प्रणाम' : h < 17 ? 'नमस्कार' : 'शुभ संझा',
      copilot: 'प्लांट डॉक्टर सहायक', tagline: 'उन्नत फसल जानकारी', subtitle: 'रोग पहचानीं, खेत के खतरा ट्रैक करीं, आउर विशेषज्ञ से जुड़ीं — एक जगह।',
      farmHealth: 'खेत के हालत', activeFields: 'खेत नजर में', watchAlerts: 'जरूरी सूचना',
      scanBtn: 'तस्वीर खींचीं', weather: 'खेत के मौसम', sunny: 'साफ़ आसमान · हल्की हवा', rustRisk: 'रतुआ खतरा',
      wind: 'हवा', humidity: 'नमी', tomorrow: 'काल्ह', lightRain: 'हल्की बरखा',
      actionCenter: 'काम केंद्र', tools: 'औजार',
      soilHealth: 'मिट्टी स्वास्थ्य', soilSub: 'NPK, pH आउर नमी',
      fertPlan: 'खाद योजना', fertSub: 'एकड़ के हिसाब से सही मात्रा',
      agriStore: 'कृषि दुकान', agriSub: 'इनपुट, किराया, पैक',
      farmerNet: 'किसान नेटवर्क', farmerSub: 'स्थानीय विशेषज्ञ से पूछीं',
      aiDiag: 'AI जाँच', scanHeadline: 'एक बेर स्कैन करीं, तुरंत इलाज पाईं।',
      scanSub: 'कैमरे से जाँच, विश्वास स्कोर, इलाज आउर रिपोर्ट।',
      takePic: 'तस्वीर खींचीं',
      marketIntel: 'मंडी भाव', live: 'गेहूँ • लाइव', pricesSell: 'बेचीं', priceDown: '₹120/क्विंटल गिरावट', perQuintal: 'प्रति क्विंटल',
      highRust: 'रतुआ रोग के उच्च खतरा', rustMsg: 'रतुआ के अनुकूल परिस्थिति बा। शाम 4 बजे से पहले स्प्रे करीं।',
      rainAlert: 'शाम 4 बजे बरखा संभव', rainMsg: 'सिंचाई जल्दी पूरा करीं आउर फफूंदनाशक तैयार रखीं।',
    },
    'ਪੰਜਾਬੀ': {
      greeting: ({ h }: { h: number }) => h < 12 ? 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ' : h < 17 ? 'ਨਮਸਕਾਰ' : 'ਸ਼ੁਭ ਸ਼ਾਮ',
      copilot: 'ਪਲਾਂਟ ਡਾਕਟਰ ਮਦਦਗਾਰ', tagline: 'ਪ੍ਰੀਮੀਅਮ ਫਸਲ ਜਾਣਕਾਰੀ', subtitle: 'ਰੋਗ ਪਛਾਣੋ, ਖੇਤ ਖਤਰਾ ਟ੍ਰੈਕ ਕਰੋ, ਮਾਹਰਾਂ ਨਾਲ ਜੁੜੋ।',
      farmHealth: 'ਖੇਤ ਦੀ ਹਾਲਤ', activeFields: 'ਨਜ਼ਰ ਵਿੱਚ ਖੇਤ', watchAlerts: 'ਜ਼ਰੂਰੀ ਸੂਚਨਾ',
      scanBtn: 'ਫੋਟੋ ਖਿੱਚੋ', weather: 'ਖੇਤ ਦਾ ਮੌਸਮ', sunny: 'ਸਾਫ਼ ਅਸਮਾਨ · ਹਲਕੀ ਹਵਾ', rustRisk: 'ਰਸਟ ਖਤਰਾ',
      wind: 'ਹਵਾ', humidity: 'ਨਮੀ', tomorrow: 'ਕੱਲ੍ਹ', lightRain: 'ਹਲਕੀ ਬਾਰਿਸ਼',
      actionCenter: 'ਕਾਰਜ ਕੇਂਦਰ', tools: 'ਸੰਦ',
      soilHealth: 'ਮਿੱਟੀ ਸਿਹਤ', soilSub: 'NPK, pH ਅਤੇ ਨਮੀ',
      fertPlan: 'ਖਾਦ ਯੋਜਨਾ', fertSub: 'ਏਕੜ ਅਨੁਸਾਰ ਸਹੀ ਮਾਤਰਾ',
      agriStore: 'ਖੇਤੀ ਦੁਕਾਨ', agriSub: 'ਖਾਦ, ਕਿਰਾਇਆ, ਪੈਕ',
      farmerNet: 'ਕਿਸਾਨ ਨੈੱਟਵਰਕ', farmerSub: 'ਸਥਾਨਕ ਮਾਹਰ ਤੋਂ ਪੁੱਛੋ',
      aiDiag: 'AI ਜਾਂਚ', scanHeadline: 'ਇੱਕ ਵਾਰ ਸਕੈਨ ਕਰੋ, ਤੁਰੰਤ ਨਤੀਜਾ ਪਾਓ।',
      scanSub: 'ਕੈਮਰੇ ਨਾਲ ਜਾਂਚ, ਭਰੋਸਾ ਸਕੋਰ, ਇਲਾਜ, ਅਤੇ ਬਹੁਭਾਸ਼ੀ ਰਿਪੋਰਟ।',
      takePic: 'ਫੋਟੋ ਖਿੱਚੋ',
      marketIntel: 'ਮੰਡੀ ਭਾਅ', live: 'ਕਣਕ • ਲਾਈਵ', pricesSell: 'ਵੇਚੋ', priceDown: '₹120/ਕੁਇੰਟਲ ਗਿਰਾਵਟ', perQuintal: 'ਪ੍ਰਤੀ ਕੁਇੰਟਲ',
      highRust: 'ਰਸਟ ਫੰਗਸ ਦਾ ਉੱਚ ਖਤਰਾ', rustMsg: 'ਰਸਟ ਲਈ ਅਨੁਕੂਲ ਸਥਿਤੀਆਂ। ਸ਼ਾਮ 4 ਵਜੇ ਤੋਂ ਪਹਿਲਾਂ ਸਪ੍ਰੇ ਕਰੋ।',
      rainAlert: 'ਸ਼ਾਮ 4 ਵਜੇ ਬਾਰਿਸ਼ ਸੰਭਵ', rainMsg: 'ਸਿੰਚਾਈ ਜਲਦੀ ਪੂਰੀ ਕਰੋ ਅਤੇ ਉੱਲੀਨਾਸ਼ਕ ਤਿਆਰ ਰੱਖੋ।',
    },
    'मैथिली': {
      greeting: ({ h }: { h: number }) => h < 12 ? 'प्रणाम' : h < 17 ? 'नमस्कार' : 'शुभ संझा',
      copilot: 'प्लांट डॉक्टर सहायक', tagline: 'उन्नत फसल जानकारी', subtitle: 'रोग पहचानीं, खेत जोखिम ट्रैक करीं, आउर विशेषज्ञ सँ जुड़ीं।',
      farmHealth: 'खेत के हालत', activeFields: 'खेत नजर में', watchAlerts: 'जरूरी खबर',
      scanBtn: 'तस्वीर लीं', weather: 'खेत मौसम', sunny: 'साफ आकाश · हल्की हवा', rustRisk: 'रतुआ खतरा',
      wind: 'हवा', humidity: 'नमी', tomorrow: 'काल्हि', lightRain: 'हल्की वर्षा',
      actionCenter: 'काज केंद्र', tools: 'औजार',
      soilHealth: 'माटि स्वास्थ्य', soilSub: 'NPK, pH आउर नमी',
      fertPlan: 'खाद योजना', fertSub: 'एकड़ अनुसार सही मात्रा',
      agriStore: 'कृषि दुकान', agriSub: 'इनपुट, किराया, पैक',
      farmerNet: 'किसान नेटवर्क', farmerSub: 'स्थानीय विशेषज्ञ सँ पूछीं',
      aiDiag: 'AI जाँच', scanHeadline: 'एक बेर स्कैन करीं, तुरंत इलाज पाबीं।',
      scanSub: 'कैमरा सँ जाँच, विश्वास स्कोर, इलाज, आउर रिपोर्ट।',
      takePic: 'तस्वीर लीं',
      marketIntel: 'मंडी भाव', live: 'गहूम • लाइव', pricesSell: 'बेचीं', priceDown: '₹120/क्विंटल गिरावट', perQuintal: 'प्रति क्विंटल',
      highRust: 'रतुआ रोग के उच्च खतरा', rustMsg: 'रतुआ के अनुकूल स्थिति। शाम 4 बजे पहिने स्प्रे करीं।',
      rainAlert: 'शाम 4 बजे वर्षा संभव', rainMsg: 'सिंचाई जल्दी पूरा करीं आउर फफूंदनाशक तैयार रखीं।',
    },
    'मराठी': {
      greeting: ({ h }: { h: number }) => h < 12 ? 'सुप्रभात' : h < 17 ? 'नमस्कार' : 'शुभ संध्या',
      copilot: 'प्लांट डॉक्टर सहायक', tagline: 'उत्तम पीक माहिती', subtitle: 'रोग ओळखा, शेत धोका ट्रॅक करा, आणि तज्ञांशी जोडा — एका ठिकाणी।',
      farmHealth: 'शेताची स्थिती', activeFields: 'लक्ष ठेवलेली शेते', watchAlerts: 'महत्त्वाचे इशारे',
      scanBtn: 'फोटो काढा', weather: 'शेताचे हवामान', sunny: 'स्वच्छ आकाश · सौम्य वारा', rustRisk: 'गंज धोका',
      wind: 'वारा', humidity: 'आर्द्रता', tomorrow: 'उद्या', lightRain: 'हलका पाऊस',
      actionCenter: 'कृती केंद्र', tools: 'साधने',
      soilHealth: 'माती आरोग्य', soilSub: 'NPK, pH आणि ओलावा',
      fertPlan: 'खत योजना', fertSub: 'एकरानुसार अचूक मात्रा',
      agriStore: 'कृषी दुकान', agriSub: 'निविष्ठा, भाडे, पॅक',
      farmerNet: 'शेतकरी नेटवर्क', farmerSub: 'स्थानिक तज्ञांना विचारा',
      aiDiag: 'AI निदान', scanHeadline: 'एकदा स्कॅन करा, लगेच उपचार मिळवा।',
      scanSub: 'कॅमेऱ्याने निदान, विश्वास स्कोर, उपचार आणि अहवाल.',
      takePic: 'फोटो काढा',
      marketIntel: 'बाजार भाव', live: 'गहू • लाइव्ह', pricesSell: 'विका', priceDown: '₹120/क्विंटल घसरण', perQuintal: 'प्रति क्विंटल',
      highRust: 'गंज बुरशीचा उच्च धोका', rustMsg: 'गंजासाठी अनुकूल परिस्थिती. संध्याकाळी 4 पूर्वी फवारणी करा.',
      rainAlert: 'संध्याकाळी 4 वाजता पाऊस संभव', rainMsg: 'सिंचन लवकर पूर्ण करा आणि बुरशीनाशक तयार ठेवा.',
    },
    'ગુજરાતી': {
      greeting: ({ h }: { h: number }) => h < 12 ? 'સુપ્રભાત' : h < 17 ? 'નમસ્કાર' : 'શુભ સંધ્યા',
      copilot: 'પ્લાન્ટ ડૉક્ટર સહાયક', tagline: 'ઉત્તમ પાક માહિતી', subtitle: 'રોગ ઓળખો, ખેતર જોખમ ટ્રૅક કરો, અને નિષ્ણાતો સાથે જોડાઓ — એક જગ્યાએ।',
      farmHealth: 'ખેતરની હાલત', activeFields: 'નજર હેઠળ ખેતર', watchAlerts: 'જરૂरी ચેતવણી',
      scanBtn: 'ફોટો પાડો', weather: 'ખેતનું હવામાન', sunny: 'સ્વચ્છ આકાશ · સૌમ્ય પવન', rustRisk: 'કળ ખતરો',
      wind: 'પવન', humidity: 'ભેજ', tomorrow: 'આવતીકાલ', lightRain: 'હળવો વરસાદ',
      actionCenter: 'ક્રિયા કેન્દ્ર', tools: 'સાધનો',
      soilHealth: 'જમીન આરોગ્ય', soilSub: 'NPK, pH અને ભેજ',
      fertPlan: 'ખાતર યોજના', fertSub: 'એકર અનુસાર સચોટ માત્રા',
      agriStore: 'કૃષિ દુકાન', agriSub: 'ઇનપુટ, ભાડું, પૅક',
      farmerNet: 'ખેડૂત નેટવર્ક', farmerSub: 'સ્થાનિક નિષ્ણાતને પૂછો',
      aiDiag: 'AI નિદાન', scanHeadline: 'એક વાર સ્કૅન કરો, તરત ઉપચાર મળો।',
      scanSub: 'કૅમેરાથી નિદાન, વિશ્વાસ સ્કોર, ઉપચાર અને અહેવાલ.',
      takePic: 'ફોટો પાડો',
      marketIntel: 'બજાર ભાવ', live: 'ઘઉં • લાઇવ', pricesSell: 'વેચો', priceDown: '₹120/ક્વિન્ટલ ઘટાડો', perQuintal: 'પ્રતિ ક્વિન્ટલ',
      highRust: 'કળ ફૂગ નો ઉચ્ચ ખતરો', rustMsg: 'કળ માટે અનુકૂળ સ્થિતિ. સાંજે 4 પહેલા છંટકાવ કરો.',
      rainAlert: 'સાંજે 4 વાગ્યે વરસાદ સંભવ', rainMsg: 'સિંચાઈ વહેલી પૂર્ણ કરો અને ફૂગનાશક તૈયાર રાખો.',
    },
    'తెలుగు': {
      greeting: ({ h }: { h: number }) => h < 12 ? 'శుభోదయం' : h < 17 ? 'నమస్కారం' : 'శుభ సాయంత్రం',
      copilot: 'ప్లాంట్ డాక్టర్ సహాయకుడు', tagline: 'అత్యుత్తమ పంట సమాచారం', subtitle: 'వ్యాధి గుర్తించండి, పొల ప్రమాదం ట్రాక్ చేయండి, నిపుణులతో అనుసంధానం అవ్వండి।',
      farmHealth: 'పొల పరిస్థితి', activeFields: 'పొలాలు పర్యవేక్షణలో', watchAlerts: 'ముఖ్యమైన హెచ్చరికలు',
      scanBtn: 'ఫోటో తీయండి', weather: 'పొల వాతావరణం', sunny: 'స్వచ్ఛమైన ఆకాశం · మందమైన గాలి', rustRisk: 'తుప్పు ప్రమాదం',
      wind: 'గాలి', humidity: 'తేమ', tomorrow: 'రేపు', lightRain: 'తేలికపాటి వర్షం',
      actionCenter: 'చర్య కేంద్రం', tools: 'పరికరాలు',
      soilHealth: 'నేల ఆరోగ్యం', soilSub: 'NPK, pH మరియు తేమ',
      fertPlan: 'ఎరువు పథకం', fertSub: 'ఎకరాకు సరైన మోతాదు',
      agriStore: 'వ్యవసాయ దుకాణం', agriSub: 'ఇన్‌పుట్లు, అద్దె, ప్యాక్లు',
      farmerNet: 'రైతు నెట్‌వర్క్', farmerSub: 'స్థానిక నిపుణులను అడగండి',
      aiDiag: 'AI నిర్ధారణ', scanHeadline: 'ఒక్కసారి స్కా్ న్ చేయండి, వెంటనే చికిత్స పొందండి।',
      scanSub: 'కెమెరాతో నిర్ధారణ, నమ్మకం స్కోరు, చికిత్స మరియు నివేదిక.',
      takePic: 'ఫోటో తీయండి',
      marketIntel: 'మార్కెట్ ధరలు', live: 'గోధుమ • లైవ్', pricesSell: 'అమ్మండి', priceDown: '₹120/క్వింటాల్ తగ్గింపు', perQuintal: 'క్వింటాల్‌కు',
      highRust: 'తుప్పు శిలీంధ్రం అధిక ప్రమాదం', rustMsg: 'తుప్పుకు అనుకూల పరిస్థితులు. సాయంత్రం 4 లోపు పిచికారీ చేయండి.',
      rainAlert: 'సాయంత్రం 4కి వర్షం సంభావ్యత', rainMsg: 'నీటిపారుదల త్వరగా పూర్తి చేయండి మరియు శీలీంద్రనాశినిని సిద్ధం చేయండి.',
    },
  };

  const T = L[language] ?? L['English'];
  const isEnglish = language === 'English';
  const soilTypeLabel = useMemo(() => formatSoilTypeLabel(profile.soilType), [profile.soilType]);
  const hour = new Date().getHours();
  const greeting = typeof T.greeting === 'function' ? (T.greeting as (args: { h: number }) => string)({ h: hour }) : T.greeting;

  const cropList = useMemo(
    () => (profile.crops?.length ? profile.crops : ['Wheat', 'Rice', 'Tomato', 'Potato', 'Corn', 'Cotton', 'Soybean', 'Sugarcane']),
    [profile.crops]
  );
  const activeCrop = profile.activeCrop || cropList[0];
  const displayCrop = !isEnglish && cropTranslations[language]?.[activeCrop] ? cropTranslations[language][activeCrop] : activeCrop;
  const alerts: AlertItem[] = useMemo(() => {
    const items: AlertItem[] = [];

    // ── 1. REAL Disease & Pest Outbreak Threat (from community scans or live weather fungal model) ──
    if (threatAlert) {
      items.push({
        type: 'disease',
        title: `${threatAlert.disease.replace(/_/g, ' ')} (${threatAlert.alert_level.toUpperCase()})`,
        message: isEnglish
          ? `${threatAlert.farmer_count} field report(s) within ${threatAlert.distance_km.toFixed(1)} km. ${threatAlert.recommendation}`
          : `${threatAlert.distance_km.toFixed(1)} किमी में ${threatAlert.farmer_count} मामले दर्ज। ${threatAlert.recommendation}`,
        priority: threatAlert.alert_level === 'high' ? 'high' : 'medium',
      });
    } else if (weather?.weather_alerts && weather.weather_alerts.length > 0) {
      items.push({
        type: 'disease',
        title: isEnglish ? 'Meteorological Crop Risk' : 'मौसम आधारित फसल जोखिम',
        message: weather.weather_alerts[0],
        priority: 'medium',
      });
    } else {
      items.push({
        type: 'disease',
        title: isEnglish ? `Crop Health Status • ${displayCrop}` : `फसल स्वास्थ्य स्थिति • ${displayCrop}`,
        message: isEnglish
          ? `Zero active pest outbreaks within 10 km of ${profile.locationLabel || weather?.city || 'your field'}. Current weather (${weather?.temperature || '28°C'}, humidity ${weather?.humidity || '60%'}) is optimal.`
          : `${profile.locationLabel || weather?.city || 'आपके क्षेत्र'} के 10 किमी में कोई सक्रिय कीट प्रकोप नहीं है। वर्तमान मौसम (${weather?.temperature || '28°C'}, नमी ${weather?.humidity || '60%'}) फसल के अनुकूल है।`,
        priority: 'low',
      });
    }

    // ── 2. REAL Live Weather Operational Advisory (from OpenWeather) ──
    if (weather?.weather_alerts && weather.weather_alerts.length > 1) {
      items.push({
        type: 'weather',
        title: isEnglish ? `Weather Warning • ${weather?.city || 'Local'}` : `मौसम चेतावनी • ${weather?.city || 'स्थानीय'}`,
        message: weather.weather_alerts[1],
        priority: 'medium',
      });
    } else if (weather) {
      items.push({
        type: 'weather',
        title: isEnglish ? `Field Operations Weather • ${weather.city || profile.locationLabel || 'Local'}` : `खेत कार्य मौसम • ${weather.city || profile.locationLabel || 'स्थानीय'}`,
        message: isEnglish
          ? `Condition: ${weather.description} · Temp: ${weather.temperature} (Feels ${weather.feels_like}) · Wind: ${weather.wind_speed} · Humidity: ${weather.humidity}. Good for field operations.`
          : `मौसम: ${weather.description} · तापमान: ${weather.temperature} · हवा: ${weather.wind_speed} · नमी: ${weather.humidity}। खेत कार्य व निगरानी के लिए उपयुक्त।`,
        priority: 'low',
      });
    }

    // ── 3. REAL Live Mandi Price & Market Trends (from Agmarknet / live mandi feed) ──
    if (mandiPrice) {
      const marketLabel = mandiPrice.market ? ` (${mandiPrice.market})` : '';
      items.push({
        type: 'market',
        title: `${isEnglish ? 'Live Mandi Rate' : 'लाइव मंडी भाव'} • ${displayCrop}${marketLabel}`,
        message: isEnglish
          ? `Modal Price: ${mandiPrice.price}/quintal (${mandiPrice.trend}). ${mandiPrice.status === 'up' ? 'Price gaining momentum — good window for spot dispatch.' : mandiPrice.status === 'down' ? 'Downside pressure noted across regional markets.' : 'Stable rate across regional mandis.'}`
          : `मॉडल भाव: ${mandiPrice.price}/क्विंटल (${mandiPrice.trend})। ${mandiPrice.status === 'up' ? 'दाम में तेजी — बिक्री के लिए उपयुक्त अवसर।' : mandiPrice.status === 'down' ? 'मंडी में नरमी का रुख।' : 'क्षेत्रीय मंडियों में भाव स्थिर बने हुए हैं।'}`,
        priority: mandiPrice.status === 'down' ? 'medium' : 'low',
      });
    } else {
      items.push({
        type: 'market',
        title: `${isEnglish ? 'Mandi Intelligence' : 'मंडी भाव'} • ${displayCrop}`,
        message: isEnglish
          ? `Connecting to agricultural market feed for ${displayCrop}...`
          : `${displayCrop} के लिए लाइव मंडी डेटा सिंक किया जा रहा है...`,
        priority: 'low',
      });
    }

    if (smartIrrigation) {
      const intervalDays = smartIrrigation.irrigation_interval_days || 3;
      const irrigationMsg = smartIrrigation.recommendation
        ? (!isEnglish && smartIrrigation.irrigation_advisory_hindi ? smartIrrigation.irrigation_advisory_hindi : smartIrrigation.recommendation)
        : isEnglish
        ? `Recommended irrigation cycle: every ${intervalDays} days based on field soil moisture.`
        : `मिट्टी की नमी के अनुसार हर ${intervalDays} दिन में सिंचाई की सलाह दी जाती है।`;

      items.push({
        type: 'irrigation',
        title: isEnglish ? `Smart Irrigation • ${smartIrrigation.crop || activeCrop}` : `स्मार्ट सिंचाई सलाह • ${smartIrrigation.crop || activeCrop}`,
        message: irrigationMsg,
        priority: 'low',
      });
    } else if (roiData) {
      const netProfit = Math.round(roiData.income?.net_inr || 0).toLocaleString('en-IN');
      const roiPct = roiData.income?.roi_pct || 0;
      const farmAcres = profile.farmSize || '1';

      items.push({
        type: 'roi',
        title: isEnglish ? `ROI Forecast • ${roiData.crop || activeCrop}` : `आय पूर्वानुमान • ${roiData.crop || activeCrop}`,
        message: isEnglish
          ? `Projected Net Profit: ₹${netProfit} (ROI: ${roiPct}%) for ${farmAcres} acre.`
          : `अनुमानित शुद्ध लाभ: ₹${netProfit} (ROI: ${roiPct}%) प्रति ${farmAcres} एकड़।`,
        priority: 'low',
      });
    }

    return items.slice(0, 4);
  }, [
    threatAlert,
    weather,
    mandiPrice,
    smartIrrigation,
    roiData,
    activeCrop,
    displayCrop,
    profile.locationLabel,
    profile.farmSize,
    profile.soilType,
    isEnglish,
  ]);

  const roiShareHref = useMemo(() => {
    if (!roiData) return '/community/ask';
    const lines = isEnglish
      ? [
          `Expected ROI update for ${roiData.crop}:`,
          `Soil: ${soilTypeLabel}`,
          `Investment: ₹${Math.round(roiData.investment.total_inr).toLocaleString('en-IN')}`,
          `Expected income: ₹${Math.round(roiData.income.gross_inr).toLocaleString('en-IN')}`,
          `Net profit: ₹${Math.round(roiData.income.net_inr).toLocaleString('en-IN')}`,
          `ROI: ${roiData.income.roi_pct}%`,
          `Mandi trend: ${roiData.market.trend} (${roiData.market.delta_pct}%)`,
          'Any practical suggestions to improve this plan?',
        ]
      : [
          `${roiData.crop} के लिए Expected ROI शेयर कर रहा/रही हूँ:`,
          `मिट्टी: ${soilTypeLabel}`,
          `कुल निवेश: ₹${Math.round(roiData.investment.total_inr).toLocaleString('en-IN')}`,
          `अनुमानित आय: ₹${Math.round(roiData.income.gross_inr).toLocaleString('en-IN')}`,
          `अनुमानित लाभ: ₹${Math.round(roiData.income.net_inr).toLocaleString('en-IN')}`,
          `ROI: ${roiData.income.roi_pct}%`,
          `मंडी ट्रेंड: ${roiData.market.trend} (${roiData.market.delta_pct}%)`,
          'इस ROI को बेहतर बनाने के लिए आपकी क्या सलाह है?',
        ];

    const params = new URLSearchParams({
      crop: roiData.crop,
      template: 'roi',
      prefill_question: isEnglish ? 'Please review my expected ROI.' : 'मेरे expected ROI को review करें।',
      prefill: lines.join('\n'),
    });
    return `/community/ask?${params.toString()}`;
  }, [isEnglish, roiData, soilTypeLabel]);

  const toolCards = [
    { href: '/mandi', icon: BarChart3, label: T.marketIntel as string, sub: T.live as string, gradient: 'from-emerald-400 to-teal-500', shadow: 'rgba(16,185,129,0.3)' },
    { href: '/soil', icon: Map, label: T.soilHealth as string, sub: T.soilSub as string, gradient: 'from-amber-400 to-orange-500', shadow: 'rgba(245,158,11,0.3)' },
    { href: '/calendar', icon: Droplets, label: T.fertPlan as string, sub: T.fertSub as string, gradient: 'from-sky-400 to-blue-500', shadow: 'rgba(14,165,233,0.3)' },
    { href: '/marketplace', icon: ShoppingBag, label: T.agriStore as string, sub: T.agriSub as string, gradient: 'from-indigo-400 to-purple-500', shadow: 'rgba(99,102,241,0.3)' },
    { href: '/community', icon: Users, label: T.farmerNet as string, sub: T.farmerSub as string, gradient: 'from-rose-400 to-pink-500', shadow: 'rgba(244,63,94,0.3)' },
  ];

  if (!mounted) {
    return <div className="min-h-screen bg-[#f8fafc]" />;
  }

  return (
    <div
      className="min-h-full space-y-5 px-4 pb-6 sm:pb-8 pt-5 text-slate-800 dark:text-slate-100 relative"
      style={{
        background: isDark
          ? 'transparent'
          : 'radial-gradient(ellipse 90% 45% at 85% -5%, rgba(254, 215, 170, 0.45) 0%, transparent 70%), radial-gradient(ellipse 75% 55% at 10% 35%, rgba(209, 250, 229, 0.42) 0%, transparent 70%), radial-gradient(ellipse 85% 50% at 90% 75%, rgba(254, 205, 211, 0.35) 0%, transparent 70%), linear-gradient(180deg, rgba(253, 246, 240, 0.6) 0%, transparent 350px)'
      }}
    >

      {/* ── Greeting row ─────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-emerald-600/80 mb-1" suppressHydrationWarning>{greeting}</p>
          <h1 className="text-[2.2rem] font-black tracking-tight text-slate-900 leading-none" suppressHydrationWarning>{firstName}</h1>
          <div className="mt-2.5 flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(8);
                setIsLocationModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200 shadow-sm ring-1 ring-slate-900/10 dark:ring-white/10 hover:ring-emerald-500/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-all cursor-pointer group"
              title="Tap to change location"
            >
              <MapPin size={11} className="text-emerald-500 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {profile.locationLabel || (isEnglish ? 'Set Location' : 'स्थान चुनें')}
              </span>
              {profile.isApproximateLocation && (
                <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 opacity-85">
                  ({isEnglish ? 'Approx' : 'अनुमानित'})
                </span>
              )}
              <ChevronDown size={11} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
            </motion.button>
            <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1.5 border border-emerald-500/20 text-[10px] font-bold text-emerald-600">
              <Zap size={10} className="text-emerald-500" />
              <span>Live</span>
            </div>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.9 }}
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate(8);
            setIsNotificationsOpen((prev) => !prev);
          }}
          className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
          <Bell size={20} className="text-slate-400" />
          {alerts.length > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-[1.5px] border-white bg-rose-500 animate-pulse" />
          )}
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {isNotificationsOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="rounded-2xl p-3 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/60 dark:border-slate-800 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {isEnglish ? 'Live Notifications' : 'लाइव नोटिफिकेशन'}
              </p>
              <button onClick={() => setIsNotificationsOpen(false)}
                className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                {isEnglish ? 'Close' : 'बंद करें'}
              </button>
            </div>
            <div className="space-y-2">
              {alerts.map((item, index) => (
                <div
                  key={`${item.type}-${index}`}
                  className={`rounded-xl border px-3 py-2.5 transition-colors ${
                    item.priority === 'high'
                      ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/90 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100'
                      : item.priority === 'medium'
                        ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100'
                  }`}
                >
                  <p className="text-[11px] font-black">{item.title}</p>
                  <p className="mt-0.5 text-[11px] font-medium opacity-80">{item.message}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Multilingual Farmer Voice Assistant & Chatbot Card (v2) ── */}
      <FarmerAssistantCard />


      {/* ── Health Score + Copilot card (Soft Glass Prism) ───────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.5 }}
        className="relative overflow-hidden rounded-[2.25rem] p-5 shadow-[0_12px_40px_rgba(16,185,129,0.12)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)] prism-ring bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-emerald-100/50 dark:from-slate-900/90 dark:via-emerald-950/40 dark:to-teal-950/30 backdrop-blur-2xl border border-emerald-200/70 dark:border-emerald-800/60 text-slate-800 dark:text-slate-100 transition-all"
      >
        {/* Ambient emerald & mint Orbs */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-400/20 dark:bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-8 -bottom-8 h-40 w-40 rounded-full bg-teal-400/15 dark:bg-teal-500/15 blur-3xl" />

        {/* Top row: badge + time */}
        <div className="relative z-10 flex items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300 backdrop-blur-md whitespace-nowrap">
              {T.copilot as string}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 dark:bg-emerald-400/15 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live</span>
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 tabular-nums ml-auto" suppressHydrationWarning>
            {time}
          </span>
        </div>

        {/* Main content: text + leaf icon orb */}
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-extrabold leading-tight tracking-tight bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-800 dark:from-white dark:via-emerald-200 dark:to-slate-100 bg-clip-text text-transparent">
              {T.tagline as string}
              <span className="block text-slate-500 dark:text-slate-400 font-bold text-base mt-0.5">{t('field_walk')}</span>
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
              {T.subtitle as string}
            </p>
          </div>
          <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)] border border-white/40">
            <Leaf size={20} className="drop-shadow-sm animate-pulse" />
          </div>
        </div>

        {/* Stats row with soft pastel glass cards */}
        <div className="relative z-10 mt-4 grid grid-cols-3 gap-2.5">
          {[
            {
              label: T.farmHealth as string,
              value: `${Math.round(healthScore || 85)}%`,
              icon: '🌾',
              cardStyle: 'bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-emerald-100/70 dark:from-emerald-950/40 dark:via-slate-900/80 dark:to-teal-950/40 border-emerald-200/70 dark:border-emerald-800/60 shadow-[0_4px_16px_rgba(16,185,129,0.08)]',
              valColor: 'text-emerald-950 dark:text-emerald-100',
              iconBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 dark:border-emerald-700/40',
            },
            {
              label: T.activeFields as string,
              value: `${cropList.length}`,
              icon: '📍',
              cardStyle: 'bg-gradient-to-br from-sky-50/90 via-cyan-50/60 to-blue-50/70 dark:from-sky-950/40 dark:via-slate-900/80 dark:to-blue-950/40 border-sky-200/70 dark:border-sky-800/60 shadow-[0_4px_16px_rgba(14,165,233,0.08)]',
              valColor: 'text-sky-950 dark:text-sky-100',
              iconBg: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-300/40 dark:border-sky-700/40',
            },
            {
              label: T.watchAlerts as string,
              value: `${alerts.length}`,
              icon: '⚠️',
              cardStyle: 'bg-gradient-to-br from-amber-50/90 via-orange-50/60 to-yellow-50/70 dark:from-amber-950/40 dark:via-slate-900/80 dark:to-orange-950/40 border-amber-200/70 dark:border-amber-800/60 shadow-[0_4px_16px_rgba(245,158,11,0.08)]',
              valColor: 'text-amber-950 dark:text-amber-100',
              iconBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300/40 dark:border-amber-700/40',
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-2xl p-2.5 backdrop-blur-md border ${item.cardStyle} transition-all hover:scale-[1.02] shadow-sm flex flex-col justify-between`}
            >
              <div className="flex items-center gap-1.5">
                <div className={`h-6 w-6 rounded-lg ${item.iconBg} flex items-center justify-center shrink-0 text-xs`}>
                  {item.icon}
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
                  {item.label}
                </span>
              </div>
              <p className={`mt-2 text-base font-extrabold leading-none ${item.valColor}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ── Quick Scan CTA — prominent green card ─────────────── */}
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.5 }}
        className="relative overflow-hidden rounded-[2rem] p-5 glass-shine-sweep scan-cta-premium">
        {/* Decorative leaf silhouette */}
        <div className="pointer-events-none absolute -right-4 -bottom-4 opacity-[0.08]">
          <Leaf size={120} className="text-white" />
        </div>
        <div className="relative z-10 flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md border border-white/20">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">{T.aiDiag as string}</span>
        </div>
        <h2 className="relative z-10 text-[1.15rem] font-black leading-tight text-white mb-2">{T.scanHeadline as string}</h2>
        <p className="relative z-10 text-xs text-emerald-50/90 leading-relaxed font-medium mb-5">{T.scanSub as string}</p>
        <Link href="/scanner"
          className="relative z-10 flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-sm font-black text-emerald-900 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.18)] active:scale-95 transition-transform hover:bg-emerald-50">
          <Camera size={18} />
          {T.takePic as string}
          <ArrowUpRight size={16} />
        </Link>
      </motion.div>

      {/* ── Crop Selector Bar (Refined Soft Glass Prism) ────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.45 }}
        className="flex gap-3 overflow-x-auto hide-scrollbar py-2 px-1 items-center"
      >
        {cropList.map((crop, idx) => {
          const localName = cropTranslations[language]?.[crop] ?? crop;
          const isActive = crop === activeCrop;
          return (
            <motion.button
              key={idx}
              whileTap={{ scale: 0.94 }}
              animate={isActive ? { scale: 1.05 } : { scale: 1 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(8);
                updateProfile({ activeCrop: crop });
              }}
              className="group flex shrink-0 cursor-pointer flex-col items-center gap-1.5 select-none"
            >
              <div
                className={`relative flex h-13 w-13 items-center justify-center rounded-[1.25rem] text-xl transition-all duration-300 backdrop-blur-xl ${
                  isActive
                    ? 'bg-emerald-500/15 dark:bg-emerald-500/25 border-2 border-emerald-500/80 dark:border-emerald-400/80 shadow-[0_6px_20px_rgba(16,185,129,0.22)] text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                    : 'bg-white/70 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 shadow-sm hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {isActive && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  </span>
                )}
                <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {cropIcons[crop] || cropIcons.Default}
                </span>
              </div>
              <span
                className={`text-[11px] font-bold tracking-tight capitalize transition-colors ${
                  isActive ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {localName}
              </span>
            </motion.button>
          );
        })}
        <motion.div
          whileTap={{ scale: 0.94 }}
          className="flex shrink-0 cursor-pointer flex-col items-center gap-1.5 group select-none"
        >
          <div className="flex h-13 w-13 items-center justify-center rounded-[1.25rem] border-2 border-dashed border-emerald-400/40 dark:border-emerald-600/40 bg-emerald-50/50 dark:bg-emerald-950/20 backdrop-blur-md hover:border-emerald-500 hover:bg-emerald-500/10 transition-colors shadow-sm">
            <Plus size={18} className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-[11px] font-bold capitalize text-slate-400 dark:text-slate-500">{t('add') || 'Add'}</span>
        </motion.div>
      </motion.div>

      {/* ── Weather Card (Ultra-Clean Soft Glass Prism) ────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5 }}
        className="relative overflow-hidden rounded-[2.25rem] p-5 shadow-[0_12px_40px_rgba(14,165,233,0.12)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)] prism-ring bg-gradient-to-br from-white/90 via-sky-50/70 to-indigo-50/60 dark:from-slate-900/90 dark:via-sky-950/40 dark:to-indigo-950/30 backdrop-blur-2xl border border-sky-200/60 dark:border-sky-800/50 text-slate-800 dark:text-slate-100 transition-all"
      >
        {/* Ambient atmospheric Orbs */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-amber-400/20 dark:bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-sky-400/15 dark:bg-sky-500/15 blur-3xl" />

        <div className="relative z-10">
          {/* Header Row */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-400 text-white shadow-[0_4px_16px_rgba(251,191,36,0.35)] border border-white/40">
                <Sun size={18} className="drop-shadow-sm" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400 block">
                  {T.weather as string}
                </span>
                <button
                  onClick={() => setIsLocationModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer group"
                  title="Tap to change location"
                >
                  <span className="truncate max-w-[150px] sm:max-w-[220px]">
                    {weather?.city || profile.locationLabel || (isEnglish ? 'Set Location' : 'स्थान चुनें')}
                  </span>
                  <ChevronDown size={11} className="text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-full bg-sky-500/10 dark:bg-sky-400/10 border border-sky-500/20 px-2.5 py-1 text-[10px] font-bold text-sky-700 dark:text-sky-300 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
              <span>Live</span>
            </div>
          </div>

          {/* Temperature + Description Hero Block */}
          {weatherLoading ? (
            <div className="space-y-2 mb-4">
              <div className="h-10 w-28 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
              <div className="h-4 w-40 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
            </div>
          ) : (
            <div className="mb-3.5">
              <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-sky-900 to-slate-800 dark:from-white dark:via-sky-200 dark:to-slate-100 bg-clip-text text-transparent leading-none">
                {weather?.temperature || '28°C'}
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {weather?.description || (T.sunny as string)}
              </p>
            </div>
          )}

          {/* Alert Badge */}
          {!weatherLoading && (
            <div className="mb-4">
              {weather?.weather_alerts?.[0] ? (
                <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 px-3 py-2 border border-amber-500/20 backdrop-blur-md">
                  <span className="text-sm shrink-0">⚠️</span>
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 leading-snug">
                    {weather.weather_alerts[0]}
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 px-3 py-1 border border-emerald-500/25 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                    {isEnglish ? 'Optimal Weather' : 'मौसम अनुकूल'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 3 Stat Cards Row with Soft Glass Prism Coloring */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              {
                icon: Wind,
                label: T.wind as string,
                value: weatherLoading ? '—' : (weather?.wind_speed || '12 km/h'),
                cardBg: 'bg-gradient-to-br from-teal-50/90 via-emerald-50/60 to-cyan-50/70 dark:from-teal-950/40 dark:via-slate-900/80 dark:to-cyan-950/40 border-teal-200/60 dark:border-teal-800/60 shadow-[0_4px_16px_rgba(20,184,166,0.08)]',
                iconBg: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-300/40 dark:border-teal-700/40',
                valColor: 'text-teal-950 dark:text-teal-100',
              },
              {
                icon: Droplets,
                label: T.humidity as string,
                value: weatherLoading ? '—' : (weather?.humidity || '68%'),
                cardBg: 'bg-gradient-to-br from-sky-50/90 via-cyan-50/60 to-blue-50/70 dark:from-sky-950/40 dark:via-slate-900/80 dark:to-blue-950/40 border-sky-200/60 dark:border-sky-800/60 shadow-[0_4px_16px_rgba(14,165,233,0.08)]',
                iconBg: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-300/40 dark:border-sky-700/40',
                valColor: 'text-sky-950 dark:text-sky-100',
              },
              {
                icon: Cloud,
                label: T.tomorrow as string,
                value: weatherLoading ? '—' : (weather?.tomorrow_description || (isEnglish ? 'Partly cloudy' : 'हल्के बादल')),
                cardBg: 'bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-violet-50/70 dark:from-indigo-950/40 dark:via-slate-900/80 dark:to-violet-950/40 border-indigo-200/60 dark:border-indigo-800/60 shadow-[0_4px_16px_rgba(99,102,241,0.08)]',
                iconBg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-300/40 dark:border-indigo-700/40',
                valColor: 'text-indigo-950 dark:text-indigo-100',
              },
            ].map(({ icon: Icon, label, value, cardBg, iconBg, valColor }) => (
              <div
                key={label}
                className={`rounded-2xl ${cardBg} border p-2.5 backdrop-blur-md transition-all hover:scale-[1.02] shadow-sm flex flex-col justify-between`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={`h-6 w-6 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                    <Icon size={13} />
                  </div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
                    {label}
                  </span>
                </div>
                {weatherLoading ? (
                  <div className="mt-2 h-4 w-12 rounded bg-slate-200/60 dark:bg-slate-700/60 animate-pulse" />
                ) : (
                  <p className={`mt-2 text-xs font-black leading-tight ${valColor} truncate`}>
                    {value}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Live Pest Threat (from community scan network) ────── */}
      {threatAlert && (
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.22, duration: 0.4 }}
          className="rounded-2xl border border-rose-200 bg-white shadow-[0_4px_16px_rgba(244,63,94,0.08)] px-4 py-3.5"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 shrink-0">
              <span className="text-base">🦟</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {threatAlert.disease.replace(/_/g, ' ')}
                </p>
                <span className="text-[9px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  {threatAlert.alert_level}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500">
                {threatAlert.farmer_count} farmers • {threatAlert.distance_km.toFixed(1)} km away
              </p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{threatAlert.recommendation.slice(0, 80)}...</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Alerts (Soft Glass Prism & Category Orbs) ───────────────────────────── */}
      <AnimatePresence>
        {alerts.map((alert, index) => {
          let cardStyle = 'bg-gradient-to-br from-slate-50/90 via-slate-100/60 to-slate-200/70 border-slate-200/70 text-slate-900 shadow-sm';
          let iconContainerStyle = 'bg-gradient-to-tr from-slate-500 to-slate-700 text-white border border-white/30 shadow-md';
          let badgeLabel = 'ALERT';
          let badgeStyle = 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20';
          let IconComponent = AlertTriangle;

          if (alert.type === 'disease') {
            if (alert.priority === 'high') {
              cardStyle = 'bg-gradient-to-br from-rose-50/90 via-red-50/60 to-orange-50/70 dark:from-rose-950/50 dark:via-slate-900/90 dark:to-red-950/40 border-rose-200/70 dark:border-rose-800/60 text-rose-950 dark:text-rose-100 shadow-[0_4px_20px_rgba(244,63,94,0.08)]';
              iconContainerStyle = 'bg-gradient-to-tr from-rose-500 to-red-500 text-white shadow-[0_4px_14px_rgba(244,63,94,0.35)] border border-white/30';
              badgeLabel = isEnglish ? 'HIGH RISK' : 'उच्च खतरा';
              badgeStyle = 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';
              IconComponent = AlertTriangle;
            } else if (alert.priority === 'medium') {
              cardStyle = 'bg-gradient-to-br from-amber-50/90 via-orange-50/60 to-yellow-50/70 dark:from-amber-950/50 dark:via-slate-900/90 dark:to-orange-950/40 border-amber-200/70 dark:border-amber-800/60 text-amber-950 dark:text-amber-100 shadow-[0_4px_20px_rgba(245,158,11,0.08)]';
              iconContainerStyle = 'bg-gradient-to-tr from-amber-400 to-orange-500 text-white shadow-[0_4px_14px_rgba(245,158,11,0.35)] border border-white/30';
              badgeLabel = isEnglish ? 'RISK ADVISORY' : 'रोग सलाह';
              badgeStyle = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
              IconComponent = AlertTriangle;
            } else {
              cardStyle = 'bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-emerald-100/70 dark:from-emerald-950/50 dark:via-slate-900/90 dark:to-teal-950/40 border-emerald-200/70 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-100 shadow-[0_4px_20px_rgba(16,185,129,0.08)]';
              iconContainerStyle = 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] border border-white/30';
              badgeLabel = isEnglish ? 'FIELD SAFE' : 'खेत सुरक्षित';
              badgeStyle = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
              IconComponent = ShieldCheck;
            }
          } else if (alert.type === 'weather') {
            cardStyle = 'bg-gradient-to-br from-amber-50/90 via-orange-50/60 to-yellow-50/70 dark:from-amber-950/50 dark:via-slate-900/90 dark:to-orange-950/40 border-amber-200/70 dark:border-amber-800/60 text-amber-950 dark:text-amber-100 shadow-[0_4px_20px_rgba(245,158,11,0.08)]';
            iconContainerStyle = 'bg-gradient-to-tr from-amber-400 to-orange-500 text-white shadow-[0_4px_14px_rgba(245,158,11,0.35)] border border-white/30';
            badgeLabel = alert.priority === 'medium' ? (isEnglish ? 'WEATHER ALERT' : 'मौसम चेतावनी') : (isEnglish ? 'WEATHER' : 'मौसम');
            badgeStyle = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
            IconComponent = Cloud;
          } else if (alert.type === 'market') {
            cardStyle = 'bg-gradient-to-br from-sky-50/90 via-cyan-50/60 to-blue-50/70 dark:from-sky-950/50 dark:via-slate-900/90 dark:to-blue-950/40 border-sky-200/70 dark:border-sky-800/60 text-sky-950 dark:text-sky-100 shadow-[0_4px_20px_rgba(14,165,233,0.08)]';
            iconContainerStyle = 'bg-gradient-to-tr from-sky-400 to-blue-500 text-white shadow-[0_4px_14px_rgba(14,165,233,0.35)] border border-white/30';
            badgeLabel = isEnglish ? 'MANDI RATE' : 'मंडी भाव';
            badgeStyle = 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20';
            IconComponent = mandiPrice?.status === 'up' ? TrendingUp : mandiPrice?.status === 'down' ? TrendingDown : BarChart3;
          } else if (alert.type === 'irrigation') {
            cardStyle = 'bg-gradient-to-br from-cyan-50/90 via-teal-50/60 to-emerald-50/70 dark:from-cyan-950/50 dark:via-slate-900/90 dark:to-teal-950/40 border-cyan-200/70 dark:border-cyan-800/60 text-cyan-950 dark:text-cyan-100 shadow-[0_4px_20px_rgba(6,182,212,0.08)]';
            iconContainerStyle = 'bg-gradient-to-tr from-cyan-500 to-teal-500 text-white shadow-[0_4px_14px_rgba(6,182,212,0.35)] border border-white/30';
            badgeLabel = isEnglish ? 'SMART IRRIGATION' : 'स्मार्ट सिंचाई';
            badgeStyle = 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20';
            IconComponent = Droplets;
          } else if (alert.type === 'roi') {
            cardStyle = 'bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-violet-50/70 dark:from-indigo-950/50 dark:via-slate-900/90 dark:to-purple-950/40 border-indigo-200/70 dark:border-indigo-800/60 text-indigo-950 dark:text-indigo-100 shadow-[0_4px_20px_rgba(99,102,241,0.08)]';
            iconContainerStyle = 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)] border border-white/30';
            badgeLabel = isEnglish ? 'ROI FORECAST' : 'आय अनुमान';
            badgeStyle = 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20';
            IconComponent = Sparkles;
          }

          return (
            <motion.div
              key={alert.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.22 + index * 0.06 }}
              className={`rounded-[1.75rem] p-4 overflow-hidden border backdrop-blur-2xl transition-all hover:scale-[1.01] ${cardStyle}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl shrink-0 ${iconContainerStyle}`}>
                  <IconComponent size={17} className="drop-shadow-sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-sm font-extrabold tracking-tight truncate">{alert.title}</p>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeStyle} shrink-0`}>
                      {badgeLabel}
                    </span>
                  </div>
                  <p className="text-xs font-medium opacity-90 leading-relaxed">{alert.message}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* ── Action Center (tool grid) ─────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.5 }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[1.1rem] font-extrabold text-slate-800">{T.actionCenter as string}</h3>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{T.tools as string}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {toolCards.map(({ href, icon: Icon, label, sub, gradient, shadow }) => (
            <Link
              key={label}
              href={href}
              className="group overflow-hidden rounded-[1.75rem] p-4 bg-white/75 dark:bg-slate-900/75 border border-white dark:border-slate-800 backdrop-blur-2xl shadow-[0_4px_20px_rgba(15,23,42,0.06)] hover:shadow-[0_8px_28px_rgba(15,23,42,0.12)] transition-all hover:scale-[1.02] block"
            >
              <div className="relative mb-3">
                <div
                  className={`relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr ${gradient} text-white border border-white/40 shadow-sm group-hover:scale-105 transition-transform`}
                  style={{ boxShadow: `0 4px 14px ${shadow}` }}
                >
                  <Icon size={18} className="drop-shadow-sm" />
                </div>
              </div>
              <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{label}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed font-medium text-slate-500 dark:text-slate-400">{sub}</p>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* ── Smart Irrigation Advisor (Soft Glass Prism) ────────────────────── */}
      {smartIrrigation && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.31, duration: 0.45 }}
          className="relative overflow-hidden rounded-[2.25rem] p-5 shadow-[0_12px_40px_rgba(14,165,233,0.12)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)] prism-ring bg-gradient-to-br from-cyan-50/90 via-sky-50/70 to-blue-50/60 dark:from-slate-900/90 dark:via-sky-950/40 dark:to-cyan-950/40 backdrop-blur-2xl border border-sky-200/60 dark:border-sky-800/50 text-slate-800 dark:text-slate-100 transition-all"
        >
          {/* Ambient cyan lighting glow */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-cyan-400/20 dark:bg-cyan-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-sky-400/15 dark:bg-blue-500/15 blur-3xl" />

          <div className="relative z-10">
            {/* Header Row */}
            <div className="mb-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-400 to-cyan-500 text-white shadow-[0_4px_16px_rgba(14,165,233,0.35)] border border-white/40">
                  <Droplets size={18} className="drop-shadow-sm animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-sky-600 to-cyan-600 dark:from-sky-300 dark:to-cyan-300 bg-clip-text text-transparent block">
                    {t('intel_smart_irrigation')}
                  </span>
                  <span className="text-[9px] font-bold text-sky-600/80 dark:text-sky-400/80 uppercase tracking-widest">
                    {t('intel_live_forecast')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 rounded-full bg-white/70 dark:bg-slate-800/70 px-3 py-1 border border-white dark:border-slate-700/80 shadow-sm backdrop-blur-md">
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  {t('intel_soil_profile')}: <span className="text-sky-700 dark:text-sky-300 font-extrabold">{soilTypeLabel}</span>
                </span>
              </div>
            </div>

            {/* Recommendation Inner Soft Glass Box */}
            <div className="mb-3.5 p-4 rounded-[1.75rem] bg-white/75 dark:bg-slate-800/75 border border-white dark:border-slate-700/80 backdrop-blur-md shadow-sm">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
                {smartIrrigation.recommendation}
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 dark:bg-sky-400/10 px-2.5 py-1 border border-sky-500/20 text-[10px] font-extrabold text-sky-700 dark:text-sky-300">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                <span>{t('intel_suggested_interval')}: every {smartIrrigation.irrigation_interval_days} days</span>
              </div>
            </div>

            {/* Week Plan Grid */}
            <div className="grid grid-cols-3 gap-2">
              {(smartIrrigation.week_plan || []).slice(0, 3).map((day) => (
                <div
                  key={day.date}
                  className="rounded-2xl border border-white dark:border-slate-700/70 bg-white/60 dark:bg-slate-800/60 p-2.5 backdrop-blur-md flex flex-col items-center text-center shadow-sm"
                >
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1.5">
                    {day.date.slice(5)}
                  </p>
                  <div
                    className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter mb-1.5 ${
                      day.action.toLowerCase() === 'normal'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                        : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20'
                    }`}
                  >
                    {day.action === 'normal' ? (isEnglish ? 'NORMAL' : 'सामान्य') : day.action.toUpperCase()}
                  </div>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100">{day.rain_mm} mm</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── ROI Dashboard ───────────────────────────────────── */}
      {roiData && (
        <WealthPredictor />
      )}

      {/* ── Market Intel ─────────────────────────────────────── */}
      {(() => {
        const trend = mandiPrice?.trend || '0%';
        let status: 'up' | 'down' | 'stable' = mandiPrice?.status || 'down';
        if (trend === '0%' || trend === '0.0%' || trend === '+0%' || trend === '-0%') {
          status = 'stable';
        }

        const isUp = status === 'up';
        const isStable = status === 'stable';

        const glowBg = isUp
          ? 'from-emerald-500/20 via-teal-500/10 to-transparent'
          : isStable
          ? 'from-amber-500/20 via-orange-500/10 to-transparent'
          : 'from-rose-500/20 via-pink-500/10 to-transparent';

        const iconContainerStyle = isUp
          ? 'from-emerald-500/15 via-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-[0_4px_16px_rgba(16,185,129,0.15)]'
          : isStable
          ? 'from-amber-500/15 via-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/30 shadow-[0_4px_16px_rgba(245,158,11,0.15)]'
          : 'from-rose-500/15 via-rose-500/10 to-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/30 shadow-[0_4px_16px_rgba(244,63,94,0.15)]';

        const headerTextColor = isUp
          ? 'from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-300'
          : isStable
          ? 'from-amber-600 to-amber-500 dark:from-amber-400 dark:to-amber-300'
          : 'from-rose-600 to-rose-500 dark:from-rose-400 dark:to-rose-300';

        const dotColor = isUp ? 'bg-emerald-500' : isStable ? 'bg-amber-500' : 'bg-rose-500';

        const badgeStyle = isUp
          ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 shadow-[0_2px_10px_rgba(16,185,129,0.1)]'
          : isStable
          ? 'bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300 border-amber-500/30 shadow-[0_2px_10px_rgba(245,158,11,0.1)]'
          : 'bg-gradient-to-r from-rose-500/15 to-rose-500/5 text-rose-700 dark:text-rose-300 border-rose-500/30 shadow-[0_2px_10px_rgba(244,63,94,0.1)]';

        const badgeIcon = isUp ? (
          <ArrowUpRight size={14} className="text-emerald-500" />
        ) : isStable ? (
          <Activity size={14} className="text-amber-500" />
        ) : (
          <TrendingDown size={14} className="text-rose-500" />
        );

        const statusText = isUp
          ? t('intel_price_rising')
          : isStable
          ? t('intel_price_stable')
          : t('intel_price_falling');

        const trendTextColor = isUp
          ? 'text-emerald-500'
          : isStable
          ? 'text-amber-500'
          : 'text-rose-500';

        const strokeColor = isUp ? '#10b981' : isStable ? '#f59e0b' : '#f43f5e';
        const stopColorTop = isUp
          ? 'rgba(16,185,129,0.28)'
          : isStable
          ? 'rgba(245,158,11,0.28)'
          : 'rgba(244,63,94,0.28)';
        const stopColorBottom = isUp
          ? 'rgba(16,185,129,0.0)'
          : isStable
          ? 'rgba(245,158,11,0.0)'
          : 'rgba(244,63,94,0.0)';

        const sparkPath = isUp
          ? 'M0,32 C30,28 60,16 100,8'
          : isStable
          ? 'M0,22 Q25,16 50,23 T100,20'
          : 'M0,10 C25,14 65,28 100,35';

        const endCy = isUp ? 8 : isStable ? 20 : 35;

        return (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.5 }}
            className="relative overflow-hidden rounded-[2.5rem] bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-white/80 dark:border-slate-800/80 shadow-[0_16px_48px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.4)] p-6 sm:p-7 group transition-all duration-300 hover:shadow-[0_20px_60px_rgba(0,0,0,0.09)] dark:hover:border-slate-700"
          >
            {/* Ambient Soft Glass Gradient Orb */}
            <div className={`absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br ${glowBg} blur-[60px] transition-all duration-500 group-hover:scale-125 pointer-events-none`} />

            {/* Header Bar */}
            <div className="relative z-10 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center bg-gradient-to-br border backdrop-blur-xl group-hover:scale-105 transition-transform duration-300 ${iconContainerStyle}`}>
                  {isUp ? <TrendingUp size={18} /> : isStable ? <Activity size={18} /> : <TrendingDown size={18} />}
                </div>
                <div className="flex flex-col">
                  <span className={`text-[11px] font-black uppercase tracking-[0.22em] bg-clip-text text-transparent bg-gradient-to-r ${headerTextColor}`}>
                    {t('intel_mandi_live')}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`}></span>
                    </span>
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-400 uppercase">
                      {isEnglish ? 'Live Market Stream' : 'लाइव मंडी अपडेट'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl px-4 py-1.5 border border-slate-200/80 dark:border-slate-700/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] transition-all duration-300 hover:scale-105">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`}></span>
                </span>
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-100">
                  {cropTranslations[language]?.[profile.activeCrop || profile.crops?.[0] || 'Wheat'] || (profile.activeCrop || profile.crops?.[0] || 'Wheat')}
                </span>
              </div>
            </div>

            {/* Price & Trend Status */}
            <div className="relative z-10 flex items-end justify-between mb-5">
              <div>
                <p className="text-4xl sm:text-5xl font-black leading-none tracking-tight text-slate-900 dark:text-white mb-3 drop-shadow-sm">
                  {mandiPrice?.price || '₹2,300'}
                </p>
                <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide border backdrop-blur-md ${badgeStyle}`}>
                  {badgeIcon}
                  <span>{statusText}</span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400 mb-1">
                  {t('intel_per_quintal')}
                </p>
                <p className={`text-xl sm:text-2xl font-black tracking-tight ${trendTextColor}`}>
                  {mandiPrice?.trend || '0%'}
                </p>
              </div>
            </div>

            {/* Sparkline Visual */}
            <div className="relative z-10 h-20 w-full mb-1">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="marketSparklineGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={stopColorTop} />
                    <stop offset="100%" stopColor={stopColorBottom} />
                  </linearGradient>
                </defs>
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  d={sparkPath}
                  fill="none" stroke={strokeColor} strokeWidth="3.5" strokeLinecap="round"
                />
                <motion.path
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 1 }}
                  d={`${sparkPath} L100,40 L0,40 Z`}
                  fill="url(#marketSparklineGradient)"
                />
                <motion.circle
                  cx="100"
                  cy={endCy}
                  r="4"
                  fill={strokeColor}
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              </svg>
            </div>
          </motion.div>
        );
      })()}

      {/* ── Hotline CTA (Soft Tinted Glass Expert Support Card) ───── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.38, duration: 0.5 }}
        className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-emerald-50/80 dark:from-slate-900/90 dark:via-emerald-950/40 dark:to-slate-900/90 backdrop-blur-2xl border border-emerald-500/25 dark:border-emerald-500/35 shadow-[0_8px_32px_rgba(16,185,129,0.08)] dark:shadow-[0_12px_44px_rgba(0,0,0,0.4)] p-5 sm:p-6 group transition-all duration-300 hover:border-emerald-500/40 hover:shadow-[0_12px_40px_rgba(16,185,129,0.15)]"
      >
        {/* Soft Ambient Glow Orbs */}
        <div className="absolute -left-10 -top-10 h-36 w-36 rounded-full bg-emerald-500/15 blur-[40px] pointer-events-none group-hover:scale-125 transition-transform duration-500" />
        <div className="absolute -right-10 -bottom-10 h-36 w-36 rounded-full bg-teal-500/15 blur-[40px] pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-slate-700/80 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4">
          {/* Top Row: Icon + Live Badge */}
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">
              <Headset size={20} className="text-emerald-700 dark:text-emerald-300" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/10 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-200 text-[10px] font-black tracking-wider uppercase border border-emerald-600/20 whitespace-nowrap">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span>{isEnglish ? '24/7 LIVE SUPPORT' : '24/7 लाइव सपोर्ट'}</span>
            </div>
          </div>

          {/* Middle Area: Headline & Explanatory Subtitle (Full width, zero truncation) */}
          <div className="flex flex-col gap-1">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-snug">
              {t('247_hotline')}
            </h3>

            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
              {t('hotline_value_prop')}
            </p>
          </div>

          {/* Bottom Area: Full-width Glass Action Button (100% Zero Clipping Guaranteed!) */}
          <Link href="/assistant" className="block w-full pt-1">
            <motion.div
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              className="w-full h-11 sm:h-12 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(16,185,129,0.28)] transition-all duration-300 cursor-pointer"
            >
              <span className="font-extrabold uppercase tracking-widest text-xs">{isEnglish ? 'Ask Doctor' : 'डॉक्टर से पूछें'}</span>
              <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </motion.div>
          </Link>
        </div>
      </motion.div>

      {/* ── Real Location Switcher Modal ── */}
      <LocationSwitcherModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onLocationSelected={(loc) => {
          if (loc.lat != null && loc.lon != null) {
            setLat(loc.lat);
            setLon(loc.lon);
            void fetchWeatherAndThreats(loc.lat, loc.lon);
            const activeCrop = profile.activeCrop || profile.crops?.[0] || 'Wheat';
            void fetchIntelligenceInsights(loc.lat, loc.lon, activeCrop);
          }
        }}
      />
    </div>
  );
}
