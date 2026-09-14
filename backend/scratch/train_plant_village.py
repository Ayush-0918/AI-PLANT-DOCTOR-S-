#!/usr/bin/env python3
"""
=============================================================
  PlantVillage Disease Classification — Multi-Model Trainer
  Models: Custom CNN · MobileNetV2 · EfficientNetB0 · ResNet50
          + SVM / Random Forest on extracted features
  Dataset: arjuntejaswi/plant-village (Kaggle)
=============================================================
"""

# ── 0. Imports ─────────────────────────────────────────────
import os, sys, time, warnings
warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")          # headless — saves to PNG
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from pathlib import Path
from collections import Counter

print("=" * 65)
print("  PlantVillage Multi-Model Trainer — Apple Silicon M-Series")
print("=" * 65)

# ── 1. Download Dataset ────────────────────────────────────
print("\n[1/7] Downloading PlantVillage dataset from Kaggle...")
try:
    import kagglehub
    dataset_path = kagglehub.dataset_download("arjuntejaswi/plant-village")
    print(f"      ✅ Dataset path: {dataset_path}")
except Exception as e:
    print(f"      ❌ Kaggle download failed: {e}")
    sys.exit(1)

# ── 2. Locate Image Root ───────────────────────────────────
print("\n[2/7] Scanning dataset structure...")
dataset_path = Path(dataset_path)
image_exts   = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}

# Find the directory that actually contains class subfolders
def find_image_root(base: Path) -> Path:
    for d in [base] + list(base.rglob("*")):
        if d.is_dir():
            subdirs = [x for x in d.iterdir() if x.is_dir()]
            if len(subdirs) >= 5:
                # check subdirs contain images
                has_imgs = any(
                    any(f.suffix in image_exts for f in sd.iterdir() if f.is_file())
                    for sd in subdirs[:3]
                )
                if has_imgs:
                    return d
    return base

img_root   = find_image_root(dataset_path)
class_dirs = sorted([d for d in img_root.iterdir() if d.is_dir()])
classes    = [d.name for d in class_dirs]
n_classes  = len(classes)
print(f"      Found {n_classes} classes at: {img_root}")

# ── 3. Data Analysis with Pandas / NumPy ──────────────────
print("\n[3/7] Analysing dataset distribution (Pandas + NumPy)...")
records = []
for cls_dir in class_dirs:
    imgs = [f for f in cls_dir.iterdir() if f.suffix in image_exts]
    records.append({"class": cls_dir.name, "count": len(imgs), "path": str(cls_dir)})

df = pd.DataFrame(records)
df["plant"]   = df["class"].apply(lambda x: x.rsplit("_", 1)[0] if "_" in x else x)
df["healthy"]  = df["class"].str.lower().str.contains("healthy")

total_images = df["count"].sum()
print(f"      Total images  : {total_images:,}")
print(f"      Classes       : {n_classes}")
print(f"      Healthy classes: {df['healthy'].sum()} / {n_classes}")
print(f"\n      Top 5 largest classes:")
print(df.nlargest(5, "count")[["class","count"]].to_string(index=False))
print(f"\n      Per-class stats (count):")
print(f"        mean={df['count'].mean():.0f}  std={df['count'].std():.0f}  "
      f"min={df['count'].min()}  max={df['count'].max()}")

# Save class distribution chart
fig, ax = plt.subplots(figsize=(16, 6))
colors = ["#10b981" if h else "#ef4444" for h in df["healthy"]]
ax.bar(range(len(df)), df["count"], color=colors, edgecolor="white", linewidth=0.3)
ax.set_xticks(range(len(df)))
ax.set_xticklabels(df["class"], rotation=90, fontsize=5)
ax.set_title("PlantVillage — Class Distribution", fontsize=13, fontweight="bold")
ax.set_xlabel("Disease Class")
ax.set_ylabel("Image Count")
green_p = mpatches.Patch(color="#10b981", label="Healthy")
red_p   = mpatches.Patch(color="#ef4444", label="Diseased")
ax.legend(handles=[green_p, red_p])
plt.tight_layout()
out_dir = Path("/Users/aayu/Plant Doctors/backend/scratch/results")
out_dir.mkdir(parents=True, exist_ok=True)
plt.savefig(out_dir / "class_distribution.png", dpi=150)
plt.close()
print(f"\n      📊 Chart saved → results/class_distribution.png")

# ── 4. Load & Preprocess Images ───────────────────────────
print("\n[4/7] Loading images (224×224, normalised)...")
from PIL import Image

