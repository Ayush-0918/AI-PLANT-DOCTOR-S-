import asyncio
import base64
import json
import logging
import os
import random
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx
from app.core.config import settings
from app.services.assistant.conversation_state import (
    ACKNOWLEDGEMENT_POOLS,
    CLOSING_POOLS,
    ConversationState,
    conversation_state_manager,
    extract_clean_final_answer,
    is_reasoning_artifact,
)

from app.services.voice.ai4bharat_provider import AI4BharatIndicConformerSTT

logger = logging.getLogger(__name__)

# Try to import official Sarvam AI SDK
try:
    from sarvamai import SarvamAI
    sarvam_sdk_available = True
except ImportError:
    SarvamAI = None
    sarvam_sdk_available = False

# Try to import official Groq SDK
try:
    from groq import Groq
    groq_sdk_available = True
except ImportError:
    Groq = None
    groq_sdk_available = False

# ============================================================
# BASE SYSTEM PROMPT & FARMER PERSONALITY BUILDER
# ============================================================
FARMER_BASE_PERSONA = """You are Plant Doctor (Sahayak / सहायक), a warm, highly intelligent, empathetic, and expert agricultural companion sitting right beside the Indian farmer.

### Core Character Traits:
1. Warm & Natural Companion: Speak with genuine empathy, respect, and warmth — like an experienced local krishi agronomist sitting beside the farmer.
2. Seamless Multilingual Mastery:
   - Hindi (हिंदी): Conversational, clear, respectful Indian tone.
   - Bhojpuri (भोजपुरी): Warm Bhojpuri-infused phrasing (e.g., "राम राम! रउआ बताईं, आज खेती-बाड़ी या मौसम में का मदद करीं?").
   - Punjabi (ਪੰਜਾਬੀ): Warm Gurmukhi phrasing (e.g., "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਦੱਸੋ ਅੱਜ ਤੁਹਾਡੀ ਖੇਤੀ-ਬਾੜੀ ਬਾਰੇ ਕੀ ਮਦਦ ਕਰਾਂ?").
   - English: Direct, friendly Indian agricultural advice.
3. Casual Talk & Greetings Protocol:
   - For simple greetings ("Hi", "Hello", "Hey", "नमस्ते", "प्रणाम", "सत श्री अकाल"): reply simply, warmly, and politely back to the greeting. Ask how you can assist them with their farming today.
   - STRICT RULE: NEVER say "I am doing well" or "thanks for asking" unless the farmer explicitly asks "how are you?" / "आप कैसे हो?" / "का हाल बा?" / "ਕਿਵੇਂ ਹੋ?".
   - STRICT RULE: NEVER assume, invent, or mention any specific crop (such as wheat, tomato, paddy) on a general greeting unless explicitly mentioned by the farmer in their query.
4. Professional Agronomist Formatting:
   - Keep answers concise (2-4 sentences or 2-3 structured bullet points).
   - Avoid robotic chemical lists or complex jargon without context.
   - If diagnosing an issue without a photo, politely request a clear photo of the leaf/plant for 100% diagnostic certainty.
5. Strict Safety Guardrails:
   - NEVER suggest synthetic chemical pesticides with specific numeric dosages unless a crop photo diagnosis is confirmed. Offer safe organic measures (neem oil) and recommend local KVK.
6. App Navigation Tags:
   - Append navigation tags when user requests tools: NAVIGATE:/scanner, NAVIGATE:/marketplace, NAVIGATE:/dashboard, NAVIGATE:/mandi, NAVIGATE:/soil.
"""

LANG_CODE_MAP = {
    "English": "en",
    "en": "en",
    "hindi": "hi",
    "हिंदी": "hi",
    "Hindi": "hi",
    "hi": "hi",
    "bho": "bho",
    "bhojpuri": "bho",
    "भोजपुरी": "bho",
    "Bhojpuri": "bho",
    "ਪੰਜਾਬੀ": "pa",
    "Punjabi": "pa",
    "pa": "pa",
    "punjabi": "pa",
    "मैथिली": "hi",
    "मराठी": "mr",
    "ગુજરાતી": "gu",
    "తెలుగు": "te",
    "বাংলা": "bn",
    "தமிழ்": "ta",
    "ಕನ್ನಡ": "kn",
    "മലയാളം": "ml",
    "ଓਡ଼ిਆ": "od",
}

SARVAM_LANG_MAP = {
    "hi": "hi-IN",
    "bho": "hi-IN",
    "pa": "pa-IN",
    "en": "en-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "bn": "bn-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "od": "od-IN",
}

NAV_INTENT_KEYWORDS = {
    "/scanner": ["scan", "scanner", "camera", "photo", "leaf photo", "स्कैन", "कैमरा", "फोटो", "पत्ती की फोटो", "ਸਕੈਨ"],
    "/marketplace": ["shop", "buy", "market", "bazaar", "fertilizer buy", "दुकान", "बाजार", "खरीद", "दुकानदार", "ਦੁਕਾਨ"],
    "/community": ["community", "farmers group", "forum", "समुदाय", "किसान मंच", "ਸਮੂਹ"],
    "/soil": ["soil", "mitti", "soil test", "मिट्टी", "जांच", "ਮਿੱਟੀ"],
    "/dashboard": ["home", "weather", "mandi", "dashboard", "घर", "मौसम", "मंडी भाव", "ਮੌਸਮ", "ਮੰਡੀ"],
}


def detect_navigation_intent(text: str) -> Optional[str]:
    lower = text.lower()
    for route, keywords in NAV_INTENT_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            if any(action in lower for action in ["open", "go to", "show", "खोलो", "खोलीं", "ਦਿਖਾਓ", "ਜਾਓ", "le chalo"]):
                return route
    return None


def get_normalized_lang_code(lang: Optional[str]) -> str:
    if not lang:
        return "hi"
    return LANG_CODE_MAP.get(lang.strip(), "hi")


# Regex catching synthetic chemical pesticide names and numeric dosage units
CHEMICAL_NAMES_REGEX = re.compile(
    r"\b(carbaryl|chlorpyrifos|imidacloprid|monocrotophos|cypermethrin|malathion|mancozeb|carbendazim|lambda-cyhalothrin|thiamethoxam|acetamiprid|dimethoate|triazophos)\b",
    re.IGNORECASE,
)

DOSAGE_UNITS_REGEX = re.compile(
    r"(\d+(\.\d+)?\s*(g|ml|kg|l|L|mg)\b|\d+(\.\d+)?\s*g\s*L⁻¹|g/L|ml/L)",
    re.IGNORECASE,
)


