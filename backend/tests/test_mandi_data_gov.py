import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.market.government_mandi_service import (
    GovernmentMandiService,
    government_mandi_service,
)
from app.api.routes.ai_chat import extract_crop_from_query, is_mandi_query


@pytest.fixture
def mandi_service():
    service = GovernmentMandiService()
    service.clear_cache()
    return service


def test_is_mandi_query_and_crop_extraction():
    assert is_mandi_query("आज गेहूं का भाव क्या है?") is True
    assert is_mandi_query("Punjab mandi price for wheat") is True
    assert is_mandi_query("टमाटर का रेट बताओ") is True
    assert is_mandi_query("धान का क्या भाव बा?") is True
    assert is_mandi_query("मक्के का दाम") is True
    assert is_mandi_query("नमस्ते कैसे हो?") is False

    assert extract_crop_from_query("आज गेहूं का भाव क्या है?") == "Wheat"
    assert extract_crop_from_query("धान का क्या रेट बा?") == "Rice"
    assert extract_crop_from_query("tamatar mandi price in bihar") == "Tomato"
    assert extract_crop_from_query("aalu bhav today") == "Potato"
    assert extract_crop_from_query("sarson rate today") == "Mustard"
    assert extract_crop_from_query("general query", default_crop="Wheat") == "Wheat"


def test_normalize_record(mandi_service):
    raw_api_record = {
        "State": "Punjab",
        "District": "Khanna",
        "Market": "Khanna Mandi",
        "Commodity": "Wheat",
        "Variety": "1121",
        "Arrival_Date": "11/09/2026",
        "Min_Price": "2300",
        "Max_Price": "2500",
        "Modal_Price": "2420",
    }
    normalized = mandi_service._normalize_record(raw_api_record, freshness="live")
    assert normalized["state"] == "Punjab"
    assert normalized["district"] == "Khanna"
    assert normalized["market"] == "Khanna Mandi"
    assert normalized["commodity"] == "Wheat"
    assert normalized["variety"] == "1121"
    assert normalized["min_price"] == 2300.0
    assert normalized["max_price"] == 2500.0
    assert normalized["modal_price"] == 2420.0
    assert normalized["date"] == "11/09/2026"
    assert normalized["data_freshness"] == "live"
    assert normalized["source"] == "data.gov.in"


@pytest.mark.asyncio
async def test_fetch_live_mandi_prices_mocked(mandi_service):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "ok",
        "total": 1,
        "count": 1,
        "records": [
            {
                "state": "Punjab",
                "district": "Ludhiana",
                "market": "Ludhiana APMC",
                "commodity": "Wheat",
                "variety": "Kalyan",
                "arrival_date": "11/09/2026",
                "min_price": "2350",
                "max_price": "2550",
                "modal_price": "2450",
            }
        ],
    }

    mandi_service.api_key = "test_data_gov_key"
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        records = await mandi_service.fetch_live_mandi_prices(state="Punjab", commodity="Wheat", limit=5)
        assert len(records) == 1
        assert records[0]["state"] == "Punjab"
        assert records[0]["modal_price"] == 2450.0
        assert records[0]["data_freshness"] == "live"


@pytest.mark.asyncio
async def test_get_prices_fallback_and_caching(mandi_service):
    # Live API returns empty, should fallback to historical dataset
    with patch.object(mandi_service, "fetch_live_mandi_prices", new_callable=AsyncMock) as mock_live:
        mock_live.return_value = []
        result = await mandi_service.get_prices(commodity="Wheat", limit=5)
        assert result["success"] is True
        assert len(result["data"]) > 0
        assert result["source"] == "historical_dataset"

    # Second call with live data should populate cache
    fake_live_data = [{
        "state": "Haryana",
        "district": "Karnal",
        "market": "Karnal Mandi",
        "commodity": "Wheat",
        "variety": "Desi",
        "min_price": 2300.0,
        "max_price": 2500.0,
        "modal_price": 2400.0,
        "date": "11/09/2026",
        "data_freshness": "live",
        "source": "data.gov.in",
    }]
    with patch.object(mandi_service, "fetch_live_mandi_prices", new_callable=AsyncMock) as mock_live:
        mock_live.return_value = fake_live_data
        res1 = await mandi_service.get_prices(state="Haryana", commodity="Wheat", limit=5)
        assert res1["source"] == "live"
        assert res1["count"] == 1

        # Check cache hit on next request
        res2 = await mandi_service.get_prices(state="Haryana", commodity="Wheat", limit=5)
        assert res2["source"] == "live_cached"
        assert res2["count"] == 1


def test_multilingual_formatting():
    intel = {
        "commodity": "Wheat",
        "modal_price": 2450.0,
        "price_range": "₹2350 - ₹2550/quintal",
        "nearest_mandi": "Khanna Mandi",
        "state": "Punjab",
        "arrival_date": "11/09/2026",
        "data_freshness": "live",
    }

    hi_summary = GovernmentMandiService.format_ai_market_summary(intel, language="hi")
    assert "2450" in hi_summary
    assert "Khanna Mandi" in hi_summary
    assert "सरकारी एगमार्कनेट" in hi_summary

    pa_summary = GovernmentMandiService.format_ai_market_summary(intel, language="pa")
    assert "2450" in pa_summary
    assert "Khanna Mandi" in pa_summary
    assert "ਸਰਕਾਰੀ ਮੰਡੀ" in pa_summary

    bho_summary = GovernmentMandiService.format_ai_market_summary(intel, language="bho")
    assert "2450" in bho_summary
    assert "Khanna Mandi" in bho_summary
    assert "एगमार्कनेट" in bho_summary

    en_summary = GovernmentMandiService.format_ai_market_summary(intel, language="en")
    assert "2450" in en_summary
    assert "Khanna Mandi" in en_summary
    assert "data.gov.in" in en_summary


def test_api_mandi_endpoints():
    client = TestClient(app)

    # Test /api/v1/mandi/prices
    res = client.get("/api/v1/mandi/prices?commodity=Wheat&limit=5")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert isinstance(data["data"], list)
    assert data["count"] >= 0

    # Test /api/v1/mandi/trends
    res_trends = client.get("/api/v1/mandi/trends?commodity=Wheat")
    assert res_trends.status_code == 200
    t_data = res_trends.json()
    assert t_data["success"] is True
    assert isinstance(t_data["trends"], list)

    # Test /api/v1/mandi/intelligence
    res_intel = client.get("/api/v1/mandi/intelligence?commodity=Wheat")
    assert res_intel.status_code == 200
    i_data = res_intel.json()
    assert "data" in i_data
    assert "commodity" in i_data["data"]
