"""
Unified Agricultural Pesticide & Dosage Safety Filter
Single source of truth used across AI Assistant, Chatbot, and Community feeds.
"""

import logging
import re
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ============================================================
# COMPREHENSIVE SYNTHETIC CHEMICAL PESTICIDES LIST
# ============================================================
# Covers Organophosphates, Synthetic Pyrethroids, Neonicotinoids,
# Carbamates, Systemic Fungicides, and Non-selective Herbicides.
# Includes English scientific names, transliterated Hindi, and Gurmukhi.
CHEMICAL_NAMES_REGEX = re.compile(
    r"\b("
    # Organophosphates & Carbamates
    r"carbaryl|chlorpyrifos|monocrotophos|malathion|dimethoate|triazophos|phorate|"
    r"profenofos|acephate|quinalphos|methyl\s*parathion|carbofuran|methomyl|"
    # Neonicotinoids & Modern Insecticides
    r"imidacloprid|thiamethoxam|acetamiprid|fipronil|clothianidin|dinotefuran|spirotetramat|"
    # Synthetic Pyrethroids
    r"cypermethrin|lambda-cyhalothrin|deltamethrin|bifenthrin|fenvalerate|permethrin|"
    # Systemic & Chemical Fungicides
    r"mancozeb|carbendazim|propiconazole|hexaconazole|tebuconazole|difenoconazole|"
    r"azoxystrobin|metalaxyl|copper\s*oxychloride|chlorothalonil|tricyclazole|"
    # Herbicides
    r"glyphosate|paraquat|atrazine|2,4-d|pretilachlor|pendimethalin|glufosinate|"
    # Hindi Transliterations
    r"क्लोरोपायरीफॉस|इमिडाक्लोप्रिड|मोनोक्रोटोफॉस|साइपरमेथ्रिन|मैन्कोजेब|कार्बेंडाजिम|"
    r"थियामेथॉक्सम|एसिटामिप्रिड|डाइमेथोएट|ट्रायजोफॉस|फोरेट|प्रोफेनोफॉस|फिप्रोनिल|एसीफेट|"
    r"प्रोपिकोनाज़ोल|हेक्साकोनाज़ोल|ग्लाइफोसेट|पैराक्वाट|एंडोसल्फान|"
    # Punjabi Gurmukhi Transliterations
    r"ਕਲੋਰਪਾਇਰੀਫਾਸ|ਇਮੀਡਾਕਲੋਪ੍ਰਿਡ|ਮੋਨੋਕ੍ਰੋਟੋਫਾਸ|ਸਾਈਪਰਮੈਥਰਿਨ|ਮੈਨਕੋਜ਼ੇਬ|ਕਾਰਬੈਂਡਾਜ਼ਿਮ|"
    r"ਥਿਆਮੇਥੋਕਸਮ|ਐਸੀਟਾਮਿਪ੍ਰਿਡ|ਗਲਾਈਫੋਸੇਟ|ਫਿਪਰੋਨਿਲ|ਫੋਰੇਟ"
    r")\b",
    re.IGNORECASE,
)

# Metric units + vernacular measures
DOSAGE_UNITS_REGEX = re.compile(
    r"("
    r"\d+(\.\d+)?\s*(g|gm|gms|gram|grams|ml|m\.l\.|kg|l|L|liter|litres|mg|ppm)\b|"
    r"\d+(\.\d+)?\s*(g\s*L⁻¹|g/L|ml/L|ml/15L|gm/L|g/l|ml/l)|"
    r"\d+\s*(चम्मच|ढक्कन|लीटर|मिली|ग्राम|ਮਿਲੀ|ਗ੍ਰਾਮ|ਲੀਟਰ)"
    r")",
    re.IGNORECASE,
)

# Broad, name-independent dosage pattern detection:
# Catches generic chemical dosage suggestions such as:
# "spray 2 ml per liter of pesticide", "दवा 50 ग्राम प्रति टंकी छिड़कें"
GENERIC_CHEMICAL_ACTION_REGEX = re.compile(
    r"\b("
    r"pesticide|fungicide|insecticide|weedicide|chemical|spray\s*tank|per\s*pump|per\s*knapsack|"
    r"कीटनाशक|फफूंदनाशक|खरपतवारनाशक|दवा\s*का\s*छिड़काव|स्प्रे\s*घोल|केमिकल|"
    r"ਕੀਟਨਾਸ਼ਕ|ਉੱਲੀਨਾਸ਼ਕ|ਨਦੀਨਨਾਸ਼ਕ|ਦਵਾਈ\s*ਦਾ\s*ਛਿੜਕਾਅ"
    r")\b",
    re.IGNORECASE,
)

