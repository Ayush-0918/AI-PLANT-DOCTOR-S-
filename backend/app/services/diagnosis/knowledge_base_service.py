import csv
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional


PROJECT_ROOT = Path(__file__).resolve().parents[3]
GENERATED_DIR = PROJECT_ROOT / "backend" / "data" / "generated"
TREATMENT_PATH = GENERATED_DIR / "treatment_knowledge.csv"
TRANSLATION_PATH = GENERATED_DIR / "translations_core.csv"
GROWTH_CARE_PATH = GENERATED_DIR / "plant_growth_care_recommendations.csv"

LANGUAGE_ALIASES = {
    "en": "English",
    "english": "English",
    "English": "English",
    "hi": "हिंदी",
    "hindi": "हिंदी",
    "Hindi": "हिंदी",
    "हिंदी": "हिंदी",
    "bho": "भोजपुरी",
    "भोजपुरी": "भोजपुरी",
    "bhojpuri": "भोजपुरी",
    "pa": "ਪੰਜਾਬੀ",
    "punjabi": "ਪੰਜਾਬੀ",
    "ਪੰਜਾਬੀ": "ਪੰਜਾਬੀ",
    "mr": "मराठी",
    "marathi": "मराठी",
    "मराठी": "मराठी",
}


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as file_obj:
        return list(csv.DictReader(file_obj))


def normalize_language(language: str) -> str:
    if not language:
        return "English"
    # Match exact alias or lowercase version
    val = LANGUAGE_ALIASES.get(language.strip())
    if not val:
        val = LANGUAGE_ALIASES.get(language.strip().lower())
    return val if val else "English"


@lru_cache(maxsize=1)
def load_translations() -> dict[str, dict[str, str]]:
    rows = _read_csv(TRANSLATION_PATH)
    payload: dict[str, dict[str, str]] = {}
    for row in rows:
        key = row.get("key", "").strip()
        if not key:
            continue
        payload[key] = row
    return payload


@lru_cache(maxsize=1)
def load_treatment_knowledge() -> list[dict[str, str]]:
    return _read_csv(TREATMENT_PATH)


@lru_cache(maxsize=1)
def load_growth_care() -> list[dict[str, str]]:
    return _read_csv(GROWTH_CARE_PATH)