def validate_and_sanitize_pesticide_safety(text: str, has_photo_diagnosis: bool, language: str = "hi") -> str:
    """
    Safety Guardrail (Bug D): Flags and sanitizes responses that output synthetic chemical pesticide names
    paired with numeric dosages when no confirmed photo diagnosis exists.
    """
    if not text or has_photo_diagnosis:
        return text

    if CHEMICAL_NAMES_REGEX.search(text) and DOSAGE_UNITS_REGEX.search(text):
        logger.warning("⚠️ SAFETY VIOLATION DETECTED: Synthetic chemical pesticide dosage suggested without photo diagnosis! Sanitizing response...")
        
        # Split text into sentences and strip sentences that recommend synthetic chemicals with dosages
        sentences = re.split(r"(?<=[.!?।])\s+", text)
        clean_sentences = [s for s in sentences if not CHEMICAL_NAMES_REGEX.search(s)]

        if language == "pa":
            safety_note = "ਕਿਸੇ ਵੀ ਰਸਾਇਣਕ ਕੀਟਨਾਸ਼ਕ ਦੀ ਸਟੀਕ ਖੁਰਾਕ ਲਈ ਆਪਣੇ ਨੇੜਲੇ ਕ੍ਰਿਸ਼ੀ ਵਿਗਿਆਨ ਕੇਂਦਰ (KVK) ਜਾਂ ਖੇਤੀਬਾੜੀ ਅਧਿਕਾਰੀ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।"
        elif language == "en":
            safety_note = "For exact chemical pesticide dosage, please consult your local Krishi Vigyan Kendra (KVK) or agricultural extension officer."
        elif language in ["bho", "bhojpuri"]:
            safety_note = "कवनो रासायनिक कीटनाशक के सही खुराक खातिर नजदीकी कृषि विज्ञान केंद्र (KVK) या दुकान से पैकेट पर लिखल खुराक ही लीं।"
        else:
            safety_note = "किसी भी रासायनिक कीटनाशक की सटीक खुराक के लिए अपने नजदीकी कृषि विज्ञान केंद्र (KVK) या कृषि विशेषज्ञ की सलाह लें।"

        clean_text = " ".join(clean_sentences).strip()
        if not clean_text:
            if language == "pa":
                clean_text = "ਕੀੜਿਆਂ ਦੇ ਸ਼ੁਰੂਆਤੀ ਬਚਾਅ ਲਈ ਨਿੰਮ ਦੇ ਤੇਲ ਦਾ ਛਿੜਕਾਅ ਕਰੋ ਅਤੇ ਪ੍ਰਭਾਵਿਤ ਪੱਤੇ ਦੀ ਸਾਫ਼ ਫੋਟੋ ਭੇਜੋ।"
            elif language == "en":
                clean_text = "For initial pest control, spray neem oil solution and please share a clear photo of the affected crop leaf."
            elif language in ["bho", "bhojpuri"]:
                clean_text = "कीड़ा लागल बा त नीम के पानी या नीम तेल के छिड़काव करीं और एगो साफ फोटो भेजीं।"
            else:
                clean_text = "कीड़ों के शुरुआती बचाव के लिए नीम तेल के घोल का छिड़काव करें और प्रभावित पत्ते की एक साफ फोटो भेजें。"

        return f"{clean_text} {safety_note}".strip()

    return text


GENERAL_GREETING_WORDS = {
    "hi", "hello", "hey", "namaste", "namaskar", "pranam", "kaise", "ho", "kya", "haal",
    "hai", "kidaan", "who", "are", "you", "kon", "tum", "kaun", "good", "morning",
    "evening", "afternoon", "help", "madad", "kaal", "baho", "bahu", "bara", "bani",
    "chalat", "raua", "veere", "paaji", "kime", "नमस्ते", "नमस्कार", "प्रणाम", "हेलो",
    "हैलो", "सत", "श्री", "अकाल", "ਸਤਿ", "ਸ੍ਰੀ", "ਅਕਾਲ", "कैसे", "क्या", "हाल", "कौन", "तुम"
}

HOW_ARE_YOU_PATTERNS = re.compile(
    r"(how\s*are\s*you|kaise\s*(ho|hain|ba)|ka\s*haal\s*ba|kaisa?n\s*ba|kime\s*ho|kidaan|kaise\s*ho\s*aap|aap\s*kaise\s*hain)",
    re.IGNORECASE,
)

CROP_AGRICULTURAL_KEYWORDS = [
    "गेहूं", "धान", "चावल", "मक्का", "सरसों", "आलू", "टमाटर", "कपास", "चना", "सोयाबीन",
    "खाद", "यूरिया", "डीएपी", "पोटाश", "कीट", "सुंडी", "रोग", "पीला", "पत्ते", "मंडी",
    "मौसम", "सिंचाई", "बुवाई", "बीज", "कटाई", "bhojpuri", "punjabi", "hindi", "english",
    "wheat", "paddy", "rice", "tomato", "potato", "cotton", "fertilizer", "urea", "dap",
    "pest", "disease", "yellow", "leaf", "leaves", "mandi", "weather", "sowing", "seed"
]


def is_general_conversational_query(text: str) -> bool:
    if not text or not text.strip():
        return True
    cleaned = re.sub(r"[^\w\s]", "", text.strip().lower())
    words = cleaned.split()
    has_crop_kw = any(kw in cleaned for kw in CROP_AGRICULTURAL_KEYWORDS)
    if not has_crop_kw:
        return True
    if len(words) <= 4 and any(w in GENERAL_GREETING_WORDS for w in words):
        return True
    return False


def is_how_are_you_query(text: str) -> bool:
    if not text:
        return False
    return bool(HOW_ARE_YOU_PATTERNS.search(text))


