// PWA Service Worker Registration
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(console.error);
}

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0-alpha.13';

// Configure environment to fetch models from HF Hub directly
env.allowLocalModels = false;

// UI Elements
const btnLocalMode = document.getElementById("btn-local-mode");
const btnCloudMode = document.getElementById("btn-cloud-mode");
const colabConfigContainer = document.getElementById("colab-config-container");
const colabUrlInput = document.getElementById("colab-url-input");
const dropZone = document.getElementById("drop-zone");
const audioFileInput = document.getElementById("audio-file-input");
const loadedFileName = document.getElementById("loaded-file-name");
const progressContainer = document.getElementById("progress-container");
const progressStatus = document.getElementById("progress-status");
const progressPercentage = document.getElementById("progress-percentage");
const progressBarFill = document.getElementById("progress-bar-fill");
const localEngineWarning = document.getElementById("local-engine-warning");
const workspaceContainer = document.getElementById("workspace-container");
const slicesTimeline = document.getElementById("slices-timeline");
const btnPlay = document.getElementById("btn-play");
const btnStop = document.getElementById("btn-stop");
const playbackTimer = document.getElementById("playback-timer");
const totalTimer = document.getElementById("total-timer");
const volumeSlider = document.getElementById("volume-slider");
const btnExport = document.getElementById("btn-export");
const shareLink = document.getElementById("share-link");
const errorBanner = document.getElementById("error-banner");

// Audio Context & State
let audioContext = null;
let decodedAudioBuffer = null;
let activeSourceNode = null;
let activeGainNode = null;
let isPlaying = false;
let isProMode = false;
let words = []; // Array of { text, startMs, endMs, isMuted }
let localTranscriber = null;
let currentPlayheadInterval = null;
let playheadStartOffset = 0;
let playheadStartTime = 0;

// Set default Colab URL
colabUrlInput.value = localStorage.getItem("colab_url") || "";

// Toggle Engine Modes
btnLocalMode.addEventListener("click", () => {
  isProMode = false;
  btnLocalMode.className = "px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 bg-blue-600 text-white shadow-md";
  btnCloudMode.className = "px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 text-gray-400 hover:text-white";
  colabConfigContainer.classList.add("hidden");
});

btnCloudMode.addEventListener("click", () => {
  isProMode = true;
  btnCloudMode.className = "px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 bg-purple-600 text-white shadow-md";
  btnLocalMode.className = "px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 text-gray-400 hover:text-white";
  colabConfigContainer.classList.remove("hidden");
});

// Drop Zone Handlers
dropZone.addEventListener("click", () => audioFileInput.click());
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("border-blue-500");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("border-blue-500");
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("border-blue-500");
  if (e.dataTransfer.files.length) {
    audioFileInput.files = e.dataTransfer.files;
    handleFileSelection();
  }
});

audioFileInput.addEventListener("change", handleFileSelection);

// File Handler
function handleFileSelection() {
  const file = audioFileInput.files[0];
  if (!file) return;
  
  // Show loaded file label
  loadedFileName.textContent = file.name;
  loadedFileName.classList.remove("hidden");
  errorBanner.classList.add("hidden");
  workspaceContainer.classList.add("hidden");
  shareLink.classList.add("hidden");
  words = [];
  
  // Start loading
  processAudio(file);
}

// Resampling Helper for local transcription (Whisper requires 16000Hz mono)
function resampleTo16kMono(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const originalSampleRate = audioBuffer.sampleRate;
  const targetSampleRate = 16000;
  
  let monoPCM;
  if (numChannels === 1) {
    monoPCM = audioBuffer.getChannelData(0);
  } else {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    monoPCM = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      monoPCM[i] = (left[i] + right[i]) / 2;
    }
  }
  
  if (originalSampleRate === targetSampleRate) {
    return monoPCM;
  }
  
  const ratio = originalSampleRate / targetSampleRate;
  const newLength = Math.round(monoPCM.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const origIndex = Math.floor(i * ratio);
    result[i] = monoPCM[origIndex];
  }
  return result;
}