FALLBACK_UI_TRANSLATIONS = {
    "pdf_farmer_details": {
        "English": "1. Farmer Details",
        "हिंदी": "1. किसान विवरण",
        "ਪੰਜਾਬੀ": "1. ਕਿਸਾਨ ਦੇ ਵੇਰਵੇ",
        "भोजपुरी": "1. किसान के विवरण",
        "मराठी": "1. शेतकरी तपशील",
    },
    "pdf_scan_result": {
        "English": "2. Scan Result",
        "हिंदी": "2. स्कैन परिणाम",
        "ਪੰਜਾਬੀ": "2. ਸਕੈਨ ਨਤੀਜਾ",
        "भोजपुरी": "2. जांच परिणाम",
        "मराठी": "2. स्कॅन निकाल",
    },
    "pdf_model_note": {
        "English": "3. AI Smart Advice",
        "हिंदी": "3. AI स्मार्ट सलाह",
        "ਪੰਜਾਬੀ": "3. AI ਸਮਾਰਟ ਸਲਾਹ",
        "भोजपुरी": "3. AI स्मार्ट सलाह",
        "मराठी": "3. AI स्मार्ट सल्ला",
    },
    "pdf_follow_up": {
        "English": "4. Follow-up Advice",
        "हिंदी": "4. आगे की सलाह",
        "ਪੰਜਾਬੀ": "4. ਅਗਲੀ ਸਲਾਹ",
        "भोजपुरी": "4. आगे के सलाह",
        "मराठी": "4. पुढील सल्ला",
    },
    "pdf_weather_window": {
        "English": "5. Weather & Spray Timing Window",
        "हिंदी": "5. मौसम और छिड़काव समय",
        "ਪੰਜਾਬੀ": "5. ਮੌਸਮ ਅਤੇ ਛਿੜਕਾਅ ਸਮਾਂ",
        "भोजपुरी": "5. मौसम आउर छिड़काव समय",
        "मराठी": "5. हवामान आणि फवारणीची वेळ",
    },
    "pdf_soil_care": {
        "English": "6. Soil Health & Nutrient Care",
        "हिंदी": "6. मिट्टी स्वास्थ्य और पोषण प्रबंधन",
        "ਪੰਜਾਬੀ": "6. ਮਿੱਟੀ ਸਿਹਤ ਅਤੇ ਪੋਸ਼ਣ ਪ੍ਰਬੰਧਨ",
        "भोजपुरी": "6. माटी स्वास्थ्य आउर पोषण",
        "मराठी": "6. माती आरोग्य आणि पोषण व्यवस्थापन",
    },
    "pdf_mandi_advice": {
        "English": "7. Mandi Market Rates & Selling Advice",
        "हिंदी": "7. मंडी भाव और बिक्री सलाह",
        "ਪੰਜਾਬੀ": "7. ਮੰਡੀ ਭਾਅ ਅਤੇ ਵੇਚਣ ਸਲਾਹ",
        "भोजपुरी": "7. मंडी भाव आउर बिक्री सलाह",
        "मराठी": "7. बाजार भाव आणि विक्री सल्ला",
    },
    "label_diagnosis": {
        "English": "Diagnosis",
        "हिंदी": "निदान",
        "ਪੰਜਾਬੀ": "ਨਿਦਾਨ",
        "भोजपुरी": "निदान",
        "मराठी": "निदान",
    },
    "label_confidence": {
        "English": "Confidence",
        "हिंदी": "विश्वसनीयता",
        "ਪੰਜਾਬੀ": "ਭਰੋਸਾ",
        "भोजपुरी": "विश्वास स्तर",
        "मराठी": "खात्री",
    },
    "label_treatment": {
        "English": "Treatment",
        "हिंदी": "उपचार",
        "ਪੰਜਾਬੀ": "ਇਲਾਜ",
        "भोजपुरी": "इलाज",
        "मराठी": "उपचार",
    },
    "label_dosage": {
        "English": "Dosage",
        "हिंदी": "मात्रा",
        "ਪੰਜਾਬੀ": "ਖੁਰਾਕ",
        "भोजपुरी": "मात्रा",
        "मराठी": "प्रमाण",
    },
    "label_name": {
        "English": "Name",
        "हिंदी": "नाम",
        "ਪੰਜਾਬੀ": "ਨਾਮ",
        "भोजपुरी": "नाम",
        "मराठी": "नाव",
    },
    "label_location": {
        "English": "Location",
        "हिंदी": "स्थान",
        "ਪੰਜਾਬੀ": "ਸਥਾਨ",
        "भोजपुरी": "स्थान",
        "मराठी": "स्थान",
    },
    "label_crop": {
        "English": "Crop",
        "हिंदी": "फसल",
        "ਪੰਜਾਬੀ": "ਫਸਲ",
        "भोजपुरी": "फसल",
        "मराठी": "पीक",
    },
    "label_generated_at": {
        "English": "Generated At",
        "हिंदी": "तैयार होने का समय",
        "ਪੰਜਾਬੀ": "ਤਿਆਰ ਕਰਨ ਦਾ ਸਮਾਂ",
        "भोजपुरी": "तैयार भइला के समय",
        "मराठी": "तयार झाल्याची वेळ",
    },
    "label_report_id": {
        "English": "Report ID",
        "हिंदी": "रिपोर्ट आईडी",
        "ਪੰਜਾਬੀ": "ਰਿਪੋਰਟ ਆਈਡੀ",
        "भोजपुरी": "रिपोर्ट आईडी",
        "मराठी": "अहवाल आयडी",
    },
    "label_stage": {
        "English": "Stage",
        "हिंदी": "चरण",
        "ਪੰਜਾਬੀ": "ਪੜਾਅ",
        "भोजपुरी": "चरण",
        "मराठी": "टप्पा",
    },
    "label_severity": {
        "English": "Severity",
        "हिंदी": "गंभीरता",
        "ਪੰਜਾਬੀ": "ਗੰਭੀਰਤਾ",
        "भोजपुरी": "गंभीरता",
        "मराठी": "तीव्रता",
    },
    "label_weather_risk": {
        "English": "Weather Risk",
        "हिंदी": "मौसम जोखिम",
        "ਪੰਜਾਬੀ": "ਮੌਸਮ ਖਤਰਾ",
        "भोजपुरी": "मौसम जोखिम",
        "मराठी": "हवामान धोका",
    },
    "pdf_title": {
        "English": "Plant Doctors Crop Health Report",
        "हिंदी": "प्लांट डॉक्टर्स फसल स्वास्थ्य रिपोर्ट",
        "ਪੰਜਾਬੀ": "ਪਲਾਂਟ ਡਾਕਟਰਜ਼ ਫਸਲ ਿਸਹਤ ਿਰਪੋਰਟ",
        "भोजपुरी": "प्लांट डॉक्टर्स फसल स्वास्थ्य रिपोर्ट",
        "मराठी": "प्लांट डॉक्टर्स पीक आरोग्य अहवाल",
    },
    "pdf_subtitle": {
        "English": "Plant Doctor Intelligence Suite | Powered by PlantVillage AI",
        "हिंदी": "प्लांट डॉक्टर इंटेलिजेंस सूट | प्लांटविलेज AI द्वारा संचालित",
        "ਪੰਜਾਬੀ": "ਪਲਾਂਟ ਡਾਕਟਰ ਇੰਟੈਲੀਜੈਂਸ ਸੂਟ | ਪਲਾਂਟਿਵਲੇਜ ਏਆਈ ਦੁਆਰਾ ਸੰਚਾਿਲਤ",
        "भोजपुरी": "प्लांट डॉक्टर इंटेलिजेंस सूट | प्लांटविलेज AI द्वारा संचालित",
        "मराठी": "प्लांट डॉक्टर इंटेलिजन्स सूट | प्लांटव्हिलेजन AI द्वारे समर्थित",
    },
    "pdf_disclaimer": {
        "English": "This report supports field decisions but does not replace certified agronomist judgment.",
        "हिंदी": "यह रिपोर्ट खेत के निर्णयों में सहायता करती है लेकिन प्रमाणित कृषि विशेषज्ञ के निर्णय का स्थान नहीं लेती।",
        "ਪੰਜਾਬੀ": "ਇਹ ਿਰਪੋਰਟ ਖੇਤ ਦੇ ਫੈਸਿਲਆਂ ਿਵੱਚ ਮਦਦ ਕਰਦੀ ਹੈ ਪਰ ਪ੍ਰਮਾਿਣਤ ਖੇਤੀਬਾੜੀ ਮਾਹਰ ਦੇ ਫੈਸਲੇ ਦੀ ਥਾਂ ਨਹੀਂ ਲੈਂਦੀ।",
        "भोजपुरी": "ई रिपोर्ट खेत के फैसला में मदद करेला बाकी विशेषज्ञ के सलाह जरूरी बा।",
        "मराठी": "हा अहवाल मदत करतो पण तज्ञ निर्णयाची जागा घेत नाही।",
    },
}


def translate(key: str, language: str, fallback: str = "") -> str:
    normalized = normalize_language(language)
    rows = load_translations()
    row = rows.get(key, {})
    val = row.get(normalized)
    if not val:
        val = FALLBACK_UI_TRANSLATIONS.get(key, {}).get(normalized)
    return val or row.get("English") or fallback or key


def get_treatment_record(
    disease_class: str,
    stage: str = "vegetative",
    severity: str = "medium",
) -> Optional[dict[str, str]]:
    disease_class = disease_class.strip()
    stage = stage.strip() or "vegetative"
    severity = severity.strip() or "medium"

    rows = load_treatment_knowledge()
    exact = [
        row
        for row in rows
        if row.get("disease_class") == disease_class and row.get("stage") == stage and row.get("severity") == severity
    ]
    if exact:
        return exact[0]

    same_disease = [row for row in rows if row.get("disease_class") == disease_class and row.get("severity") == severity]
    if same_disease:
        return same_disease[0]

    general = [row for row in rows if row.get("disease_class") == disease_class]
    if general:
        return general[0]
    return None


def get_localized_treatment_summary(record: Optional[dict[str, str]], language: str) -> str:
    if not record:
        return ""
    normalized = normalize_language(language)
    summary_column = {
        "English": "summary_en",
        "हिंदी": "summary_hi",
        "भोजपुरी": "summary_bho",
        "ਪੰਜਾਬੀ": "summary_pa",
        "मराठी": "summary_mr",
    }.get(normalized, "summary_en")
    return record.get(summary_column, "") or record.get("summary_en", "")


