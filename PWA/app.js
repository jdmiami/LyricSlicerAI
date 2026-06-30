// PWA Service Worker Registration
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(console.error);
}

// UI Elements
const btnLocalMode = document.getElementById("btn-local-mode");
const btnCloudMode = document.getElementById("btn-cloud-mode");
const btnManualMode = document.getElementById("btn-manual-mode");
const colabConfigContainer = document.getElementById("colab-config-container");
const colabUrlInput = document.getElementById("colab-url-input");
const localConfigContainer = document.getElementById("local-config-container");
const localModelSelect = document.getElementById("local-model-select");
const manualConfigContainer = document.getElementById("manual-config-container");
const manualSliceSelect = document.getElementById("manual-slice-select");
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

// Waveform Canvas Elements
const waveformCanvas = document.getElementById("waveform-canvas");
const waveformPlayhead = document.getElementById("waveform-playhead");

// Audio Context & State
let audioContext = null;
let decodedAudioBuffer = null;
let activeSourceNode = null;
let activeGainNode = null;
let isPlaying = false;
let engineMode = "local"; // "local" | "cloud" | "manual"
let words = []; // Array of { text, startMs, endMs, isMuted }
let localTranscriber = null;
let loadedModelName = null;
let currentPlayheadInterval = null;
let playheadStartOffset = 0;
let playheadStartTime = 0;
let lastHighlightedIdx = -1;

// GSAP Initial Page Entrance Animation - Fixed readyState Race Condition
function initAnimations() {
  // Fade in body
  gsap.to("body", { opacity: 1, duration: 0.6, ease: "power2.out" });
  
  // Stagger entry of main layout components
  gsap.from("header", { y: -20, opacity: 0, duration: 0.6, ease: "power3.out" });
  gsap.from("#drop-zone", { y: 30, opacity: 0, duration: 0.8, delay: 0.1, ease: "power3.out" });
  gsap.from("#local-config-container", { y: 20, opacity: 0, duration: 0.6, delay: 0.15, ease: "power3.out" });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initAnimations);
} else {
  initAnimations();
}

// Set default Colab URL
colabUrlInput.value = localStorage.getItem("colab_url") || "";

// Toggle Engine Modes (GSAP Switch Animation)
btnLocalMode.addEventListener("click", () => {
  if (engineMode !== "local") {
    engineMode = "local";
    updateActiveModeButton(btnLocalMode, "#2563eb");
    
    // Animate configs
    slideInConfig(localConfigContainer);
    slideOutConfig(colabConfigContainer);
    slideOutConfig(manualConfigContainer);
  }
});

btnCloudMode.addEventListener("click", () => {
  if (engineMode !== "cloud") {
    engineMode = "cloud";
    updateActiveModeButton(btnCloudMode, "#7c3aed");
    
    // Animate configs
    slideInConfig(colabConfigContainer);
    slideOutConfig(localConfigContainer);
    slideOutConfig(manualConfigContainer);
  }
});

btnManualMode.addEventListener("click", () => {
  if (engineMode !== "manual") {
    engineMode = "manual";
    updateActiveModeButton(btnManualMode, "#ea580c");
    
    // Animate configs
    slideInConfig(manualConfigContainer);
    slideOutConfig(localConfigContainer);
    slideOutConfig(colabConfigContainer);
  }
});

function updateActiveModeButton(activeBtn, color) {
  [btnLocalMode, btnCloudMode, btnManualMode].forEach(btn => {
    if (btn === activeBtn) {
      gsap.to(btn, { backgroundColor: color, color: "#ffffff", duration: 0.3, ease: "power1.out" });
    } else {
      gsap.to(btn, { backgroundColor: "transparent", color: "#9ca3af", duration: 0.3, ease: "power1.out" });
    }
  });
}

function slideInConfig(container) {
  container.classList.remove("hidden");
  gsap.fromTo(container, 
    { opacity: 0, y: -10 },
    { opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.5)" }
  );
}

function slideOutConfig(container) {
  gsap.to(container, {
    opacity: 0,
    y: -10,
    duration: 0.3,
    onComplete: () => container.classList.add("hidden")
  });
}

