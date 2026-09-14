from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

import httpx  # type: ignore[import]

from app.core.config import settings
from app.core.errors import DependencyError


def compute_disease_risk(temp_c: float, humidity: int, rain_1h_mm: float, wind_kmh: float) -> Dict[str, Any]:
    score = 0
    reasons = []
    farming_alerts = []

    if 22 <= temp_c <= 32:
        score += 25
        reasons.append("temperature favorable for fungal growth")
    if temp_c > 35:
        farming_alerts.append(f"☀️ High temperature ({temp_c}°C) — risk of heat stress on sensitive crops")
    if temp_c < 10:
        farming_alerts.append(f"🌨️ Low temperature ({temp_c}°C) — protect crops from frost damage")
    if humidity >= 80:
        score += 35
        reasons.append("high humidity")
        farming_alerts.append(f"💧 High humidity ({humidity}%) — favorable conditions for fungal/mold growth")
    if rain_1h_mm >= 2:
        score += 20
        reasons.append("leaf wetness due to rain")
        farming_alerts.append(f"🌧️ Rain detected ({rain_1h_mm}mm/hr) — delay spraying until dry")
    if wind_kmh >= 25:
        score += 10
        reasons.append("wind can accelerate spread")
        farming_alerts.append(f"💨 High wind ({wind_kmh} km/h) — avoid spraying, disease spread risk")

    score = min(100, max(0, score))
    if score >= 70:
        level = "high"
    elif score >= 40:
        level = "medium"
    else:
        level = "low"

    return {
        "risk_score": score,
        "risk_level": level,
        "reasons": reasons,
        "farming_alerts": farming_alerts,
    }


WMO_WEATHER_CODE_DESCRIPTIONS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


async def _fetch_open_meteo_live(lat: float, lon: float, city_name: Optional[str] = None) -> Dict[str, Any]:
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "precipitation",
            "weather_code",
            "wind_speed_10m",
            "cloud_cover",
        ],
        "timezone": "auto",
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        res = await client.get(url, params=params)
        res.raise_for_status()
        data = res.json()

    current = data.get("current", {})
    temp_c = round(float(current.get("temperature_2m", 25.0)), 1)
    feels_like_c = round(float(current.get("apparent_temperature", temp_c)), 1)
    humidity = int(current.get("relative_humidity_2m", 50))
    rain_1h = round(float(current.get("precipitation", 0.0)), 2)
    wind_kmh = round(float(current.get("wind_speed_10m", 0.0)), 1)
    cloud_pct = int(current.get("cloud_cover", 0))
    w_code = int(current.get("weather_code", 0))
    desc = WMO_WEATHER_CODE_DESCRIPTIONS.get(w_code, "Partly cloudy")
    risk = compute_disease_risk(temp_c, humidity, rain_1h, wind_kmh)

    resolved_city = city_name
    if not resolved_city:
        try:
            geo_info = await reverse_geocode(lat=lat, lon=lon)
            resolved_city = geo_info.get("city") or geo_info.get("label")
        except Exception:
            resolved_city = f"{lat:.2f}, {lon:.2f}"

    return {
        "temperature_c": temp_c,
        "feels_like_c": feels_like_c,
        "humidity_pct": humidity,
        "wind_kmh": wind_kmh,
        "rain_1h_mm": rain_1h,
        "cloud_pct": cloud_pct,
        "description": desc,
        "city": resolved_city,
        "source": "open_meteo_live",
        "disease_risk": risk,
    }


async def _fetch_open_meteo_forecast(lat: float, lon: float) -> List[Dict[str, Any]]:
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "wind_speed_10m_max",
        ],
        "timezone": "auto",
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        res = await client.get(url, params=params)
        res.raise_for_status()
        data = res.json()

    daily_data = data.get("daily", {})
    times = daily_data.get("time", [])
    t_min = daily_data.get("temperature_2m_min", [])
    t_max = daily_data.get("temperature_2m_max", [])
    precip = daily_data.get("precipitation_sum", [])
    wind = daily_data.get("wind_speed_10m_max", [])
    w_codes = daily_data.get("weather_code", [])

    daily = []
    for i in range(min(7, len(times))):
        min_temp = round(float(t_min[i]), 1) if i < len(t_min) else 20.0
        max_temp = round(float(t_max[i]), 1) if i < len(t_max) else 30.0
        avg_temp = round((min_temp + max_temp) / 2, 1)
        rain_mm = round(float(precip[i]), 1) if i < len(precip) else 0.0
        max_wind_kmh = round(float(wind[i]), 1) if i < len(wind) else 10.0
        code = int(w_codes[i]) if i < len(w_codes) else 0
        desc = WMO_WEATHER_CODE_DESCRIPTIONS.get(code, "Clear sky")

        est_humidity = 75 if rain_mm > 2.0 else 55
        risk = compute_disease_risk(
            temp_c=avg_temp,
            humidity=est_humidity,
            rain_1h_mm=round(rain_mm / 6, 2) if rain_mm > 0 else 0.0,
            wind_kmh=max_wind_kmh,
        )
        daily.append(
            {
                "date": times[i],
                "min_temp_c": min_temp,
                "max_temp_c": max_temp,
                "humidity_pct": est_humidity,
                "rain_mm": rain_mm,
                "wind_kmh": max_wind_kmh,
                "description": desc,
                "disease_risk": risk,
                "source": "open_meteo_forecast",
            }
        )
    return daily