def build_farmer_system_prompt(
    state: ConversationState,
    greeting_mode: str,
    context: Optional[Dict[str, Any]] = None,
    user_message: str = "",
) -> str:
    """
    Build dynamic system prompt containing greeting rules, rotation exclusions, and conversation context.
    """
    lines = [FARMER_BASE_PERSONA]

    is_general_msg = is_general_conversational_query(user_message)
    is_how_are_you = is_how_are_you_query(user_message)

    farmer_name = ""
    if context and isinstance(context, dict):
        profile_ctx = context.get("farmer_profile") or {}
        if isinstance(profile_ctx, dict):
            farmer_name = profile_ctx.get("name") or ""

    name_str = f" {farmer_name}" if farmer_name else ""

    # 1. Greeting & Conversational Mode Directive
    if is_how_are_you:
        lines.append(
            f"\n### WELLBEING DIRECTIVE:\n"
            f"- The farmer explicitly asked how you are doing ('how are you' / 'कैसे हो' / 'का हाल बा').\n"
            f"- Reply warmly that you are doing well, thank them politely, and ask how you can assist{name_str} with their crops, weather, or mandi rates today."
        )
    elif is_general_msg:
        lines.append(
            f"\n### GENERAL GREETING DIRECTIVE:\n"
            f"- The farmer sent a simple greeting (e.g. 'hello', 'hi', 'hey', 'नमस्ते', 'प्रणाम').\n"
            f"- Reply with a simple, warm greeting back{name_str} (e.g. 'Hello{name_str}! How can I help you today?' or 'नमस्ते{name_str}! मैं आपकी क्या सहायता कर सकता हूँ?').\n"
            f"- STRICT RULE: DO NOT say 'I am doing well' or 'thanks for asking' because the user did NOT ask how you are doing!\n"
            f"- DO NOT mention any crop unless specified by the farmer."
        )
    elif greeting_mode == "none":
        lines.append(
            "\n### CRITICAL GREETING DIRECTIVE:\n"
            "- DO NOT use any greeting or salutation (NO 'नमस्ते', 'नमस्कार', 'प्रणाम', 'हेलो', 'हैलो', 'सत श्री अकाल', 'Hello', 'Hi', etc.).\n"
            "- Start directly with the answer or a natural acknowledgement from the allowed pool."
        )
    elif greeting_mode == "first_greeting":
        lines.append(
            "\n### GREETING DIRECTIVE:\n"
            "- This is the FIRST message of the conversation. Greet the farmer warmly ONCE (e.g. 'नमस्ते जी!', 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਵੀਰ ਜੀ!'), then address their problem."
        )
    elif greeting_mode == "explicit_farmer_greeting":
        topic_ref = f"regarding '{state.last_topic}'" if state.last_topic else "their ongoing farming situation"
        lines.append(
            f"\n### MANDATORY GREETING DIRECTIVE:\n"
            f"- The farmer just greeted you. You MUST start your response with a brief greeting back (e.g. 'नमस्ते जी!', 'ਜੀ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ!').\n"
            f"- Continue the conversation {topic_ref} or ask how you can assist them today."
        )
    elif greeting_mode == "welcome_back":
        topic_ref = f"regarding '{state.last_topic}'" if state.last_topic else "their farming activities"
        lines.append(
            f"\n### GREETING DIRECTIVE:\n"
            f"- The farmer returned after an inactive break (>30 minutes). Give a soft welcome back (e.g. 'नमस्ते फिर से जी!', 'ਜੀ, ਸਵਾਗਤ ਹੈ ਵਾਪਸ।'),\n"
            f"- Then follow up on {topic_ref} or their latest message."
        )

    # 2. Language Directive
    lang_code = state.language or "hi"
    if lang_code == "pa":
        lines.append("\n- Respond strictly in natural, conversational Punjabi (Gurmukhi script).")
    elif lang_code == "en":
        lines.append("\n- Respond in clear, friendly English with Indian farming context.")
    elif lang_code in ["bho", "bhojpuri", "भोजपुरी"]:
        lines.append(
            "\n### CRITICAL BHOJPURI LANGUAGE DIRECTIVE:\n"
            "- The farmer explicitly requested Bhojpuri or is a Bhojpuri speaker.\n"
            "- You MUST reply in warm, simple Hindi using natural Bhojpuri phrasing, vocabulary, and rhythm (e.g. 'राम राम भइया!', 'रउआ', 'बताईं', 'परेशानी बा', 'चिंता मत करीं', 'का हाल बा', 'फोटो भेजीं').\n"
            "- DO NOT reply in English.\n"
            "- DO NOT output meta-commentary like 'Sure, I can help in a Bhojpuri-flavoured way'. Respond IMMEDIATELY in Bhojpuri-infused Hindi!"
        )
    else:
        lines.append("\n- Respond in natural, conversational Hindi.")

    # 3. Rotating Phrase Constraints
    if state.recent_acknowledgements:
        lines.append(f"\n- DO NOT REUSE these recent acknowledgements: {json.dumps(state.recent_acknowledgements, ensure_ascii=False)}")
    if state.recent_closings:
        lines.append(f"\n- DO NOT REUSE these recent closings: {json.dumps(state.recent_closings, ensure_ascii=False)}")

    # 4. Mandi Data Freshness Directive
    if context and isinstance(context, dict) and context.get("mandi_data_freshness") == "cached_static":
        lines.append(
            "\n### MANDI DATA FRESHNESS DIRECTIVE:\n"
            "- The mandi price information in context comes from a static historical database fallback (live search was temporarily unavailable).\n"
            "- When sharing mandi prices, soften your claim appropriately (e.g. 'यह पिछली जानकारी के अनुसार है, ताज़ा भाव के लिए मंडी में पता करें') rather than stating prices with absolute real-time confidence."
        )

    # 5. Contextual Field Details
    if context:
        ctx_items = [f"{k}: {v}" for k, v in context.items() if v and k != "history"]
        if ctx_items:
            lines.append(f"\nFarmer Context: {', '.join(ctx_items)}")

    return "\n".join(lines)


