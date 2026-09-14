export interface LocationDetectionResult {
  success: boolean;
  latitude: number | null;
  longitude: number | null;
  village?: string;
  state?: string;
  country?: string;
  locationLabel: string;
  locationSource: 'gps' | 'ip' | 'profile' | 'manual' | null;
  isApproximateLocation: boolean;
  message?: string;
}

export interface LocationSearchResult {
  name: string;
  city: string;
  state: string;
  country: string;
  label: string;
  latitude: number;
  longitude: number;
}

/**
 * Reverse geocodes coordinates to city/state name via backend OpenWeather/OSM integration.
 */
export async function reverseGeocodeCoords(lat: number, lon: number): Promise<LocationDetectionResult> {
  try {
    const res = await fetch(`/api/v1/geo/reverse-geocode?lat=${lat}&lon=${lon}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          success: true,
          latitude: data.latitude ?? lat,
          longitude: data.longitude ?? lon,
          village: data.city || '',
          state: data.state || '',
          country: data.country || 'IN',
          locationLabel: data.label || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
          locationSource: 'gps',
          isApproximateLocation: false,
        };
      }
    }
  } catch (err) {
    console.warn('Reverse geocoding error:', err);
  }

  return {
    success: true,
    latitude: lat,
    longitude: lon,
    locationLabel: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    locationSource: 'gps',
    isApproximateLocation: false,
  };
}

/**
 * Fetches approximate IP-based location fallback.
 */
export async function fetchIpLocation(): Promise<LocationDetectionResult | null> {
  try {
    const res = await fetch('/api/v1/geo/ip-location');
    if (res.ok) {
      const data = await res.json();
      if (data.success && (data.latitude || data.city)) {
        return {
          success: true,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          village: data.city || '',
          state: data.state || '',
          country: data.country || 'IN',
          locationLabel: data.label || data.city || 'Approximate Location',
          locationSource: 'ip',
          isApproximateLocation: true,
        };
      }
    }
  } catch (err) {
    console.warn('IP location fetch failed:', err);
  }
  return null;
}

/**
 * Autocomplete search for Indian cities and districts.
 */
export async function searchCities(query: string): Promise<LocationSearchResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ || cleanQ.length < 2) return [];

  try {
    const res = await fetch(`/api/v1/geo/search?q=${encodeURIComponent(cleanQ)}&limit=6`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results)) {
        return data.results;
      }
    }
  } catch (err) {
    console.warn('City search failed:', err);
  }
  return [];
}

/**
 * Multi-Tier Real Location Detection Chain:
 * 1. Browser Geolocation (GPS/Network) -> reverse-geocode via OpenWeather
 * 2. IP-based location fallback (Approximate)
 * 3. Saved Profile Location fallback (from localStorage)
 * 4. Manual selection fallback
 * NEVER silently defaults to hardcoded demo data like "Nalanda, Bihar".
 */
export async function detectFarmerLocation(
  savedProfile?: { locationLabel?: string; latitude?: number | null; longitude?: number | null; state?: string; village?: string },
  requestGpsPermission = true
): Promise<LocationDetectionResult> {
  // ── TIER 1: Browser Geolocation (GPS / Network accurate) ──
  if (requestGpsPermission && typeof window !== 'undefined' && 'geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 300000, // 5 min cache
        });
      });

      const { latitude, longitude } = position.coords;
      const geocoded = await reverseGeocodeCoords(latitude, longitude);
      return geocoded;
    } catch (gpsError) {
      console.info('Browser geolocation declined or timed out, proceeding to IP fallback.', gpsError);
    }
  }

  // ── TIER 2: IP-based Network Location (Approximate) ──
  const ipResult = await fetchIpLocation();
  if (ipResult && ipResult.success && (ipResult.locationLabel || ipResult.latitude)) {
    return ipResult;
  }

  // ── TIER 3: Saved Profile Location (if previously entered by user) ──
  if (savedProfile && savedProfile.locationLabel && savedProfile.locationLabel.trim()) {
    return {
      success: true,
      latitude: savedProfile.latitude ?? null,
      longitude: savedProfile.longitude ?? null,
      village: savedProfile.village || '',
      state: savedProfile.state || '',
      locationLabel: savedProfile.locationLabel.trim(),
      locationSource: 'profile',
      isApproximateLocation: true,
    };
  }

  // ── TIER 4: Manual City Selection Prompt ──
  return {
    success: false,
    latitude: null,
    longitude: null,
    locationLabel: '',
    locationSource: 'manual',
    isApproximateLocation: true,
    message: 'Location access unavailable. Please select your city manually.',
  };
}