MEDICINE_TRANSLATIONS = {
    "English": {},
    "हिंदी": {
        "Neem-based miticide support": "नीम आधारित माइटिसाइड",
        "Systemic + contact fungicide program": "प्रणालीगत + संपर्क कवकनाशी (Fungicide)",
        "Protective foliar fungicide": "सुरक्षात्मक कवकनाशी (Fungicide)",
        "Vector management + rogue infected plants": "वेक्टर प्रबंधन और संक्रमित पौधों को हटाएं",
        "Copper-based bactericide": "कॉपर आधारित जीवाणुनाशक (Bactericide)",
        "No chemical treatment required": "किसी रसायन की आवश्यकता नहीं",
        "Preventive scouting + balanced nutrition": "रोग निरोधी निगरानी और संतुलित पोषण",
        "Remove infected lower leaves and improve sunlight penetration in canopy.": "संक्रमित निचली पत्तियों को हटाएँ और सूर्य के प्रकाश के प्रवेश में सुधार करें।"
    },
    "ਪੰਜਾਬੀ": {
        "Neem-based miticide support": "ਨਿੰਮ ਅਧਾਰਤ ਮਾਈਟੀਸਾਈਡ",
        "Systemic + contact fungicide program": "ਸਿਸਟੈਮਿਕ + ਸੰਪਰਕ ਉੱਲੀਮਾਰ (Fungicide)",
        "Protective foliar fungicide": "ਸੁਰੱਖਿਆ ਵਾਲੀ ਉੱਲੀਮਾਰ (Fungicide)",
        "Vector management + rogue infected plants": "ਵੈਕਟਰ ਪ੍ਰਬੰਧਨ ਅਤੇ ਬਿਮਾਰ ਪੌਦੇ ਹਟਾਓ",
        "Copper-based bactericide": "ਕਾਪਰ ਅਧਾਰਤ ਜੀਵਾਣੂਨਾਸ਼ਕ (Bactericide)",
        "No chemical treatment required": "ਕਿਸੇ ਰਸਾਇਣ ਦੀ ਲੋੜ ਨਹੀਂ",
        "Preventive scouting + balanced nutrition": "ਰੋਕਥਾਮ ਅਤੇ ਸੰਤੁਲਿਤ ਪੋਸ਼ਣ"
    }
}

def get_localized_medicine(medicine: str, language: str) -> str:
    if not medicine:
        return medicine
    normalized = normalize_language(language)
    trans = MEDICINE_TRANSLATIONS.get(normalized, {}).get(medicine)
    return trans if trans else medicine




CROP_TRANSLATIONS = {
    "Apple": {"हिंदी": "सेब (Apple)", "ਪੰਜਾਬੀ": "ਸੇਬ (Apple)", "भोजपुरी": "सेब (Apple)", "मराठी": "सफरचंद (Apple)"},
    "Corn (maize)": {"हिंदी": "मक्का (Corn)", "ਪੰਜਾਬੀ": "ਮੱਕੀ (Corn)", "भोजपुरी": "मकई (Corn)", "मराठी": "मका (Corn)"},
    "Corn": {"हिंदी": "मक्का (Corn)", "ਪੰਜਾਬੀ": "ਮੱਕੀ (Corn)", "भोजपुरी": "मकई (Corn)", "मराठी": "मका (Corn)"},
    "Grape": {"हिंदी": "अंगूर (Grape)", "ਪੰਜਾਬੀ": "ਅੰਗੂਰ (Grape)", "भोजपुरी": "अंगूर (Grape)", "मराठी": "द्राक्षे (Grape)"},
    "Orange": {"हिंदी": "संतरा (Orange)", "ਪੰਜਾਬੀ": "ਸੰਤਰਾ (Orange)", "भोजपुरी": "संतरा (Orange)", "मराठी": "संत्री (Orange)"},
    "Peach": {"हिंदी": "आड़ू (Peach)", "ਪੰਜਾਬੀ": "ਆੜੂ (Peach)", "भोजपुरी": "आड़ू (Peach)", "मराठी": "आडू (Peach)"},
    "Pepper": {"हिंदी": "शिमला मिर्च (Pepper)", "ਪੰਜਾਬੀ": "ਸ਼ਿਮਲਾ ਮਿਰਚ (Pepper)", "भोजपुरी": "मिर्च (Pepper)", "मराठी": "ढोबळी मिरची (Pepper)"},
    "Pepper, bell": {"हिंदी": "शिमला मिर्च (Pepper)", "ਪੰਜਾਬੀ": "ਸ਼ਿਮਲਾ ਮਿਰਚ (Pepper)", "भोजपुरी": "मिर्च (Pepper)", "मराठी": "ढोबळी मिरची (Pepper)"},
    "Potato": {"हिंदी": "आलू (Potato)", "ਪੰਜਾਬੀ": "ਆਲੂ (Potato)", "भोजपुरी": "आलू (Potato)", "मराठी": "बटाटा (Potato)"},
    "Raspberry": {"हिंदी": "रसभरी (Raspberry)", "ਪੰਜਾਬੀ": "ਰਸਬੇਰੀ (Raspberry)", "भोजपुरी": "रसभरी (Raspberry)", "मराठी": "रसबेरी (Raspberry)"},
    "Soybean": {"हिंदी": "सोयाबीन (Soybean)", "ਪੰਜਾਬੀ": "ਸੋਆਬੀਨ (Soybean)", "भोजपुरी": "सोयाबीन (Soybean)", "मराठी": "सोयाबीन (Soybean)"},
    "Squash": {"हिंदी": "कद्दू (Squash)", "ਪੰਜਾਬੀ": "ਕੱਦੂ (Squash)", "भोजपुरी": "कोहड़ा (Squash)", "मराठी": "भोपळा (Squash)"},
    "Strawberry": {"हिंदी": "स्ट्रॉबेरी (Strawberry)", "ਪੰਜਾਬੀ": "ਸਟ੍ਰਾਬੇਰੀ (Strawberry)", "भोजपुरी": "स्ट्रॉबेरी (Strawberry)", "मराठी": "स्ट्रॉबेरी (Strawberry)"},
    "Tomato": {"हिंदी": "टमाटर (Tomato)", "ਪੰਜਾਬੀ": "ਟਮਾਟਰ (Tomato)", "भोजपुरी": "टमाटर (Tomato)", "मराठी": "टोमॅटो (Tomato)"},
    "Rice": {"हिंदी": "चावल / धान (Rice)", "ਪੰਜਾਬੀ": "ਝੋਨਾ / ਚੌਲ (Rice)", "भोजपुरी": "धान (Rice)", "मराठी": "तांदूळ (Rice)"},
    "Paddy": {"हिंदी": "चावल / धान (Rice)", "ਪੰਜਾਬੀ": "ਝੋਨਾ / ਚੌਲ (Rice)", "भोजपुरी": "धान (Rice)", "मराठी": "तांदूळ (Rice)"},
    "Wheat": {"हिंदी": "गेहूं (Wheat)", "ਪੰਜਾਬੀ": "ਕਣਕ (Wheat)", "भोजपुरी": "गेहूँ (Wheat)", "मराठी": "गहू (Wheat)"},
    "Cotton": {"हिंदी": "कपास (Cotton)", "ਪੰਜਾਬੀ": "ਕਪਾਹ (Cotton)", "भोजपुरी": "कपास (Cotton)", "मराठी": "कापूस (Cotton)"},
    "Mustard": {"हिंदी": "सरसों (Mustard)", "ਪੰਜਾਬੀ": "ਸਰ੍ਹੋਂ (Mustard)", "भोजपुरी": "सरसों (Mustard)", "मराठी": "मोहरी (Mustard)"},
    "Gudhal": {"हिंदी": "गुड़हल (Hibiscus)", "ਪੰਜਾਬੀ": "ਗੁੜਹਲ (Hibiscus)", "भोजपुरी": "गुड़हल (Hibiscus)", "मराठी": "जास्वंद (Hibiscus)"},
}

