'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, Search, X, Check, Loader2, Compass, AlertCircle, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useFarmerProfile } from '@/context/FarmerProfileContext';
import { detectFarmerLocation, searchCities, LocationSearchResult } from '@/lib/locationDetector';

interface LocationSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelected?: (location: { label: string; lat: number | null; lon: number | null; city: string; state: string; isApproximate: boolean; source: 'gps' | 'ip' | 'profile' | 'manual' }) => void;
}

const POPULAR_HUBS = [
  { city: 'Jalandhar', state: 'Punjab', lat: 31.326, lon: 75.576 },
  { city: 'Ludhiana', state: 'Punjab', lat: 30.901, lon: 75.857 },
  { city: 'Bathinda', state: 'Punjab', lat: 30.211, lon: 74.945 },
  { city: 'Karnal', state: 'Haryana', lat: 29.685, lon: 76.990 },
  { city: 'Indore', state: 'Madhya Pradesh', lat: 22.719, lon: 75.857 },
  { city: 'Nashik', state: 'Maharashtra', lat: 19.997, lon: 73.789 },
  { city: 'Patna', state: 'Bihar', lat: 25.594, lon: 85.137 },
  { city: 'Guntur', state: 'Andhra Pradesh', lat: 16.306, lon: 80.436 },
];

