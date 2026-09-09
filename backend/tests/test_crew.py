import asyncio
import pytest
from app.services.agents.mandi_price_crew import run_mandi_price_crew
from app.services.agents.weather_advisory_crew import run_weather_advisory_crew
from app.services.agents.scheme_lookup_crew import run_scheme_lookup_crew

@pytest.mark.anyio
async def test_mandi_price_crew_returns_structured_dict():
    res = await run_mandi_price_crew("Wheat", "Nalanda")
    assert isinstance(res, dict)
    assert "modal_price" in res
    assert "trend" in res
    assert "commodity" in res

@pytest.mark.anyio
async def test_weather_advisory_crew_returns_structured_dict():
    res = await run_weather_advisory_crew("Wheat", "flowering", "Nalanda")
    assert isinstance(res, dict)
    assert res.get("action") in ["wait", "proceed", "caution"]
    assert "safe_window_hours" in res

@pytest.mark.anyio
async def test_scheme_lookup_crew_returns_verified_or_none():
    res = await run_scheme_lookup_crew("PM-KISAN 6000 rupees")
    assert res is not None
    assert isinstance(res, dict)
    assert res.get("verification_status") == "verified"

    # Non-existent fake scheme should return None (never fabricate!)
    fake_res = await run_scheme_lookup_crew("Super Fake Alien Farming Subsidy 2099")
    assert fake_res is None