def get_localized_crop(crop_name: str, language: str) -> str:
    if not crop_name:
        return ""
    normalized = normalize_language(language)
    if normalized in ["English", "English (Global)", "en"]:
        return crop_name
    matched = CROP_TRANSLATIONS.get(crop_name.strip())
    if not matched:
        for k, v in CROP_TRANSLATIONS.items():
            if k.lower() == crop_name.strip().lower():
                matched = v
                break
    if matched and matched.get(normalized):
        return matched[normalized]
    return crop_name


DISEASE_TRANSLATIONS = {
    "Apple___Apple_scab": {"हिंदी": "सेब — सेब स्कैब (दाग रोग)", "ਪੰਜਾਬੀ": "ਸੇਬ — ਸੇਬ ਸਕੈਬ (ਦਾਗ ਰੋਗ)", "मराठी": "सफरचंद — स्कॅब (डाग रोग)"},
    "Apple___Black_rot": {"हिंदी": "सेब — ब्लैक रॉट (काली सड़न)", "ਪੰਜਾਬੀ": "ਸੇਬ — ਬਲੈਕ ਰੌਟ (ਕਾਲੀ ਸੜਨ)", "मराठी": "सफरचंद — काळी सड (ब्लॅक रॉट)"},
    "Apple___Cedar_apple_rust": {"हिंदी": "सेब — सीडर एप्पल रस्ट (रतुआ)", "ਪੰਜਾਬੀ": "ਸੇਬ — ਸੀਡਰ ਐਪਲ ਰਸਟ", "मराठी": "सफरचंद — तांबेरा (रस्ट)"},
    "Apple___healthy": {"हिंदी": "सेब — स्वस्थ (कोई बीमारी नहीं)", "ਪੰਜਾਬੀ": "ਸੇਬ — ਤੰਦਰੁਸਤ", "मराठी": "सफरचंद — निरोगी"},
    "Cherry_(including_sour)___Powdery_mildew": {"हिंदी": "चेरी — चेरी पाउडरी मिलड्यू (सफेद फफूंद)", "ਪੰਜਾਬੀ": "ਚੈਰੀ — ਚੈਰੀ ਪਾਊਡਰੀ ਮਿਲਡਿਊ", "मराठी": "चेरी — भुरी रोग"},
    "Cherry_(including_sour)___healthy": {"हिंदी": "चेरी — स्वस्थ", "ਪੰਜਾਬੀ": "ਚੈਰੀ — ਤੰਦਰੁਸਤ", "मराठी": "चेरी — निरोगी"},
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": {"हिंदी": "मक्का — सर्कोस्पोरा पत्ती धब्बा (ग्रे लीफ स्पॉट)", "ਪੰਜਾਬੀ": "ਮੱਕੀ — ਗ੍ਰੇ ਲੀਫ਼ ਸਪਾਟ", "मराठी": "मका — पानांवरील करपा"},
    "Corn_(maize)___Common_rust_": {"हिंदी": "मक्का — कॉमन रस्ट (रतुआ रोग)", "ਪੰਜਾਬੀ": "ਮੱਕੀ — ਰਤੂਆ ਰੋਗ", "मराठी": "मका — तांबेरा रोग"},
    "Corn_(maize)___Northern_Leaf_Blight": {"हिंदी": "मक्का — नॉर्दर्न लीफ ब्लाइट (झुलसा रोग)", "ਪੰਜਾਬੀ": "ਮੱਕੀ — ਨੌਰਦਰਨ ਲੀਫ਼ ਬਲਾਇਟ", "मराठी": "मका — तुरा व पान करपा"},
    "Corn_(maize)___healthy": {"हिंदी": "मक्का — स्वस्थ", "ਪੰਜਾਬੀ": "ਮੱਕੀ — ਤੰਦਰੁਸਤ", "मराठी": "मका — निरोगी"},
    "Grape___Black_rot": {"हिंदी": "अंगूर — ब्लैक रॉट (काली सड़न)", "ਪੰਜਾਬੀ": "ਅੰਗੂਰ — ਬਲੈਕ ਰੌਟ (ਕਾਲੀ ਸੜਨ)", "मराठी": "द्राक्षे — काळी सड (ब्लॅक रॉट)"},
    "Grape___Esca_(Black_Measles)": {"हिंदी": "अंगूर — एस्का (ब्लैक मीजल्स / काली चेचक)", "ਪੰਜਾਬੀ": "ਅੰਗੂਰ — ਐਸਕਾ (ਕਾਲੀ ਚੇਚਕ)", "मराठी": "द्राक्षे — एस्का (काळी चेचक)"},
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": {"हिंदी": "अंगूर — लीफ ब्लाइट (पत्ती झुलसा)", "ਪੰਜਾਬੀ": "ਅੰਗੂਰ — ਪੱਤਾ ਝੁਲਸ", "मराठी": "द्राक्षे — पानांवरील करपा"},
    "Grape___healthy": {"हिंदी": "अंगूर — स्वस्थ", "ਪੰਜਾਬੀ": "ਅੰਗੂਰ — ਤੰਦਰੁਸਤ", "मराठी": "द्राक्षे — निरोगी"},
    "Orange___Haunglongbing_(Citrus_greening)": {"हिंदी": "संतरा — सिट्रस ग्रीनिंग (ग्रीनिंग रोग)", "ਪੰਜਾਬੀ": "ਸੰਤਰਾ — ਸਿਟ੍ਰਸ ਗ੍ਰੀਨਿੰਗ", "मराठी": "संत्री — ग्रीनिंग रोग"},
    "Peach___Bacterial_spot": {"हिंदी": "आड़ू — जीवाणु धब्बा (बैक्टीरियल स्पॉट)", "ਪੰਜਾਬੀ": "ਆੜੂ — ਬੈਕਟੀਰੀਅਲ ਸਪਾਟ", "मराठी": "आडू — जिवाणू डाग"},
    "Peach___healthy": {"हिंदी": "आड़ू — स्वस्थ", "ਪੰਜਾਬੀ": "ਆੜੂ — ਤੰਦਰੁਸਤ", "मराठी": "आडू — निरोगी"},
    "Pepper,_bell___Bacterial_spot": {"हिंदी": "शिमला मिर्च — जीवाणु धब्बा (बैक्टीरियल स्पॉट)", "ਪੰਜਾਬੀ": "ਸ਼ਿਮਲਾ ਮਿਰਚ — ਬੈਕਟੀਰੀਅਲ ਸਪਾਟ", "मराठी": "ढोबळी मिरची — जिवाणू डाग"},
    "Pepper,_bell___healthy": {"हिंदी": "शिमला मिर्च — स्वस्थ", "ਪੰਜਾਬੀ": "ਸ਼ਿਮਲਾ ਮਿਰਚ — ਤੰਦਰੁਸਤ", "मराठी": "ढोबळी मिरची — निरोगी"},
    "Potato___Early_blight": {"हिंदी": "आलू — अर्ली ब्लाइट (अगेती झुलसा)", "ਪੰਜਾਬੀ": "ਆਲੂ — ਅਗੇਤੀ ਝੁਲਸ (Early Blight)", "मराठी": "बटाटा — अगेती करपा"},
    "Potato___Late_blight": {"हिंदी": "आलू — लेट ब्लाइट (पछेती झुलसा)", "ਪੰਜਾਬੀ": "ਆਲੂ — ਪਛੇਤੀ ਝੁਲਸ (Late Blight)", "मराठी": "बटाटा — पछेती करपा"},
    "Potato___healthy": {"हिंदी": "आलू — स्वस्थ", "ਪੰਜਾਬੀ": "ਆਲੂ — ਤੰਦਰੁਸਤ", "मराठी": "बटाटा — निरोगी"},
    "Raspberry___healthy": {"हिंदी": "रसभरी — स्वस्थ", "ਪੰਜਾਬੀ": "ਰਸਬੇਰੀ — ਤੰਦਰੁਸਤ", "मराठी": "रसबेरी — निरोगी"},
    "Soybean___healthy": {"हिंदी": "सोयाबीन — स्वस्थ", "ਪੰਜਾਬੀ": "ਸੋਆਬੀਨ — ਤੰਦਰੁਸਤ", "मराठी": "सोयाबीन — निरोगी"},
    "Squash___Powdery_mildew": {"हिंदी": "कद्दू — पाउडरी मिलड्यू (सफेद फफूंद)", "ਪੰਜਾਬੀ": "ਕੱਦੂ — ਪਾਊਡਰੀ ਮਿਲਡਿਊ", "मराठी": "भोपळा — भुरी रोग"},
    "Strawberry___Leaf_scorch": {"हिंदी": "स्ट्रॉबेरी — लीफ स्कॉर्च (पत्ती झुलसा)", "ਪੰਜਾਬੀ": "ਸਟ੍ਰਾਬੇਰੀ — ਲੀਫ਼ ਸਕੌਰਚ", "मराठी": "स्ट्रॉबेरी — पानांवरील करपा"},
    "Strawberry___healthy": {"हिंदी": "स्ट्रॉबेरी — स्वस्थ", "ਪੰਜਾਬੀ": "ਸਟ੍ਰਾਬੇਰੀ — ਤੰਦਰੁਸਤ", "मराठी": "स्ट्रॉबेरी — निरोगी"},
    "Tomato___Bacterial_spot": {"हिंदी": "टमाटर — जीवाणु धब्बा (बैक्टीरियल स्पॉट)", "ਪੰਜਾਬੀ": "ਟਮਾਟਰ — ਬੈਕਟੀਰੀਅਲ ਸਪਾਟ", "मराठी": "टोमॅटो — जिवाणू डाग"},
    "Tomato___Early_blight": {"हिंदी": "टमाटर — अर्ली ब्लाइट (अगेती झुलसा)", "ਪੰਜਾਬੀ": "ਟਮਾਟਰ — ਅਗੇਤੀ ਝੁਲਸ", "मराठी": "टोमॅटो — अगेती करपा"},
    "Tomato___Late_blight": {"हिंदी": "टमाटर — लेट ब्लाइट (पछेती झुलसा)", "ਪੰਜਾਬੀ": "ਟਮਾਟਰ — ਪਛੇਤੀ ਝੁਲਸ", "मराठी": "टोमॅटो — पछेती करपा"},
    "Tomato___Leaf_Mold": {"हिंदी": "टमाटर — लीफ मोल्ड (पत्ती फफूंद)", "ਪੰਜਾਬੀ": "ਟਮਾਟਰ — ਲੀਫ਼ ਮੋਲਡ", "मराठी": "टोमॅटो — पानांवरील बुरशी"},
    "Tomato___Septoria_leaf_spot": {"हिंदी": "टमाटर — सेप्टोरिया पत्ती धब्बा", "ਪੰਜਾਬੀ": "ਟਮਾਟਰ — ਸੇਪਟੋਰੀਆ ਪੱਤਾ ਧੱਬਾ", "मराठी": "टोमॅटो — सेप्टोरिया डाग"},
    "Tomato___Spider_mites Two-spotted_spider_mite": {"हिंदी": "टमाटर — मकड़ी कीट (स्पाइडर माइट्स)", "ਪੰਜਾਬੀ": "ਟਮਾਟਰ — ਮਕੜੀ ਕੀੜੇ", "मराठी": "टोमॅटो — कोळी कीड"},
    "Tomato___Target_Spot": {"हिंदी": "टमाटर — टारगेट स्पॉट (लक्ष्य धब्बा)", "ਪੰਜਾਬੀ": "ਟਮਾਟਰ — ਟਾਰਗੇਟ ਸਪਾਟ", "मराठी": "टोमॅटो — टार्गेट स्पॉट"},
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {"हिंदी": "टमाटर — येलो लीफ कर्ल वायरस (पत्ती मोड़क विषाणु)", "ਪੰਜਾਬੀ": "ਟਮਾਟਰ — ਯੈਲੋ ਲੀਫ਼ ਕਰਲ ਵਾਇਰਸ", "मराठी": "टोमॅटो — पर्णगुच्छ विषाणू"},
    "Tomato___Tomato_mosaic_virus": {"हिंदी": "टमाटर — मोज़ेक वायरस (चित्रक विषाणु)", "ਪੰਜਾਬੀ": "ਟਮਾਟਰ — ਮੋਜ਼ੇਕ ਵਾਇਰਸ", "मराठी": "टोमॅटो — मोझॅक विषाणू"},
    "Tomato___healthy": {"हिंदी": "टमाटर — स्वस्थ", "ਪੰਜਾਬੀ": "ਟਮਾਟਰ — ਤੰਦਰੁਸਤ", "मराठी": "टोमॅटो — निरोगी"},
    "Gudhal___healthy": {"हिंदी": "गुड़हल — स्वस्थ (पौधा तंदुरुस्त है)", "ਪੰਜਾਬੀ": "ਗੁੜਹਲ — ਤੰਦਰੁਸਤ", "मराठी": "जास्वंद — निरोगी"},
}

