# Fertilizer Recommendation Dataset

## Purpose & Target Consumer
Used for calculating fertilizer doses and recommending commercial & organic fertilizers (Urea, DAP, MOP, 10:26:26, 12:32:16, 20:20:0, etc.) based on soil type, crop type, and nutrient deficits.
- **Consumed by**:
  - `backend/app/services/soil/soil_advice_service.py`
  - `backend/app/api/routes/admin_ai.py`
  - `backend/scripts/check_data_readiness.py`

## Expected File Name & Format
- **Target File**: `fertilizer_recommendation.csv` (place in `backend/data/datasets/fertilizer_recommendation/fertilizer_recommendation.csv` or `backend/data/generated/fertilizer_recommendation.csv`).
- **Format**: CSV with header row:
  ```csv
  Temparature,Humidity,Moisture,Soil Type,Crop Type,Nitrogen,Potassium,Phosphorous,Fertilizer Name
  26,52,38,Sandy,Maize,37,0,0,Urea
  29,52,45,Loamy,Sugarcane,12,0,36,DAP
  34,65,54,Black,Cotton,7,9,30,14-35-14
  ```
- **Key Columns**:
  - `Temparature` / `Temperature`: Ambient temperature (°C)
  - `Humidity`: Air relative humidity (%)
  - `Moisture`: Soil moisture index (%)
  - `Soil Type`: Sandy, Loamy, Black, Red, Clayey
  - `Crop Type`: Maize, Sugarcane, Cotton, Tobacco, Paddy, Barley, Wheat, Millets, Oil seeds, Pulses, Ground Nuts
  - `Nitrogen`, `Potassium`, `Phosphorous`: Soil nutrient test values
  - `Fertilizer Name`: Urea, DAP, 14-35-14, 28-28-0, 17-17-17, 20-20, 10-26-26

## Recommended Dataset
- **Dataset Name**: **Fertilizer Prediction Dataset** (Kaggle / Agricultural University benchmark)
- **Direct Source**: [Kaggle Fertilizer Prediction Dataset by Samadrita Ghosh](https://www.kaggle.com/datasets/samadritaghosh/fertilizer-prediction)
- **Size & Samples**: ~5 KB (100–500 rows standard benchmark) or extended multi-state fertilizer matrix (~700 KB).
- **Why**: Specifically models Indian soil types (Sandy, Loamy, Black, Red, Clayey) against major staple and cash crops with fertilizer recommendations standard in Indian Mandis and cooperative societies (IFFCO / KRIBHCO).
- **License**: CC0: Public Domain.
