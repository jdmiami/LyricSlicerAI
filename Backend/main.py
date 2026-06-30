import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
import uvicorn
from models.WhisperX_Inference import process_audio_file

app = FastAPI(title="LyricSlicer AI Cloud Engine")

@app.get("/")
def read_root():
    return {"message": "LyricSlicer AI Backend is running"}

@app.post("/align")
async def align_audio(file: UploadFile = File(...)):
    # Validate file extension roughly
    if not file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.flac')):
        raise HTTPException(status_code=400, detail="Unsupported file format")

    temp_file_path = f"temp_{file.filename}"
    
    try:
        # Save the uploaded file to a temporary location
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Process the audio file
        word_slices = process_audio_file(temp_file_path)
        
        return word_slices
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