// Drop Zone Handlers
dropZone.addEventListener("click", () => audioFileInput.click());
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("border-blue-500");
  gsap.to(dropZone, { scale: 0.99, duration: 0.2 });
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("border-blue-500");
  gsap.to(dropZone, { scale: 1.0, duration: 0.2 });
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("border-blue-500");
  gsap.to(dropZone, { scale: 1.0, duration: 0.2 });
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
  
  loadedFileName.textContent = file.name;
  loadedFileName.classList.remove("hidden");
  gsap.fromTo(loadedFileName, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.5)" });
  
  errorBanner.classList.add("hidden");
  workspaceContainer.classList.add("hidden");
  shareLink.classList.add("hidden");
  words = [];
  
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
  gsap.fromTo(progressContainer, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
  updateProgress(5, "Reading audio file...");
  
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const arrayBuffer = await file.arrayBuffer();
    updateProgress(15, "Decoding audio stem...");
    decodedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    totalTimer.textContent = formatTime(decodedAudioBuffer.duration);
    
    if (engineMode === "local") {
      await transcribeLocal();
    } else if (engineMode === "cloud") {
      await transcribeCloud(file);
    } else {
      sliceManualGrid();
    }
  } catch (err) {
    showError("Failed to decode or process audio: " + err.message);
  }
}

// Local ONNX Dynamic Loader (Prevents top-level Safari script crash)
async function transcribeLocal() {
  localEngineWarning.classList.remove("hidden");
  
  const selectedModel = localModelSelect.value;
  updateProgress(25, `Loading local AI engine (${selectedModel.split("/")[1]})...`);
  
  try {
    // Dynamic import to isolate loading failures
    const transformers = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0-alpha.13');
    const pipeline = transformers.pipeline;
    const env = transformers.env;
    env.allowLocalModels = false;
    
    if (!localTranscriber || loadedModelName !== selectedModel) {
      localTranscriber = await pipeline('automatic-speech-recognition', selectedModel, {
        progress_callback: (data) => {
          if (data.status === 'downloading') {
            const pct = Math.round(data.progress || 0);
            updateProgress(25 + (pct * 0.25), `Downloading AI model components... ${pct}%`);
          } else if (data.status === 'done') {
            updateProgress(50, "Warming up Neural Engine components...");
          }
        }
      });
      loadedModelName = selectedModel;
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
      words = generateFallbackSlices();
    }
    
    finishProcessing();
  } catch (err) {
    showError("Local model failed: " + err.message + ". Falling back to manual grid slicing...");
    sliceManualGrid();
  }
}

