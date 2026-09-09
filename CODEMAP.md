# Plant Doctors — Codebase Feature & Architecture Map (`CODEMAP.md`)

This map serves as the single source of truth for locating farmer-facing features, AI models, dataset assets, backend domain services, APIs, and frontend user interfaces across the Plant Doctors platform.

---

## 🗺️ High-Level Directory Overview

```
Plant Doctors/
├── backend/                  # FastAPI Backend Server (Python 3.12)
│   ├── app/                  # Application Core, API Routers, and Domain Services
│   │   ├── api/routes/       # Modular REST Endpoints (/api/v1/...)
│   │   ├── core/             # App Config, Database, Rate Limiting & Security
│   │   ├── models/           # Pydantic Schemas & DB Data Models
│   │   └── services/         # Domain-driven Service Layer (by Farmer Feature)
│   ├── data/                 # Segregated Model Weights & Datasets
│   │   ├── models/           # PyTorch .pth Weights & Model Labels
│   │   ├── datasets/         # Agricultural Reference Datasets & Soil Labels
│   │   └── generated/        # Curated Crop, Fertilizer & Treatment CSVs
│   ├── scripts/              # Training, Pipeline, and Seeding Utilities
│   ├── static/               # Generated PDF Reports, Model Registry & Metrics
│   └── tests/                # Automated Backend Route & Security Tests
├── docs/                     # Categorized Documentation
│   ├── architecture/         # System Architecture & Multi-Provider AI Specs
│   ├── business/             # Business Plan, Bilingual Analysis & Team Info
│   └── execution/            # 90-Day Roadmap, Checklists & Launch Guides
├── web/                      # Next.js 16 (App Router) + Tailwind/CSS Frontend
│   ├── app/                  # Frontend Routes (Scanner, Voice, Mandi, Soil, etc.)
│   ├── components/           # UI Components (Chatbot, Voice, Audio Visualizer)
│   └── lib/                  # Frontend Utilities, API Client & State Hooks
├── README.md                 # Project Overview & Quickstart Guide
└── CODEMAP.md                # Feature-to-File-Path Lookup Table (This File)
```

---

## 🌾 Feature-to-File-Path Lookup Table

