# Soil Types Image Classification Dataset

## Purpose & Target Consumer
Used for training the soil type vision classifier to identify Indian soil classes (Alluvial, Black, Clayey, Red, Sandy, Loamy) from camera photos.
- **Consumed by**:
  - `backend/app/services/diagnosis/ai_inference_service.py` (`SoilClassifier`)
  - `backend/scripts/train_soil_model.py`

## Expected File Names & Formats
1. **`soil_labels.txt`**
   - Single column plain text with soil class names (one per line):
     ```
     Alluvial Soil
     Black Soil
     Clay Soil
     Red Soil
     Sandy Soil
     Loamy Soil
     ```
2. **Image Folders**:
   - `Alluvial_Soil/`
   - `Black_Soil/`
   - `Clay_Soil/`
   - `Red_Soil/`
   - `Sandy_Soil/`
   - `Loamy_Soil/`

## Recommended Dataset
- **Dataset Name**: **Soil Types Image Dataset** (Kaggle)
- **Direct Source**: [Kaggle Soil Types Dataset by Prasansha Satpathy](https://www.kaggle.com/datasets/prasanshasatpathy/soil-types) or [Soil Classification Dataset by Mahdieh](https://www.kaggle.com/datasets/mahdiehh/soil-classification)
- **Size & Samples**: ~15–35 MB (approx. 1,000–1,500 photos across 5–6 key soil categories).
- **Why**: Lightweight, high contrast soil texture images, allows quick MobileNet transfer learning with >93% validation accuracy.
- **License**: CC0 / Open Public Access.
