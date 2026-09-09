import json
import logging
import os
import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Data file for persistent state storage across server restarts
DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "conversations"
STATE_FILE = DATA_DIR / "conversation_states.json"

# ============================================================
# ROTATING PHRASE POOLS (Multilingual)
# ============================================================
ACKNOWLEDGEMENT_POOLS: Dict[str, List[str]] = {
    "hi": [
        "समझ गया जी।",
        "अच्छा, ठीक है।",
        "हाँ जी, ये जानकारी काम की है।",
        "ठीक है, अब एक चीज़ बताइए...",
        "कोई चिंता नहीं, देखते हैं।",
        "अच्छा, अब आगे देखते हैं।",
        "जी, बिल्कुल सही बताया आपने।",
    ],
    "pa": [
        "ਸਮਝ ਗਿਆ ਜੀ।",
        "ਅੱਛਾ, ਠੀਕ ਹੈ ਜੀ।",
        "ਹਾਂਜੀ, ਇਹ ਜਾਣਕਾਰੀ ਕੰਮ ਦੀ ਹੈ।",
        "ਕੋਈ ਚਿੰਤਾ ਨਹੀਂ, ਦੇਖਦੇ ਹਾਂ।",
        "ਠੀਕ ਹੈ, ਹੁਣ ਇੱਕ ਗੱਲ ਦੱਸੋ...",
        "ਅੱਛਾ, ਹੁਣ ਅੱਗੇ ਦੇਖਦੇ ਹਾਂ।",
    ],
    "en": [
        "Understood.",
        "Got it.",
        "Alright, let's look into this.",
        "Sure, let's check.",
        "No worries, let's see.",
        "Okay, let's look at the next step.",
    ],
}

CLOSING_POOLS: Dict[str, List[str]] = {
    "hi": [
        "एक बार चेक करके बताइएगा।",
        "फोटो मिलते ही तुरंत सही उपाय बताऊँगा।",
        "कोई और शंका हो तो बिना झिझक पूछें।",
        "इसको करके देखिए, फायदा मिलेगा।",
        "खेत की स्थिति देखकर आगे फैसला लेंगे।",
    ],
    "pa": [
        "ਇੱਕ ਵਾਰ ਜਾਂਚ ਕਰਕੇ ਦੱਸੋ ਜੀ।",
        "ਫੋਟੋ ਮਿਲਦੇ ਹੀ ਸਹੀ ਇਲਾਜ ਦੱਸਾਂਗਾ।",
        "ਕੋਈ ਹੋਰ ਸਵਾਲ ਹੋਵੇ ਤਾਂ ਜ਼ਰੂਰ ਪੁੱਛੋ।",
        "ਇਹ ਕਰਕੇ ਦੇਖੋ, ਫ਼ਾਇਦਾ ਹੋਵੇਗਾ।",
    ],
    "en": [
        "Let me know once you check.",
        "Feel free to ask if you have any questions.",
        "Try this and let me know the result.",
        "We'll proceed once you share more details.",
    ],
}

# Regex to detect explicit greetings from the farmer in Hindi, Punjabi, Bhojpuri, and English
EXPLICIT_GREETING_REGEX = re.compile(
    r"(नमस्ते|नमस्कार|प्रणाम|हेलो|हैलो|सत\s*श्री\s*अकाल|ਸਤਿ\s*ਸ੍ਰੀ\s*ਅਕਾਲ|राम\s*राम|राधे\s*राधे|\bhello\b|\bhi\b|\bhey\b|\bgood\s*morning\b|\bgood\s*evening\b|\bnamaste\b|\bpranam\b|किसान\s*भाई|\bsat\s*sri\s*akal\b)",
    re.IGNORECASE | re.UNICODE,
)