// Audio Processing Pipeline
async function processAudio(file) {
  progressContainer.classList.remove("hidden");
  updateProgress(5, "Reading audio file...");
  
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Decode Audio Data
    const arrayBuffer = await file.arrayBuffer();
    updateProgress(15, "Decoding audio stem...");
    decodedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Format timer
    totalTimer.textContent = formatTime(decodedAudioBuffer.duration);
    
    if (isProMode) {
      await transcribeCloud(file);
    } else {
      await transcribeLocal();
    }
  } catch (err) {
    showError("Failed to decode or process audio: " + err.message);
  }
}

// Local ONNX Whisper Engine
async function transcribeLocal() {
  localEngineWarning.classList.remove("hidden");
  updateProgress(25, "Loading local AI engine (openai/whisper-tiny)...");
  
  try {
    if (!localTranscriber) {
      localTranscriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
        progress_callback: (data) => {
          if (data.status === 'downloading') {
            const pct = Math.round(data.progress || 0);
            updateProgress(25 + (pct * 0.25), `Downloading AI model components... ${pct}%`);
          } else if (data.status === 'done') {
            updateProgress(50, "Warming up Neural Engine components...");
          }
        }
      });
    }
    
    updateProgress(55, "Resampling audio stem to 16kHz...");
    const pcm16k = resampleTo16kMono(decodedAudioBuffer);
    
    updateProgress(65, "Analyzing vocal slices...");
    const result = await localTranscriber(pcm16k, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: 'word'
    });
    
    updateProgress(90, "Realigning word timing data...");
    
    if (result && result.chunks && result.chunks.length > 0) {
      words = result.chunks.map(chunk => ({
        text: chunk.text,
        startMs: chunk.timestamp[0] * 1000,
        endMs: chunk.timestamp[1] * 1000,
        isMuted: false
      }));
    } else {
      // Fallback
      words = generateFallbackSlices();
    }
    
    finishProcessing();
  } catch (err) {
    showError("Local model failed: " + err.message + ". Trying cloud/fallback...");
    finishProcessing(generateFallbackSlices());
  }
}

// Cloud Python API alignment
async function transcribeCloud(file) {
  const colabURL = colabUrlInput.value.trim();
  if (!colabURL) {
    throw new Error("Colab URL is required for Cloud mode.");
  }
  localStorage.setItem("colab_url", colabURL);
  
  updateProgress(35, "Uploading audio stem to GPU Server...");
  
  const formData = new FormData();
  formData.append("file", file);
  
  try {
    const res = await fetch(`${colabURL}/align`, {
      method: "POST",
      headers: {
        "Bypass-Tunnel-Reminder": "true"
      },
      body: formData
    });
    
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    
    updateProgress(80, "Stitching cloud alignment...");
    const data = await res.json();
    words = data.map(w => ({
      text: w.text,
      startMs: w.startMs,
      endMs: w.endMs,
      isMuted: w.isMuted || false
    }));
    
    finishProcessing();
  } catch (err) {
    showError("Cloud alignment failed: " + err.message);
  }
}

// Helpers
function updateProgress(percentage, status) {
  progressStatus.textContent = status;
  progressPercentage.textContent = `${Math.round(percentage)}%`;
  progressBarFill.style.width = `${percentage}%`;
}

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.classList.remove("hidden");
  progressContainer.classList.add("hidden");
}

function finishProcessing(fallbackWords = null) {
  if (fallbackWords) {
    words = fallbackWords;
  }
  updateProgress(100, "Ready!");
  setTimeout(() => {
    progressContainer.classList.add("hidden");
    localEngineWarning.classList.add("hidden");
    workspaceContainer.classList.remove("hidden");
    renderWordSlices();
  }, 500);
}

