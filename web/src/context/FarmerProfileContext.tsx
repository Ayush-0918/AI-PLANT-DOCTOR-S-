'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { normalizeSoilType } from '@/lib/soil';

export interface FarmerProfile {
  name: string;
  village: string;
  state: string;
  locationLabel: string;
  soilType: string;
  farmerType: string;
  farmSize: string;
  crops: string[];
  activeCrop: string;
  voiceEnabled: boolean;
  locationAllowed: boolean;
  onboardingCompleted: boolean;
  latitude: number | null;
  longitude: number | null;
  locationSource: 'gps' | 'ip' | 'profile' | 'manual' | null;
  isApproximateLocation: boolean;
  joinedLabel: string;
  avatarUrl: string | null;
}

const STORAGE_KEY = 'plant-doctor/farmer-profile';

const defaultProfile: FarmerProfile = {
  name: 'किशन कुमार',
  village: '',
  state: '',
  locationLabel: '',
  soilType: 'loamy',
  farmerType: 'Progressive Farmer',
  farmSize: '3.5 acres',
  crops: ['गेहूँ', 'धान', 'टमाटर'],
  activeCrop: 'गेहूँ',
  voiceEnabled: true,
  locationAllowed: false,
  onboardingCompleted: false,
  latitude: null,
  longitude: null,
  locationSource: null,
  isApproximateLocation: false,
  joinedLabel: 'Mar 2026',
  avatarUrl: null,
};

function normalizeProfile(profile: FarmerProfile): FarmerProfile {
  const locationParts = [profile.village, profile.state].filter(Boolean);
  const locationLabel =
    locationParts.length > 0
      ? locationParts.join(', ')
      : profile.locationLabel || '';

  // Ensure activeCrop is always one of the selected crops
  const activeCrop =
    profile.crops.includes(profile.activeCrop)
      ? profile.activeCrop
      : profile.crops[0] || 'गेहूँ';

  return {
    ...profile,
    locationLabel,
    soilType: normalizeSoilType(profile.soilType),
    activeCrop,
  };
}

interface FarmerProfileContextType {
  profile: FarmerProfile;
  isHydrated: boolean;
  updateProfile: (updates: Partial<FarmerProfile>) => void;
  completeOnboarding: (updates: Partial<FarmerProfile>) => void;
  resetProfile: () => void;
}

const FarmerProfileContext = createContext<FarmerProfileContextType | undefined>(
  undefined
);

export function FarmerProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<FarmerProfile>(defaultProfile);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as FarmerProfile;
        setProfile(normalizeProfile({ ...defaultProfile, ...parsed }));
      }
    } catch (error) {
      console.error('Failed to load farmer profile', error);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(normalizeProfile(profile))
      );
    } catch (error) {
      console.error('Failed to save farmer profile', error);
    }
  }, [profile, isHydrated]);

  const updateProfile = useCallback((updates: Partial<FarmerProfile>) => {
    setProfile((current) => normalizeProfile({ ...current, ...updates }));
  }, []);

  const completeOnboarding = useCallback((updates: Partial<FarmerProfile>) => {
    setProfile((current) =>
      normalizeProfile({
        ...current,
        ...updates,
        onboardingCompleted: true,
      })
    );
  }, []);

  const resetProfile = useCallback(() => {
    setProfile(defaultProfile);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      isHydrated,
      updateProfile,
      completeOnboarding,
      resetProfile,
    }),
    [profile, isHydrated, updateProfile, completeOnboarding, resetProfile]
  );

  return (
    <FarmerProfileContext.Provider value={value}>
      {children}
    </FarmerProfileContext.Provider>
  );
}

export function useFarmerProfile() {
  const context = useContext(FarmerProfileContext);
  if (!context) {
    throw new Error(
      'useFarmerProfile must be used within a FarmerProfileProvider'
    );
  }
  return context;
}