async def fetch_live_weather(lat: float = None, lon: float = None, q: str = None) -> Dict[str, Any]:
    # 1. Try OpenWeather if API key is present
    if settings.openweather_api_key:
        try:
            params: Dict[str, Any] = {"appid": settings.openweather_api_key, "units": "metric"}
            if q and q.strip():
                params["q"] = q.strip()
            elif lat is not None and lon is not None:
                params["lat"] = lat
                params["lon"] = lon

            async with httpx.AsyncClient(timeout=6.0) as client:
                response = await client.get("https://api.openweathermap.org/data/2.5/weather", params=params)
                if response.status_code == 200:
                    weather = response.json()
                    temp_c = round(float(weather["main"]["temp"]), 1)
                    humidity = int(weather["main"]["humidity"])
                    rain_1h = float(weather.get("rain", {}).get("1h", 0.0))
                    wind_kmh = round(float(weather.get("wind", {}).get("speed", 0.0)) * 3.6, 1)
                    risk = compute_disease_risk(temp_c, humidity, rain_1h, wind_kmh)

                    return {
                        "temperature_c": temp_c,
                        "feels_like_c": round(float(weather["main"]["feels_like"]), 1),
                        "humidity_pct": humidity,
                        "wind_kmh": wind_kmh,
                        "rain_1h_mm": rain_1h,
                        "cloud_pct": int(weather.get("clouds", {}).get("all", 0)),
                        "description": weather["weather"][0]["description"],
                        "city": weather.get("name"),
                        "source": "openweathermap_live",
                        "disease_risk": risk,
                    }
        except Exception:
            pass

    # 2. Resilient Open-Meteo (Zero API key required, 100% Free real live weather)
    resolved_lat = lat
    resolved_lon = lon
    resolved_city = None
    if (resolved_lat is None or resolved_lon is None) and q:
        locs = await search_locations(query=q, limit=1)
        if locs:
            resolved_lat = locs[0]["latitude"]
            resolved_lon = locs[0]["longitude"]
            resolved_city = locs[0]["city"]

    if resolved_lat is not None and resolved_lon is not None:
        try:
            return await _fetch_open_meteo_live(lat=resolved_lat, lon=resolved_lon, city_name=resolved_city)
        except Exception:
            pass

    # 3. Resilient fallback to avoid crashing user UI
    default_lat = resolved_lat or 31.2330
    default_lon = resolved_lon or 75.5532
    return {
        "temperature_c": 28.0,
        "feels_like_c": 30.0,
        "humidity_pct": 65,
        "wind_kmh": 10.0,
        "rain_1h_mm": 0.0,
        "cloud_pct": 20,
        "description": "Partly cloudy",
        "city": resolved_city or "Jalandhar",
        "source": "local_resilient_fallback",
        "disease_risk": compute_disease_risk(28.0, 65, 0.0, 10.0),
    }


