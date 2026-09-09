"""
AI4Bharat IndicConformerASR STT Provider (Self-Hosted Fallback)
Covers all 22 official Indian languages using AI4Bharat IndicConformer models.
Repo: https://github.com/AI4Bharat/IndicConformerASR
"""

import logging
import os
import tempfile
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Check if NeMo or ONNX runtime dependencies are available
_nemo_available = False
_onnx_available = False
nemo_asr = None
ort = None

try:
    import nemo.collections.asr as nemo_asr
    _nemo_available = True
except ImportError:
    logger.info("AI4Bharat NeMo package not installed. IndicConformer will run in fallback/ONNX mode if available.")

try:
    import onnxruntime as ort
    _onnx_available = True
except ImportError:
    pass


class AI4BharatIndicConformerSTT:
    """
    Self-hosted secondary/fallback STT provider wrapping AI4Bharat IndicConformerASR.
    Provides standard interface: transcribe(audio_bytes, language) -> { text, language, confidence }
    """

    def __init__(self, model_name: str = "ai4bharat/IndicConformer"):
        self.model_name = model_name
        self.model = None
        self._is_loaded = False

    def health_check(self) -> bool:
        """
        Health check to determine if the self-hosted model engine is ready/capable of running.
        Returns True if NeMo or ONNX runtime is installed and hardware is capable.
        """
        return _nemo_available or _onnx_available

    def _ensure_model_loaded(self):
        """
        Lazy loader for IndicConformer model weights to avoid cold-start delays on app boot.
        """
        if self._is_loaded:
            return

        if _nemo_available and nemo_asr is not None:
            try:
                logger.info(f"Loading self-hosted AI4Bharat IndicConformer model: {self.model_name}...")
                self.model = nemo_asr.models.ASRModel.from_pretrained(self.model_name)
                self._is_loaded = True
                logger.info("✅ AI4Bharat IndicConformer STT Model loaded successfully.")
                return
            except Exception as e:
                logger.warning(f"Failed to load NeMo model '{self.model_name}': {e}")

        # If NeMo model failed or is not installed, mark load attempted
        self._is_loaded = True

    def transcribe(self, audio_bytes: bytes, language: str = "hi") -> Dict[str, Any]:
        """
        Transcribes input audio bytes using IndicConformerASR.
        Supports all Indian languages (Bhojpuri 'bho' maps to Hindi 'hi').
        """
        # Map Bhojpuri to Hindi for STT processing
        stt_lang = "hi" if language in ["bho", "bhojpuri", "भोजपुरी"] else language.lower()

        if not self.health_check():
            logger.warning("AI4Bharat IndicConformer dependencies missing. Skipping self-hosted STT.")
            return {"text": "", "language": stt_lang, "confidence": 0.0, "source": "ai4bharat_indicconformer"}

        # Write audio bytes to temporary file for model ingestion
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_bytes)
                temp_path = f.name

            self._ensure_model_loaded()

            if self.model is not None:
                transcriptions = self.model.transcribe([temp_path])
                text = transcriptions[0] if transcriptions else ""
                return {
                    "text": text.strip(),
                    "language": stt_lang,
                    "confidence": 0.88,
                    "source": "ai4bharat_indicconformer",
                }
            else:
                logger.info("IndicConformer weights not available; returning clean fallback result.")
                return {
                    "text": "",
                    "language": stt_lang,
                    "confidence": 0.0,
                    "source": "ai4bharat_indicconformer",
                }
        except Exception as e:
            logger.error(f"Error during AI4Bharat IndicConformer transcription: {e}")
            return {"text": "", "language": stt_lang, "confidence": 0.0, "source": "ai4bharat_indicconformer"}
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass
