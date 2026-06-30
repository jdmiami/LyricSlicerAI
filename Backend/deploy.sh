#!/bin/bash
echo "🚀 Deploying LyricSlicer AI Backend to Cloud GPU..."

# Ensure the script stops on first error
set -e

# Check if Docker is installed
if ! command -v docker &> /dev/null
then
    echo "❌ Docker could not be found. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null
then
    echo "❌ Docker Compose could not be found. Please install Docker Compose first."
    exit 1
fi

echo "📦 Building the Docker image (this may take a while as it downloads PyTorch)..."
docker-compose build

echo "🏃‍♂️ Starting the container in the background..."
docker-compose up -d

echo "✅ Deployment complete! API is running on port 8000."
echo "Use 'docker logs -f lyricslicer_api' to view the output."
