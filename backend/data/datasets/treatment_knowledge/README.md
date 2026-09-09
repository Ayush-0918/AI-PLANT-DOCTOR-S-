# Plant Care, Treatment & Pesticide Knowledgebase

## Purpose & Target Consumer
Provides comprehensive disease management, organic home remedies, chemical remedies, preventive care, and multilingual translations for plant diseases diagnosed by the vision engine or queried in chat.
- **Consumed by**:
  - `backend/app/services/diagnosis/knowledge_base_service.py`
  - `backend/app/api/routes/admin_ai.py`
  - `backend/scripts/check_data_readiness.py`

## Expected File Names & Formats
1. **`treatment_knowledge.csv`**
   - **Columns**: `disease_id`, `crop`, `disease_name_en`, `disease_name_hi`, `disease_name_pa`, `symptoms_en`, `symptoms_hi`, `organic_treatment_en`, `organic_treatment_hi`, `chemical_treatment_en`, `chemical_treatment_hi`, `preventive_measures_en`, `preventive_measures_hi`, `severity_level`
2. **`plant_growth_care_recommendations.csv`**
   - **Columns**: `crop`, `growth_stage`, `water_requirement`, `sunlight_requirement`, `ideal_temperature`, `soil_ph_range`, `common_risks`, `organic_boosters`
3. **`translations_core.csv`**
   - **Columns**: `term_key`, `english`, `hindi`, `punjabi`, `bhojpuri`, `category`

## Recommended Dataset / Knowledge Sources
- **Source 1: ICAR & State Agricultural Universities (SAUs) Package of Practices**
  - [ICAR Agritech Portal & Crop Protection Guides](https://icar.org.in/) / [TNAU Agritech Portal](http://agritech.tnau.ac.in/)
  - Covers 500+ Indian crop-disease treatment protocols with approved CIBRC (Central Insecticide Board and Registration Committee) safe dosages.
- **Source 2: PlantVillage Disease Diagnosis & Treatments Knowledge Base**
  - [PlantVillage Open Disease Database](https://plantvillage.psu.edu/diseases)
  - Covers organic, biological (Trichoderma, Pseudomonas, Neem oil) and chemical controls for all 38 PlantVillage disease classes.
