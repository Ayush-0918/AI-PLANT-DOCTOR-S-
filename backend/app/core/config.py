import os
from dataclasses import dataclass
from pathlib import Path


def _to_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _to_int(value: str, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_float(value: str, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Settings:
    app_env: str
    mongo_uri: str
    jwt_secret_key: str
    jwt_expiry_minutes: int
    ai_confidence_threshold: float
    allow_legacy_mocks: bool
    enable_legacy_api: bool
    rate_limit_requests: int
    rate_limit_window_seconds: int
    openweather_api_key: str
    vapi_api_key: str
    vapi_assistant_id: str
    vapi_phone_number_id: str
    vapi_webhook_secret: str
    vapi_url: str
    group_api_url: str
    group_api_key: str
    group_api_timeout: float
    gemini_api_key: str
    gemini_model: str
    bhashini_api_url: str
    bhashini_api_key: str
    bhashini_user_id: str
    sarvam_api_key: str
    sarvam_model: str
    sarvam_chat_model: str
    sarvam_stt_model: str
    sarvam_speaker: str
    groq_api_key: str
    groq_chat_model: str
    groq_stt_model: str
    mistral_api_url: str
    mistral_api_key: str
    mistral_model: str
    stt_provider: str
    tts_provider: str
    static_dir: Path
    model_registry_path: Path
    accuracy_path: Path
    field_validation_report_path: Path


def load_settings() -> Settings:
    backend_root = Path(__file__).resolve().parents[2]
    static_dir = backend_root / "static"
    static_dir.mkdir(parents=True, exist_ok=True)

    return Settings(
        app_env=os.getenv("APP_ENV", "development"),
        mongo_uri=os.getenv("MONGO_URI", "mongodb://localhost:27017"),
        jwt_secret_key=os.getenv("JWT_SECRET_KEY", "change-me-in-production"),
        jwt_expiry_minutes=_to_int(os.getenv("JWT_EXPIRY_MINUTES"), 60 * 24),
        ai_confidence_threshold=_to_float(os.getenv("AI_CONFIDENCE_THRESHOLD"), 75.0),
        allow_legacy_mocks=_to_bool(os.getenv("ALLOW_LEGACY_MOCKS"), False),
        enable_legacy_api=_to_bool(
            os.getenv("ENABLE_LEGACY_API"),
            os.getenv("APP_ENV", "development").strip().lower() != "production",
        ),
        rate_limit_requests=_to_int(os.getenv("RATE_LIMIT_REQUESTS"), 120),
        rate_limit_window_seconds=_to_int(os.getenv("RATE_LIMIT_WINDOW_SECONDS"), 60),
        openweather_api_key=os.getenv("OPENWEATHER_API_KEY", ""),
        vapi_api_key=os.getenv("VAPI_API_KEY", ""),
        vapi_assistant_id=os.getenv("VAPI_ASSISTANT_ID", ""),
        vapi_phone_number_id=os.getenv("VAPI_PHONE_NUMBER_ID", ""),
        vapi_webhook_secret=os.getenv("VAPI_WEBHOOK_SECRET", ""),
        vapi_url=os.getenv("VAPI_URL", "https://api.vapi.ai/call"),
        group_api_url=os.getenv("GROUP_API_URL", ""),
        group_api_key=os.getenv("GROUP_API_KEY", ""),
        group_api_timeout=_to_float(os.getenv("GROUP_API_TIMEOUT"), 5.0),
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        bhashini_api_url=os.getenv("BHASHINI_API_URL", "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"),
        bhashini_api_key=os.getenv("BHASHINI_API_KEY", ""),
        bhashini_user_id=os.getenv("BHASHINI_USER_ID", ""),
        sarvam_api_key=os.getenv("SARVAM_API_KEY", ""),
        sarvam_model=os.getenv("SARVAM_MODEL", "bulbul:v3"),
        sarvam_chat_model=os.getenv("SARVAM_CHAT_MODEL", "sarvam-105b"),
        sarvam_stt_model=os.getenv("SARVAM_STT_MODEL", "saaras:v3"),
        sarvam_speaker=os.getenv("SARVAM_SPEAKER", "ritu"),
        groq_api_key=os.getenv("GROQ_API_KEY", ""),
        groq_chat_model=os.getenv("GROQ_CHAT_MODEL", "openai/gpt-oss-120b"),
        groq_stt_model=os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo"),
        mistral_api_url=os.getenv("MISTRAL_API_URL", "https://api.mistral.ai/v1"),
        mistral_api_key=os.getenv("MISTRAL_API_KEY", ""),
        mistral_model=os.getenv("MISTRAL_MODEL", "mistral-large-latest"),
        stt_provider=os.getenv("STT_PROVIDER", "sarvam"),
        tts_provider=os.getenv("TTS_PROVIDER", "sarvam"),
        static_dir=static_dir,
        model_registry_path=static_dir / "model_registry.json",
        accuracy_path=static_dir / "accuracy.json",
        field_validation_report_path=static_dir / "field_validation_report.json",
    )




settings = load_settings()