# Safe organic substances explicitly exempted
ORGANIC_SAFE_EXEMPTIONS = re.compile(
    r"\b(neem|neem\s*oil|trichoderma|pseudomonas|vermicompost|jeeavamrit|dashparni|bio-fertilizer|"
    r"नीम\s*तेल|ट्राइकोडर्मा|जीवामृत|कंपोस्ट|जैविक|ਨਿੰਮ\s*ਦਾ\s*ਤੇਲ|ਜੀਵਾਮ੍ਰਿਤ)\b",
    re.IGNORECASE,
)


def scan_community_content_safety(text: str, language: str = "hi") -> Optional[Dict[str, Any]]:
    """
    Pre-publish safety scanner: checks if content contains unsafe pesticide names paired
    with numeric dosages, or broad chemical-action dosage patterns without organic exemption.
    Returns None if safe, or a detailed friendly explanation dictionary if violated.
    """
    if not text:
        return None

    # Check for specific chemical name + dosage match
    has_chemical_name = bool(CHEMICAL_NAMES_REGEX.search(text))
    has_dosage_unit = bool(DOSAGE_UNITS_REGEX.search(text))

    # Check for broad name-independent chemical spray dosage match
    has_generic_chemical_action = bool(GENERIC_CHEMICAL_ACTION_REGEX.search(text))
    has_organic_exemption = bool(ORGANIC_SAFE_EXEMPTIONS.search(text))

    is_unsafe_specific = has_chemical_name and has_dosage_unit
    is_unsafe_generic = has_generic_chemical_action and has_dosage_unit and not has_organic_exemption

    if is_unsafe_specific or is_unsafe_generic:
        return {
            "safe": False,
            "violation": "unsafe_chemical_dosage",
            "message": "सटीक दवा की खुराक साझा करना सुरक्षित नहीं है, कृपया सामान्य सलाह दें या KVK से पुष्टि करने को कहें।",
            "message_hi": "सटीक दवा की खुराक साझा करना सुरक्षित नहीं है, कृपया सामान्य सलाह दें या KVK से पुष्टि करने को कहें।",
            "message_pa": "ਕਿਸੇ ਰਸਾਇਣਕ ਕੀਟਨਾਸ਼ਕ ਦੀ ਸਟੀਕ ਖੁਰਾਕ ਸਾਂਝੀ ਕਰਨਾ ਸੁਰੱਖਿਅਤ ਨਹੀਂ ਹੈ, ਕਿਰਪਾ ਕਰਕੇ ਆਮ ਸਲਾਹ ਦਿਓ ਜਾਂ ਕੇਵੀਕੇ (KVK) ਤੋਂ ਪੁਸ਼ਟੀ ਕਰਵਾਉਣ ਲਈ ਕਹੋ।",
            "message_en": "Sharing exact synthetic chemical dosages is not safe. Please share general advice or ask to confirm with KVK.",
            "safe_alternative": "जैविक उपाय (जैसे नीम तेल 100% स्प्रे) या स्थानीय कृषि विज्ञान केंद्र (KVK) संपर्क की सिफारिश करें।",
            "detected_chemical": has_chemical_name or has_generic_chemical_action,
            "detected_dosage": has_dosage_unit,
        }

    return None


def validate_and_sanitize_pesticide_safety(text: str, has_photo_diagnosis: bool, language: str = "hi") -> str:
    """
    Used by AI Assistant to sanitize model responses: flags and replaces synthetic chemical
    dosages with safe KVK references if no verified photo diagnosis is present.
    """
    if not text or has_photo_diagnosis:
        return text

    safety_check = scan_community_content_safety(text, language)
    if safety_check and not safety_check["safe"]:
        logger.warning("⚠️ SAFETY VIOLATION DETECTED in assistant response. Sanitizing response...")
        sentences = re.split(r"(?<=[.!?।])\s+", text)
        clean_sentences = [
            s for s in sentences
            if not (CHEMICAL_NAMES_REGEX.search(s) and DOSAGE_UNITS_REGEX.search(s))
        ]

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
                clean_text = "कीड़ों के शुरुआती बचाव के लिए नीम तेल के घोल का छिड़काव करें और प्रभावित पत्ते की एक साफ फोटो भेजें।"

        return f"{clean_text} {safety_note}".strip()

    return text
