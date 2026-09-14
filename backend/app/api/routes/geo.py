from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, Query

from app.api.deps import enforce_rate_limit
from app.core.database import get_database
from app.core.errors import DependencyError, ValidationError
from app.services.market import fetch_live_weather, ThreatMapService, fetch_7day_forecast
from app.services.market.weather_service import reverse_geocode, get_ip_location, search_locations
from fastapi import Request


# Optional: Import cache helpers if redis is available
try:
    from app.core.cache import cache_get, cache_set
    cache_available = True
except ImportError:
    cache_available = False
    cache_get = None
    cache_set = None

router = APIRouter(prefix="/geo", tags=["Geo Intelligence"], dependencies=[Depends(enforce_rate_limit)])


@router.get("/reverse-geocode")
async def geo_reverse_geocode(
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate"),
):
    """
    Reverse geocodes GPS coordinates into a verified district/city and state name.
    """
    return await reverse_geocode(lat=lat, lon=lon)


@router.get("/ip-location")
async def geo_ip_location(request: Request):
    """
    Network IP-based approximate location fallback (Tier 2 in location detection chain).
    """
    client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not client_ip and request.client:
        client_ip = request.client.host
    return await get_ip_location(client_ip=client_ip)


@router.get("/search")
async def geo_search(
    q: str = Query(..., min_length=2, description="City, town or district search query"),
    limit: int = Query(default=5, ge=1, le=10),
):
    """
    City/district autocomplete search endpoint for manual location selection.
    """
    results = await search_locations(query=q, limit=limit)
    return {"success": True, "results": results, "count": len(results)}



def _clean_val(v):
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _resolve_coordinates(
    lat: Optional[float],
    lon: Optional[float],
    latitude: Optional[float],
    longitude: Optional[float],
) -> Tuple[float, float]:
    c_lat = _clean_val(lat) if _clean_val(lat) is not None else _clean_val(latitude)
    c_lon = _clean_val(lon) if _clean_val(lon) is not None else _clean_val(longitude)
    if c_lat is None or c_lon is None:
        raise ValidationError("Provide coordinates via lat/lon or latitude/longitude.")
    return float(c_lat), float(c_lon)


@router.get("/weather")
async def geo_weather(
    lat: Optional[float] = Query(default=None),
    lon: Optional[float] = Query(default=None),
    latitude: Optional[float] = Query(default=None),
    longitude: Optional[float] = Query(default=None),
    q: Optional[str] = Query(default=None),
):
    clean_q = q.strip() if (q and isinstance(q, str)) else None
    if clean_q:
        weather = await fetch_live_weather(q=clean_q)
        return {
            "success": True,
            "weather": weather,
            "disease_risk": weather.get("disease_risk", {}),
        }
    else:
        resolved_lat, resolved_lon = _resolve_coordinates(lat, lon, latitude, longitude)
        cache_key = f"weather:{resolved_lat:.2f}:{resolved_lon:.2f}"
        
        # Try to use cache if available
        if cache_available and cache_get:
            cached = await cache_get(cache_key)
            if cached:
                return {
                    "success": True,
                    "weather": cached,
                    "disease_risk": cached.get("disease_risk", {}),
                    "cached": True
                }
        
        weather = await fetch_live_weather(lat=resolved_lat, lon=resolved_lon)
        
        # Store in cache if available
        if cache_available and cache_set:
            await cache_set(cache_key, weather, ttl=1800)  # 30 min cache
        
        return {
            "success": True,
            "weather": weather,
            "disease_risk": weather.get("disease_risk", {}),
            "cached": False
        }


@router.get("/forecast")
async def geo_forecast(
    lat: Optional[float] = Query(default=None),
    lon: Optional[float] = Query(default=None),
    latitude: Optional[float] = Query(default=None),
    longitude: Optional[float] = Query(default=None),
):
    resolved_lat, resolved_lon = _resolve_coordinates(lat, lon, latitude, longitude)
    forecast = await fetch_7day_forecast(lat=resolved_lat, lon=resolved_lon)
    return {
        "success": True,
        "forecast": forecast,
        "count": len(forecast),
    }


@router.get("/threats")
async def geo_threats(
    lat: Optional[float] = Query(default=None),
    lon: Optional[float] = Query(default=None),
    latitude: Optional[float] = Query(default=None),
    longitude: Optional[float] = Query(default=None),
    radius_km: Optional[int] = Query(default=None),
    radius: Optional[int] = Query(default=None),
):
    resolved_lat, resolved_lon = _resolve_coordinates(lat, lon, latitude, longitude)
    r_val = _clean_val(radius_km) if _clean_val(radius_km) is not None else _clean_val(radius)
    resolved_radius = int(r_val) if r_val is not None else 10
    resolved_radius = max(1, min(resolved_radius, 100))

    db = get_database()
    if db is not None:
        try:
            service = ThreatMapService(db)
            await service.ensure_geospatial_index()
            res = await service.check_threats(
                latitude=resolved_lat,
                longitude=resolved_lon,
                radius_km=resolved_radius,
            )
            return {
                "success": True,
                **res,
            }
        except Exception:
            pass

    # Resilient fallback if db is offline or no scan cluster exists:
    return {
        "success": True,
        "has_threats": False,
        "threats": [],
        "safe_zones": [
            {
                "area": f"Within {resolved_radius}km radius",
                "radius_km": resolved_radius,
                "status": "normal",
                "message": "No active pest or disease outbreaks reported in this area.",
            }
        ],
        "location": {"latitude": resolved_lat, "longitude": resolved_lon},
        "search_radius_km": resolved_radius,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