# ============================================================
# 1. GROUP API CLIENT (PRIMARY AI)
# ============================================================
class GroupApiClient:
    def __init__(self):
        self.url = settings.group_api_url
        self.api_key = settings.group_api_key
        self.timeout = settings.group_api_timeout or 5.0

    def is_configured(self) -> bool:
        return bool(self.url and self.url.startswith("http"))

    async def health_check(self) -> bool:
        if not self.is_configured():
            return False
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"{self.url.rstrip('/')}/health")
                return res.status_code == 200
        except Exception:
            return False

    async def ask_assistant(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("Group API URL is not configured.")

        payload = {
            "message": message,
            "context": context or {},
            "system_prompt": system_prompt or FARMER_BASE_PERSONA,
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["X-API-Key"] = self.api_key

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            res = await client.post(f"{self.url.rstrip('/')}/ask", json=payload, headers=headers)
            if res.status_code != 200:
                raise RuntimeError(f"Group API returned HTTP {res.status_code}: {res.text}")
            data = res.json()
            answer = data.get("response") or data.get("answer") or data.get("text") or ""
            return {
                "answer": answer.strip(),
                "source": "group_api",
                "confidence": data.get("confidence", 0.95),
                "suggestions": data.get("suggestions", []),
            }

    async def analyze_plant(
        self,
        question: str,
        image_bytes: bytes,
        context: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("Group API URL is not configured.")

        img_b64 = base64.b64encode(image_bytes).decode("utf-8")
        payload = {
            "question": question,
            "image": img_b64,
            "context": context or {},
            "system_prompt": system_prompt or FARMER_BASE_PERSONA,
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        async with httpx.AsyncClient(timeout=self.timeout + 3.0) as client:
            res = await client.post(f"{self.url.rstrip('/')}/analyze", json=payload, headers=headers)
            if res.status_code != 200:
                raise RuntimeError(f"Group API analysis failed with {res.status_code}")
            data = res.json()
            return {
                "answer": data.get("answer") or data.get("response") or "",
                "source": "group_api",
                "confidence": data.get("confidence", 0.90),
                "suggestions": data.get("suggestions", []),
            }


# ============================================================
# 2. SARVAM-105B CHAT CLIENT (INDIC REASONING AI TIER)
# ============================================================
class SarvamChatClient:
    def __init__(self):
        self.api_key = settings.sarvam_api_key or os.getenv("SARVAM_API_KEY", "")
        self.model = settings.sarvam_chat_model or "sarvam-105b"
        self.client = None
        if self.api_key and sarvam_sdk_available and SarvamAI:
            try:
                self.client = SarvamAI(api_subscription_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize SarvamAI SDK: {e}")

    def is_configured(self) -> bool:
        return bool(self.api_key and self.client)

    async def ask_assistant(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.is_configured() or not self.client:
            raise RuntimeError("Sarvam AI Client is not configured.")

        system_msg = system_prompt or FARMER_BASE_PERSONA
        messages = [
            {"role": "system", "content": system_msg},
        ]
        # Append history if present in context
        if context and "history" in context and isinstance(context["history"], list):
            for h in context["history"][-4:]:
                messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})

        messages.append({"role": "user", "content": message})

        def _call_sarvam():
            res = self.client.chat.completions(
                model=self.model,
                messages=messages,
                temperature=0.3,
                max_tokens=1024,
            )
            if res.choices and len(res.choices) > 0:
                msg = res.choices[0].message
                content = (msg.content or "").strip()
                # Do NOT use reasoning_content as main answer; extract clean final answer
                return extract_clean_final_answer(content)
            return ""

        loop = asyncio.get_event_loop()
        answer = await loop.run_in_executor(None, _call_sarvam)
        clean_answer = extract_clean_final_answer(answer)
        if not clean_answer or is_reasoning_artifact(clean_answer):
            raise RuntimeError("Sarvam completion contained reasoning artifacts.")

        return {
            "answer": clean_answer,
            "source": "sarvam_105b",
            "confidence": 0.96,
            "suggestions": self._generate_suggestions(clean_answer, message),
        }

    def _generate_suggestions(self, answer: str, query: str) -> List[str]:
        q = query.lower()
        if "पील" in q or "yellow" in q or "रोग" in q or "disease" in q:
            return ["📷 साफ पत्ती की फोटो भेजें", "🌾 खाद की सही मात्रा जानें", "📞 विशेषज्ञ से बात करें"]
        if "खाद" in q or "fertilizer" in q or "urea" in q or "dap" in q:
            return ["🌱 फसल का रकबा बताएं", "💧 सिंचाई का सही समय", "💰 नजदीकी दुकान देखें"]
        if "मौसम" in q or "weather" in q or "बारिश" in q:
            return ["🌤️ 7 दिन का मौसम पूर्वानुमान", "🌧️ छिड़काव कब करें?"]
        return ["📷 पौधे की फोटो भेजें", "💰 मंडी का ताजा भाव", "🌤️ आज का मौसम"]


# ============================================================
# 3. GROQ LPU CHAT CLIENT (ULTRA-FAST INFERENCE TIER)
# ============================================================
class GroqChatClient:
    def __init__(self):
        self.api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
        self.model = settings.groq_chat_model or "openai/gpt-oss-120b"
        self.client = None
        if self.api_key and groq_sdk_available and Groq:
            try:
                self.client = Groq(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to init Groq client: {e}")

    def is_configured(self) -> bool:
        return bool(self.api_key and self.client)

    async def ask_assistant(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.is_configured() or not self.client:
            raise RuntimeError("Groq Client is not configured.")

        system_msg = system_prompt or FARMER_BASE_PERSONA
        messages = [
            {"role": "system", "content": system_msg},
        ]
        if context and "history" in context and isinstance(context["history"], list):
            for h in context["history"][-4:]:
                messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})

        messages.append({"role": "user", "content": message})

        def _call_groq():
            # Groq completion with reasoning effort minimal/none
            try:
                res = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.3,
                    max_tokens=1024,
                )
                return res.choices[0].message.content or ""
            except Exception as e:
                logger.warning(f"Groq API error: {e}")
                return ""

        loop = asyncio.get_event_loop()
        answer = await loop.run_in_executor(None, _call_groq)
        clean_answer = extract_clean_final_answer(answer)
        if not clean_answer or is_reasoning_artifact(clean_answer):
            raise RuntimeError("Groq completion contained reasoning artifacts.")

        return {
            "answer": clean_answer,
            "source": "groq_120b",
            "confidence": 0.97,
            "suggestions": self._generate_suggestions(clean_answer, message),
        }

    def _generate_suggestions(self, answer: str, query: str) -> List[str]:
        q = query.lower()
        if "पील" in q or "yellow" in q or "रोग" in q or "disease" in q:
            return ["📷 साफ पत्ती की फोटो भेजें", "🌾 खाद की सही मात्रा जानें", "📞 विशेषज्ञ से बात करें"]
        if "खाद" in q or "fertilizer" in q or "urea" in q or "dap" in q:
            return ["🌱 फसल का रकबा बताएं", "💧 सिंचाई का सही समय", "💰 नजदीकी दुकान देखें"]
        if "मौसम" in q or "weather" in q or "बारिश" in q:
            return ["🌤️ 7 दिन का मौसम पूर्वानुमान", "🌧️ छिड़काव कब करें?"]
        return ["📷 पौधे की फोटो भेजें", "💰 मंडी का ताजा भाव", "🌤️ आज का मौसम"]


# ============================================================
# 4. GEMINI FALLBACK CLIENT (SECONDARY AI)
# ============================================================
class GeminiFallbackClient:
    def __init__(self):
        self.api_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "")
        self.model = settings.gemini_model or "gemini-2.0-flash"
        self.timeout = 7.0

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key != "your_gemini_api_key_here")

    async def ask_assistant(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("Gemini API key is not configured.")

        system_msg = system_prompt or FARMER_BASE_PERSONA
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        user_prompt = f"{system_msg}\n\nFarmer Query: \"{message}\""

        payload = {
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 350,
                "topP": 0.85,
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            res = await client.post(endpoint, json=payload, headers={"Content-Type": "application/json"})
            if res.status_code != 200:
                raise RuntimeError(f"Gemini API returned status {res.status_code}: {res.text}")
            data = res.json()
            text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            return {
                "answer": text.strip(),
                "source": "gemini_fallback",
                "confidence": 0.92,
                "suggestions": ["📷 साफ पत्ती की फोटो भेजें", "🌾 खाद की खुराक", "💰 मंडी भाव"],
            }

    async def analyze_plant(
        self,
        question: str,
        image_bytes: bytes,
        context: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("Gemini API key is not configured.")

        system_msg = system_prompt or FARMER_BASE_PERSONA
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        img_b64 = base64.b64encode(image_bytes).decode("utf-8")

        prompt = f"{system_msg}\nAnalyze this plant image and answer the farmer's question: \"{question}\". Keep it friendly, practical, and clear."
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {"inlineData": {"mimeType": "image/jpeg", "data": img_b64}},
                    ],
                }
            ],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 400},
        }

        async with httpx.AsyncClient(timeout=self.timeout + 4.0) as client:
            res = await client.post(endpoint, json=payload)
            if res.status_code != 200:
                raise RuntimeError(f"Gemini Vision call failed with status {res.status_code}")
            data = res.json()
            text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            return {
                "answer": text.strip(),
                "source": "gemini_fallback",
                "confidence": 0.90,
                "suggestions": ["📷 Take another photo", "🌱 Fertilizer Dosage", "📞 Call Crop Expert"],
            }


