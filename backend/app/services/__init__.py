from app.services.assistant import (
    AssistantOrchestrator,
    GeminiFallbackClient,
    GroqChatClient,
    GroupApiClient,
    SarvamChatClient,
    SpeechToTextClient,
    TextToSpeechClient,
    assistant_orchestrator,
    get_normalized_lang_code,
)
from app.services.auth import (
    authenticate_user,
    get_user_by_id,
    issue_user_token,
    register_user,
)
from app.services.diagnosis import (
    generate_scan_report,
    get_growth_care_recommendations,
    get_localized_medicine,
    get_localized_treatment_summary,
    get_treatment_record,
    load_treatment_knowledge,
    normalize_language,
    run_scan_inference,
    run_soil_inference,
    translate,
)
from app.services.expert import (
    trigger_expert_call,
    update_call_status_from_webhook,
)
from app.services.market import (
    MandiTrendService,
    ThreatMapService,
    fetch_7day_forecast,
    fetch_live_weather,
    mandi_trend_service,
)
from app.services.soil import (
    SOIL_PROFILES,
    build_soil_report_from_ocr,
    build_soil_report_from_prediction,
    estimate_fertilizer_investment,
)
from app.services.system import (
    AGRICULTURE_PRICE_DATASET_CANDIDATES,
    CROP_RECOMMENDATION_CANDIDATES,
    FERTILIZER_RECOMMENDATION_CANDIDATES,
    first_existing_path,
    get_active_model,
    get_feedback_accuracy_summary,
    get_observability_snapshot,
    get_registry,
    image_sha256,
    list_models,
    log_prediction,
    store_feedback,
    upsert_model,
)

__all__ = [
    # Assistant
    "assistant_orchestrator",
    "get_normalized_lang_code",
    "AssistantOrchestrator",
    "GroupApiClient",
    "SarvamChatClient",
    "GroqChatClient",
    "GeminiFallbackClient",
    "SpeechToTextClient",
    "TextToSpeechClient",
    # Auth
    "authenticate_user",
    "issue_user_token",
    "register_user",
    "get_user_by_id",
    # Diagnosis
    "run_scan_inference",
    "run_soil_inference",
    "load_treatment_knowledge",
    "get_treatment_record",
    "get_growth_care_recommendations",
    "get_localized_treatment_summary",
    "get_localized_medicine",
    "normalize_language",
    "translate",
    "generate_scan_report",
    # Soil
    "SOIL_PROFILES",
    "build_soil_report_from_prediction",
    "build_soil_report_from_ocr",
    "estimate_fertilizer_investment",
    # Market
    "mandi_trend_service",
    "MandiTrendService",
    "fetch_live_weather",
    "fetch_7day_forecast",
    "ThreatMapService",
    # Expert
    "trigger_expert_call",
    "update_call_status_from_webhook",
    # System
    "get_active_model",
    "get_registry",
    "upsert_model",
    "list_models",
    "log_prediction",
    "store_feedback",
    "image_sha256",
    "get_feedback_accuracy_summary",
    "get_observability_snapshot",
    "first_existing_path",
    "AGRICULTURE_PRICE_DATASET_CANDIDATES",
    "CROP_RECOMMENDATION_CANDIDATES",
    "FERTILIZER_RECOMMENDATION_CANDIDATES",
]