function generateFallbackSlices() {
  const duration = decodedAudioBuffer.duration;
  const totalSlices = 10;
  const sliceLen = duration / totalSlices;
  let fallback = [];
  for (let i = 0; i < totalSlices; i++) {
    fallback.push({
      text: `[Slice ${i+1}]`,
      startMs: i * sliceLen * 1000,
      endMs: (i + 1) * sliceLen * 1000,
      isMuted: false
    });
  }
  return fallback;
}

// Slices UI Renderer
function renderWordSlices() {
  slicesTimeline.innerHTML = "";
  words.forEach((word, idx) => {
    const chip = document.createElement("div");
    chip.className = `word-chip active px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold transition-all duration-300 ${word.isMuted ? "muted" : ""}`;
    chip.textContent = word.text;
    chip.dataset.idx = idx;
    
    chip.addEventListener("click", () => {
      word.isMuted = !word.isMuted;
      if (word.isMuted) {
        chip.classList.add("muted");
      } else {
        chip.classList.remove("muted");
      }
      
      // Clear share link since modifications changed
      shareLink.classList.add("hidden");
      
      // Update playback scheduling if playing
      if (isPlaying) {
        scheduleVolumeAutomation();
      }
    });
    
    slicesTimeline.appendChild(chip);
  });
}

// Audio Playback Automation
function startAudioPlayback(offset = 0) {
  if (isPlaying) stopAudioPlayback();
  
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  
  activeSourceNode = audioContext.createBufferSource();
  activeSourceNode.buffer = decodedAudioBuffer;
  
  activeGainNode = audioContext.createGain();
  activeSourceNode.connect(activeGainNode);
  activeGainNode.connect(audioContext.destination);
  
  // Set starting volume
  activeGainNode.gain.setValueAtTime(parseFloat(volumeSlider.value), audioContext.currentTime);
  
  // Schedule mute/unmute events
  scheduleVolumeAutomation(offset);
  
  activeSourceNode.start(0, offset);
  isPlaying = true;
  btnPlay.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>`;
  
  playheadStartTime = audioContext.currentTime;
  playheadStartOffset = offset;
  
  currentPlayheadInterval = setInterval(updatePlayheadProgress, 100);
}

function stopAudioPlayback() {
  if (activeSourceNode) {
    try { activeSourceNode.stop(); } catch(e) {}
    activeSourceNode.disconnect();
    activeGainNode.disconnect();
    activeSourceNode = null;
    activeGainNode = null;
  }
  isPlaying = false;
  btnPlay.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    </svg>`;
  
  clearInterval(currentPlayheadInterval);
  playbackTimer.textContent = "00:00";
}

// Volume automator scheduler
function scheduleVolumeAutomation(offsetSeconds = 0) {
  if (!activeGainNode) return;
  
  const now = audioContext.currentTime;
  const currentVal = parseFloat(volumeSlider.value);
  
  // Reset all scheduled automation
  activeGainNode.gain.cancelScheduledValues(now);
  activeGainNode.gain.setValueAtTime(currentVal, now);
  
  words.forEach(word => {
    const startSecs = word.startMs / 1000;
    const endSecs = word.endMs / 1000;
    
    // Only schedule events in the future relative to the start offset
    if (endSecs > offsetSeconds) {
      const scheduleStart = Math.max(0, startSecs - offsetSeconds);
      const scheduleEnd = Math.max(0, endSecs - offsetSeconds);
      
      if (word.isMuted) {
        // Drop gain to 0 instantly at start of word
        activeGainNode.gain.setValueAtTime(currentVal, now + scheduleStart);
        activeGainNode.gain.setValueAtTime(0, now + scheduleStart + 0.005);
        
        // Restore volume at the end of word
        activeGainNode.gain.setValueAtTime(0, now + scheduleEnd);
        activeGainNode.gain.setValueAtTime(currentVal, now + scheduleEnd + 0.005);
      }
    }
  });
}