# ============================================================
# 4.5 MISTRAL AI FALLBACK CLIENT (THIRD-TIER FALLBACK #2)
# ============================================================
class MistralFallbackClient:
    """
    Mistral AI Fallback Client (Fallback #2 in Groq -> Gemini -> Mistral pipeline).
    Data privacy caveat: Do NOT include farmer PII or identifying data in prompts.
    Free Experiment tier provides OpenAI-SDK compatible API endpoint.
    """
    def __init__(self):
        self.url = getattr(settings, "mistral_api_url", None) or os.getenv("MISTRAL_API_URL", "https://api.mistral.ai/v1")
        self.api_key = getattr(settings, "mistral_api_key", None) or os.getenv("MISTRAL_API_KEY", "")
        self.model = getattr(settings, "mistral_model", None) or os.getenv("MISTRAL_MODEL", "mistral-large-latest")
        self.timeout = 7.0

    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    async def health_check(self) -> bool:
        if not self.is_configured():
            return False
        try:
            headers = {"Authorization": f"Bearer {self.api_key}"}
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.url.rstrip('/')}/models", headers=headers)
                return res.status_code == 200
        except Exception:
            return False

    async def ask_assistant(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
        system_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("Mistral API key is not configured.")

        system_msg = system_prompt or FARMER_BASE_PERSONA
        messages = [{"role": "system", "content": system_msg}]
        if context and "history" in context and isinstance(context["history"], list):
            for h in context["history"][-4:]:
                messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
        messages.append({"role": "user", "content": message})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 512,
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        endpoint = f"{self.url.rstrip('/')}/chat/completions"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            res = await client.post(endpoint, json=payload, headers=headers)
            if res.status_code != 200:
                raise RuntimeError(f"Mistral API returned status {res.status_code}: {res.text}")
            data = res.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            clean_answer = extract_clean_final_answer(content)
            if not clean_answer or is_reasoning_artifact(clean_answer):
                raise RuntimeError("Mistral completion was empty or contained reasoning artifacts.")

            return {
                "answer": clean_answer,
                "source": "mistral_fallback",
                "confidence": 0.88,
                "suggestions": ["📷 साफ पत्ती की फोटो भेजें", "🌾 खाद की खुराक", "💰 मंडी भाव"],
            }



# ============================================================
# 5. SPEECH-TO-TEXT (STT) ADAPTER (SAARAS V3 & GROQ WHISPER)
# ============================================================
class SpeechToTextClient:
    def __init__(self):
        self.sarvam_key = settings.sarvam_api_key or os.getenv("SARVAM_API_KEY", "")
        self.sarvam_model = settings.sarvam_stt_model or "saaras:v3"
        self.bhashini_url = settings.bhashini_api_url
        self.bhashini_key = settings.bhashini_api_key
        self.bhashini_user_id = settings.bhashini_user_id
        self.client = None
        self.ai4bharat_stt = AI4BharatIndicConformerSTT()
        if self.sarvam_key and sarvam_sdk_available and SarvamAI:
            try:
                self.client = SarvamAI(api_subscription_key=self.sarvam_key)
            except Exception as e:
                logger.warning(f"Failed to init Sarvam STT client: {e}")

    def normalize_language_code(self, lang: Optional[str]) -> str:
        code = get_normalized_lang_code(lang)
        return "hi" if code in ["hi", "bho", "mai"] else code

    async def transcribe(self, audio_bytes: bytes, language: Optional[str] = None) -> Dict[str, Any]:
        norm_lang = self.normalize_language_code(language)
        sarvam_lang = SARVAM_LANG_MAP.get(norm_lang, "hi-IN")

        # 1. Try Groq Whisper
        if groq_sdk_available and settings.groq_api_key and Groq:
            try:
                def _call_groq_whisper():
                    groq_cl = Groq(api_key=settings.groq_api_key)
                    whisper_res = groq_cl.audio.transcriptions.create(
                        file=("audio.wav", audio_bytes),
                        model=settings.groq_stt_model or "whisper-large-v3-turbo",
                        language=norm_lang if norm_lang not in ["bho", "mai"] else "hi",
                    )
                    return whisper_res.text

                loop = asyncio.get_event_loop()
                transcript = await loop.run_in_executor(None, _call_groq_whisper)
                if transcript and transcript.strip():
                    return {
                        "text": transcript.strip(),
                        "language": norm_lang,
                        "confidence": 0.99,
                        "provider": "groq_whisper_turbo",
                    }
            except Exception as e:
                logger.warning(f"Groq Whisper STT error: {e}")

        # 2. Try Sarvam Saaras v3
        if self.client:
            try:
                def _call_saaras():
                    res = self.client.speech_to_text.transcribe(
                        file=("audio.wav", audio_bytes, "audio/wav"),
                        model=self.sarvam_model,
                        language_code=sarvam_lang,
                        mode="transcribe",
                    )
                    return res.transcript

                loop = asyncio.get_event_loop()
                transcript = await loop.run_in_executor(None, _call_saaras)
                if transcript and transcript.strip():
                    return {
                        "text": transcript.strip(),
                        "language": norm_lang,
                        "confidence": 0.98,
                        "provider": f"sarvam_{self.sarvam_model}",
                    }
            except Exception as e:
                logger.warning(f"Sarvam Saaras v3 STT error: {e}")

        # 3. Try Bhashini
        if self.bhashini_key and self.bhashini_user_id:
            try:
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                payload = {
                    "pipelineTasks": [
                        {
                            "taskType": "asr",
                            "config": {
                                "language": {"sourceLanguage": norm_lang},
                                "audioFormat": "wav",
                                "samplingRate": 16000,
                            },
                        }
                    ],
                    "inputData": {"audio": [{"audioContent": audio_b64}]},
                }
                headers = {
                    "Authorization": self.bhashini_key,
                    "userID": self.bhashini_user_id,
                    "Content-Type": "application/json",
                }
                async with httpx.AsyncClient(timeout=6.0) as client:
                    res = await client.post(self.bhashini_url, json=payload, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        text = data.get("pipelineResponse", [{}])[0].get("output", [{}])[0].get("source", "")
                        if text:
                            return {
                                "text": text.strip(),
                                "language": norm_lang,
                                "confidence": 0.94,
                                "provider": "bhashini",
                            }
            except Exception as e:
                logger.warning(f"Bhashini STT failed: {e}")

        # 4. Try AI4Bharat IndicConformerASR (Self-Hosted Fallback)
        if self.ai4bharat_stt and self.ai4bharat_stt.health_check():
            try:
                loop = asyncio.get_event_loop()
                ai4b_res = await loop.run_in_executor(None, lambda: self.ai4bharat_stt.transcribe(audio_bytes, norm_lang))
                if ai4b_res and ai4b_res.get("text"):
                    return {
                        "text": ai4b_res["text"],
                        "language": norm_lang,
                        "confidence": 0.90,
                        "provider": "ai4bharat_indicconformer",
                    }
            except Exception as e:
                logger.warning(f"AI4Bharat IndicConformer STT failed: {e}")

        return {
            "text": "",
            "language": norm_lang,
            "confidence": 0.80,
            "provider": "browser_fallback_ready",
        }


# ============================================================
# 6. TEXT-TO-SPEECH (TTS) ADAPTER (BULBUL V3)
# ============================================================
class TextToSpeechClient:
    def __init__(self):
        self.sarvam_key = settings.sarvam_api_key or os.getenv("SARVAM_API_KEY", "")
        self.sarvam_model = settings.sarvam_model or "bulbul:v3"
        self.sarvam_speaker = settings.sarvam_speaker or "ritu"
        self.client = None
        if self.sarvam_key and sarvam_sdk_available and SarvamAI:
            try:
                self.client = SarvamAI(api_subscription_key=self.sarvam_key)
            except Exception as e:
                logger.warning(f"Failed to init Sarvam TTS client: {e}")

    async def synthesize(self, text: str, language: str = "hi", voice: Optional[str] = None) -> Dict[str, Any]:
        norm_lang = get_normalized_lang_code(language)
        sarvam_lang = SARVAM_LANG_MAP.get(norm_lang, "hi-IN")
        clean_text = text.replace("NAVIGATE:/", "").strip()
        speaker = voice or self.sarvam_speaker or "ritu"

        # 1. Try Sarvam Bulbul v3
        if self.client:
            try:
                def _call_bulbul():
                    res = self.client.text_to_speech.convert(
                        text=clean_text[:450],
                        language_code=sarvam_lang,
                        model=self.sarvam_model,
                        speaker=speaker,
                        output_audio_codec="mp3",
                    )
                    return res.audios[0] if res.audios else None

                loop = asyncio.get_event_loop()
                audio_b64 = await loop.run_in_executor(None, _call_bulbul)
                if audio_b64:
                    return {
                        "audio_base64": audio_b64,
                        "format": "mp3",
                        "provider": f"sarvam_{self.sarvam_model}",
                        "language": norm_lang,
                    }
            except Exception as e:
                logger.warning(f"Sarvam Bulbul v3 TTS error: {e}")

        # 2. Local gTTS fallback
        try:
            from gtts import gTTS
            tts_lang = norm_lang if norm_lang in ["hi", "pa", "en", "mr", "gu", "te", "bn", "ta", "kn", "ml"] else "hi"
            tts = gTTS(text=clean_text[:300], lang=tts_lang, slow=False)
            import io
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            fp.seek(0)
            audio_b64 = base64.b64encode(fp.read()).decode("utf-8")
            return {
                "audio_base64": audio_b64,
                "format": "mp3",
                "provider": "gtts_backend",
                "language": norm_lang,
            }
        except Exception as e:
            logger.warning(f"Backend TTS synthesis fallback: {e}")
            return {
                "audio_base64": None,
                "format": "browser_native",
                "provider": "browser_native",
                "language": norm_lang,
            }


# ============================================================
# 7. ORCHESTRATOR & RESPONSE NORMALIZER
# ============================================================
class AssistantOrchestrator:
    def __init__(self):
        self.groq_chat = GroqChatClient()
        self.sarvam_chat = SarvamChatClient()
        self.group_api = GroupApiClient()
        self.gemini_fallback = GeminiFallbackClient()
        self.mistral_fallback = MistralFallbackClient()
        self.stt = SpeechToTextClient()
        self.tts = TextToSpeechClient()

    async def ask(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
        language: Optional[str] = "Hindi",
        voice_requested: bool = False,
        conversation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Multi-Tier Resilient AI Execution Pipeline:
        Evaluate State -> GROQ LPU (Tier 1) -> SARVAM 105B (Tier 2) -> GROUP API (Tier 3) -> GEMINI (Tier 4) -> MISTRAL (Tier 5) -> Local Fallback -> Sanitize -> TTS
        """
        start_t = time.time()
        result: Optional[Dict[str, Any]] = None
        source_used = "service_unavailable"

        cid = conversation_id or (context.get("conversation_id") if context else None)

        # 1. State evaluation and greeting control
        state, greeting_mode = conversation_state_manager.evaluate_turn(
            conversation_id=cid,
            user_message=message,
            current_language=get_normalized_lang_code(language),
            timeout_minutes=30.0,
        )

        norm_lang = state.language or get_normalized_lang_code(language)
        dynamic_system_prompt = build_farmer_system_prompt(state, greeting_mode, context, user_message=message)

        # Check navigation intent directly
        nav_intent = detect_navigation_intent(message)

        # 2. Tier 1: Groq LPU Ultra-Fast Inference Engine
        if result is None and self.groq_chat.is_configured():
            try:
                result = await asyncio.wait_for(
                    self.groq_chat.ask_assistant(message, context, system_prompt=dynamic_system_prompt),
                    timeout=7.0,
                )
                source_used = "groq_120b"
            except Exception as e:
                logger.info(f"Groq Chat unavailable/timed out ({e}), falling back to Sarvam 105B.")
                result = None

        # 3. Tier 2: Sarvam 105B Indic Reasoning AI
        if result is None and self.sarvam_chat.is_configured():
            try:
                result = await asyncio.wait_for(
                    self.sarvam_chat.ask_assistant(message, context, system_prompt=dynamic_system_prompt),
                    timeout=7.0,
                )
                source_used = "sarvam_105b"
            except Exception as e:
                logger.info(f"Sarvam Chat unavailable ({e}), falling back to Group API.")
                result = None

        # 4. Tier 3: Call Group API with timeout protection
        if result is None and self.group_api.is_configured():
            try:
                result = await asyncio.wait_for(
                    self.group_api.ask_assistant(message, context, system_prompt=dynamic_system_prompt),
                    timeout=self.group_api.timeout,
                )
                source_used = "group_api"
            except Exception as e:
                logger.info(f"Group API unavailable/timed out ({e}), falling back to Gemini.")
                result = None

        # 5. Tier 4: Call Gemini
        if result is None and self.gemini_fallback.is_configured():
            try:
                result = await asyncio.wait_for(
                    self.gemini_fallback.ask_assistant(message, context, system_prompt=dynamic_system_prompt),
                    timeout=self.gemini_fallback.timeout,
                )
                source_used = "gemini_fallback"
            except Exception as e:
                logger.info(f"Gemini fallback failed ({e}), falling back to Mistral.")
                result = None

        # 6. Tier 5: Call Mistral
        if result is None and self.mistral_fallback.is_configured():
            try:
                result = await asyncio.wait_for(
                    self.mistral_fallback.ask_assistant(message, context, system_prompt=dynamic_system_prompt),
                    timeout=self.mistral_fallback.timeout,
                )
                source_used = "mistral_fallback"
            except Exception as e:
                logger.warning(f"Mistral fallback failed ({e}).")
                result = None

        # 7. Local Resilient Expert Fallback (Never fail user query)
        if result is None:
            logger.warning(f"⚠️ Cloud AI models offline. Generating resilient local Sahayak response for conversation_id={cid}")
            local_ans = self._get_local_sahayak_response(message, norm_lang)
            result = {
                "answer": local_ans,
                "source": "local_sahayak_knowledge",
                "confidence": 0.85,
                "suggestions": ["📷 पत्ती की फोटो भेजें", "🌾 खाद की सही मात्रा", "🌤️ आज का मौसम"],
            }
            source_used = "local_sahayak_knowledge"

        raw_answer = result.get("answer", "").strip()

        # Check if response embeds a NAVIGATE tag
        if "NAVIGATE:" in raw_answer:
            m = re.search(r"NAVIGATE:(\S+)", raw_answer)
            if m:
                nav_intent = m.group(1)
                raw_answer = raw_answer.replace(m.group(0), "").strip()

        # 8. Apply double guardrail sanitization to ensure no unwanted greetings or unrequested 'doing well' boilerplates occur
        is_how_are_you_msg = is_how_are_you_query(message)
        sanitized_answer = conversation_state_manager.sanitize_response(
            raw_answer, greeting_mode, language=norm_lang, is_how_are_you=is_how_are_you_msg
        )

        # 8.5 Apply Chemical Pesticide & Dosage Safety Filter (Bug D)
        has_photo_diag = bool(context and (context.get("has_photo_diagnosis") or context.get("analyzed_image")))
        sanitized_answer = validate_and_sanitize_pesticide_safety(sanitized_answer, has_photo_diagnosis=has_photo_diag, language=norm_lang)

        # 9. Record acknowledgement and closing rotation
        conversation_state_manager.record_turn_response(state.conversation_id, sanitized_answer, norm_lang)

        # 10. Synthesize voice with Sarvam Bulbul v3 / fallback if voice requested
        audio_data = None
        if voice_requested and sanitized_answer:
            try:
                tts_res = await self.tts.synthesize(sanitized_answer, language=norm_lang)
                if tts_res.get("audio_base64"):
                    audio_data = f"data:audio/{tts_res['format']};base64,{tts_res['audio_base64']}"
            except Exception as e:
                logger.warning(f"Voice synthesis error: {e}")

        elapsed = round(time.time() - start_t, 3)

        return {
            "answer": sanitized_answer,
            "language": norm_lang,
            "source": source_used,
            "confidence": result.get("confidence", 0.95),
            "suggestions": result.get("suggestions") or ["📷 पौधे की फोटो भेजें", "🌾 खाद की खुराक", "🌤️ आज का मौसम"],
            "audio": audio_data,
            "navigate": nav_intent,
            "latency_sec": elapsed,
            "conversation_id": state.conversation_id,
            "conversation_state": state.to_dict(),
        }

    def _get_local_sahayak_response(self, message: str, lang: str) -> str:
        q = message.lower().strip()

        if is_general_conversational_query(message):
            if is_how_are_you_query(message):
                if lang == "pa":
                    return "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਮੈਂ ਬਿਲਕੁਲ ਠੀਕ ਹਾਂ। ਦੱਸੋ ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕੀ ਮਦਦ ਕਰਾਂ?"
                elif lang == "en":
                    return "Hello! I am doing well, thank you. How can I help you with your crops today?"
                elif lang in ["bho", "bhojpuri"]:
                    return "प्रणाम जी! हम सब ठीक बानी। बताईं आज का मदद करीं?"
                return "नमस्ते जी! मैं बिल्कुल ठीक हूँ। बताइए, आज आपकी क्या सहायता कर सकता हूँ?"
            else:
                if lang == "pa":
                    return "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਦੱਸੋ ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?"
                elif lang == "en":
                    return "Hello! How can I help you with your farming today?"
                elif lang in ["bho", "bhojpuri"]:
                    return "प्रणाम जी! रउआ खातिर आज का मदद करीं?"
                return "नमस्ते जी! मैं आपकी क्या सहायता कर सकता हूँ?"

        if "पील" in q or "yellow" in q or "रोग" in q or "disease" in q:
            if lang == "pa":
                return "ਫ਼ਸਲ ਵਿੱਚ ਪੀਲਾਪਣ ਨਾਈਟ੍ਰੋਜਨ ਦੀ ਘਾਟ ਜਾਂ ਜ਼ਿਆਦਾ ਪਾਣੀ ਕਾਰਨ ਹੋ ਸਕਦਾ ਹੈ। ਕ੍ਰਿਪਾ ਕਰਕੇ ਪੱਤੇ ਦੀ ਸਾਫ਼ ਫੋਟੋ ਭੇਜੋ ਤਾਂ ਜੋ ਸਹੀ ਇਲਾਜ ਦੱਸਿਆ ਜਾ ਸਕੇ।"
            elif lang == "en":
                return "Yellowing in crops is often caused by nitrogen deficiency or waterlogging. Please share a clear leaf photo for precise diagnostic advice."
            elif lang in ["bho", "bhojpuri"]:
                return "फसल में पीलापन नाइट्रोजन के कमी या बेसी पानी से हो सकत बा। पत्ती के साफ फोटो भेजीं ताकि सटीक उपाय बतावल जा सके।"
            return "फसल में पीलापन नाइट्रोजन की कमी या पानी के ठहराव के कारण हो सकता है। सटीक इलाज के लिए कृपया प्रभावित पत्ती की एक साफ फोटो भेजें।"

        if "खाद" in q or "fertilizer" in q or "urea" in q or "dap" in q:
            if lang == "pa":
                return "ਯੂਰੀਆ ਅਤੇ ਡੀ.ਏ.ਪੀ. ਦੀ ਸਹੀ ਮਾਤਰਾ ਲਈ ਆਪਣੀ ਫ਼ਸਲ ਦਾ ਰਕਬਾ ਦੱਸੋ। ਸ਼ੁਰੂਆਤੀ ਬਜਾਈ ਸਮੇਂ ਡੀ.ਏ.ਪੀ. ਅਤੇ ਬਾਅਦ ਵਿੱਚ ਯੂਰੀਆ ਦੀਆਂ ਛੋਟੀਆਂ ਖੁਰਾਕਾਂ ਦੇਵੋ।"
            elif lang == "en":
                return "For optimal fertilizer dosage, share your field area. Apply DAP during sowing and split urea doses during irrigation."
            return "खाद की सही खुराक के लिए अपनी फसल का रकबा बताएं। बुवाई के समय DAP और सिंचाई के बाद यूरिया की संतुलित खुराक दें।"

        if lang == "pa":
            return "ਤੁਹਾਡੀ ਫ਼ਸਲ ਦੀ ਸਹੀ ਦੇਖਭਾਲ ਲਈ ਮੈਂ ਇੱਥੇ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਸਮੱਸਿਆ ਜਾਂ ਪੱਤੇ ਦੀ ਫੋਟੋ ਭੇਜੋ।"
        elif lang == "en":
            return "I am here to assist with your farming queries. Please describe your crop condition or send a leaf photo."
        elif lang in ["bho", "bhojpuri"]:
            return "रउआ फसल के सब जानकारी खातिर हम तैयार बानी। कवनो परेशानी बा त फोटो भेजीं या बताईं।"
        return "आपकी फसल की अच्छी देखभाल के लिए मैं तैयार हूं। कृपया अपनी समस्या बताएं या पौधे की फोटो भेजें।"

    async def analyze_plant(
        self,
        question: str,
        image_bytes: bytes,
        context: Optional[Dict[str, Any]] = None,
        language: Optional[str] = "Hindi",
        conversation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        result = None
        source_used = "service_unavailable"
        norm_lang = get_normalized_lang_code(language)
        cid = conversation_id or (context.get("conversation_id") if context else None)

        state, greeting_mode = conversation_state_manager.evaluate_turn(
            conversation_id=cid,
            user_message=question,
            current_language=norm_lang,
            timeout_minutes=30.0,
        )

        norm_lang = state.language or get_normalized_lang_code(language)
        dynamic_system_prompt = build_farmer_system_prompt(state, greeting_mode, context)

        # 1. Tier 1: Try Gemini Vision if configured
        if self.gemini_fallback.is_configured():
            try:
                result = await asyncio.wait_for(
                    self.gemini_fallback.analyze_plant(question, image_bytes, context, system_prompt=dynamic_system_prompt),
                    timeout=self.gemini_fallback.timeout + 3.0,
                )
                source_used = "gemini_fallback"
            except Exception as e:
                logger.info(f"Gemini vision fallback failed ({e}), falling back to Groq LPU text analysis.")
                result = None

        # 2. Tier 2: Try Groq text analysis with image context
        if result is None and self.groq_chat.is_configured():
            try:
                prompt_with_img_ctx = f"{dynamic_system_prompt}\nNote: Farmer submitted an image of crop leaf with question: '{question}'."
                result = await asyncio.wait_for(
                    self.groq_chat.ask_assistant(question, context, system_prompt=prompt_with_img_ctx),
                    timeout=7.0,
                )
                source_used = "groq_120b"
            except Exception as e:
                logger.info(f"Groq text analysis for image failed ({e}).")
                result = None

        # 3. Tier 3: Try Group API
        if result is None and self.group_api.is_configured():
            try:
                result = await asyncio.wait_for(
                    self.group_api.analyze_plant(question, image_bytes, context, system_prompt=dynamic_system_prompt),
                    timeout=self.group_api.timeout + 3.0,
                )
                source_used = "group_api"
            except Exception as e:
                logger.info(f"Group API vision call failed ({e}).")
                result = None

        # 4. Tier 4: Try Mistral
        if result is None and self.mistral_fallback.is_configured():
            try:
                prompt_with_img_ctx = f"{dynamic_system_prompt}\nNote: Farmer submitted an image with question: '{question}'."
                result = await asyncio.wait_for(
                    self.mistral_fallback.ask_assistant(question, context, system_prompt=prompt_with_img_ctx),
                    timeout=self.mistral_fallback.timeout + 3.0,
                )
                source_used = "mistral_fallback"
            except Exception as e:
                logger.warning(f"Mistral text fallback for image analysis failed ({e}).")
                result = None

        if result is None:
            logger.warning(f"⚠️ Cloud vision models offline. Using resilient local image guidance for conversation_id={cid}")
            local_ans = self._get_local_sahayak_response(question, norm_lang)
            result = {
                "answer": local_ans,
                "source": "local_sahayak_knowledge",
                "confidence": 0.80,
                "suggestions": ["📷 फोटो दोबारा भेजें", "🌾 खाद सलाह", "📞 विशेषज्ञ मदद"],
            }
            source_used = "local_sahayak_knowledge"

        raw_ans = result.get("answer", "").strip()
        sanitized_ans = conversation_state_manager.sanitize_response(raw_ans, greeting_mode, language=norm_lang)
        conversation_state_manager.record_turn_response(state.conversation_id, sanitized_ans, norm_lang)

        return {
            "answer": sanitized_ans,
            "language": norm_lang,
            "source": source_used,
            "confidence": result.get("confidence", 0.90),
            "suggestions": result.get("suggestions", []),
            "navigate": "/scanner" if "scan" in question.lower() else None,
            "conversation_id": state.conversation_id,
            "conversation_state": state.to_dict(),
        }


# Global singleton orchestrator
assistant_orchestrator = AssistantOrchestrator()