def get_localized_diagnosis(diagnosis_name: str, language: str) -> str:
    if not diagnosis_name:
        return ""
    normalized = normalize_language(language)
    if normalized in ["English", "English (Global)", "en"]:
        return diagnosis_name.replace("___", " — ").replace("_", " ")

    matched = DISEASE_TRANSLATIONS.get(diagnosis_name.strip())
    if matched and matched.get(normalized):
        return matched[normalized]

    if "___" in diagnosis_name:
        crop_part, disease_part = diagnosis_name.split("___", 1)
        localized_crop = get_localized_crop(crop_part, language)
        disease_clean = disease_part.replace("_", " ").strip()
        if "healthy" in disease_clean.lower():
            disease_clean = "स्वस्थ" if normalized in ["हिंदी", "भोजपुरी"] else ("निरोगी" if normalized == "मराठी" else "ਤੰਦਰੁਸਤ")
        return f"{localized_crop} — {disease_clean}"
    return diagnosis_name.replace("___", " — ").replace("_", " ")


MEDICINE_TRANSLATIONS = {
    "English": {},
    "हिंदी": {
        "Mancozeb": "मैनकोजेब (Mancozeb 75% WP)",
        "Neem-based miticide support": "नीम आधारित माइटिसाइड (Neem Miticide)",
        "Systemic + contact fungicide program": "प्रणालीगत + संपर्क कवकनाशी (Fungicide)",
        "Protective foliar fungicide": "सुरक्षात्मक कवकनाशी (Protective Fungicide)",
        "Vector management + rogue infected plants": "कीट नियंत्रण (इमिडाक्लोप्रिड) और संक्रमित पौधों को हटाना",
        "Copper-based bactericide": "कॉपर आधारित जीवाणुनाशक (Copper Oxychloride)",
        "No chemical treatment required": "किसी रासायनिक उपचार की आवश्यकता नहीं (पौधा स्वस्थ है)",
        "Preventive scouting + balanced nutrition": "रोग निरोधी निगरानी और संतुलित पोषण",
        "Remove infected lower leaves and improve sunlight penetration in canopy.": "संक्रमित निचली पत्तियों को हटाएँ और सूर्य के प्रकाश के प्रवेश में सुधार करें।"
    },
    "ਪੰਜਾਬੀ": {
        "Mancozeb": "ਮੈਨਕੋਜ਼ੇਬ (Mancozeb 75% WP)",
        "Neem-based miticide support": "ਨਿੰਮ ਅਧਾਰਤ ਮਾਈਟੀਸਾਈਡ",
        "Systemic + contact fungicide program": "ਸਿਸਟੈਮਿਕ + ਸੰਪਰਕ ਉੱਲੀਮਾਰ (Fungicide)",
        "Protective foliar fungicide": "ਸੁਰੱਖਿਆ ਵਾਲੀ ਉੱਲੀਮਾਰ (Fungicide)",
        "Vector management + rogue infected plants": "ਵੈਕਟਰ ਪ੍ਰਬੰਧਨ ਅਤੇ ਬਿਮਾਰ ਪੌਦੇ ਹਟਾਓ",
        "Copper-based bactericide": "ਕਾਪਰ ਅਧਾਰਤ ਜੀਵਾਣੂਨਾਸ਼ਕ (Bactericide)",
        "No chemical treatment required": "ਕਿਸੇ ਰਸਾਇਣ ਦੀ ਲੋੜ ਨਹੀਂ (ਪੌਦਾ ਤੰਦਰੁਸਤ ਹੈ)",
        "Preventive scouting + balanced nutrition": "ਰੋਕਥਾਮ ਅਤੇ ਸੰਤੁਲਿਤ ਪੋਸ਼ਣ"
    },
    "मराठी": {
        "Mancozeb": "मॅन्कोझेब (Mancozeb 75% WP)",
        "Neem-based miticide support": "कडुनिंब आधारित कीटकनाशक",
        "Systemic + contact fungicide program": "प्रणालीगत + संपर्क बुरशीनाशक (Fungicide)",
        "Protective foliar fungicide": "संरक्षक बुरशीनाशक (Fungicide)",
        "Vector management + rogue infected plants": "कीड व्यवस्थापन व बाधित वनस्पती नष्ट करा",
        "Copper-based bactericide": "कॉपर आधारित जिवाणूनाशक (Bactericide)",
        "No chemical treatment required": "कोणत्याही रासायनिक उपचारांची गरज नाही",
        "Preventive scouting + balanced nutrition": "प्रतिबंधात्मक पाहणी व संतुलित पोषण"
    }
}