// Cloud Python API alignment via PWA Vercel Serverless Proxy
async function transcribeCloud(file) {
  const colabURL = colabUrlInput.value.trim();
  if (!colabURL) {
    throw new Error("Colab URL is required for Cloud mode.");
  }
  localStorage.setItem("colab_url", colabURL);
  
  updateProgress(35, "Uploading audio stem to Cloud Proxy...");
  
  const formData = new FormData();
  formData.append("file", file);
  
  try {
    const res = await fetch("/api/align", {
      method: "POST",
      headers: {
        "x-colab-url": colabURL
      },
      body: formData
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server error: ${errText}`);
    }
    
    updateProgress(85, "Stitching cloud alignment...");
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

// Manual Grid Slicer Logic
function sliceManualGrid() {
  updateProgress(80, "Calculating grid boundaries...");
  const durationSec = decodedAudioBuffer.duration;
  const sliceDuration = parseFloat(manualSliceSelect.value);
  
  words = [];
  let currentTimeSec = 0;
  let chunkIdx = 1;
  
  while (currentTimeSec < durationSec) {
    const end = Math.min(durationSec, currentTimeSec + sliceDuration);
    words.push({
      text: `[Slice ${chunkIdx}]`,
      startMs: currentTimeSec * 1000,
      endMs: end * 1000,
      isMuted: false
    });
    currentTimeSec = end;
    chunkIdx++;
  }
  
  finishProcessing();
}

// Helpers
function updateProgress(percentage, status) {
  progressStatus.textContent = status;
  progressPercentage.textContent = `${Math.round(percentage)}%`;
  gsap.to(progressBarFill, { width: `${percentage}%`, duration: 0.3, ease: "power1.out" });
}

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.classList.remove("hidden");
  gsap.fromTo(errorBanner, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.5)" });
  progressContainer.classList.add("hidden");
}

function finishProcessing() {
  updateProgress(100, "Ready!");
  
  gsap.to(progressContainer, {
    opacity: 0,
    y: -10,
    duration: 0.4,
    onComplete: () => {
      progressContainer.classList.add("hidden");
      localEngineWarning.classList.add("hidden");
      
      workspaceContainer.classList.remove("hidden");
      gsap.fromTo(workspaceContainer, 
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
      );
      
      drawWaveform();
      renderWordSlices();
    }
  });
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

// Waveform Canvas Drawer
function drawWaveform() {
  if (!decodedAudioBuffer) return;
  
  const rect = waveformCanvas.parentElement.getBoundingClientRect();
  waveformCanvas.width = rect.width * (window.devicePixelRatio || 1);
  waveformCanvas.height = rect.height * (window.devicePixelRatio || 1);
  waveformCanvas.style.width = '100%';
  waveformCanvas.style.height = '100%';
  
  const ctx = waveformCanvas.getContext("2d");
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  
  const width = rect.width;
  const height = rect.height;
  const rawData = decodedAudioBuffer.getChannelData(0);
  const step = Math.ceil(rawData.length / width);
  const amp = height / 2;
  
  ctx.clearRect(0, 0, width, height);
  
  // Background lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 50; i < width; i += 50) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  
  ctx.beginPath();
  ctx.moveTo(0, amp);
  ctx.lineTo(width, amp);
  ctx.stroke();
  
  ctx.strokeStyle = "rgba(59, 130, 246, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    for (let j = 0; j < step; j++) {
      const datum = rawData[(i * step) + j];
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    ctx.moveTo(i, amp + (min * amp));
    ctx.lineTo(i, amp + (max * amp));
  }
  ctx.stroke();
  
  words.forEach(word => {
    const duration = decodedAudioBuffer.duration * 1000;
    const startX = (word.startMs / duration) * width;
    const endX = (word.endMs / duration) * width;
    
    if (word.isMuted) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
      ctx.fillRect(startX, 0, endX - startX, height);
      
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.moveTo(endX, 0);
      ctx.lineTo(endX, height);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.stroke();
    }
  });
}

// Seek on click
waveformCanvas.addEventListener("click", (e) => {
  if (!decodedAudioBuffer) return;
  const rect = waveformCanvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const ratio = clickX / rect.width;
  const targetSeekTime = ratio * decodedAudioBuffer.duration;
  
  playheadStartOffset = targetSeekTime;
  
  if (isPlaying) {
    startAudioPlayback(targetSeekTime);
  } else {
    waveformPlayhead.style.transform = `translateX(${clickX}px)`;
    playbackTimer.textContent = formatTime(targetSeekTime);
  }
});

// Slices UI Renderer
function renderWordSlices() {
  slicesTimeline.innerHTML = "";
  lastHighlightedIdx = -1;
  
  words.forEach((word, idx) => {
    const chip = document.createElement("div");
    chip.className = `word-chip px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold transition-all duration-300 ${word.isMuted ? "muted" : ""}`;
    chip.textContent = word.text;
    chip.dataset.idx = idx;
    
    chip.addEventListener("click", () => {
      word.isMuted = !word.isMuted;
      if (word.isMuted) {
        chip.classList.add("muted");
        gsap.fromTo(chip, { scale: 1 }, { scale: 0.95, duration: 0.2, yoyo: true, repeat: 1 });
      } else {
        chip.classList.remove("muted");
        gsap.fromTo(chip, { scale: 1 }, { scale: 1.05, duration: 0.2, yoyo: true, repeat: 1 });
      }
      
      drawWaveform();
      shareLink.classList.add("hidden");
      
      if (isPlaying) {
        scheduleVolumeAutomation();
      }
    });
    
    slicesTimeline.appendChild(chip);
  });
  
  gsap.from(".word-chip", {
    scale: 0.7,
    opacity: 0,
    y: 10,
    duration: 0.4,
    stagger: 0.012,
    ease: "back.out(1.5)"
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
  
  activeGainNode.gain.setValueAtTime(parseFloat(volumeSlider.value), audioContext.currentTime);
  
  scheduleVolumeAutomation(offset);
  
  activeSourceNode.start(0, offset);
  isPlaying = true;
  btnPlay.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>`;
  
  playheadStartTime = audioContext.currentTime;
  playheadStartOffset = offset;
  
  currentPlayheadInterval = setInterval(updatePlayheadProgress, 30);
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
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 ml-0.5" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    </svg>`;
  
  clearInterval(currentPlayheadInterval);
  playbackTimer.textContent = "00:00";
  waveformPlayhead.style.transform = `translateX(0px)`;
  
  words.forEach((_, idx) => {
    const chip = slicesTimeline.children[idx];
    if (chip) {
      gsap.to(chip, { scale: 1.0, borderColor: "rgba(255, 255, 255, 0.1)", boxShadow: "none", duration: 0.2 });
    }
  });
  lastHighlightedIdx = -1;
}

// Volume automator scheduler
function scheduleVolumeAutomation(offsetSeconds = 0) {
  if (!activeGainNode) return;
  
  const now = audioContext.currentTime;
  const currentVal = parseFloat(volumeSlider.value);
  
  activeGainNode.gain.cancelScheduledValues(now);
  activeGainNode.gain.setValueAtTime(currentVal, now);
  
  words.forEach(word => {
    const startSecs = word.startMs / 1000;
    const endSecs = word.endMs / 1000;
    
    if (endSecs > offsetSeconds) {
      const scheduleStart = Math.max(0, startSecs - offsetSeconds);
      const scheduleEnd = Math.max(0, endSecs - offsetSeconds);
      
      if (word.isMuted) {
        activeGainNode.gain.setValueAtTime(currentVal, now + scheduleStart);
        activeGainNode.gain.setValueAtTime(0, now + scheduleStart + 0.005);
        
        activeGainNode.gain.setValueAtTime(0, now + scheduleEnd);
        activeGainNode.gain.setValueAtTime(currentVal, now + scheduleEnd + 0.005);
      }
    }
  });
}

// Updates playing highlight with smooth GSAP scaling transitions and playhead scroll
function updatePlayheadProgress() {
  if (!isPlaying) return;
  const elapsed = audioContext.currentTime - playheadStartTime + playheadStartOffset;
  playbackTimer.textContent = formatTime(elapsed);
  
  if (elapsed >= decodedAudioBuffer.duration) {
    stopAudioPlayback();
    return;
  }
  
  const duration = decodedAudioBuffer.duration;
  const rect = waveformCanvas.getBoundingClientRect();
  const playheadX = (elapsed / duration) * rect.width;
  waveformPlayhead.style.transform = `translateX(${playheadX}px)`;
  
  const elapsedMs = elapsed * 1000;
  let activeIdx = -1;
  
  for (let i = 0; i < words.length; i++) {
    if (elapsedMs >= words[i].startMs && elapsedMs <= words[i].endMs) {
      activeIdx = i;
      break;
    }
  }
  
  if (activeIdx !== lastHighlightedIdx) {
    if (lastHighlightedIdx !== -1) {
      const lastChip = slicesTimeline.children[lastHighlightedIdx];
      if (lastChip) {
        gsap.to(lastChip, {
          scale: 1.0,
          borderColor: "rgba(255,255,255,0.1)",
          boxShadow: "none",
          duration: 0.25,
          overwrite: "auto"
        });
      }
    }
    
    if (activeIdx !== -1) {
      const activeChip = slicesTimeline.children[activeIdx];
      if (activeChip) {
        gsap.to(activeChip, {
          scale: 1.08,
          borderColor: "#3b82f6",
          boxShadow: "0 0 15px rgba(59, 130, 246, 0.45)",
          duration: 0.2,
          overwrite: "auto"
        });
        
        activeChip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
    lastHighlightedIdx = activeIdx;
  }
}

// Controls listeners
btnPlay.addEventListener("click", () => {
  if (isPlaying) {
    stopAudioPlayback();
  } else {
    startAudioPlayback(playheadStartOffset);
  }
});

btnStop.addEventListener("click", () => {
  stopAudioPlayback();
  playheadStartOffset = 0;
});

volumeSlider.addEventListener("input", () => {
  if (activeGainNode) {
    activeGainNode.gain.setValueAtTime(parseFloat(volumeSlider.value), audioContext.currentTime);
  }
});

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
      
      const channels = [];
      for (let i = 0; i < numChannels; i++) {
        channels.push(new Float32Array(decodedAudioBuffer.getChannelData(i)));
      }
      
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
      
      const buffer = encodeWAV(channels, sampleRate);
      const blob = new Blob([buffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      
      shareLink.href = url;
      shareLink.download = "LyricSlicer_MutedStem.wav";
      shareLink.classList.remove("hidden");
      
      gsap.fromTo(shareLink, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.5)" });
      
      btnExport.innerHTML = `<span>Export Done</span>`;
      btnExport.disabled = false;
      
      setTimeout(() => {
        btnExport.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, length, true);
  
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

// Redraw canvas on window resize
window.addEventListener("resize", drawWaveform);
