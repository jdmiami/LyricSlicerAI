import os
import uuid
import whisperx
import torch

# Global variables to hold models and avoid reloading on every request
device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "float16" if device == "cuda" else "int8"
model = None
align_model = None
metadata = None

def load_models():
    global model, align_model, metadata
    if model is None:
        print(f"Loading WhisperX base model on {device}...")
        model = whisperx.load_model("base", device, compute_type=compute_type)
    if align_model is None:
        print(f"Loading alignment model for language: en...")
        # Note: assuming English for simplicity, can be dynamic later
        align_model, metadata = whisperx.load_align_model(language_code="en", device=device)

def process_audio_file(filepath: str) -> list:
    """
    1. Transcribe with Whisper
    2. Forced alignment with Wav2Vec2
    3. Return WordSlice array JSON
    """
    load_models()
    
    # 1. Load Audio
    audio = whisperx.load_audio(filepath)
    
    # 2. Transcribe
    result = model.transcribe(audio, batch_size=16)
    
    # 3. Align
    result = whisperx.align(result["segments"], align_model, metadata, audio, device, return_char_alignments=False)
    
    # 4. Extract words and convert to WordSlice format
    word_slices = []
    for segment in result["segments"]:
        if "words" in segment:
            for word_info in segment["words"]:
                if "start" in word_info and "end" in word_info and "word" in word_info:
                    word_slice = {
                        "id": str(uuid.uuid4()),
                        "text": word_info["word"],
                        "startMs": round(word_info["start"] * 1000.0, 2),
                        "endMs": round(word_info["end"] * 1000.0, 2),
                        "isMuted": False,
                        "stretchRatio": 1.0,
                        "isAnchor": False
                    }
                    word_slices.append(word_slice)
                    
    return word_slices