def get_localized_medicine(medicine: str, language: str) -> str:
    if not medicine:
        return medicine
    normalized = normalize_language(language)
    trans = MEDICINE_TRANSLATIONS.get(normalized, {}).get(medicine)
    return trans if trans else medicine


def get_localized_dosage(dosage: str, language: str) -> str:
    if not dosage:
        return ""
    normalized = normalize_language(language)
    if normalized in ["English", "English (Global)", "en"]:
        return dosage
    text = dosage
    if normalized in ["हिंदी", "भोजपुरी"]:
        text = text.replace("per Liter", "प्रति लीटर").replace("g/L", "ग्राम/लीटर").replace("ml/L", "मिली/लीटर").replace("g/acre", "ग्राम/एकड़").replace("ml/acre", "मिली/एकड़")
    elif normalized == "ਪੰਜਾਬੀ":
        text = text.replace("per Liter", "ਪ੍ਰਤੀ ਲੀਟਰ").replace("g/L", "ਗ੍ਰਾਮ/ਲੀਟਰ").replace("ml/L", "ਮਿਲੀ/ਲੀਟਰ").replace("g/acre", "ਗ੍ਰਾਮ/ਏਕੜ").replace("ml/acre", "ਮਿਲੀ/ਏਕੜ")
    elif normalized == "मराठी":
        text = text.replace("per Liter", "प्रति लिटर").replace("g/L", "ग्रॅम/लिटर").replace("ml/L", "मिली/लिटर").replace("g/acre", "ग्रॅम/एकरी").replace("ml/acre", "मिली/एकरी")
    return text