# Regex to strip unwanted accidental leading greetings if greeting is not allowed
LEADING_GREETING_STRIP_REGEX = re.compile(
    r"^(नमस्ते\s*(जी|किसान\s*(भाई|जी|मित्र))?!|नमस्कार\s*(जी)?!?|प्रणाम\s*(जी)?!?|हेलो\s*(जी)?!?|हैलो\s*(जी)?!?|hello\s*(there)?!?|hi\s*(there)?!?|hey!?|सत\s*श्री\s*अकाल\s*(जी)?!?|ਸਤਿ\s*ਸ੍ਰੀ\s*ਅਕਾਲ\s*(ਜੀ)?!?|राम\s*राम\s*(जी)?!?|राधे\s*राधे!?|good\s*morning!?|good\s*evening!?)\s*[,।!:\-—]?\s*",
    re.IGNORECASE,
)


# Regex to detect explicit language-switch requests or implicit vocabulary signals from the farmer
EXPLICIT_LANG_SWITCH_PATTERNS = {
    "bho": re.compile(
        r"(bhojpuri|भोजपुरी|batiya|batia|bhojpuri\s*me|bhojpuri\s*mein|bhojpuri\s*vich|भोजपुरी\s*में|भोजपुरी\s*में\s*बात|भोजपुरी\s*में\s*बताओ|भोजपुरी\s*में\s*बोल|भोजपुरी\s*में\s*बताईं|अब\s*भोजपुरी\s*में|ka\s*haal|kaal\s*bah|kaise\s*bara|kaise\s*bani|ka\s*chalat|raua)",
        re.IGNORECASE,
    ),
    "pa": re.compile(
        r"(punjabi|ਪੰਜਾਬੀ|punjabi\s*me|punjabi\s*mein|punjabi\s*vich|ਪੰਜਾਬੀ\s*ਵਿੱਚ|sat\s*sri\s*akal|kidaan|ki\s*haal|kime\s*ho)", re.IGNORECASE
    ),
    "hi": re.compile(
        r"(hindi|हिंदी|hindi\s*me|hindi\s*mein|hindi\s*vich|hindi\s*baat|हिंदी\s*में|हिंदी\s*बोलिए|हिंदी\s*में\s*बात|मुझसे\s*हिंदी|हिंदी\s*में\s*बात\s*कर)",
        re.IGNORECASE,
    ),
    "en": re.compile(
        r"(english\s*please|speak\s*english|in\s*english|english\s*me|english\s*mein|अंग्रेजी\s*में)",
        re.IGNORECASE,
    ),
}

# Vocabulary signals unique to Bhojpuri conversation (Devanagari + Roman script)
BHOJPURI_SIGNAL_REGEX = re.compile(
    r"(का\s*हाल\s*बा|ka\s*hal\s*ba|kaisa?n\s*ba|batiya|batia|बताईं|बतावा|बताईं\s*ना|कइसन\s*बा|का\s*करीं|का\s*करें|हमार|हमनी|रउआ|रउरा|बाड़े|\bबा\b|\bba\b|बानी|होखेला|भइल|भईल|कइल|लागल|चाही|चाहत\s*बानी|बोलs|कहs|अइसन|ओइसन|कइसन|केहू|कवन|कवनो|एगो|दूगो|बतियाइब|बतियाइ|दीं)",
    re.IGNORECASE | re.UNICODE,
)

LANG_DISPLAY_NAMES = {
    "bho": "bho",
    "pa": "pa",
    "hi": "hi",
    "en": "en",
}

def detect_explicit_language_request(text: str) -> Optional[str]:
    """
    Detects if the user explicitly asks to switch language or uses distinct regional vocabulary signals.
    Returns normalized language code ('bho', 'pa', 'en', 'hi') or None.
    """
    if not text:
        return None
    for key, pattern in EXPLICIT_LANG_SWITCH_PATTERNS.items():
        if pattern.search(text):
            return LANG_DISPLAY_NAMES.get(key)

    if BHOJPURI_SIGNAL_REGEX.search(text):
        return "bho"

    return None

# Tell-tale reasoning / scratchpad / meta-commentary artifacts to filter out server-side
REASONING_ARTIFACT_REGEX = re.compile(
    r"(I\s*need\s*to|Let'?s\s*draft|Double-check|Final\s*check|Wait,|Thinking\s*process:|Internal\s*monologue:|Drafting\s*reply:|<think>|</think>|The\s*user\s*said|The\s*user\s*is\s*asking|This\s*is\s*a\s*continuation|Context:|According\s*to\s*my\s*instructions|I\s*will\s*respond|The\s*conversation\s*state|The\s*detected\s*language|Provider\s*selected|Bhojpuri-flavoured\s*way|Sure,?\s*I\s*can\s*help)",
    re.IGNORECASE,
)


