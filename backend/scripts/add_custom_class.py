import os
import sys

def main():
    print("========================================")
    print("🪴 Plant Doctor - Custom Class Tool")
    print("========================================")
    
    class_name = "Gudhal___healthy"
    
    # We will put it directly in the training bundle
    # If the bundle doesn't exist, we'll create the structure.
    dataset_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'PlantVillage-Dataset', 'training_bundle', 'color'))
    target_dir = os.path.join(dataset_dir, class_name)
    
    os.makedirs(target_dir, exist_ok=True)
    
    print(f"\n✅ Created directory for new class: {class_name}")
    print(f"📁 Path: {target_dir}")
    print("\n👉 Next Steps:")
    print("1. Copy your Gudhal image into the folder path above.")
    print("2. Since the full dataset is quite large, if you haven't downloaded the full PlantVillage dataset yet, please place it in the same structure.")
    print("3. Run the training script:")
    print("   source venv312/bin/activate")
    print("   python backend/scripts/train_lite.py --preset light --dataset-dir PlantVillage-Dataset/training_bundle/color")
    print("\nNote: Make sure your image is named something like 'gudhal_1.jpg'.")

if __name__ == "__main__":
    main()
