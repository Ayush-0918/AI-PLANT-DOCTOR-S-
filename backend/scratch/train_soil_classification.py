#!/usr/bin/env python3
"""
=============================================================
  Comprehensive Soil Classification — CNN Model Trainer
  Dataset: ai4a-lab/comprehensive-soil-classification-datasets (Kaggle)
  Engine: TensorFlow 2.16 + Apple Silicon Metal GPU
=============================================================
"""

import os, sys, time, warnings
warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path
from collections import Counter
import kagglehub

# ── 1. Setup Directories ──────────────────────────────────
RESULTS_DIR = Path("/Users/aayu/Plant Doctors/backend/scratch/results")
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 65)
print("   Soil Classification Model Trainer — Apple Silicon M-Series")
print("=" * 65)

# ── 2. Download Kaggle Dataset ───────────────────────────
print("\n[1/6] Downloading Soil Classification dataset from Kaggle...")
try:
    dataset_path = kagglehub.dataset_download("ai4a-lab/comprehensive-soil-classification-datasets")
    print(f"      ✅ Dataset downloaded to: {dataset_path}")
except Exception as e:
    print(f"      ❌ Download error: {e}")
    sys.exit(1)

root_dir = Path(dataset_path)

# ── 3. Scan Dataset Structure ─────────────────────────────
print("\n[2/6] Scanning directory structure...")
image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

def find_image_dirs(path):
    class_dirs = []
    for p in path.rglob("*"):
        if p.is_dir():
            imgs = [f for f in p.iterdir() if f.suffix.lower() in image_extensions]
            if len(imgs) > 10:
                class_dirs.append((p, len(imgs)))
    return class_dirs

valid_dirs = find_image_dirs(root_dir)

if not valid_dirs:
    # Check direct child folders
    for child in root_dir.iterdir():
        if child.is_dir():
            imgs = [f for f in child.rglob("*") if f.suffix.lower() in image_extensions]
            if imgs:
                valid_dirs.append((child, len(imgs)))

print(f"      Found {len(valid_dirs)} soil categories.")

class_map = {}
image_paths = []
labels = []

for cdir, count in valid_dirs:
    cname = cdir.name
    class_map[cname] = cdir
    for img_file in cdir.rglob("*"):
        if img_file.suffix.lower() in image_extensions:
            image_paths.append(str(img_file))
            labels.append(cname)

df = pd.DataFrame({"path": image_paths, "label": labels})
classes = sorted(df["label"].unique())
num_classes = len(classes)

print(f"      Total soil images found : {len(df):,}")
print(f"      Soil Classes ({num_classes})      : {classes}")

# ── 4. Analyze Data Distribution (Pandas + Matplotlib) ─────
print("\n[3/6] Analyzing class distribution (Pandas + Matplotlib)...")
class_counts = df["label"].value_counts()
print(class_counts.to_string())

plt.figure(figsize=(12, 6))
bars = plt.bar(class_counts.index, class_counts.values, color="#2e7d32", edgecolor="black", alpha=0.85)
plt.title("Soil Classification Dataset — Image Count per Class", fontsize=14, fontweight="bold", pad=15)
plt.xlabel("Soil Category", fontsize=12)
plt.ylabel("Number of Images", fontsize=12)
plt.xticks(rotation=45, ha="right", fontsize=10)
plt.grid(axis="y", linestyle="--", alpha=0.5)

for bar in bars:
    yval = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2, yval + 5, f"{yval:,}", ha="center", va="bottom", fontsize=9, fontweight="bold")

plt.tight_layout()
dist_chart_path = RESULTS_DIR / "soil_class_distribution.png"
plt.savefig(dist_chart_path, dpi=150)
plt.close()
print(f"      📊 Chart saved → {dist_chart_path}")

# ── 5. Data Cleaning & Image Loading (NumPy) ─────────────
print("\n[4/6] Data cleaning & Loading images into NumPy float32 arrays (224×224)...")
import cv2

IMG_SIZE = 224
MAX_PER_CLASS = 1000  # High precision cap

balanced_df_list = []
for c in classes:
    sub = df[df["label"] == c]
    if len(sub) > MAX_PER_CLASS:
        sub = sub.sample(MAX_PER_CLASS, random_state=42)
    balanced_df_list.append(sub)

clean_df = pd.concat(balanced_df_list).sample(frac=1.0, random_state=42).reset_index(drop=True)
print(f"      Balanced dataset size: {len(clean_df):,} images")

label_to_idx = {c: i for i, c in enumerate(classes)}
idx_to_label = {i: c for i, c in enumerate(classes)}

X_list, y_list = [], []
corrupt_count = 0

for idx, row in clean_df.iterrows():
    img_path = row["path"]
    lbl_idx = label_to_idx[row["label"]]
    try:
        img = cv2.imread(img_path)
        if img is None:
            corrupt_count += 1
            continue
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
        img_arr = img.astype("float32") / 255.0
        
        # Check corrupt / blank image (std near 0)
        if img_arr.std() < 0.01:
            corrupt_count += 1
            continue
            
        X_list.append(img_arr)
        y_list.append(lbl_idx)
    except Exception:
        corrupt_count += 1

X = np.array(X_list, dtype="float32")
y = np.array(y_list, dtype="int32")

