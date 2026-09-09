# Plant Doctor — Farmer Voice Assistant & Multilingual Chatbot Architecture (v2)

This document describes the design, implementation, and engineering contracts for the **Plant Doctor Multilingual Voice Assistant & Chatbot (v2)**.

---

## 1. Core Architecture & Request Flow

The assistant connects Indian farmers directly with actionable agricultural expertise using a resilient, multi-tiered AI pipeline:

```
                  ┌─────────────────────────────────────┐
                  │ FARMER (Voice / Text / Leaf Image)   │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │ Plant Doctor Backend Orchestrator   │
                  │ (/api/v1/ai/chat & /api/v1/voice/*) │
                  └──────┬──────────────────────────────┘
                         │
             ┌───────────┴───────────┐
             │                       │
             ▼ (Primary)             ▼ (Automatic Fallback)
    ┌─────────────────┐     ┌─────────────────────┐
    │  GROUP API      │     │  GEMINI FALLBACK    │
    │  (Fast Primary) │     │  (Automatic Safety) │
    └────────┬────────┘     └──────────┬──────────┘
             │                         │
             └───────────┬─────────────┘
                         ▼
        ┌───────────────────────────────────┐
        │  RESPONSE NORMALIZER & FORMATTER  │
        └────────────────┬──────────────────┘
                         │
        ┌────────────────┴──────────────────┐
        ▼ (Text Answer)                     ▼ (Voice Stream)
┌──────────────┐                  ┌────────────────────────┐
│ UI Messages  │                  │ BHASHINI TTS (Primary) │
│ & Follow-ups │                  │ SARVAM (Optional Tier) │
│              │                  │ BROWSER TTS (Fallback) │
└──────────────┘                  └────────────────────────┘
```

### Key Principles
1. **Group API is Primary**: Fast, specialized agronomist engine.
2. **Gemini is Automatic Fallback**: If Group API encounters timeouts, 5xx codes, network errors, or invalid responses, the orchestrator instantly routes the query to Gemini without exposing backend failures to the farmer.
3. **Safety First**: Never fabricates disease certainty without clear visual symptoms; dosages are verified before recommending chemicals.

---

## 2. Speech-to-Text (STT) Abstraction Layer

Provider Priority (Cost-Aware):
1. **Primary (Free)**: **Bhashini ASR API** (`bhashini.gov.in`, MeitY/Govt of India) — covers Hindi, Punjabi, English, and 19 scheduled languages at no cost.
2. **Secondary (Free / Self-Hosted)**: **AI4Bharat IndicConformer** — open-source, run locally or on private GPU/CPU instances.
3. **Client-Side Fallback**: **Web Speech API (`SpeechRecognition`)** — instant, zero-latency in-browser recognition on supported mobile browsers.

```python
class SpeechToTextClient:
    async def transcribe(audio_bytes: bytes, language: Optional[str] = None) -> Dict[str, Any]:
        # returns { text, language, confidence, provider }
```

---

## 3. Bhojpuri Language Coverage Strategy

> **⚠️ Engineering Note on Bhojpuri Language Support:**
> 
> Bhojpuri is not one of India's 22 officially "scheduled" languages (8th Schedule of the Indian Constitution). Consequently, no major enterprise STT/TTS vendor (Bhashini, Google Speech, Sarvam AI, AI4Bharat) currently ships a dedicated stand-alone Bhojpuri acoustic model.
>
> **Practical Engineering Implementation in Plant Doctor:**
> 1. **STT Pipeline**: Bhojpuri spoken audio is force-routed to the **Hindi (`hi`)** ASR acoustic model. Because Bhojpuri speakers are near-universally Hindi-comprehensible and code-mixing is ubiquitous across rural Bihar/UP, acoustic recognition accuracy is high in practice.
> 2. **TTS / Response Generation**: Responses are formulated in clean, colloquial Hindi using vocabulary familiar to Bhojpuri speakers (short sentences, simple words, avoiding bookish or Sanskritized terms).
> 3. **Modularity**: When a dedicated Bhojpuri acoustic model becomes available from AI4Bharat or Bhashini, it can be plugged directly behind `SpeechToTextClient` without modifying calling code.

---

## 4. Text-to-Speech (TTS) Abstraction Layer

Provider Priority:
1. **Primary (Free)**: **Bhashini TTS API** — natural voices for Hindi, Punjabi, and Indian languages at zero cost.
2. **Optional Quality Tier (Paid / Feature-Flagged)**: **Sarvam Bulbul (`bulbul:v1`)** — high-fidelity conversational audio with low latency.
3. **Last-Resort Zero-Dependency Fallback**: **Browser / Device Native TTS (`SpeechSynthesis`)** & backend **gTTS** — guarantees the assistant is never silent even during complete network degradation.

```python
class TextToSpeechClient:
    async def synthesize(text: str, language: str = "hi", voice: Optional[str] = None) -> Dict[str, Any]:
        # returns { audio_base64, format, provider, language }
```

---

## 5. Normalized Response Schema

Both the Group API and Gemini fallback pipelines emit identical normalized payloads to the client:

```json
{
  "success": true,
  "answer": "नमस्ते जी! पत्ते पीले होना आमतौर पर नाइट्रोजन की कमी का संकेत हो सकता है। एक साफ फोटो भेज दीजिए।",
  "response": "नमस्ते जी!...",
  "language": "hi",
  "source": "group_api",
  "confidence": 0.95,
  "suggestions": [
    "📷 पत्ती की फोटो भेजें",
    "🌾 यूरिया की खुराक",
    "💧 सिंचाई जांच"
  ],
  "audio": "data:audio/mp3;base64,...",
  "navigate": "/scanner",
  "latency_sec": 0.38
}
```

---

## 6. Environment Variables Configuration

| Variable | Description | Default |
| :--- | :--- | :--- |
| `GROUP_API_URL` | Base URL of Group AI API | `""` |
| `GROUP_API_KEY` | Bearer/API token for Group API | `""` |
| `GROUP_API_TIMEOUT` | Timeout in seconds before Gemini fallback | `5.0` |
| `GEMINI_API_KEY` | Google Gemini API Key | `""` |
| `GEMINI_MODEL` | Gemini model name | `gemini-2.0-flash` |
| `BHASHINI_API_URL` | MeitY Bhashini API endpoint | `https://dhruva-api.bhashini.gov.in/...` |
| `BHASHINI_API_KEY` | Bhashini developer API key | `""` |
| `BHASHINI_USER_ID` | Bhashini developer user ID | `""` |
| `SARVAM_API_KEY` | Optional Sarvam Bulbul API Key | `""` |
| `SARVAM_MODEL` | Sarvam voice model | `bulbul:v1` |
| `STT_PROVIDER` | Active STT provider | `bhashini` |
| `TTS_PROVIDER` | Active TTS provider | `bhashini` |