| **Multilingual Voice Assistant & Chatbot** | [`backend/app/services/assistant/ai_assistant_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/assistant/ai_assistant_service.py) | [`backend/app/api/routes/ai_chat.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/ai_chat.py)<br>[`backend/app/api/routes/voice.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/voice.py) | [`web/src/components/farmer/FarmerAssistantCard.tsx`](file:///Users/aayu/Plant%20Doctors/web/src/components/farmer/FarmerAssistantCard.tsx)<br>[`web/src/components/farmer/FarmerAssistantModal.tsx`](file:///Users/aayu/Plant%20Doctors/web/src/components/farmer/FarmerAssistantModal.tsx) |
| **Primary AI (Group API) & Fallback AI (Gemini/Sarvam/Groq)** | [`backend/app/services/assistant/ai_assistant_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/assistant/ai_assistant_service.py) | [`backend/app/api/routes/ai_chat.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/ai_chat.py) | [`web/src/services/aiAssistantService.ts`](file:///Users/aayu/Plant%20Doctors/web/src/services/aiAssistantService.ts) |
| **Speech-to-Text (STT) & Text-to-Speech (TTS)** | [`backend/app/services/assistant/ai_assistant_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/assistant/ai_assistant_service.py) *(Sarvam Saaras & Bulbul / Groq Whisper)* | [`backend/app/api/routes/voice.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/voice.py) | [`web/src/components/farmer/FarmerAssistantModal.tsx`](file:///Users/aayu/Plant%20Doctors/web/src/components/farmer/FarmerAssistantModal.tsx) |
| **Crop Leaf Disease Diagnosis (38 Classes)** | [`backend/app/services/diagnosis/ai_inference_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/diagnosis/ai_inference_service.py)<br>[`backend/app/ai_model.py`](file:///Users/aayu/Plant%20Doctors/backend/app/ai_model.py) | [`backend/app/api/routes/ai.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/ai.py) | [`web/app/scanner/page.tsx`](file:///Users/aayu/Plant%20Doctors/web/app/scanner/page.tsx) |
| **Disease Treatment & Care Knowledge** | [`backend/app/services/diagnosis/knowledge_base_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/diagnosis/knowledge_base_service.py) | [`backend/app/api/routes/ai.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/ai.py) | [`web/app/scanner/page.tsx`](file:///Users/aayu/Plant%20Doctors/web/app/scanner/page.tsx)<br>[`web/app/guide/page.tsx`](file:///Users/aayu/Plant%20Doctors/web/app/guide/page.tsx) |
| **Bilingual PDF Crop Health Reports** | [`backend/app/services/diagnosis/report_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/diagnosis/report_service.py) | [`backend/app/api/routes/ai.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/ai.py) | [`web/app/scanner/page.tsx`](file:///Users/aayu/Plant%20Doctors/web/app/scanner/page.tsx) |
| **Soil Analysis & Fertilizer Advisory** | [`backend/app/services/soil/soil_advice_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/soil/soil_advice_service.py) | [`backend/app/api/routes/ai.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/ai.py)<br>[`backend/app/api/routes/intelligence.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/intelligence.py) | [`web/app/soil/page.tsx`](file:///Users/aayu/Plant%20Doctors/web/app/soil/page.tsx) |
| **Mandi Real-time Prices & Arrival Trends** | [`backend/app/services/market/mandi_trend_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/market/mandi_trend_service.py) | [`backend/app/api/routes/mandi.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/mandi.py) | [`web/app/mandi/page.tsx`](file:///Users/aayu/Plant%20Doctors/web/app/mandi/page.tsx) |
| **Live Weather & 7-Day Agricultural Forecasts** | [`backend/app/services/market/weather_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/market/weather_service.py) | [`backend/app/api/routes/geo.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/geo.py)<br>[`backend/app/api/routes/intelligence.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/intelligence.py) | [`web/app/dashboard/page.tsx`](file:///Users/aayu/Plant%20Doctors/web/app/dashboard/page.tsx) |
| **Regional Outbreak Threat Mapping** | [`backend/app/services/market/threat_map_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/market/threat_map_service.py) | [`backend/app/api/routes/geo.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/geo.py) | [`web/app/dashboard/page.tsx`](file:///Users/aayu/Plant%20Doctors/web/app/dashboard/page.tsx) |
| **Agronomist / Expert Voice Consultation** | [`backend/app/services/expert/expert_call_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/expert/expert_call_service.py) | [`backend/app/api/routes/expert_calls.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/expert_calls.py) | [`web/app/expert/page.tsx`](file:///Users/aayu/Plant%20Doctors/web/app/expert/page.tsx) |
| **Farmer Auth & Profile Management** | [`backend/app/services/auth/auth_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/auth/auth_service.py) | [`backend/app/api/routes/auth.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/auth.py)<br>[`backend/app/api/routes/users.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/users.py) | [`web/app/profile/page.tsx`](file:///Users/aayu/Plant%20Doctors/web/app/profile/page.tsx) |
| **AI Model Registry, Observability & Feedback** | [`backend/app/services/system/model_registry_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/system/model_registry_service.py)<br>[`backend/app/services/system/prediction_log_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/system/prediction_log_service.py) | [`backend/app/api/routes/admin_ai.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/admin_ai.py)<br>[`backend/app/api/routes/health.py`](file:///Users/aayu/Plant%20Doctors/backend/app/api/routes/health.py) | [`web/app/admin/page.tsx`](file:///Users/aayu/Plant%20Doctors/web/app/admin/page.tsx) |
| **Data File Discovery & Resolution** | [`backend/app/services/system/dataset_locator_service.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/system/dataset_locator_service.py) | Internal | N/A |

---

## 📦 Data & Model Artifact Locations

- **Fine-tuned Disease Classifier Weights**: `backend/data/models/plantvillage_model.pth`
- **Soil Classification Labels**: `backend/data/models/soil_labels.txt` (and `backend/data/datasets/soil_labels.txt`)
- **Crop Recommendation Matrix**: `backend/data/generated/crop_recommendation.csv`
- **Fertilizer Recommendation Matrix**: `backend/data/generated/fertilizer_recommendation.csv`
- **Treatment & Pesticide Knowledgebase**: `backend/data/generated/treatment_knowledge.csv`
- **Growth Care Guidelines**: `backend/data/generated/plant_growth_care_recommendations.csv`
- **Agricultural Price Dataset (Fallback Safety Net)**: `backend/data/generated/agriculture_price_dataset.csv`
  > 📌 *Maintenance Note*: While live web search (`MandiPriceCrew`) is primary, this static dataset acts as the secondary safety net if web search or Agmarknet APIs time out. It should be refreshed monthly (`python backend/scripts/generate_mandi_dataset.py`) to prevent fallback data from growing stale over time.

---

## 📚 Documentation Index

- **System Architecture**: [`docs/architecture/ARCHITECTURE.md`](file:///Users/aayu/Plant%20Doctors/docs/architecture/ARCHITECTURE.md)
- **Voice Assistant Architecture**: [`docs/architecture/FARMER_VOICE_ASSISTANT_ARCHITECTURE.md`](file:///Users/aayu/Plant%20Doctors/docs/architecture/FARMER_VOICE_ASSISTANT_ARCHITECTURE.md)
- **Bilingual PDF Health Reports**: [`docs/architecture/PDF_HEALTH_REPORT_BILINGUAL_SOLUTION.md`](file:///Users/aayu/Plant%20Doctors/docs/architecture/PDF_HEALTH_REPORT_BILINGUAL_SOLUTION.md)
- **Lightweight Training Guide**: [`docs/architecture/TRAINING_LIGHT_GUIDE.md`](file:///Users/aayu/Plant%20Doctors/docs/architecture/TRAINING_LIGHT_GUIDE.md)
- **Business Plan & Monetization**: [`docs/business/BUSINESS_PLAN.md`](file:///Users/aayu/Plant%20Doctors/docs/business/BUSINESS_PLAN.md)
- **Bilingual Project Analysis**: [`docs/business/PROJECT_ANALYSIS_BILINGUAL.md`](file:///Users/aayu/Plant%20Doctors/docs/business/PROJECT_ANALYSIS_BILINGUAL.md)
- **90-Day Execution Roadmap**: [`docs/execution/90_DAY_EXECUTION_PLAN.md`](file:///Users/aayu/Plant%20Doctors/docs/execution/90_DAY_EXECUTION_PLAN.md)
- **Execution Checklist**: [`docs/execution/EXECUTION_CHECKLIST.md`](file:///Users/aayu/Plant%20Doctors/docs/execution/EXECUTION_CHECKLIST.md)

---

## 🎙️ AI4Bharat IndicConformerASR Self-Hosted STT Fallback

- **Module**: [`backend/app/services/voice/ai4bharat_provider.py`](file:///Users/aayu/Plant%20Doctors/backend/app/services/voice/ai4bharat_provider.py)
- **Model Suite**: [AI4Bharat IndicConformer](https://huggingface.co/ai4bharat/IndicConformer) (22 Indian languages supported).
- **Fallback Chain Position**: `Groq Whisper / Sarvam (Saaras v3) → Bhashini → AI4Bharat IndicConformerASR → Local Fallback`.
- **Resource & Hardware Footprint**:
  - **GPU (Recommended)**: NVIDIA GPU with CUDA support (~2GB VRAM per loaded language model instance). First inference cold start latency: ~1.5s to 3.0s (model weights lazily loaded on first request). Subsequent inferences: ~200ms–400ms.
  - **CPU (Supported)**: PyTorch CPU inference or ONNX Runtime (`OpenVoiceOS/ai4bharat-indicconformer-<lang>-onnx`). RAM allocation: ~1.8GB. Inference latency: ~800ms–1.5s for a 5-second audio clip.
- **Health Check & Fault Tolerance**: Includes `health_check()` to dynamically verify NeMo/ONNX runtime availability. If dependencies are missing or weights fail to load, the provider safely yields `text: ""` and allows local fallback without crashing server processes.