export default function LocationSwitcherModal({
  isOpen,
  onClose,
  onLocationSelected,
}: LocationSwitcherModalProps) {
  const { language } = useLanguage();
  const { profile, updateProfile } = useFarmerProfile();
  const isEnglish = language === 'English';
  const isPunjabi = language === 'ਪੰਜਾਬੀ';

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const t = {
    title: isEnglish ? 'Select Your Location' : isPunjabi ? 'ਆਪਣਾ ਟਿਕਾਣਾ ਚੁਣੋ' : 'अपना स्थान चुनें',
    subtitle: isEnglish ? 'Get accurate live weather, pest threat warnings, and local crop advice.' : isPunjabi ? 'ਸਹੀ ਮੌਸਮ, ਬਿਮਾਰੀ ਚਿਤਾਵਨੀ ਅਤੇ ਖੇਤੀ ਸਲਾਹ ਲਈ ਸਹੀ ਸਥਾਨ ਚੁਣੋ।' : 'सटीक मौसम, बीमारी चेतावनी और कृषि सलाह के लिए अपना सही क्षेत्र चुनें।',
    gpsBtn: isEnglish ? 'Use Current GPS Location' : isPunjabi ? 'ਮੌਜੂਦਾ GPS ਲੋਕੇਸ਼ਨ ਵਰਤੋ' : 'वर्तमान GPS लोकेशन इस्तेमाल करें',
    gpsDetecting: isEnglish ? 'Detecting satellite GPS...' : isPunjabi ? 'GPS ਲੋਕੇਸ਼ਨ ਲੱਭ ਰਹੇ ਹਾਂ...' : 'GPS लोकेशन खोजी जा रही है...',
    searchPh: isEnglish ? 'Search city, town, or district...' : isPunjabi ? 'ਸ਼ਹਿਰ, ਜ਼ਿਲ੍ਹਾ ਜਾਂ ਪਿੰਡ ਖੋਜੋ...' : 'शहर, कस्बा या जिला खोजें...',
    popular: isEnglish ? 'Popular Farming Hubs' : isPunjabi ? 'ਮੁੱਖ ਖੇਤੀ ਖੇਤਰ' : 'प्रमुख कृषि क्षेत्र',
    approximate: isEnglish ? 'Approximate (Network IP)' : isPunjabi ? 'ਅਨੁਮਾਨਿਤ ਲੋਕੇਸ਼ਨ (IP)' : 'अनुमानित क्षेत्र (Network IP)',
    verifiedGps: isEnglish ? 'Exact GPS Verified' : isPunjabi ? 'ਸਟੀਕ GPS ਪ੍ਰਮਾਣਿਤ' : 'सटीक GPS द्वारा सत्यापित',
    manual: isEnglish ? 'Custom Selected' : isPunjabi ? 'ਖ਼ੁਦ ਚੁਣਿਆ' : 'मैन्युअल चुना गया',
  };

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setErrorMessage('');
      const results = await searchCities(query);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleGpsDetect = async () => {
    setIsDetectingGps(true);
    setErrorMessage('');
    try {
      const result = await detectFarmerLocation(profile, true);
      if (result.success && result.locationLabel) {
        updateProfile({
          locationLabel: result.locationLabel,
          village: result.village || '',
          state: result.state || '',
          latitude: result.latitude,
          longitude: result.longitude,
          locationAllowed: true,
          locationSource: result.locationSource,
          isApproximateLocation: result.isApproximateLocation,
        });
        if (onLocationSelected) {
          onLocationSelected({
            label: result.locationLabel,
            lat: result.latitude,
            lon: result.longitude,
            city: result.village || '',
            state: result.state || '',
            isApproximate: result.isApproximateLocation,
            source: result.locationSource || 'gps',
          });
        }
        onClose();
      } else {
        setErrorMessage(isEnglish ? 'Could not access GPS. Please choose a city below.' : 'GPS अनुमति नहीं मिली। कृपया नीचे दिए गए शहरों में से चुनें।');
      }
    } catch {
      setErrorMessage(isEnglish ? 'GPS detection timed out. Please select your city.' : 'GPS समय समाप्त हुआ। कृपया शहर खोजें।');
    } finally {
      setIsDetectingGps(false);
    }
  };

  const handleSelectCity = (item: {
    city?: string;
    name?: string;
    state?: string;
    lat?: number;
    lon?: number;
    latitude?: number;
    longitude?: number;
    label?: string;
  }) => {
    const city = item.city || item.name || '';
    const state = item.state || '';
    const lat = item.lat ?? item.latitude ?? null;
    const lon = item.lon ?? item.longitude ?? null;
    const label = item.label || (state ? `${city}, ${state}` : city);

    updateProfile({
      locationLabel: label,
      village: city,
      state: state,
      latitude: lat,
      longitude: lon,
      locationSource: 'manual',
      isApproximateLocation: false,
    });
    if (onLocationSelected) {
      onLocationSelected({
        label,
        lat,
        lon,
        city,
        state,
        isApproximate: false,
        source: 'manual',
      });
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/80">
                <Compass size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">{t.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-1">{t.subtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* GPS 1-Tap Button */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleGpsDetect}
              disabled={isDetectingGps}
              className="w-full flex items-center justify-center gap-2 rounded-2xl p-3.5 text-xs font-black text-white shadow-md transition-all hover:brightness-105 disabled:opacity-75"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              {isDetectingGps ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t.gpsDetecting}</span>
                </>
              ) : (
                <>
                  <Navigation size={16} />
                  <span>{t.gpsBtn}</span>
                </>
              )}
            </motion.button>

            {errorMessage && (
              <div className="flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200/80 p-3 text-xs font-semibold text-amber-800">
                <AlertCircle size={15} className="shrink-0 text-amber-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Current Location Status Bar */}
            {profile.locationLabel && (
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200/80 p-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin size={15} className="text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Current Location</span>
                    <span className="font-extrabold text-slate-900 truncate block">{profile.locationLabel}</span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0 ${
                  profile.locationSource === 'gps'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : profile.isApproximateLocation
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-sky-100 text-sky-800 border border-sky-200'
                }`}>
                  {profile.locationSource === 'gps'
                    ? t.verifiedGps
                    : profile.isApproximateLocation
                    ? t.approximate
                    : t.manual}
                </span>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <div className="flex items-center gap-2.5 rounded-2xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs">
                <Search size={16} className="text-slate-400 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.searchPh}
                  className="flex-1 bg-transparent font-medium text-slate-800 placeholder:text-slate-400 outline-none"
                />
                {query && (
                  <button onClick={() => setQuery('')}>
                    <X size={14} className="text-slate-400" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {isSearching ? (
                <div className="mt-2 rounded-2xl bg-white border border-slate-100 p-4 text-center text-xs text-slate-400 shadow-sm">
                  <Loader2 size={16} className="animate-spin mx-auto mb-1 text-emerald-600" />
                  <span>Searching locations...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="mt-2 rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100 shadow-md max-h-48 overflow-y-auto">
                  {searchResults.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectCity(item)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-emerald-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-black text-slate-900">{item.name}</p>
                          <p className="text-[10px] text-slate-500 font-semibold">{item.label || item.state}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Select
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Popular Agricultural Hubs Preset Chips */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t.popular}</span>
              <div className="flex flex-wrap gap-2">
                {POPULAR_HUBS.map((hub) => (
                  <button
                    key={hub.city}
                    onClick={() => handleSelectCity(hub)}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-900 transition-colors"
                  >
                    <span>📍</span>
                    <span>{hub.city}</span>
                    <span className="text-[10px] text-slate-400 font-medium">({hub.state})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
