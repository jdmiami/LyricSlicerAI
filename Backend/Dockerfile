FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required for audio processing
RUN apt-get update && apt-get install -y ffmpeg

COPY requirements.txt .

# Explicitly install PyTorch with CUDA 11.8 support before other requirements
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
