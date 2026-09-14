import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.geo import router as geo_router
from app.core.errors import register_error_handlers
from app.services.market.weather_service import reverse_geocode, get_ip_location, search_locations


@pytest.fixture
def client():
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(geo_router, prefix="/api/v1")
    return TestClient(app)


@pytest.mark.asyncio
async def test_reverse_geocode_service():
    # Test coordinates for Jalandhar, Punjab
    result = await reverse_geocode(lat=31.3260, lon=75.5762)
    assert result is not None
    assert result.get("success") is True
    assert "label" in result
    assert result.get("latitude") == 31.3260
    assert result.get("longitude") == 75.5762
    # Ensure it's not a hardcoded Nalanda fallback
    if result.get("source") in ["openweathermap_geo", "osm_nominatim"]:
        assert "Punjab" in result.get("label", "") or "Jalandhar" in result.get("label", "") or "India" in result.get("country", "")


@pytest.mark.asyncio
async def test_get_ip_location_service():
    result = await get_ip_location()
    assert result is not None
    # If IP geocoder is reachable, check contract
    if result.get("success"):
        assert result.get("is_approximate") is True
        assert "label" in result
        assert "latitude" in result
        assert "longitude" in result


@pytest.mark.asyncio
async def test_search_locations_service():
    results = await search_locations(query="Jalandhar", limit=3)
    assert isinstance(results, list)
    if len(results) > 0:
        first = results[0]
        assert "name" in first
        assert "latitude" in first
        assert "longitude" in first
        assert "label" in first


def test_api_reverse_geocode_route(client):
    response = client.get("/api/v1/geo/reverse-geocode?lat=31.326&lon=75.576")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "label" in data
    assert data["latitude"] == 31.326
    assert data["longitude"] == 75.576


def test_api_ip_location_route(client):
    response = client.get("/api/v1/geo/ip-location")
    assert response.status_code == 200
    data = response.json()
    assert "success" in data


def test_api_geo_search_route(client):
    response = client.get("/api/v1/geo/search?q=Ludhiana&limit=3")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "results" in data
