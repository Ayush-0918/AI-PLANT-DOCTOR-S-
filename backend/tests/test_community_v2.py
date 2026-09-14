import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.community import (
    router as community_router,
    scan_community_content_safety,
    _format_author_display,
    _infer_region,
)
from app.api.routes.expert_calls import router as expert_router
from app.core.errors import register_error_handlers


def test_pesticide_safety_catches_unsafe_chemical_and_dosage():
    unsafe_examples = [
        ("Spray 5ml/L chlorpyrifos on wheat", "en"),
        ("गेहूं में 2 मिली क्लोरोपायरीफॉस का छिड़काव करें", "hi"),
        ("ਕਣਕ ਵਿੱਚ 5ml ਕਲੋਰਪਾਇਰੀਫਾਸ ਪਾਓ", "pa"),
        ("Apply 50g mancozeb per 15 liter water", "en"),
        ("Try 100ml imidacloprid for cotton pests", "en"),
    ]
    for text, lang in unsafe_examples:
        result = scan_community_content_safety(text, lang)
        assert result is not None, f"Failed to catch unsafe text: {text}"
        assert result["safe"] is False
        assert result["violation"] == "unsafe_chemical_dosage"
        assert "message" in result
        assert "safe_alternative" in result


def test_pesticide_safety_allows_safe_and_organic_advice():
    safe_examples = [
        "Use 100% pure organic neem oil spray for aphid control",
        "ਨਿੰਮ ਦੇ ਤੇਲ ਦਾ ਛਿੜਕਾਅ ਕਰੋ ਅਤੇ ਖੇਤ ਵਿੱਚ ਪਾਣੀ ਦਾ ਨਿਕਾਸ ਸਹੀ ਰੱਖੋ",
        "धान की फसल में पीलेपन के लिए जैविक खाद और ट्राइकोडर्मा का उपयोग करें",
        "Chlorpyrifos usage is restricted in our state, contact KVK",
    ]
    for text in safe_examples:
        result = scan_community_content_safety(text, "hi")
        assert result is None or result.get("safe") is True


def test_author_display_anonymity_and_formatting():
    pa_anon = _format_author_display("Harpreet Singh", "anonymous", True, "pa")
    assert "ਗੁਮਨਾਮ ਕਿਸਾਨ" in pa_anon

    hi_anon = _format_author_display("Kishan Kumar", "anonymous", True, "hi")
    assert "गुमनाम किसान" in hi_anon

    en_anon = _format_author_display("John Doe", "anonymous", True, "en")
    assert "Anonymous Farmer" in en_anon

    first_name = _format_author_display("Harpreet Singh", "first_name", False, "pa")
    assert first_name == "Harpreet S."

    full_name = _format_author_display("Harpreet Singh", "full", False, "pa")
    assert full_name == "Harpreet Singh"


def test_region_inference():
    assert _infer_region("Ludhiana, Punjab") == "Punjab"
    assert _infer_region("Patna, Bihar") == "Bihar"
    assert _infer_region("Nashik, Maharashtra") == "Maharashtra"
    assert _infer_region("Remote Village") == "All India"