// Updates playing highlight
function updatePlayheadProgress() {
  if (!isPlaying) return;
  const elapsed = audioContext.currentTime - playheadStartTime + playheadStartOffset;
  playbackTimer.textContent = formatTime(elapsed);
  
  if (elapsed >= decodedAudioBuffer.duration) {
    stopAudioPlayback();
    return;
  }
  
  const elapsedMs = elapsed * 1000;
  // Highlight currently playing word chip
  words.forEach((word, idx) => {
    const chip = slicesTimeline.children[idx];
    if (chip) {
      if (elapsedMs >= word.startMs && elapsedMs <= word.endMs) {
        chip.style.borderColor = "#3b82f6";
        chip.style.transform = "scale(1.05)";
      } else {
        chip.style.borderColor = "";
        chip.style.transform = "";
      }
    }
  });
}

// Controls listeners
btnPlay.addEventListener("click", () => {
  if (isPlaying) {
    stopAudioPlayback();
  } else {
    startAudioPlayback(0);
  }
});

btnStop.addEventListener("click", stopAudioPlayback);

volumeSlider.addEventListener("input", () => {
  if (activeGainNode) {
    activeGainNode.gain.setValueAtTime(parseFloat(volumeSlider.value), audioContext.currentTime);
  }
});

// Helper formatting seconds -> mm:ss
function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Export to WAV & compile silenced segments client-side
btnExport.addEventListener("click", async () => {
  if (!decodedAudioBuffer) return;
  btnExport.innerHTML = `<span>Exporting...</span>`;
  btnExport.disabled = true;
  
  setTimeout(() => {
    try {
      const numChannels = decodedAudioBuffer.numberOfChannels;
      const length = decodedAudioBuffer.length;
      const sampleRate = decodedAudioBuffer.sampleRate;
      
      // Clone channel arrays
      const channels = [];
      for (let i = 0; i < numChannels; i++) {
        channels.push(new Float32Array(decodedAudioBuffer.getChannelData(i)));
      }
      
      // Apply muting to the exported channel float arrays directly
      words.forEach(word => {
        if (word.isMuted) {
          const startFrame = Math.floor((word.startMs / 1000) * sampleRate);
          const endFrame = Math.floor((word.endMs / 1000) * sampleRate);
          
          for (let frame = startFrame; frame < endFrame; frame++) {
            if (frame >= 0 && frame < length) {
              for (let c = 0; c < numChannels; c++) {
                channels[c][frame] = 0.0;
              }
            }
          }
        }
      });
      
      // Compile PCM to standard 16-bit WAV file
      const buffer = encodeWAV(channels, sampleRate);
      const blob = new Blob([buffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      
      shareLink.href = url;
      shareLink.download = "LyricSlicer_MutedStem.wav";
      shareLink.classList.remove("hidden");
      
      btnExport.innerHTML = `<span>Export Done</span>`;
      btnExport.disabled = false;
      
      setTimeout(() => {
        btnExport.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
          </svg>
          <span>Export Stem</span>`;
      }, 2000);
      
    } catch (err) {
      alert("Export failed: " + err.message);
      btnExport.disabled = false;
    }
  }, 100);
});

// WAV encoder helper
function encodeWAV(channels, sampleRate) {
  const numChannels = channels.length;
  const blockAlign = numChannels * 2;
  const length = channels[0].length * blockAlign;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  
  /* RIFF identifier */
  writeString(view, 0, "RIFF");
  /* file length */
  view.setUint32(4, 36 + length, true);
  /* RIFF type */
  writeString(view, 8, "WAVE");
  /* format chunk identifier */
  writeString(view, 12, "fmt ");
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, "data");
  /* data chunk length */
  view.setUint32(40, length, true);
  
  // Write interleaved PCM samples
  let offset = 44;
  for (let i = 0; i < channels[0].length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
