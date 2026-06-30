import argparse
import requests
import json
import time
import os

def test_api(server_url: str, audio_path: str):
    print(f"Connecting to API at: {server_url}")
    print(f"Uploading file: {audio_path}")
    
    if not os.path.exists(audio_path):
        print(f"❌ File not found: {audio_path}")
        return
        
    start_time = time.time()
    
    # Open the file and send the POST request
    with open(audio_path, 'rb') as f:
        files = {'file': (os.path.basename(audio_path), f, 'audio/wav')}
        headers = {'Bypass-Tunnel-Reminder': 'true'}
        try:
            response = requests.post(f"{server_url}/align", files=files, headers=headers)
            response.raise_for_status()
            
            # Parse the JSON response
            result = response.json()
            
            end_time = time.time()
            duration = end_time - start_time
            
            print(f"\n[SUCCESS] Processed in {duration:.2f} seconds.")
            print("\n--- Response Payload ---")
            print(json.dumps(result, indent=2))
            
        except requests.exceptions.RequestException as e:
            print(f"\n[ERROR] Request failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Server response: {e.response.text}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test the LyricSlicer AI Cloud Backend")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="URL of the backend server (e.g., http://your-cloud-ip:8000)")
    parser.add_argument("--file", required=True, help="Path to the audio file to test (.wav, .mp3, etc.)")
    
    args = parser.parse_args()
    test_api(args.url, args.file)