def test_api_community_safety_check_route():
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(community_router, prefix="/api/v1")
    app.include_router(expert_router, prefix="/api/v1")
    client = TestClient(app)

    # 1. Safety check endpoint with unsafe chemical dosage
    res_unsafe = client.post(
        "/api/v1/community/safety-check",
        json={"content": "Use 5ml/L chlorpyrifos on crop", "language": "en"},
    )
    assert res_unsafe.status_code == 200
    data_unsafe = res_unsafe.json()
    assert data_unsafe["safe"] is False
    assert data_unsafe["violation"] == "unsafe_chemical_dosage"
    assert "message" in data_unsafe

    # 2. Safety check endpoint with safe advice
    res_safe = client.post(
        "/api/v1/community/safety-check",
        json={"content": "Use organic neem oil spray 100% pure", "language": "en"},
    )
    assert res_safe.status_code == 200
    data_safe = res_safe.json()
    assert data_safe["safe"] is True

    # 3. Try to post unsafe dosage via POST /posts -> must return 422
    res_post_unsafe = client.post(
        "/api/v1/community/posts",
        json={
            "content": "Please spray 2ml/L imidacloprid to kill all insects",
            "location": "Punjab",
            "crop": "Cotton",
            "language": "pa",
        },
    )
    assert res_post_unsafe.status_code == 422
    err = res_post_unsafe.json()
    assert err["detail"]["safety_violation"] is True
    assert "सटीक दवा की खुराक साझा करना सुरक्षित नहीं है" in err["detail"]["message_hi"]

    # 4. Voice-note pre-publish safety scan: unsafe dosage in transcript MUST be rejected with 422
    res_voice_unsafe = client.post(
        "/api/v1/community/posts",
        json={
            "content": "Voice Note Attached",
            "transcript": "Please spray 5ml/L chlorpyrifos on the affected cotton leaves",
            "audio_url": "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8USA",
            "audio_duration": 8,
            "location": "Bathinda, Punjab",
            "language": "en",
        },
    )
    assert res_voice_unsafe.status_code == 422
    voice_err = res_voice_unsafe.json()
    assert voice_err["detail"]["safety_violation"] is True
    assert voice_err["detail"]["source"] == "voice_note"
    assert voice_err["detail"]["violation"] == "unsafe_chemical_dosage"

    # 5. Comment voice-note pre-publish safety scan: unsafe dosage in comment transcript MUST be rejected with 422
    res_comment_unsafe = client.post(
        "/api/v1/community/posts/sample-post-id/comments",
        json={
            "content": "Voice Note Reply",
            "transcript": "Use 20g mancozeb powder in 10 liter water",
            "audio_url": "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8USA",
            "language": "en",
        },
    )
    assert res_comment_unsafe.status_code == 422
    comment_err = res_comment_unsafe.json()
    assert comment_err["detail"]["safety_violation"] is True
    assert comment_err["detail"]["source"] == "voice_note"

    # 6. Expert credential verification submission route
    res_ver = client.post(
        "/api/v1/expert/directory/verify-request",
        json={
            "name": "Dr. Amarjit Singh",
            "phone": "+919876543210",
            "credential_type": "kvk",
            "credential_title": "Senior Agronomist (KVK)",
            "institution": "PAU Krishi Vigyan Kendra",
            "id_or_registration_number": "KVK-PAU-9921",
            "crop_speciality": "Wheat",
            "experience_years": 10,
        },
    )
    assert res_ver.status_code == 200
    ver_data = res_ver.json()
    assert ver_data["success"] is True
    assert "request_id" in ver_data


def test_shared_pesticide_patterns_module():
    from app.services.safety.pesticide_patterns import (
        CHEMICAL_NAMES_REGEX,
        DOSAGE_UNITS_REGEX,
        scan_community_content_safety,
        validate_and_sanitize_pesticide_safety,
    )

    # Shared regex contains key synthetic chemicals
    for chem in ["chlorpyrifos", "imidacloprid", "mancozeb", "monocrotophos", "carbendazim"]:
        assert CHEMICAL_NAMES_REGEX.search(chem) is not None

    # Shared regex contains dosage units
    for unit in ["5ml", "2ml/L", "10g", "2.5kg", "500 mg", "2 चम्मच"]:
        assert DOSAGE_UNITS_REGEX.search(unit) is not None

    # Sanitize strips unsafe dosage and attaches recommendation
    clean_text = validate_and_sanitize_pesticide_safety(
        "Apply 5ml/L chlorpyrifos on tomatoes",
        has_photo_diagnosis=False,
        language="en",
    )
    assert "chlorpyrifos" not in clean_text
    assert "KVK" in clean_text


def test_anonymous_and_expert_safety_enforcement():
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(community_router, prefix="/api/v1")
    client = TestClient(app)

    # Anonymous post with unsafe dosage MUST be rejected with 422
    res_anon_unsafe = client.post(
        "/api/v1/community/posts",
        json={
            "content": "Please spray 10ml/L chlorpyrifos on wheat",
            "is_anonymous": True,
            "display_mode": "anonymous",
            "location": "Punjab",
            "language": "pa",
        },
    )
    assert res_anon_unsafe.status_code == 422
    assert res_anon_unsafe.json()["detail"]["safety_violation"] is True

    # Expert comment with unsafe dosage MUST ALSO be rejected with 422 (credentials do not exempt)
    res_expert_unsafe = client.post(
        "/api/v1/community/posts/sample-post-id/comments",
        json={
            "content": "As an agronomist, apply 5ml monocrotophos per liter",
            "is_expert": True,
            "expert_credential": "Ph.D. Agronomy (PAU)",
            "language": "en",
        },
    )
    assert res_expert_unsafe.status_code == 422
    assert res_expert_unsafe.json()["detail"]["safety_violation"] is True


def test_ask_assist_bridge_endpoint():
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(community_router, prefix="/api/v1")
    client = TestClient(app)

    res = client.post(
        "/api/v1/community/ask-assist",
        json={
            "question": "Leaves are turning yellow with brown spots after heavy rain",
            "crop": "Wheat",
            "location": "Ludhiana, Punjab",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "formatted_post" in data
    assert data["crop"] == "Wheat"
    assert len(data["suggested_actions"]) > 0
    assert "monetization_tip" in data