IMG_SIZE   = 224
BATCH_SIZE = 32
VAL_SPLIT  = 0.15
TEST_SPLIT = 0.10
MAX_PER_CLASS = 800   # cap per class so training finishes in reasonable time

class_to_idx = {c: i for i, c in enumerate(classes)}

all_paths, all_labels = [], []
for cls_dir in class_dirs:
    imgs = sorted([f for f in cls_dir.iterdir() if f.suffix in image_exts])
    imgs = imgs[:MAX_PER_CLASS]
    all_paths  += imgs
    all_labels += [class_to_idx[cls_dir.name]] * len(imgs)

total_used = len(all_paths)
print(f"      Using {total_used:,} images (cap {MAX_PER_CLASS}/class)")

# Shuffle
rng = np.random.default_rng(42)
idx = rng.permutation(total_used)
all_paths  = [all_paths[i]  for i in idx]
all_labels = [all_labels[i] for i in idx]

# Split
n_test  = int(total_used * TEST_SPLIT)
n_val   = int(total_used * VAL_SPLIT)
n_train = total_used - n_val - n_test

test_paths,  test_labels  = all_paths[:n_test],  all_labels[:n_test]
val_paths,   val_labels   = all_paths[n_test:n_test+n_val],  all_labels[n_test:n_test+n_val]
train_paths, train_labels = all_paths[n_test+n_val:], all_labels[n_test+n_val:]
print(f"      Train: {n_train:,}  Val: {n_val:,}  Test: {n_test:,}")

def load_images_np(paths, labels, size=IMG_SIZE):
    """Load images into (N, H, W, 3) float32 numpy array."""
    X, y = [], []
    for p, lbl in zip(paths, labels):
        try:
            img = Image.open(p).convert("RGB").resize((size, size), Image.BILINEAR)
            X.append(np.array(img, dtype=np.float32) / 255.0)
            y.append(lbl)
        except Exception:
            pass
    return np.stack(X), np.array(y, dtype=np.int32)

print("      Loading train images...", end=" ", flush=True)
t0 = time.time()
X_train, y_train = load_images_np(train_paths, train_labels)
print(f"done ({time.time()-t0:.1f}s)")

print("      Loading val images...", end=" ", flush=True)
X_val, y_val = load_images_np(val_paths, val_labels)
print(f"done")

print("      Loading test images...", end=" ", flush=True)
X_test, y_test = load_images_np(test_paths, test_labels)
print(f"done")
print(f"      X_train shape: {X_train.shape}  dtype: {X_train.dtype}")

# ── 5. Data Cleaning ──────────────────────────────────────
print("\n[5/7] Data cleaning (NumPy)...")

# Remove near-zero-variance (pure black/white) images
def is_corrupt(img):
    std = img.std()
    mean = img.mean()
    return std < 0.01 or mean < 0.01 or mean > 0.99

mask_train = np.array([not is_corrupt(x) for x in X_train])
mask_val   = np.array([not is_corrupt(x) for x in X_val])
mask_test  = np.array([not is_corrupt(x) for x in X_test])

removed = (~mask_train).sum() + (~mask_val).sum() + (~mask_test).sum()
X_train, y_train = X_train[mask_train], y_train[mask_train]
X_val,   y_val   = X_val[mask_val],   y_val[mask_val]
X_test,  y_test  = X_test[mask_test],  y_test[mask_test]
print(f"      Removed {removed} corrupt/blank images")
print(f"      Clean sizes → Train:{len(X_train):,}  Val:{len(X_val):,}  Test:{len(X_test):,}")

# Visualise sample images
fig, axes = plt.subplots(4, 8, figsize=(16, 8))
for ax, img, lbl in zip(axes.flat, X_train[:32], y_train[:32]):
    ax.imshow(img)
    ax.set_title(classes[lbl][:18], fontsize=4)
    ax.axis("off")
plt.suptitle("Sample Training Images (cleaned)", fontsize=11, fontweight="bold")
plt.tight_layout()
plt.savefig(out_dir / "sample_images.png", dpi=120)
plt.close()
print("      📷 Sample images → results/sample_images.png")

# ── 6. Model Training ─────────────────────────────────────
print("\n[6/7] Training models...")
print("─" * 65)

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import MobileNetV2, EfficientNetB0, ResNet50V2
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import LinearSVC
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
from sklearn.decomposition import PCA

print(f"      TF version: {tf.__version__}  GPUs: {len(tf.config.list_physical_devices('GPU'))}")

results = {}    # model_name → test_accuracy
histories = {}  # model_name → keras History

