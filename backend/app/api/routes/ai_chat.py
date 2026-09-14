import logging
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.api.deps import enforce_rate_limit
from app.services.assistant import assistant_orchestrator, conversation_state_manager
from app.services.market import mandi_trend_service

router = APIRouter(prefix="/ai", tags=["AI Chat"], dependencies=[Depends(enforce_rate_limit)])
logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "model", "system"] = "user"
    content: str = Field(default="", max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(default="", max_length=4000)
    conversation_id: Optional[str] = Field(default=None, description="Stable conversation UUID")
    history: List[ChatMessage] = Field(default_factory=list)
    voice_mode: bool = Field(default=False)
    language: str = Field(default="Hindi")
    crop: Optional[str] = None
    location: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class ResetConversationRequest(BaseModel):
    conversation_id: str
    language: Optional[str] = "Hindi"


class NormalizedChatResponse(BaseModel):
    success: bool = True
    answer: str
    response: str  # Backwards compatibility alias for answer
    language: str = "hi"
    source: str = "primary"
    confidence: float = 0.95
    suggestions: List[str] = Field(default_factory=list)
    audio: Optional[str] = None
    voice_url: Optional[str] = None
    navigate: Optional[str] = None
    latency_sec: Optional[float] = None
    conversation_id: Optional[str] = None


MANDI_QUERY_KEYWORDS = [
    "mandi", "rate", "price", "bhav", "bhaav", "dam", "daam", "bikri", "bechna", "sell", "market", "ret",
    "मंडी", "भाव", "दाम", "बिक्री", "बेचना", "बाजार", "कीमत", "रेट", "मंडी भाव", "ਮੰਡੀ", "ਭਾਅ"
]

CROP_MAP = {
    "wheat": "Wheat", "gehu": "Wheat", "gehun": "Wheat", "गेहूं": "Wheat", "गेहूँ": "Wheat", "ਕਣਕ": "Wheat",
    "rice": "Rice", "paddy": "Rice", "dhan": "Rice", "धान": "Rice", "चावल": "Rice", "ਝੋਨਾ": "Rice",
    "tomato": "Tomato", "tamatar": "Tomato", "टमाटर": "Tomato", "ਟਮਾਟਰ": "Tomato",
    "potato": "Potato", "aloo": "Potato", "aalu": "Potato", "आलू": "Potato", "ਆਲੂ": "Potato",
    "onion": "Onion", "pyaj": "Onion", "pyaz": "Onion", "प्याज": "Onion", "ਗੰਢਾ": "Onion",
    "mustard": "Mustard", "sarson": "Mustard", "सरसों": "Mustard", "ਸਰ੍ਹੋਂ": "Mustard",
    "cotton": "Cotton", "kapas": "Cotton", "कपास": "Cotton", "ਕਪਾਹ": "Cotton",
    "maize": "Maize", "corn": "Maize", "makka": "Maize", "मक्का": "Maize", "ਮੱਕੀ": "Maize",
    "soybean": "Soybean", "सोयाबीन": "Soybean",
    "sugarcane": "Sugarcane", "ganna": "Sugarcane", "गन्ना": "Sugarcane", "ਗੰਨਾ": "Sugarcane",
}


import re

def extract_crop_from_query(text: str, default_crop: Optional[str] = None) -> str:
    lower = text.lower()
    for kw in sorted(CROP_MAP.keys(), key=lambda k: len(k), reverse=True):
        pattern = r"\b" + re.escape(kw) + r"\b" if kw.isascii() else re.escape(kw)
        if re.search(pattern, lower):
            return CROP_MAP[kw]
    return default_crop or "Wheat"


def is_mandi_query(text: str) -> bool:
    if not text:
        return False
    lower = text.lower()
    return any(kw in lower for kw in MANDI_QUERY_KEYWORDS)


@router.post("/chat", response_model=NormalizedChatResponse)
@router.post("/assistant", response_model=NormalizedChatResponse)
async def chat_with_assistant(req: ChatRequest):
    """
    Multilingual Farmer AI Assistant with Group API (Primary) and Gemini (Automatic Fallback).
    Maintains persistent conversation state and strict natural greeting control.
    """
    user_query = req.message.strip()

    if not user_query:
        return NormalizedChatResponse(
            success=True,
            answer="नमस्ते किसान जी! आप अपनी फसल या खेती के बारे में कुछ भी पूछ सकते हैं।",
            response="नमस्ते किसान जी! आप अपनी फसल या खेती के बारे में कुछ भी पूछ सकते हैं।",
            language="hi",
            source="degraded",
            suggestions=["📷 पत्ती की फोटो भेजें", "🌾 खाद की सही मात्रा", "💰 मंडी भाव"],
            conversation_id=req.conversation_id,
        )

    # Build context dictionary
    ctx: Dict[str, Any] = req.context or {}
    if req.crop:
        ctx["crop"] = req.crop
    if req.location:
        ctx["location"] = req.location
    if req.conversation_id:
        ctx["conversation_id"] = req.conversation_id

    # Inject mandi trend intelligence ONLY when user query is about mandi/prices
    if is_mandi_query(user_query):
        try:
            detected_crop = extract_crop_from_query(user_query, req.crop)
            mandi_intel = await mandi_trend_service.get_mandi_intelligence(
                commodity=detected_crop,
                location=req.location,
            )
            if mandi_intel and mandi_intel.get("modal_price", 0) > 0:
                ctx["mandi_trends"] = (
                    f"Official AGMARKNET Data (data.gov.in): {mandi_intel.get('commodity')} at {mandi_intel.get('nearest_mandi')} ({mandi_intel.get('state')}). "
                    f"Modal Price: ₹{mandi_intel.get('modal_price')}/quintal, Range: {mandi_intel.get('price_range')}, "
                    f"Arrival Date: {mandi_intel.get('arrival_date')}."
                )
                ctx["mandi_data_freshness"] = mandi_intel.get("data_freshness", "live")
        except Exception as e:
            logger.warning(f"Failed to inject mandi intelligence into context: {e}")

    # Pass conversation history
    if req.history:
        ctx["history"] = [{"role": m.role, "content": m.content} for m in req.history[-6:]]

    result = await assistant_orchestrator.ask(
        message=user_query,
        context=ctx,
        language=req.language,
        voice_requested=req.voice_mode,
        conversation_id=req.conversation_id,
    )

    answer = result.get("answer", "")
    raw_source = str(result.get("source", "primary")).lower()
    if "local" in raw_source or "degraded" in raw_source:
        normalized_source = "degraded"
    elif "fallback" in raw_source or "gemini" in raw_source or "mistral" in raw_source:
        normalized_source = "fallback"
    else:
        normalized_source = "primary"

    return NormalizedChatResponse(
        success=True,
        answer=answer,
        response=answer,
        language=result.get("language", "hi"),
        source=normalized_source,
        confidence=result.get("confidence", 0.90),
        suggestions=result.get("suggestions", []),
        audio=result.get("audio"),
        voice_url=result.get("audio"),
        navigate=result.get("navigate"),
        latency_sec=result.get("latency_sec"),
        conversation_id=result.get("conversation_id"),
    )


@router.post("/reset")
async def reset_conversation_endpoint(req: ResetConversationRequest):
    """
    Explicitly resets conversation state for a given conversation_id.
    """
    state = conversation_state_manager.reset_conversation(req.conversation_id, req.language or "hi")
    return {"success": True, "conversation_id": state.conversation_id, "message": "Conversation state reset successfully."}


@router.post("/analyze-leaf")
async def analyze_leaf_image(
    image: UploadFile = File(...),
    question: str = Form(default="इस पत्ते में क्या बीमारी है?"),
    crop: str = Form(default=""),
    language: str = Form(default="Hindi"),
    conversation_id: Optional[str] = Form(default=None),
):
    """
    Multimodal image analysis via Group API with Gemini vision fallback.
    """
    if image.content_type and not (image.content_type.startswith("image/") or image.content_type in ["application/octet-stream"]):
        raise HTTPException(status_code=400, detail="Invalid file type. Image file required.")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image file is empty.")

    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size exceeds maximum limit of 10MB.")

    context = {"crop": crop} if crop else {}
    if conversation_id:
        context["conversation_id"] = conversation_id

    result = await assistant_orchestrator.analyze_plant(
        question=question,
        image_bytes=image_bytes,
        context=context,
        language=language,
        conversation_id=conversation_id,
    )
    raw_source = str(result.get("source", "primary")).lower()
    if "local" in raw_source or "degraded" in raw_source:
        norm_source = "degraded"
    elif "fallback" in raw_source or "gemini" in raw_source:
        norm_source = "fallback"
    else:
        norm_source = "primary"

    return {
        "success": True,
        "answer": result.get("answer"),
        "response": result.get("answer"),
        "language": result.get("language"),
        "source": norm_source,
        "confidence": result.get("confidence"),
        "suggestions": result.get("suggestions"),
        "navigate": result.get("navigate"),
        "conversation_id": result.get("conversation_id"),
    }
