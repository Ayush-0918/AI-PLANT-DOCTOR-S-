# Plant / Crop Disease Image Dataset

## Purpose & Target Consumer
Used for training and fine-tuning the leaf disease diagnosis vision model (`MobileNetV3-Large` / `EfficientNet-Lite`).
- **Consumed by**:
  - Training script: `backend/scripts/train_lite.py`
  - Dataset validator: `backend/scripts/check_data_readiness.py`
  - Inference locator: `backend/app/services/system/dataset_locator_service.py`

## Expected Format & Structure
The dataset should be structured in PyTorch `ImageFolder` format (or subfolder per disease class):

```
backend/data/datasets/plant_disease_images/
├── Apple___Apple_scab/
│   ├── image1.jpg
│   └── image2.jpg
├── Apple___Black_rot/
├── Corn_(maize)___Common_rust_/
├── Gudhal___healthy/
├── Gudhal___mealybug/
├── Potato___Early_blight/
├── Potato___Late_blight/
├── Rice___Brown_Spot/
├── Tomato___Bacterial_spot/
├── Tomato___healthy/
└── Wheat___Yellow_Rust/
```

## Recommended Dataset Options

### Option 1: PlantVillage Dataset (Standard Clean Version — Recommended)
- **Source**: Kaggle / GitHub ([PlantVillage Dataset on Kaggle](https://www.kaggle.com/datasets/emmarex/plantdisease) or [SpMohanty PlantVillage](https://github.com/spMohanty/PlantVillage-Dataset))
- **Size & Samples**: ~828 MB (54,303 labeled images across 38 crop-disease classes + background).
- **Why**: Clean laboratory background, standard benchmark for agricultural computer vision, 98.2%+ validation accuracy on MobileNetV3.
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0) — Permissive for research & commercial use.

### Option 2: PlantDoc Dataset (Field Conditions — Complementary Option)
- **Source**: [PlantDoc Dataset on GitHub](https://github.com/pratikkayal/PlantDoc-Dataset) / [Kaggle](https://www.kaggle.com/datasets/theaugmentednature/plantdoc-dataset)
- **Size & Samples**: ~250 MB (2,598 real in-field images across 13 plant species and 27 classes).
- **Trade-off**: PlantVillage has laboratory clean leaves with high training stability (ideal primary base); PlantDoc has real cluttered field conditions (ideal for validation/fine-tuning).

## How to Place
1. Unzip the dataset into this folder (`backend/data/datasets/plant_disease_images/`).
2. Run `python scripts/check_data_readiness.py` to verify class folders and image counts.
3. Run `python scripts/train_lite.py` to train the new model weights (`backend/data/models/plantvillage_model.pth`).