async def fetch_7day_forecast(lat: float, lon: float) -> List[Dict[str, Any]]:
    # 1. Try OpenWeather if API key is present
    if settings.openweather_api_key:
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                response = await client.get(
                    "https://api.openweathermap.org/data/2.5/forecast",
                    params={
                        "appid": settings.openweather_api_key,
                        "units": "metric",
                        "lat": lat,
                        "lon": lon,
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    entries = data.get("list", [])
                    day_buckets: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
                    for row in entries:
                        timestamp = row.get("dt_txt")
                        if not timestamp:
                            continue
                        day_key = timestamp.split(" ")[0]
                        day_buckets[day_key].append(row)

                    daily = []
                    for day_key in sorted(day_buckets.keys())[:7]:
                        rows = day_buckets[day_key]
                        if not rows:
                            continue
                        min_temp = min(float(item.get("main", {}).get("temp_min", 0.0)) for item in rows)
                        max_temp = max(float(item.get("main", {}).get("temp_max", 0.0)) for item in rows)
                        avg_humidity = sum(float(item.get("main", {}).get("humidity", 0.0)) for item in rows) / max(1, len(rows))
                        rain_mm = sum(float(item.get("rain", {}).get("3h", 0.0)) for item in rows)
                        max_wind_kmh = max(float(item.get("wind", {}).get("speed", 0.0)) * 3.6 for item in rows)
                        description = rows[len(rows) // 2].get("weather", [{}])[0].get("description", "no data")
                        risk = compute_disease_risk(
                            temp_c=round((min_temp + max_temp) / 2, 1),
                            humidity=int(round(avg_humidity)),
                            rain_1h_mm=round(rain_mm / 3, 2) if rain_mm > 0 else 0.0,
                            wind_kmh=round(max_wind_kmh, 1),
                        )
                        daily.append(
                            {
                                "date": day_key,
                                "min_temp_c": round(min_temp, 1),
                                "max_temp_c": round(max_temp, 1),
                                "humidity_pct": int(round(avg_humidity)),
                                "rain_mm": round(rain_mm, 2),
                                "wind_kmh": round(max_wind_kmh, 1),
                                "description": description,
                                "disease_risk": risk,
                            }
                        )
                    if daily:
                        return daily[:7]
        except Exception:
            pass

    # 2. Try Open-Meteo (Zero API key required, 100% Free real forecast)
    try:
        daily_om = await _fetch_open_meteo_forecast(lat=lat, lon=lon)
        if daily_om:
            return daily_om
    except Exception:
        pass

    # 3. Resilient fallback generator if network blocked
    today = date.today()
    return [
        {
            "date": (today + timedelta(days=i)).isoformat(),
            "min_temp_c": 22.0 + i * 0.5,
            "max_temp_c": 32.0 + i * 0.5,
            "humidity_pct": 60,
            "rain_mm": 0.0,
            "wind_kmh": 12.0,
            "description": "Partly cloudy",
            "disease_risk": compute_disease_risk(27.0, 60, 0.0, 12.0),
            "source": "resilient_fallback",
        }
        for i in range(7)
    ]


async def reverse_geocode(lat: float, lon: float) -> Dict[str, Any]:
    """
    Reverse geocodes latitude/longitude coordinates into a city/state name.
    Primary: OpenWeather Geocoding API.
    Fallback: OpenStreetMap Nominatim.
    """
    # 1. Try OpenWeather Geocoding API if key is present
    if settings.openweather_api_key:
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(
                    "https://api.openweathermap.org/geo/1.0/reverse",
                    params={
                        "lat": lat,
                        "lon": lon,
                        "limit": 1,
                        "appid": settings.openweather_api_key,
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    if isinstance(data, list) and len(data) > 0:
                        item = data[0]
                        city = item.get("name", "").strip()
                        state = item.get("state", "").strip()
                        country = item.get("country", "IN").strip()
                        label_parts = [p for p in [city, state] if p]
                        display_name = ", ".join(label_parts) if label_parts else f"{lat:.2f}, {lon:.2f}"
                        return {
                            "success": True,
                            "city": city or "Unknown",
                            "state": state,
                            "country": country,
                            "label": display_name,
                            "latitude": lat,
                            "longitude": lon,
                            "source": "openweathermap_geo",
                            "is_approximate": False,
                        }
        except Exception:
            pass

    # 2. Fallback to OpenStreetMap Nominatim
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lon, "format": "json"},
                headers={"User-Agent": "PlantDoctors/2.0 (Farmer AgTech Platform)"},
            )
            if res.status_code == 200:
                data = res.json()
                address = data.get("address", {})
                city = address.get("city") or address.get("town") or address.get("village") or address.get("county", "")
                state = address.get("state", "")
                country = address.get("country_code", "in").upper()
                label_parts = [p for p in [city, state] if p]
                display_name = ", ".join(label_parts) if label_parts else f"{lat:.2f}, {lon:.2f}"
                return {
                    "success": True,
                    "city": city or "Unknown",
                    "state": state,
                    "country": country,
                    "label": display_name,
                    "latitude": lat,
                    "longitude": lon,
                    "source": "osm_nominatim",
                    "is_approximate": False,
                }
    except Exception:
        pass

    return {
        "success": True,
        "city": f"{lat:.2f}",
        "state": f"{lon:.2f}",
        "country": "IN",
        "label": f"Coordinates ({lat:.2f}, {lon:.2f})",
        "latitude": lat,
        "longitude": lon,
        "source": "coordinates_fallback",
        "is_approximate": False,
    }


async def get_ip_location(client_ip: str = "") -> Dict[str, Any]:
    """
    Rough city/region lookup based on caller IP address.
    Returns city, state, lat, lon marked as is_approximate=True.
    """
    clean_ip = client_ip.strip() if client_ip and client_ip not in ["127.0.0.1", "::1", "localhost"] else ""
    url = f"http://ip-api.com/json/{clean_ip}" if clean_ip else "http://ip-api.com/json"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(url, params={"fields": "status,message,country,countryCode,regionName,city,lat,lon"})
            if res.status_code == 200:
                data = res.json()
                if data.get("status") == "success":
                    city = data.get("city", "").strip()
                    state = data.get("regionName", "").strip()
                    lat = float(data.get("lat", 0.0))
                    lon = float(data.get("lon", 0.0))
                    label_parts = [p for p in [city, state] if p]
                    display_name = ", ".join(label_parts) if label_parts else "Approximate Area"
                    return {
                        "success": True,
                        "city": city,
                        "state": state,
                        "country": data.get("countryCode", "IN"),
                        "label": display_name,
                        "latitude": lat,
                        "longitude": lon,
                        "is_approximate": True,
                        "source": "ip_network",
                    }
    except Exception:
        pass

    # Secondary IP lookup fallback (ipapi.co)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            ipapi_url = f"https://ipapi.co/{clean_ip}/json/" if clean_ip else "https://ipapi.co/json/"
            res = await client.get(ipapi_url)
            if res.status_code == 200:
                data = res.json()
                city = data.get("city", "").strip()
                state = data.get("region", "").strip()
                lat = float(data.get("latitude", 0.0))
                lon = float(data.get("longitude", 0.0))
                label_parts = [p for p in [city, state] if p]
                return {
                    "success": True,
                    "city": city,
                    "state": state,
                    "country": data.get("country_code", "IN"),
                    "label": ", ".join(label_parts) if label_parts else "Approximate Area",
                    "latitude": lat,
                    "longitude": lon,
                    "is_approximate": True,
                    "source": "ipapi_fallback",
                }
    except Exception:
        pass

    return {
        "success": False,
        "message": "IP location unavailable. Please select your city manually.",
    }


async def search_locations(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Direct location search autocomplete by place/city/district name.
    """
    clean_q = query.strip()
    if not clean_q:
        return []

    # 1. Try OpenWeather direct geocoding
    if settings.openweather_api_key:
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(
                    "https://api.openweathermap.org/geo/1.0/direct",
                    params={
                        "q": clean_q if "," in clean_q else f"{clean_q},IN",
                        "limit": max(1, min(limit, 10)),
                        "appid": settings.openweather_api_key,
                    },
                )
                if res.status_code == 200:
                    results = res.json()
                    out = []
                    for item in results:
                        city = item.get("name", "").strip()
                        state = item.get("state", "").strip()
                        country = item.get("country", "IN").strip()
                        label_parts = [p for p in [city, state] if p]
                        out.append({
                            "name": city,
                            "city": city,
                            "state": state,
                            "country": country,
                            "label": ", ".join(label_parts),
                            "latitude": float(item.get("lat", 0.0)),
                            "longitude": float(item.get("lon", 0.0)),
                        })
                    if out:
                        return out
        except Exception:
            pass

    # 2. Fallback to OpenStreetMap Nominatim search
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": clean_q,
                    "format": "json",
                    "addressdetails": 1,
                    "limit": max(1, min(limit, 10)),
                    "countrycodes": "in",
                },
                headers={"User-Agent": "PlantDoctors/2.0 (Farmer AgTech Platform)"},
            )
            if res.status_code == 200:
                results = res.json()
                out = []
                for item in results:
                    addr = item.get("address", {})
                    city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county") or item.get("display_name", "").split(",")[0]
                    state = addr.get("state", "")
                    country = addr.get("country_code", "in").upper()
                    label_parts = [p for p in [city, state] if p]
                    out.append({
                        "name": city,
                        "city": city,
                        "state": state,
                        "country": country,
                        "label": ", ".join(label_parts) or item.get("display_name", ""),
                        "latitude": float(item.get("lat", 0.0)),
                        "longitude": float(item.get("lon", 0.0)),
                    })
                return out
    except Exception:
        pass

    return []