print(f"      Cleaned dataset shape: {X.shape} | Removed corrupt/blank: {corrupt_count}")

# Save sample images grid
fig, axes = plt.subplots(3, 5, figsize=(15, 9))
axes = axes.flatten()
for i in range(min(15, len(X))):
    axes[i].imshow(X[i])
    axes[i].set_title(idx_to_label[y[i]], fontsize=10, fontweight="bold")
    axes[i].axis("off")
plt.tight_layout()
sample_grid_path = RESULTS_DIR / "soil_sample_images.png"
plt.savefig(sample_grid_path, dpi=150)
plt.close()
print(f"      📷 Sample grid saved → {sample_grid_path}")

# Train / Val / Test Split (80 / 10 / 10)
from sklearn.model_selection import train_test_split
X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp)

print(f"      Train: {len(X_train):,} | Val: {len(X_val):,} | Test: {len(X_test):,}")

# ── 6. Build & Train Custom CNN Model (TensorFlow / Metal GPU) ─
print("\n[5/6] Building & Training Custom Deep CNN Architecture...")
import tensorflow as tf
from tensorflow.keras import layers, models, callbacks

gpus = tf.config.list_physical_devices("GPU")
print(f"      TF version: {tf.__version__} | Active GPUs: {len(gpus)}")

def build_custom_cnn(input_shape, num_classes):
    model = models.Sequential([
        layers.Input(shape=input_shape),
        
        # Augmentation
        layers.RandomFlip("horizontal_and_vertical"),
        layers.RandomRotation(0.2),
        layers.RandomZoom(0.15),
        layers.RandomContrast(0.15),
        
        # Block 1
        layers.Conv2D(32, (3, 3), padding="same", activation="relu"),
        layers.BatchNormalization(),
        layers.Conv2D(32, (3, 3), padding="same", activation="relu"),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.2),
        
        # Block 2
        layers.Conv2D(64, (3, 3), padding="same", activation="relu"),
        layers.BatchNormalization(),
        layers.Conv2D(64, (3, 3), padding="same", activation="relu"),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.3),
        
        # Block 3
        layers.Conv2D(128, (3, 3), padding="same", activation="relu"),
        layers.BatchNormalization(),
        layers.Conv2D(128, (3, 3), padding="same", activation="relu"),
        layers.BatchNormalization(),
        layers.MaxPooling2D((2, 2)),
        layers.Dropout(0.3),
        
        # Dense Head
        layers.GlobalAveragePooling2D(),
        layers.Dense(256, activation="relu"),
        layers.BatchNormalization(),
        layers.Dropout(0.4),
        layers.Dense(num_classes, activation="softmax")
    ])
    return model

cnn_model = build_custom_cnn((IMG_SIZE, IMG_SIZE, 3), num_classes)
cnn_model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)

cnn_callbacks = [
    callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True, verbose=1),
    callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, verbose=1)
]

print("      Starting Custom CNN Training (15 Epochs)...")
start_time = time.time()
history_cnn = cnn_model.fit(
    X_train, y_train,
    validation_data=(X_val, y_val),
    epochs=15,
    batch_size=32,
    callbacks=cnn_callbacks,
    verbose=1
)
cnn_time = time.time() - start_time

test_loss, test_acc = cnn_model.evaluate(X_test, y_test, verbose=0)
print(f"      ✅ Custom CNN Test Accuracy: {test_acc * 100:.2f}% (Loss: {test_loss:.4f}) in {cnn_time:.1f}s")

# ── 7. Save Model & Plot Results ─────────────────────────
print("\n[6/6] Saving Best Model & Training Visualizations...")

model_save_path = RESULTS_DIR / "soil_cnn_model.keras"
cnn_model.save(model_save_path)
print(f"      💾 Trained CNN Model saved → {model_save_path}")

# Plot training curves
plt.figure(figsize=(12, 5))

# Accuracy plot
plt.subplot(1, 2, 1)
plt.plot(history_cnn.history["accuracy"], label="Train Acc", linewidth=2, color="#1b5e20")
plt.plot(history_cnn.history["val_accuracy"], label="Val Acc", linewidth=2, color="#e65100", linestyle="--")
plt.title("Soil CNN — Model Accuracy", fontsize=12, fontweight="bold")
plt.xlabel("Epoch")
plt.ylabel("Accuracy")
plt.legend()
plt.grid(True, alpha=0.3)

# Loss plot
plt.subplot(1, 2, 2)
plt.plot(history_cnn.history["loss"], label="Train Loss", linewidth=2, color="#1b5e20")
plt.plot(history_cnn.history["val_loss"], label="Val Loss", linewidth=2, color="#e65100", linestyle="--")
plt.title("Soil CNN — Model Loss", fontsize=12, fontweight="bold")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.legend()
plt.grid(True, alpha=0.3)

plt.tight_layout()
curves_path = RESULTS_DIR / "soil_training_curves.png"
plt.savefig(curves_path, dpi=150)
plt.close()
print(f"      📊 Curves chart saved → {curves_path}")

print("=" * 65)
print(f"  🎉 Soil Classification Training Complete!")
print(f"  Final Test Accuracy: {test_acc * 100:.2f}%")
print("=" * 65)
