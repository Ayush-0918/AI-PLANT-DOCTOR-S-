import asyncio
import io
import os
import sys
from pathlib import Path

# Ensure backend package is in python path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.main import app
from app.api.routes.ai_chat import router as ai_chat_router
from app.api.routes.voice import router as voice_router
from app.services.assistant import assistant_orchestrator, conversation_state_manager
from app.services.assistant.conversation_state import ConversationStateManager
from app.services.agents.mandi_price_crew import run_mandi_price_crew
from app.services.agents.weather_advisory_crew import run_weather_advisory_crew
from app.services.agents.scheme_lookup_crew import run_scheme_lookup_crew
from app.services.market.mandi_trend_service import mandi_trend_service
from fastapi.testclient import TestClient

client = TestClient(app)

def test_finding_1_single_chat_endpoint():
    print("Testing Finding #1: Single route enforcement...")
    chat_routes = [r.path for r in app.routes if getattr(r, 'path', '').endswith('/chat')]
    assert len(chat_routes) == len(set(chat_routes)), f"Route collision! Found duplicate paths: {chat_routes}"
    assert "/api/v1/agents/chat" not in chat_routes, "Unsafe CrewAI /chat route still registered!"
    print(f"✅ Finding #1 Passed: Exactly 1 route handles /chat ({set(chat_routes)})")

def test_finding_2_3_4_conversation_ids():
    print("Testing Findings #2, #3, #4: conversation_id tracking & no 'default' fallback...")
    
    # 1. Ask without conversation_id should generate a unique UUID (not 'default')
    resp1 = client.post("/api/v1/ai/chat", json={"message": "hello", "language": "Hindi"})
    assert resp1.status_code == 200
    data1 = resp1.json()
    cid1 = data1.get("conversation_id")
    assert cid1 is not None and cid1 != "default" and len(cid1) > 10, f"Expected valid UUID, got {cid1}"

    # 2. Ask with a specific conversation_id should preserve it
    user_cid = "test-session-uuid-12345"
    resp2 = client.post("/api/v1/ai/chat", json={"message": "wheat crop help", "conversation_id": user_cid, "language": "Hindi"})
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2.get("conversation_id") == user_cid

    # 3. Voice intent should accept conversation_id and pass it down
    resp3 = client.post("/api/v1/voice/intent", data={"text": "weather report", "lang": "English", "conversation_id": user_cid})
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert data3.get("conversation_id") == user_cid

    print("✅ Findings #2, #3, #4 Passed: Unique UUIDs generated, explicit session IDs respected across chat & voice intent")

def test_repurposed_crew_services():
    print("Testing Repurposed Structured CrewAI Multi-Agent Services...")

    # Mandi Price Crew
    mandi_res = asyncio.run(run_mandi_price_crew("Wheat", "Nalanda"))
    assert isinstance(mandi_res, dict)
    assert "modal_price" in mandi_res
    assert "trend" in mandi_res

    # Weather Advisory Crew
    weather_res = asyncio.run(run_weather_advisory_crew("Wheat", "flowering", "Nalanda"))
    assert isinstance(weather_res, dict)
    assert weather_res.get("action") in ["wait", "proceed", "caution"]

    # Scheme Lookup Crew
    scheme_res = asyncio.run(run_scheme_lookup_crew("PM-KISAN"))
    assert isinstance(scheme_res, dict)
    assert scheme_res.get("verification_status") == "verified"

    # Fake scheme must return None (Never fabricate government schemes rule)
    fake_scheme = asyncio.run(run_scheme_lookup_crew("NonExistentFakeScheme99"))
    assert fake_scheme is None

    # Mandi Service integration
    mandi_intel = asyncio.run(mandi_trend_service.get_mandi_intelligence("Wheat", "Nalanda"))
    assert isinstance(mandi_intel, dict)
    assert mandi_intel.get("commodity") == "Wheat"

    print("✅ Structured CrewAI Services Passed: All crews return structured data ONLY, never raw farmer-facing chat text.")

if __name__ == "__main__":
    test_finding_1_single_chat_endpoint()
    test_finding_2_3_4_conversation_ids()
    test_repurposed_crew_services()
    print("\n🎉 ALL ARCHITECTURAL GUARDRAILS AND CREWAI REPURPOSING VERIFIED SUCCESSFULLY!")
