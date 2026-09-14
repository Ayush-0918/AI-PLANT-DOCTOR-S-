import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from fpdf import FPDF  # type: ignore[import]

from app.services.diagnosis.knowledge_base_service import (
    get_growth_care_recommendations,
    get_localized_crop,
    get_localized_diagnosis,
    get_localized_dosage,
    get_localized_medicine,
    get_localized_severity,
    get_localized_stage,
    get_localized_text,
    get_localized_treatment_summary,
    get_treatment_record,
    normalize_language,
    translate,
)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
STATIC_REPORT_DIR = PROJECT_ROOT / "static" / "reports"
UNICODE_FONT_CANDIDATES = [
    Path("/Library/Fonts/Arial Unicode.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
]


def _resolve_unicode_font() -> Optional[Path]:
    for path in UNICODE_FONT_CANDIDATES:
        if path.exists():
            return path
    return None


def shape_indic_text(text: str) -> str:
    if not text:
        return ""
    # Devanagari matra i (U+093F)
    pattern_hi = re.compile(r'((?:[\u0915-\u0939\u0958-\u095f]\u093c?(?:\u094d[\u0915-\u0939\u0958-\u095f]\u093c?)*))\u093f')
    text = pattern_hi.sub("\u093f\\g<1>", text)

    # Gurmukhi matra i (U+0A3F)
    pattern_pa = re.compile(r'((?:[\u0a15-\u0a39\u0a59-\u0a5e](?:\u0a4d[\u0a15-\u0a39\u0a59-\u0a5e])*))\u0a3f')
    text = pattern_pa.sub("\u0a3f\\g<1>", text)

    return text


def _build_pdf(language: str) -> FPDF:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()

    font_path = _resolve_unicode_font()
    if font_path is not None:
        pdf.add_font("PlantDoctorsUnicode", "", str(font_path), uni=True)
        pdf.set_font("PlantDoctorsUnicode", "", 12)
    else:
        pdf.set_font("Arial", "", 12)
    return pdf


def _set_font(pdf: FPDF, style: str = "", size: int = 12) -> None:
    if "plantdoctorsunicode" in getattr(pdf, "fonts", {}):
        pdf.set_font("PlantDoctorsUnicode", "", size)
    else:
        pdf.set_font("Arial", style, size)


def _safe_text(text: Any) -> str:
    if text is None:
        return ""
    return str(text).strip()


def _add_section_header(pdf: FPDF, title: str, r: int, g: int, b: int) -> None:
    pdf.set_fill_color(r, g, b)
    pdf.set_text_color(255, 255, 255)
    _set_font(pdf, "B", 11)
    shaped_title = shape_indic_text(_safe_text(title))
    pdf.cell(0, 8, txt=f"   {shaped_title}", ln=True, fill=True)
    pdf.set_text_color(30, 30, 30)
    pdf.ln(1)


def _dedupe_preserve_order(lines: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for line in lines:
        cleaned = _safe_text(line)
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(cleaned)
    return output


def generate_scan_report(
    language: str,
    farmer_name: str,
    location: str,
    crop: str,
    diagnosis_name: str,
    confidence: float,
    treatment: dict[str, Any],
    recommendation: str,
    treatment_record: Optional[dict[str, str]] = None,
    care_recommendations: Optional[list[dict[str, Any]]] = None,
    stage: str = "vegetative",
    severity: str = "medium",
    weather_risk: str = "medium",
) -> dict[str, str]:
    STATIC_REPORT_DIR.mkdir(parents=True, exist_ok=True)
    pdf = _build_pdf(language)
    report_id = uuid4().hex[:8].upper()
    generated_at = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M")

    # Localized Headers and Labels
    loc_title = translate("pdf_title", language, "Plant Doctors Crop Health Report")
    loc_subheader = translate("pdf_subheader", language, "Plant Doctor Intelligence Suite | Powered by PlantVillage AI")
    loc_disclaimer = translate("pdf_disclaimer", language, "This report supports field decisions but does not replace certified agronomist judgment.")

    loc_rep_id = translate("lbl_report_id", language, "Report ID")
    loc_gen_at = translate("lbl_generated_at", language, "Generated At")
    loc_lbl_stage = translate("lbl_stage", language, "Stage")
    loc_lbl_severity = translate("lbl_severity", language, "Severity")
    loc_lbl_w_risk = translate("lbl_weather_risk", language, "Weather Risk")

    val_stage = get_localized_stage(stage, language)
    val_severity = get_localized_severity(severity, language)
    val_w_risk = get_localized_severity(weather_risk, language)

    # -------------------------------------------------------------
    # 0. ULTRA-PREMIUM HEADER BANNER (Dark Forest Green + Gold Accent)
    # -------------------------------------------------------------
    pdf.set_fill_color(18, 64, 42)
    pdf.rect(10, 10, 190, 22, "F")
    
    pdf.set_xy(14, 13)
    pdf.set_text_color(255, 255, 255)
    _set_font(pdf, "B", 16)
    pdf.cell(0, 8, txt=shape_indic_text(loc_title), ln=True)
    
    pdf.set_xy(14, 21)
    pdf.set_text_color(200, 240, 215)
    _set_font(pdf, "", 9)
    pdf.cell(0, 6, txt=shape_indic_text(loc_subheader), ln=True)
    
    pdf.set_fill_color(220, 175, 40)
    pdf.rect(10, 32, 190, 2, "F")

    pdf.set_y(37)
    pdf.set_text_color(30, 30, 30)

    # -------------------------------------------------------------
    # METADATA BAR (Soft Blue Card)
    # -------------------------------------------------------------
    pdf.set_fill_color(240, 246, 255)
    pdf.set_draw_color(205, 222, 245)
    _set_font(pdf, "", 9.5)
    meta_text = (
        f"{loc_rep_id}: {report_id}    |    {loc_gen_at}: {generated_at}\n"
        f"{loc_lbl_stage}: {val_stage}    |    {loc_lbl_severity}: {val_severity}    |    {loc_lbl_w_risk}: {val_w_risk}"
    )
    pdf.multi_cell(0, 6, txt=shape_indic_text(meta_text), fill=True, border=1)
    pdf.ln(2)

    # DISCLAIMER
    _set_font(pdf, "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(0, 5.5, txt=shape_indic_text(loc_disclaimer))
    pdf.set_text_color(30, 30, 30)
    pdf.ln(2)

    # -------------------------------------------------------------
    # SECTION 1: FARMER DETAILS (किसान विवरण / ਕਿਸਾਨ ਦੇ ਵੇਰਵੇ / शेतकरी तपशील)
    # -------------------------------------------------------------
    _add_section_header(pdf, translate("pdf_farmer_details", language, "1. Farmer Details"), 28, 85, 140)
    _set_font(pdf, "", 10.5)
    farmer_val = _safe_text(farmer_name) or translate("farmer_default", language, "Farmer")
    location_val = _safe_text(location) or translate("not_provided", language, "Not provided")
    crop_val = get_localized_crop(_safe_text(crop), language)

    farmer_text = (
        f"• {translate('lbl_name', language, 'Name')}: {farmer_val}\n"
        f"• {translate('lbl_location', language, 'Location')}: {location_val}\n"
        f"• {translate('lbl_crop', language, 'Crop')}: {crop_val}\n"
        f"• {translate('lbl_generated_at', language, 'Generated At')}: {generated_at}"
    )
    pdf.multi_cell(0, 6.5, txt=shape_indic_text(farmer_text))
    pdf.ln(2)

    # -------------------------------------------------------------
    # SECTION 2: SCAN RESULT / DIAGNOSIS (स्कैन परिणाम / ਸਕੈਨ ਨਤੀਜਾ / स्कॅन निकाल)
    # -------------------------------------------------------------
    _add_section_header(pdf, translate("pdf_scan_result", language, "2. Scan Result"), 20, 110, 70)
    _set_font(pdf, "", 10.5)

    diagnosis_val = get_localized_diagnosis(diagnosis_name, language)
    medicine_val = get_localized_medicine(_safe_text(treatment.get("medicine")), language)
    dosage_val = get_localized_dosage(_safe_text(treatment.get("dosage")), language)

    scan_text = (
        f"• {translate('label_diagnosis', language, 'Diagnosis')}: {diagnosis_val}\n"
        f"• {translate('label_confidence', language, 'Confidence')}: {round(float(confidence or 0), 2)}%\n"
        f"• {translate('label_treatment', language, 'Treatment')}: {medicine_val}\n"
        f"• {translate('label_dosage', language, 'Dosage')}: {dosage_val}"
    )
    pdf.multi_cell(0, 6.5, txt=shape_indic_text(scan_text))
    pdf.ln(2)

    # -------------------------------------------------------------
    # SECTION 3: AI SMART ADVICE (AI स्मार्ट सलाह / AI ਸਮਾਰਟ ਸਲਾਹ / AI स्मार्ट सल्ला)
    # -------------------------------------------------------------
    _add_section_header(pdf, translate("pdf_model_note", language, "3. AI Smart Advice"), 110, 45, 125)
    _set_font(pdf, "", 10.5)

    localized_summary = get_localized_treatment_summary(treatment_record, language)
    if not localized_summary:
        localized_summary = get_localized_text(_safe_text(recommendation), language)

    advice_text = localized_summary or get_localized_text(_safe_text(treatment.get("instructions")), language)
    pdf.multi_cell(0, 6.5, txt=shape_indic_text(advice_text))
    pdf.ln(2)

    # -------------------------------------------------------------
    # SECTION 4: FOLLOW-UP & TREATMENT CARE (आगे की सलाह / ਅਗਲੀ ਸਲਾਹ / पुढील सल्ला)
    # -------------------------------------------------------------
    _add_section_header(pdf, translate("pdf_follow_up", language, "4. Follow-up Advice"), 180, 85, 20)
    _set_font(pdf, "", 10.5)

    raw_instr = _safe_text(treatment.get("instructions"))
    raw_prec = _safe_text(treatment.get("precautionary_notes"))
    loc_instr = get_localized_text(get_localized_medicine(raw_instr, language), language)
    loc_prec = get_localized_text(get_localized_medicine(raw_prec, language), language)

    follow_up_lines = [loc_instr, loc_prec]
    if care_recommendations:
        for row in care_recommendations[:4]:
            adv = _safe_text(row.get("advice"))
            if adv:
                follow_up_lines.append(get_localized_text(adv, language))

    follow_up_lines = _dedupe_preserve_order([line for line in follow_up_lines if line])
    if not follow_up_lines:
        follow_up_lines.append(get_localized_text(_safe_text(recommendation), language))

    bullet_lines = [f"• {line}" for line in follow_up_lines]
    pdf.multi_cell(0, 6.5, txt=shape_indic_text("\n".join(bullet_lines)))
    pdf.ln(2)

    # -------------------------------------------------------------
    # SECTION 5: NEW FEATURE - WEATHER & SPRAY TIMING WINDOW
    # (मौसम और छिड़काव समय / ਮੌਸਮ ਅਤੇ ਛਿੜਕਾਅ ਸਮਾਂ / हवामान आणि फवारणीची वेळ)
    # -------------------------------------------------------------
    _add_section_header(pdf, translate("pdf_weather_window", language, "5. Weather & Spray Timing Window"), 25, 115, 130)
    _set_font(pdf, "", 10.5)
    weather_advice = get_localized_text("weather_window_default", language)
    pdf.multi_cell(0, 6.5, txt=shape_indic_text(f"• {weather_advice}"))
    pdf.ln(2)

    # -------------------------------------------------------------
    # SECTION 6: NEW FEATURE - SOIL HEALTH & NUTRIENT CARE
    # (मिट्टी स्वास्थ्य और पोषण प्रबंधन / ਮਿੱਟੀ ਸਿਹਤ ਅਤੇ ਪੋਸ਼ਣ ਪ੍ਰਬੰਧਨ / माती आरोग्य आणि पोषण व्यवस्थापन)
    # -------------------------------------------------------------
    _add_section_header(pdf, translate("pdf_soil_care", language, "6. Soil Health & Nutrient Care"), 120, 75, 30)
    _set_font(pdf, "", 10.5)
    soil_advice = get_localized_text("soil_care_default", language)
    pdf.multi_cell(0, 6.5, txt=shape_indic_text(f"• {soil_advice}"))
    pdf.ln(2)

    # -------------------------------------------------------------
    # SECTION 7: NEW FEATURE - MANDI MARKET RATES & SELLING ADVICE
    # (मंडी भाव और बिक्री सलाह / ਮੰਡੀ ਭਾਅ ਅਤੇ ਵੇਚਣ ਸਲਾਹ / बाजार भाव आणि विक्री सल्ला)
    # -------------------------------------------------------------
    _add_section_header(pdf, translate("pdf_mandi_advice", language, "7. Mandi Market Rates & Selling Advice"), 160, 110, 20)
    _set_font(pdf, "", 10.5)
    mandi_advice = get_localized_text("mandi_advice_default", language)
    pdf.multi_cell(0, 6.5, txt=shape_indic_text(f"• {mandi_advice}"))

    # -------------------------------------------------------------
    # PDF OUTPUT
    # -------------------------------------------------------------
    file_name = f"scan_report_{uuid4().hex[:10]}.pdf"
    file_path = STATIC_REPORT_DIR / file_name
    pdf.output(str(file_path))
    return {
        "report_url": f"/static/reports/{file_name}",
        "file_name": file_name,
    }