def get_localized_stage(stage: str, language: str) -> str:
    normalized = normalize_language(language)
    if normalized in ["English", "English (Global)", "en"]:
        return stage.replace("_", " ").capitalize()
    if normalized in ["हिंदी", "भोजपुरी"]:
        return {"vegetative": "वानस्पतिक (Vegetative)", "nursery": "नर्सरी (Nursery)", "flowering_fruiting": "फूल व फल (Flowering)"}.get(stage, stage)
    elif normalized == "ਪੰਜਾਬੀ":
        return {"vegetative": "ਵਨਸਪਤੀ (Vegetative)", "nursery": "ਨਰਸਰੀ (Nursery)", "flowering_fruiting": "ਫੁੱਲ ਅਤੇ ਫਲ"}.get(stage, stage)
    elif normalized == "मराठी":
        return {"vegetative": "शाकीय (Vegetative)", "nursery": "रोपवाटिका (Nursery)", "flowering_fruiting": "फुलधारणा (Flowering)"}.get(stage, stage)
    return stage


def get_localized_severity(severity: str, language: str) -> str:
    normalized = normalize_language(language)
    if normalized in ["English", "English (Global)", "en"]:
        return severity.capitalize()
    if normalized in ["हिंदी", "भोजपुरी"]:
        return {"low": "कम (Low)", "medium": "मध्यम (Medium)", "high": "उच्च (High)", "critical": "गंभीर (Critical)"}.get(severity.lower(), severity)
    elif normalized == "ਪੰਜਾਬੀ":
        return {"low": "ਘੱਟ (Low)", "medium": "ਦਰਮਿਆਨਾ (Medium)", "high": "ਉੱਚ (High)", "critical": "ਗੰਭੀਰ (Critical)"}.get(severity.lower(), severity)
    elif normalized == "मराठी":
        return {"low": "कमी (Low)", "medium": "मध्यम (Medium)", "high": "जास्त (High)", "critical": "गंभीर (Critical)"}.get(severity.lower(), severity)
    return severity


