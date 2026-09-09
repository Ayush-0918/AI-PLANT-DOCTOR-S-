# Crop Recommendation Dataset

## Purpose & Target Consumer
Used by the soil analytics and crop recommendation engine to predict optimal crops based on soil nutrients and climatic conditions.
- **Consumed by**:
  - `backend/app/services/soil/soil_advice_service.py`
  - `backend/app/api/routes/admin_ai.py`
  - `backend/scripts/check_data_readiness.py`

## Expected File Name & Format
- **Target File**: `crop_recommendation.csv` (place directly in `backend/data/datasets/crop_recommendation/crop_recommendation.csv` or symlink/copy to `backend/data/generated/crop_recommendation.csv`).
- **Format**: CSV with header row:
  ```csv
  N,P,K,temperature,humidity,ph,rainfall,label
  90,42,43,20.87,82.00,6.50,202.93,rice
  85,58,41,21.77,80.31,7.03,226.65,rice
  60,55,44,23.00,82.32,7.84,263.96,rice
  ```
- **Key Columns**:
  - `N`: Nitrogen level in soil (ratio / kg/ha)
  - `P`: Phosphorus level in soil (ratio / kg/ha)
  - `K`: Potassium level in soil (ratio / kg/ha)
  - `temperature`: Temperature in °C
  - `humidity`: Relative humidity in %
  - `ph`: Soil pH (3.5 - 9.9)
  - `rainfall`: Rainfall in mm
  - `label`: Crop name (e.g., `rice`, `wheat`, `maize`, `chickpea`, `kidneybeans`, `pigeonpeas`, `mothbeans`, `mungbean`, `blackgram`, `lentil`, `pomegranate`, `banana`, `mango`, `grapes`, `watermelon`, `muskmelon`, `apple`, `orange`, `papaya`, `coconut`, `cotton`, `jute`, `coffee`).

## Recommended Dataset
- **Dataset Name**: **Crop Recommendation Dataset** (Kaggle / Open ICAR benchmark)
- **Direct Source**: [Kaggle Crop Recommendation Dataset by Atharva Ingle](https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset)
- **Size & Samples**: ~140 KB, 2,200 rows, 22 distinct crops with balanced 100 samples per class.
- **Why**: Clean, standardized multi-nutrient tabular benchmark dataset derived from Indian Council of Agricultural Research (ICAR) field studies; achieves 99%+ accuracy with Random Forest / XGBoost classifiers.
- **License**: Open Database License (ODbL) / Public Domain (CC0: Public Domain).