EPOCHS     = 15
y_train_oh = tf.keras.utils.to_categorical(y_train, n_classes)
y_val_oh   = tf.keras.utils.to_categorical(y_val,   n_classes)

def compile_and_train(name, model, X_tr, y_tr_oh, X_v, y_v_oh, epochs=EPOCHS, lr=1e-3):
    print(f"\n  ── {name} ──")
    model.compile(
        optimizer=keras.optimizers.Adam(lr),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    cb = [
        EarlyStopping(patience=4, restore_best_weights=True, verbose=0),
        ReduceLROnPlateau(patience=2, factor=0.5, verbose=0),
    ]
    t0 = time.time()
    hist = model.fit(
        X_tr, y_tr_oh,
        validation_data=(X_v, y_v_oh),
        epochs=epochs,
        batch_size=BATCH_SIZE,
        callbacks=cb,
        verbose=1,
    )
    elapsed = time.time() - t0
    loss, acc = model.evaluate(X_test, tf.keras.utils.to_categorical(y_test, n_classes), verbose=0)
    print(f"  → Test Accuracy: {acc*100:.2f}%  (trained {elapsed:.0f}s)")
    results[name] = acc * 100
    histories[name] = hist
    return model

# ── Model A: Custom CNN ──────────────────────────────────
def build_custom_cnn():
    inp = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = layers.RandomFlip("horizontal")(inp)
    x = layers.RandomRotation(0.15)(x)
    x = layers.RandomZoom(0.1)(x)
    x = layers.Conv2D(32, 3, activation="relu", padding="same")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D()(x)
    x = layers.Conv2D(64, 3, activation="relu", padding="same")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D()(x)
    x = layers.Conv2D(128, 3, activation="relu", padding="same")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D()(x)
    x = layers.Conv2D(256, 3, activation="relu", padding="same")(x)
    x = layers.BatchNormalization()(x)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.4)(x)
    x = layers.Dense(512, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(n_classes, activation="softmax")(x)
    return Model(inp, out, name="CustomCNN")

cnn_model = compile_and_train("Custom CNN (4-layer)", build_custom_cnn(), X_train, y_train_oh, X_val, y_val_oh)

# ── Model B: MobileNetV2 (Transfer Learning) ────────────
def build_mobilenet():
    base = MobileNetV2(weights="imagenet", include_top=False, input_shape=(IMG_SIZE, IMG_SIZE, 3))
    base.trainable = False          # frozen backbone
    inp = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x   = base(inp, training=False)
    x   = layers.GlobalAveragePooling2D()(x)
    x   = layers.Dropout(0.3)(x)
    x   = layers.Dense(256, activation="relu")(x)
    out = layers.Dense(n_classes, activation="softmax")(x)
    return Model(inp, out, name="MobileNetV2_TL")

mn_model = compile_and_train("MobileNetV2 (Transfer Learning, frozen)", build_mobilenet(), X_train, y_train_oh, X_val, y_val_oh)

# Fine-tune top 30 layers of MobileNetV2
print("\n  ── MobileNetV2 Fine-Tuning (top-30 unfrozen) ──")
base_layer = mn_model.layers[2]   # MobileNetV2 base
base_layer.trainable = True
for layer in base_layer.layers[:-30]:
    layer.trainable = False
mn_model.compile(
    optimizer=keras.optimizers.Adam(1e-5),
    loss="categorical_crossentropy",
    metrics=["accuracy"],
)
hist_ft = mn_model.fit(
    X_train, y_train_oh,
    validation_data=(X_val, y_val_oh),
    epochs=8,
    batch_size=BATCH_SIZE,
    callbacks=[EarlyStopping(patience=3, restore_best_weights=True, verbose=0)],
    verbose=1,
)
_, acc_ft = mn_model.evaluate(X_test, tf.keras.utils.to_categorical(y_test, n_classes), verbose=0)
print(f"  → Test Accuracy: {acc_ft*100:.2f}%")
results["MobileNetV2 (Fine-tuned)"] = acc_ft * 100

# ── Model C: EfficientNetB0 (Transfer Learning) ─────────
def build_efficientnet():
    base = EfficientNetB0(weights="imagenet", include_top=False, input_shape=(IMG_SIZE, IMG_SIZE, 3))
    base.trainable = False
    inp = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x   = base(inp, training=False)
    x   = layers.GlobalAveragePooling2D()(x)
    x   = layers.Dropout(0.35)(x)
    x   = layers.Dense(256, activation="relu")(x)
    out = layers.Dense(n_classes, activation="softmax")(x)
    return Model(inp, out, name="EfficientNetB0_TL")

eff_model = compile_and_train("EfficientNetB0 (Transfer Learning, frozen)", build_efficientnet(), X_train, y_train_oh, X_val, y_val_oh)

# ── Model D: ResNet50V2 (Transfer Learning) ──────────────
def build_resnet():
    base = ResNet50V2(weights="imagenet", include_top=False, input_shape=(IMG_SIZE, IMG_SIZE, 3))
    base.trainable = False
    inp = keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x   = base(inp, training=False)
    x   = layers.GlobalAveragePooling2D()(x)
    x   = layers.Dropout(0.4)(x)
    x   = layers.Dense(256, activation="relu")(x)
    out = layers.Dense(n_classes, activation="softmax")(x)
    return Model(inp, out, name="ResNet50V2_TL")

res_model = compile_and_train("ResNet50V2 (Transfer Learning, frozen)", build_resnet(), X_train, y_train_oh, X_val, y_val_oh)

# ── Model E: Traditional ML — SVM on flattened features ──
print("\n  ── LinearSVC on PCA-compressed features ──")
FEAT_SIZE = 64
X_tr_sm = np.stack([np.array(Image.fromarray((x*255).astype(np.uint8)).resize((FEAT_SIZE, FEAT_SIZE))).flatten() / 255.0 for x in X_train])
X_va_sm = np.stack([np.array(Image.fromarray((x*255).astype(np.uint8)).resize((FEAT_SIZE, FEAT_SIZE))).flatten() / 255.0 for x in X_val])
X_te_sm = np.stack([np.array(Image.fromarray((x*255).astype(np.uint8)).resize((FEAT_SIZE, FEAT_SIZE))).flatten() / 255.0 for x in X_test])

pca = PCA(n_components=200, random_state=42)
X_tr_pca = pca.fit_transform(X_tr_sm)
X_te_pca = pca.transform(X_te_sm)
print(f"      PCA: {X_tr_sm.shape[1]} → 200 components  (explained: {pca.explained_variance_ratio_.sum()*100:.1f}%)")

t0 = time.time()
svm = LinearSVC(max_iter=3000, C=0.5, random_state=42)
svm.fit(X_tr_pca, y_train)
svm_pred = svm.predict(X_te_pca)
svm_acc  = accuracy_score(y_test, svm_pred) * 100
print(f"  → LinearSVC Test Accuracy: {svm_acc:.2f}%  ({time.time()-t0:.1f}s)")
results["LinearSVC + PCA (200)"] = svm_acc

# ── Model F: Random Forest on MobileNetV2 features ───────
print("\n  ── Random Forest on MobileNetV2 embeddings ──")
feat_extractor = Model(
    inputs=mn_model.input,
    outputs=mn_model.layers[-3].output,   # Dense(256) layer
    name="feat_extract",
)
print("      Extracting features...", end=" ", flush=True)
F_train = feat_extractor.predict(X_train, batch_size=64, verbose=0)
F_test  = feat_extractor.predict(X_test,  batch_size=64, verbose=0)
print(f"shape: {F_train.shape}")

t0 = time.time()
rf = RandomForestClassifier(n_estimators=300, max_depth=20, n_jobs=-1, random_state=42)
rf.fit(F_train, y_train)
rf_pred = rf.predict(F_test)
rf_acc  = accuracy_score(y_test, rf_pred) * 100
print(f"  → RandomForest Test Accuracy: {rf_acc:.2f}%  ({time.time()-t0:.1f}s)")
results["Random Forest (MobileNet features)"] = rf_acc

# ── 7. Results & Comparison ───────────────────────────────
print("\n" + "=" * 65)
print("[7/7] Final Results Summary")
print("=" * 65)

res_df = pd.DataFrame(list(results.items()), columns=["Model", "Test Accuracy (%)"])
res_df = res_df.sort_values("Test Accuracy (%)", ascending=False).reset_index(drop=True)
res_df.index += 1
res_df["Test Accuracy (%)"] = res_df["Test Accuracy (%)"].map(lambda x: f"{x:.2f}%")
print("\n" + res_df.to_string())

best_model = max(results, key=results.get)
best_acc   = results[best_model]
print(f"\n  🏆 BEST MODEL : {best_model}")
print(f"  🎯 BEST ACCURACY : {best_acc:.2f}%")

# ── Bar chart of all model accuracies ─────────────────────
fig, ax = plt.subplots(figsize=(12, 5))
model_names = list(results.keys())
accs        = [results[m] for m in model_names]
bar_colors  = ["#10b981" if m == best_model else "#6366f1" for m in model_names]
bars = ax.bar(range(len(model_names)), accs, color=bar_colors, edgecolor="white")
ax.bar_label(bars, fmt="%.2f%%", fontsize=9, padding=3)
ax.set_xticks(range(len(model_names)))
ax.set_xticklabels(model_names, rotation=25, ha="right", fontsize=8)
ax.set_ylim(0, 105)
ax.set_ylabel("Test Accuracy (%)")
ax.set_title("PlantVillage — Model Accuracy Comparison", fontsize=13, fontweight="bold")
ax.axhline(best_acc, color="#ef4444", linestyle="--", linewidth=1.2, label=f"Best: {best_acc:.2f}%")
ax.legend()
plt.tight_layout()
plt.savefig(out_dir / "accuracy_comparison.png", dpi=150)
plt.close()

# ── Training curves for DL models ─────────────────────────
fig, axes = plt.subplots(2, 2, figsize=(14, 10))
dl_models = ["Custom CNN (4-layer)", "MobileNetV2 (Transfer Learning, frozen)",
             "EfficientNetB0 (Transfer Learning, frozen)", "ResNet50V2 (Transfer Learning, frozen)"]
for ax, name in zip(axes.flat, dl_models):
    if name in histories:
        h = histories[name]
        ax.plot(h.history["accuracy"],     label="Train Acc", color="#10b981")
        ax.plot(h.history["val_accuracy"], label="Val Acc",   color="#6366f1")
        ax.set_title(name, fontsize=9, fontweight="bold")
        ax.set_xlabel("Epoch"); ax.set_ylabel("Accuracy")
        ax.legend(fontsize=8); ax.set_ylim(0, 1)
plt.suptitle("Training Curves — PlantVillage", fontsize=12, fontweight="bold")
plt.tight_layout()
plt.savefig(out_dir / "training_curves.png", dpi=150)
plt.close()

# ── Save best model ───────────────────────────────────────
# (save the best Keras model)
best_keras = {
    "Custom CNN (4-layer)": cnn_model,
    "MobileNetV2 (Transfer Learning, frozen)": mn_model,
    "MobileNetV2 (Fine-tuned)": mn_model,
    "EfficientNetB0 (Transfer Learning, frozen)": eff_model,
    "ResNet50V2 (Transfer Learning, frozen)": res_model,
}.get(best_model)

if best_keras:
    save_path = out_dir / "best_model.keras"
    best_keras.save(str(save_path))
    print(f"\n  💾 Best model saved → {save_path}")

# ── Save results CSV ──────────────────────────────────────
res_df.to_csv(out_dir / "results.csv", index=True)
print(f"  📋 Results CSV  → {out_dir}/results.csv")
print(f"  📊 Charts       → {out_dir}/accuracy_comparison.png")
print(f"                    {out_dir}/training_curves.png")
print(f"                    {out_dir}/class_distribution.png")

print("\n" + "=" * 65)
print("  TRAINING COMPLETE ✅")
print("=" * 65)

# ── Final explanation ─────────────────────────────────────
print("""
┌─────────────────────────────────────────────────────────────┐
│  MODEL METHODOLOGY SUMMARY                                  │
├──────────────────────────────┬──────────────────────────────┤
│ Custom CNN (4-layer)         │ Trained from scratch. 4 Conv │
│                              │ blocks + BatchNorm. Dropout  │
│                              │ augmentation built-in.       │
├──────────────────────────────┼──────────────────────────────┤
│ MobileNetV2 TL (frozen)      │ ImageNet backbone frozen.    │
│                              │ Only new head trained. Fast. │
├──────────────────────────────┼──────────────────────────────┤
│ MobileNetV2 Fine-tuned       │ Top-30 layers unfrozen + low │
│                              │ LR fine-tuning for best DL   │
│                              │ accuracy on plant features.  │
├──────────────────────────────┼──────────────────────────────┤
│ EfficientNetB0 TL (frozen)   │ Compound-scaled backbone.    │
│                              │ Best accuracy/size ratio.    │
├──────────────────────────────┼──────────────────────────────┤
│ ResNet50V2 TL (frozen)       │ Skip-connections backbone.   │
│                              │ Stable, deep feature maps.   │
├──────────────────────────────┼──────────────────────────────┤
│ LinearSVC + PCA              │ Classical ML. Images resized │
│                              │ to 64×64 → PCA 200 dims →   │
│                              │ SVM for fast baseline.       │
├──────────────────────────────┼──────────────────────────────┤
│ Random Forest (MN features)  │ RF on 256-dim MobileNetV2   │
│                              │ embeddings. No retraining.   │
└──────────────────────────────┴──────────────────────────────┘
""")
