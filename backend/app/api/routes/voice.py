import io
from typing import Dict, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.api.deps import enforce_rate_limit
from app.services.assistant import assistant_orchestrator, get_normalized_lang_code
from app.services.diagnosis import normalize_language, translate

router = APIRouter(prefix="/voice", tags=["Voice"], dependencies=[Depends(enforce_rate_limit)])

LANG_ISO_MAP: Dict[str, str] = {
    "English": "en-IN",
    "हिंदी": "hi",
    "भोजपुरी": "hi",
    "मैथिली": "hi",
    "ਪੰਜਾਬੀ": "pa",
    "मराठी": "mr",
    "ગુજરાતી": "gu",
    "తెలుగు": "te",
}


class TranscribeResponse(BaseModel):
    success: bool
    text: str
    language: str
    confidence: float
    provider: str


class SynthesizeRequest(BaseModel):
    text: str
    language: str = "Hindi"
    voice: Optional[str] = None


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(default=None),
):
    """
    Speech-To-Text endpoint with provider priority:
    1. Groq Whisper
    2. Sarvam Saaras v3
    3. Bhashini ASR
    4. AI4Bharat / Local fallback
    """
    if audio.content_type and not (audio.content_type.startswith("audio/") or audio.content_type in ["application/octet-stream"]):
        raise HTTPException(status_code=400, detail="Invalid file type. Audio file required.")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    if len(audio_bytes) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file size exceeds maximum limit of 15MB")

    result = await assistant_orchestrator.stt.transcribe(audio_bytes, language=language)
    return TranscribeResponse(
        success=True,
        text=result.get("text", ""),
        language=result.get("language", "hi"),
        confidence=result.get("confidence", 0.90),
        provider=result.get("provider", "bhashini"),
    )


@router.post("/synthesize")
async def synthesize_speech(req: SynthesizeRequest):
    """
    Text-To-Speech endpoint with provider priority:
    1. Sarvam Bulbul v3
    2. gTTS fallback
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    result = await assistant_orchestrator.tts.synthesize(
        text=req.text,
        language=req.language,
        voice=req.voice,
    )
    return {
        "success": True,
        "audio_base64": result.get("audio_base64"),
        "format": result.get("format", "mp3"),
        "provider": result.get("provider"),
        "language": result.get("language"),
    }


@router.post("/intent")
async def parse_voice_command(
    audio: UploadFile = File(default=None),
    text: str = Form(default=""),
    lang: str = Form(default="English"),
    conversation_id: Optional[str] = Form(default=None),
):
    """
    Voice command parser with fallback intent matching
    """
    transcribed_text = text.strip()
    if audio is not None and not transcribed_text:
        if audio.content_type and not (audio.content_type.startswith("audio/") or audio.content_type in ["application/octet-stream"]):
            raise HTTPException(status_code=400, detail="Invalid file type. Audio file required.")
        audio_bytes = await audio.read()
        if audio_bytes:
            if len(audio_bytes) > 15 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Audio file size exceeds maximum limit of 15MB")
            stt_res = await assistant_orchestrator.stt.transcribe(audio_bytes, language=lang)
            transcribed_text = stt_res.get("text", "")

    command_text = transcribed_text.lower() if transcribed_text else "what is the weather?"
    lang = normalize_language(lang)

    if any(keyword in command_text for keyword in ["weather", "mausam", "mausami", "havaman"]):
        intent = "check_weather"
        response_text = translate("voice_weather_response", lang, "There is a strong chance of rain tomorrow. Avoid spraying today.")
        recommended_action = "open_weather"
    elif any(keyword in command_text for keyword in ["disease", "bimari", "rog", "scan"]):
        intent = "disease_scan"
        response_text = translate("voice_scan_response", lang, "Open the scanner and capture a clear leaf image.")
        recommended_action = "open_scanner"
    else:
        intent = "chat"
        # Route through full orchestrator with conversation_id
        chat_res = await assistant_orchestrator.ask(message=command_text, language=lang, conversation_id=conversation_id)
        response_text = chat_res.get("answer", "")
        recommended_action = chat_res.get("navigate") or "continue_chat"

    return {
        "success": True,
        "input_text": command_text,
        "mapped_intent": intent,
        "assistant_response": response_text,
        "recommended_action": recommended_action,
        "tts_lang": LANG_ISO_MAP.get(lang, "en-IN"),
        "conversation_id": chat_res.get("conversation_id") if intent == "chat" else conversation_id,
    }