def extract_clean_final_answer(text: str) -> str:
    """
    Extracts ONLY the final farmer-facing answer segment, stripping all CoT blocks,
    <think> tags, scratchpad text, meta-monologues, and English disclaimers.
    """
    if not text:
        return ""
    cleaned = text.strip()

    # 1. Siphon out content inside <think>...</think> if present
    if "<think>" in cleaned:
        if "</think>" in cleaned:
            cleaned = cleaned.split("</think>")[-1].strip()
        else:
            return ""

    # 2. Strip markdown thought/reasoning blocks
    cleaned = re.sub(r"```(?:thought|reasoning|analysis).*?```", "", cleaned, flags=re.DOTALL | re.IGNORECASE).strip()

    # 3. Strip leading monologue sentences and prompt reflections
    cleaned = re.sub(
        r"^(The\s*user\s*(said|is\s*asking)|I\s*need\s*to|I\s*should|Let'?s\s*draft|Double-check|Final\s*check|This\s*is\s*a\s*continuation|Context:|According\s*to\s*my\s*instructions|I\s*will\s*respond|The\s*conversation\s*state|The\s*detected\s*language|Thinking\s*Process:|Internal\s*monologue:|Drafting\s*reply:).*\n?",
        "",
        cleaned,
        flags=re.IGNORECASE | re.MULTILINE,
    ).strip()

    # 4. Strip English meta commentary disclaimers about speaking Bhojpuri
    cleaned = re.sub(
        r"Sure,?\s*I\s*can\s*help\s*(you\s*)?(in\s*a\s*)?bhojpuri[- ]flavoured\s*way\.?\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()
    cleaned = re.sub(r"bhojpuri[- ]flavoured\s*way\.?\s*", "", cleaned, flags=re.IGNORECASE).strip()

    return cleaned


def is_reasoning_artifact(text: str) -> bool:
    """
    Safety filter: returns True if text contains internal reasoning or scratchpad artifacts that must never be shown to the farmer.
    """
    if not text or len(text.strip()) == 0:
        return True
    return bool(REASONING_ARTIFACT_REGEX.search(text))


@dataclass
class ConversationState:
    conversation_id: str
    is_first_message: bool = True
    message_count: int = 0
    last_active_at: str = ""
    inactivity_minutes: float = 0.0
    greeting_used: bool = False
    last_topic: str = ""
    language: str = "hi"
    recent_acknowledgements: List[str] = field(default_factory=list)
    recent_closings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConversationState":
        return cls(
            conversation_id=data.get("conversation_id", ""),
            is_first_message=data.get("is_first_message", True),
            message_count=data.get("message_count", 0),
            last_active_at=data.get("last_active_at", ""),
            inactivity_minutes=data.get("inactivity_minutes", 0.0),
            greeting_used=data.get("greeting_used", False),
            last_topic=data.get("last_topic", ""),
            language=data.get("language", "hi"),
            recent_acknowledgements=data.get("recent_acknowledgements", []),
            recent_closings=data.get("recent_closings", []),
        )


class ConversationStateManager:
    def __init__(self):
        self._states: Dict[str, ConversationState] = {}
        self._ensure_storage()
        self._load_from_disk()

    def _ensure_storage(self):
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            if not STATE_FILE.exists():
                with open(STATE_FILE, "w", encoding="utf-8") as f:
                    json.dump({}, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to create storage directory for conversation state: {e}")

    def _load_from_disk(self):
        if not STATE_FILE.exists():
            return
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
                if isinstance(raw, dict):
                    for cid, sdict in raw.items():
                        self._states[cid] = ConversationState.from_dict(sdict)
        except Exception as e:
            logger.warning(f"Failed to load conversation states from disk: {e}")

    def _prune_expired_states(self, max_age_hours: float = 48.0):
        now = datetime.now(timezone.utc)
        expired_ids = []
        for cid, state in list(self._states.items()):
            if state.last_active_at:
                try:
                    last_time = datetime.fromisoformat(state.last_active_at)
                    age_hours = (now - last_time).total_seconds() / 3600.0
                    if age_hours > max_age_hours:
                        expired_ids.append(cid)
                except Exception:
                    pass
        for cid in expired_ids:
            self._states.pop(cid, None)

    def _save_to_disk(self):
        try:
            self._prune_expired_states(max_age_hours=48.0)
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            out = {cid: state.to_dict() for cid, state in self._states.items()}
            tmp_file = STATE_FILE.with_suffix(".tmp")
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(out, f, ensure_ascii=False, indent=2)
            os.replace(tmp_file, STATE_FILE)
        except Exception as e:
            logger.warning(f"Failed to save conversation states to disk: {e}")

    def get_or_create(self, conversation_id: Optional[str], language: str = "hi") -> ConversationState:
        raw_id = conversation_id.strip() if conversation_id and conversation_id.strip() else ""
        if not raw_id or raw_id == "default":
            cid = str(uuid.uuid4())
        else:
            cid = raw_id

        if cid not in self._states:
            state = ConversationState(
                conversation_id=cid,
                is_first_message=True,
                message_count=0,
                last_active_at=datetime.now(timezone.utc).isoformat(),
                inactivity_minutes=0.0,
                greeting_used=False,
                last_topic="",
                language=language or "hi",
                recent_acknowledgements=[],
                recent_closings=[],
            )
            self._states[cid] = state
            self._save_to_disk()
            return state
        return self._states[cid]

    def reset_conversation(self, conversation_id: str, language: str = "hi") -> ConversationState:
        raw_id = conversation_id.strip() if conversation_id and conversation_id.strip() else ""
        if not raw_id or raw_id == "default":
            cid = str(uuid.uuid4())
        else:
            cid = raw_id

        state = ConversationState(
            conversation_id=cid,
            is_first_message=True,
            message_count=0,
            last_active_at=datetime.now(timezone.utc).isoformat(),
            inactivity_minutes=0.0,
            greeting_used=False,
            last_topic="",
            language=language or "hi",
            recent_acknowledgements=[],
            recent_closings=[],
        )
        self._states[cid] = state
        self._save_to_disk()
        return state

    def detect_explicit_greeting(self, text: str) -> bool:
        if not text:
            return False
        clean_text = text.strip()
        words = clean_text.split()
        # Message starts directly with a standalone greeting phrase
        starts_with_greeting = bool(LEADING_GREETING_STRIP_REGEX.match(clean_text))
        # Message is short (<= 5 words) and contains a greeting word
        short_greeting = len(words) <= 5 and bool(EXPLICIT_GREETING_REGEX.search(clean_text))
        return starts_with_greeting or short_greeting

    def detect_explicit_language_request(self, text: str) -> Optional[str]:
        if not text:
            return None
        for lang_code, pat in EXPLICIT_LANG_SWITCH_PATTERNS.items():
            if pat.search(text):
                return lang_code
        return None

    def evaluate_turn(
        self,
        conversation_id: Optional[str],
        user_message: str,
        current_language: str = "hi",
        timeout_minutes: float = 30.0,
    ) -> Tuple[ConversationState, str]:
        """
        Evaluates the turn and returns:
        (updated_state, greeting_mode)
        """
        state = self.get_or_create(conversation_id, current_language)
        now = datetime.now(timezone.utc)

        # Calculate inactivity
        inactivity_min = 0.0
        if state.last_active_at:
            try:
                last_time = datetime.fromisoformat(state.last_active_at)
                diff_sec = (now - last_time).total_seconds()
                inactivity_min = max(0.0, round(diff_sec / 60.0, 2))
            except Exception:
                inactivity_min = 0.0

        state.inactivity_minutes = inactivity_min

        # Determine greeting mode
        farmer_greeted = self.detect_explicit_greeting(user_message)
        is_first = (state.message_count == 0) or (not state.greeting_used)
        is_welcome_back = (not is_first) and (inactivity_min >= timeout_minutes)

        if is_first:
            greeting_mode = "first_greeting"
        elif farmer_greeted:
            greeting_mode = "explicit_farmer_greeting"
        elif is_welcome_back:
            greeting_mode = "welcome_back"
        else:
            greeting_mode = "none"

        # Language detection & persistence rules:
        # 1. Explicit message signal (Devanagari/Roman phrases like "Hindi mein", "Bhojpuri mein", "Ka hal ba", "Punjabi vich", etc.)
        explicit_lang = self.detect_explicit_language_request(user_message)
        if explicit_lang:
            state.language = explicit_lang
        # 2. If state.language has not been established yet, set from request argument:
        elif not state.language or state.language in ["default", ""]:
            if current_language and current_language.lower() in ["bho", "bhojpuri", "भोजपुरी"]:
                state.language = "bho"
            elif current_language and current_language.lower() in ["pa", "punjabi", "ਪੰਜਾਬੀ"]:
                state.language = "pa"
            elif current_language and current_language.lower() in ["en", "english"]:
                state.language = "en"
            else:
                state.language = "hi"
        # 3. If state.language is already established (e.g. 'bho', 'pa', 'hi'), DO NOT overwrite it unless explicit_lang is detected!

        # Update message count & topic tracking
        state.message_count += 1
        state.is_first_message = False
        if greeting_mode in ["first_greeting", "welcome_back"]:
            state.greeting_used = True

        state.last_active_at = now.isoformat()

        # Update topic extraction from user message
        extracted_topic = self._extract_topic(user_message)
        if extracted_topic:
            state.last_topic = extracted_topic

        self._states[state.conversation_id] = state
        self._save_to_disk()

        return state, greeting_mode

    def _extract_topic(self, message: str) -> str:
        msg = message.strip()
        if not msg:
            return ""
        # Identify crop or topic keywords
        crops = ["गेहूं", "धान", "चावल", "मक्का", "सरसों", "आलू", "टमाटर", "कपास", "चना", "सोयाबीन", "wheat", "paddy", "rice", "mustard", "potato", "tomato", "cotton", "ਕਣਕ", "ਝੋਨਾ", "ਸਰ੍ਹੋਂ", "ਆਲੂ"]
        symptoms = ["पीले पत्ते", "पीला", "धब्बा", "कीट", "सुंडी", "सड़न", "उकठा", "खाद", "यूरिया", "पोटाश", "मंडी भाव", "yellow leaves", "pest", "fertilizer", "urea", "mandi rate", "ਪੀਲੇ ਪੱਤੇ", "ਕੀੜਾ", "ਖਾਦ"]

        found_crop = next((c for c in crops if c.lower() in msg.lower()), "")
        found_symptom = next((s for s in symptoms if s.lower() in msg.lower()), "")

        if found_crop and found_symptom:
            return f"{found_crop} में {found_symptom}"
        elif found_crop:
            return f"{found_crop} की देखभाल"
        elif found_symptom:
            return found_symptom
        elif len(msg) < 40 and not self.detect_explicit_greeting(msg):
            return msg
        return ""

    def record_turn_response(
        self,
        conversation_id: str,
        response_text: str,
        lang: str = "hi",
    ):
        """
        Record any acknowledgements or closings used in the response so they can be avoided next turn.
        """
        cid = conversation_id.strip() if conversation_id and conversation_id.strip() else "default"
        state = self._states.get(cid)
        if not state:
            return

        norm_lang = "pa" if lang in ["pa", "ਪੰਜਾਬੀ"] else ("en" if lang in ["en", "English"] else "hi")
        ack_pool = ACKNOWLEDGEMENT_POOLS.get(norm_lang, ACKNOWLEDGEMENT_POOLS["hi"])
        closing_pool = CLOSING_POOLS.get(norm_lang, CLOSING_POOLS["hi"])

        # Check which acknowledgement was used
        for ack in ack_pool:
            if ack in response_text or ack.rstrip("।.") in response_text:
                if ack not in state.recent_acknowledgements:
                    state.recent_acknowledgements.append(ack)
                state.recent_acknowledgements = state.recent_acknowledgements[-4:]
                break

        # Check which closing was used
        for close_phr in closing_pool:
            if close_phr in response_text or close_phr.rstrip("।.") in response_text:
                if close_phr not in state.recent_closings:
                    state.recent_closings.append(close_phr)
                state.recent_closings = state.recent_closings[-4:]
                break

        self._states[cid] = state
        self._save_to_disk()

    def sanitize_response(self, text: str, greeting_mode: str, language: str = "hi", is_how_are_you: bool = False) -> str:
        """
        Double safety guardrail:
        - If is_how_are_you is False, strip any hallucinated 'I am doing well — thanks for asking' phrases.
        - If greeting_mode is 'none', strictly strip leading greetings if the model hallucinated one.
        - If greeting_mode is 'explicit_farmer_greeting' and the model forgot to greet back, ensure a polite brief greeting back is prepended.
        - If greeting_mode is 'welcome_back' and the model omitted it, ensure a soft welcome back is prepended.
        - If greeting_mode is 'first_greeting' and the model omitted it, ensure an opening greeting is prepended.
        """
        cleaned = text.strip()

        # Strip unrequested "I am doing well" phrases if the user didn't ask
        if not is_how_are_you:
            cleaned = re.sub(
                r"(I'?m\s*doing\s*well[—\-,\s]*thanks\s*for\s*asking\.?|I\s*am\s*doing\s*well[—\-,\s]*thanks\s*for\s*asking\.?|अपने\s*से\s*बता\s*रहा\s*हूँ|मैं\s*बिल्कुल\s*ठीक\s*हूँ[—\-,\s]*पूछने\s*के\s*लिए\s*धन्यवाद\.?|हम\s*सब\s*ठीक\s*बानी[—\-,\s]*पूछे\s*खातिर\s*धन्यवाद\.?)",
                "",
                cleaned,
                flags=re.IGNORECASE,
            ).strip()
            cleaned = re.sub(r"\s+", " ", cleaned)

        has_leading_greeting = bool(LEADING_GREETING_STRIP_REGEX.match(cleaned))

        if greeting_mode == "none":
            if has_leading_greeting:
                match = LEADING_GREETING_STRIP_REGEX.match(cleaned)
                if match:
                    cleaned = cleaned[match.end():].strip()
                    if cleaned and cleaned[0].islower():
                        cleaned = cleaned[0].upper() + cleaned[1:]
        elif greeting_mode == "explicit_farmer_greeting":
            if not has_leading_greeting:
                if language == "pa":
                    cleaned = f"ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! {cleaned}"
                elif language == "en":
                    cleaned = f"Hello! {cleaned}"
                else:
                    cleaned = f"नमस्ते जी! {cleaned}"
        elif greeting_mode == "welcome_back":
            if not any(w in cleaned.lower() for w in ["फिर से", "ਵਾਪਸ", "welcome back", "swagat"]):
                if language == "pa":
                    cleaned = f"ਜੀ, ਸਵਾਗਤ ਹੈ ਵਾਪਸ। {cleaned}"
                elif language == "en":
                    cleaned = f"Welcome back! {cleaned}"
                else:
                    cleaned = f"नमस्ते फिर से जी! {cleaned}"
        # Clean up awkward English connectors in Hindi/Punjabi turns
        if language != "en":
            if language == "pa":
                cleaned = re.sub(r"\b(in the\s+)?meantime,?\b", "ਤਦ ਤੱਕ,", cleaned, flags=re.IGNORECASE)
                cleaned = re.sub(r"\bmeanwhile,?\b", "ਇਸ ਦੌਰਾਨ,", cleaned, flags=re.IGNORECASE)
            else:
                cleaned = re.sub(r"\b(in the\s+)?meantime,?\b", "इस बीच,", cleaned, flags=re.IGNORECASE)
                cleaned = re.sub(r"\bmeanwhile,?\b", "इस बीच,", cleaned, flags=re.IGNORECASE)

        return cleaned


# Global instance
conversation_state_manager = ConversationStateManager()