TEXT_TRANSLATIONS = {
    "Disease detected. Follow treatment and re-scan in 48 hours.": {
        "English": "Disease detected. Follow treatment and re-scan in 48 hours.",
        "हिंदी": "रोग के लक्षण मिले हैं। सुझाये गए उपचार का पालन करें और 48 घंटे बाद पुनः स्कैन करें।",
        "ਪੰਜਾਬੀ": "ਫਸਲ ਵਿੱਚ ਬਿਮਾਰੀ ਦੇ ਲੱਛਣ ਮਿਲੇ ਹਨ। ਦੱਸੇ ਗਏ ਇਲਾਜ ਦੀ ਪਾਲਣਾ ਕਰੋ ਅਤੇ 48 ਘੰਟਿਆਂ ਬਾਅਦ ਮੁੜ ਸਕੈਨ ਕਰੋ।",
        "भोजपुरी": "बीमारी के लक्षण मिलल बा। बतावल गइल इलाज करीं आ 48 घंटा बाद फेर जांच करीं।",
        "मराठी": "रोगाची लक्षणे आढळली आहेत. सुचविलेले उपचार करा आणि ४८ तासांनंतर पुन्हा स्कॅन करा.",
    },
    "Crop looks healthy. Continue routine monitoring.": {
        "English": "Crop looks healthy. Continue routine monitoring.",
        "हिंदी": "आपकी फसल स्वस्थ दिखाई दे रही है। नियमित देखभाल और निगरानी जारी रखें।",
        "ਪੰਜਾਬੀ": "ਤੁਹਾਡੀ ਫਸਲ ਤੰਦਰੁਸਤ ਲਗਦੀ ਹੈ। ਨਿਯਮਤ ਦੇਖਭਾਲ ਜਾਰੀ ਰੱਖੋ।",
        "भोजपुरी": "फसल एकदम ठीक बा। लगातार देखभाल आ निगरानी चालू राखीं।",
        "मराठी": "तुमचे पीक निरोगी दिसत आहे. नियमित काळजी आणि पाहणी सुरू ठेवा.",
    },
    "Confidence low. Connect to human agronomist before spraying.": {
        "English": "Confidence low. Connect to human agronomist before spraying.",
        "हिंदी": "जांच का विश्वास स्तर कम है। छिड़काव करने से पहले कृषि विशेषज्ञ से सलाह लें।",
        "ਪੰਜਾਬੀ": "ਸਕੈਨ ਨਤੀਜਾ ਅਨਿਸ਼ਚਿਤ ਹੈ। ਛਿੜਕਾਅ ਤੋਂ ਪਹਿਲਾਂ ਖੇਤੀਬਾੜੀ ਮਾਹਰ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",
        "भोजपुरी": "जांच पक्का नइखे। छिड़काव करे से पहिले कृषि विशेषज्ञ से सलाह लीं।",
        "मराठी": "स्कॅन खात्री कमी आहे. फवारणीपूर्वी कृषी तज्ञांचा सल्ला घ्या.",
    },
    "Spray from early shoot growth until 4 weeks after bloom.": {
        "English": "Spray from early shoot growth until 4 weeks after bloom.",
        "हिंदी": "अंकुर की शुरुआती वृद्धि से लेकर फूल आने के 4 सप्ताह बाद तक छिड़काव करें।",
        "ਪੰਜਾਬੀ": "ਫੁੱਲ ਆਉਣ ਤੋਂ ਲੈ ਕੇ 4 ਹਫ਼ਤਿਆਂ ਬਾਅਦ ਤੱਕ ਛਿੜਕਾਅ ਕਰੋ।",
        "भोजपुरी": "अंकुर निकले के शुरुआत से लेके फूल आइला के 4 हफ्ता बाद तक छिड़काव करीं।",
        "मराठी": "पालवी फुटण्याच्या सुरुवातीपासून ते फुलल्यानंतर ४ आठवड्यांपर्यंत फवारणी करा.",
    },
    "weather_window_default": {
        "English": "Optimal spray window: Early morning (6:00 AM - 9:00 AM). Avoid spraying during rain or strong wind above 15 km/h.",
        "हिंदी": "छिड़काव का सही समय: सुबह जल्दी (6:00 - 9:00 बजे)। बारिश या 15 किमी/घंटा से अधिक तेज हवा में छिड़काव न करें।",
        "ਪੰਜਾਬੀ": "ਛਿੜਕਾਅ ਦਾ ਸਹੀ ਸਮਾਂ: ਸਵੇਰੇ ਜਲਦੀ (6:00 - 9:00 ਵਜੇ)। ਮੀਂਹ ਜਾਂ ਤੇਜ਼ ਹਵਾ ਵਿੱਚ ਛਿੜਕਾਅ ਤੋਂ ਬਚੋ।",
        "भोजपुरी": "छिड़काव के सही समय: भोर में जल्दी (6:00 - 9:00 बजे)। बरखा आउर तेज हवा में छिड़काव मत करीं।",
        "मराठी": "फवारणीची योग्य वेळ: पहाटे (सकाळी ६ ते ९). पाऊस किंवा जोरदार वाऱ्यात फवारणी टाळा.",
    },
    "soil_care_default": {
        "English": "Maintain balanced NPK feed and organic neem cake to enhance root immunity, soil structure, and crop recovery.",
        "हिंदी": "जड़ों की प्रतिरक्षा और मिट्टी की संरचना सुधारने के लिए संतुलित एनपीके और जैविक नीम खली का उपयोग करें।",
        "ਪੰਜਾਬੀ": "ਜੜ੍ਹਾਂ ਦੀ ਇਮਿਊਨਿਟੀ ਅਤੇ ਮਿੱਟੀ ਦੀ ਬਣਤਰ ਸੁਧਾਰਨ ਲਈ ਸੰਤੁਲਿਤ NPK ਅਤੇ ਨਿੰਮ ਦੀ ਖਲ੍ਹ ਦੀ ਵਰਤੋਂ ਕਰੋ।",
        "भोजपुरी": "जड़ के ताकत आ माटी के गुणवत्ता बढ़ावे खातिर संतुलित NPK आ नीम के खली के प्रयोग करीं।",
        "मराठी": "मुळांची प्रतिकारशक्ती आणि मातीची पोत सुधारण्यासाठी संतुलित NPK आणि सेंद्रिय कडुनिंब पेंड वापरा.",
    },
    "mandi_advice_default": {
        "English": "Expected Mandi Range: ₹1,850 - ₹2,400 / Quintal. Harvest after crop recovery and sell at registered APMC mandis.",
        "हिंदी": "अनुमानित मंडी भाव: ₹1,850 - ₹2,400 प्रति क्विंटल। फसल स्वस्थ होने पर नजदीकी सरकारी एपीएमसी मंडी में बेचें।",
        "ਪੰਜਾਬੀ": "ਅਨੁਮਾਨਿਤ ਮੰਡੀ ਭਾਅ: ₹1,850 - ₹2,400 ਪ੍ਰਤੀ ਕੁਇੰਟਲ। ਫਸਲ ਤੰਦਰੁਸਤ ਹੋਣ 'ਤੇ ਸਰਕਾਰੀ APMC ਮੰਡੀ ਵਿੱਚ ਵੇਚੋ।",
        "भोजपुरी": "अनुमानित मंडी भाव: ₹1,850 - ₹2,400 प्रति क्विंटल। फसल स्वस्थ भइला पर सरकारी एपीएमसी मंडी में बेचीं।",
        "मराठी": "अंदाजे बाजार भाव: ₹१,८५० - ₹२,४०० प्रति क्विंटल. पीक सुधारल्यानंतर नोंदणीकृत APMC बाजारात विक्री करा.",
    },
}

def get_localized_text(text: str, language: str) -> str:
    if not text:
        return ""
    normalized = normalize_language(language)
    clean_key = text.strip()
    if clean_key in TEXT_TRANSLATIONS:
        val = TEXT_TRANSLATIONS[clean_key].get(normalized)
        if val:
            return val
        return TEXT_TRANSLATIONS[clean_key].get("English", text)
    return text


def get_growth_care_recommendations(
    crop: str,
    stage: str = "vegetative",
    weather_risk: str = "medium",
    language: str = "English",
    limit: int = 4,
) -> list[dict[str, Any]]:
    normalized = normalize_language(language)
    advice_column = {
        "English": "advice_en",
        "हिंदी": "advice_hi",
        "भोजपुरी": "advice_bho",
        "ਪੰਜਾਬੀ": "advice_pa",
        "मराठी": "advice_mr",
    }.get(normalized, "advice_en")

    crop = crop.strip()
    stage = stage.strip() or "vegetative"
    weather_risk = weather_risk.strip() or "medium"

    rows = load_growth_care()
    matching = [
        row
        for row in rows
        if row.get("crop", "").strip().lower() == crop.lower()
        and row.get("stage") == stage
        and row.get("weather_risk") == weather_risk
    ]
    if not matching:
        matching = [row for row in rows if row.get("crop", "").strip().lower() == crop.lower() and row.get("stage") == stage]
    if not matching:
        matching = [row for row in rows if row.get("crop", "").strip().lower() == crop.lower()]

    payload = []
    for row in matching[: max(1, limit)]:
        payload.append(
            {
                "crop": row.get("crop"),
                "stage": row.get("stage"),
                "weather_risk": row.get("weather_risk"),
                "care_area": row.get("care_area"),
                "priority": row.get("priority"),
                "frequency": row.get("frequency"),
                "advice": row.get(advice_column) or row.get("advice_en", ""),
            }
        )
    return payload

