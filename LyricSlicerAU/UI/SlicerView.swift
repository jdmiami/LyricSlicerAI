import SwiftUI
import UniformTypeIdentifiers
import AVFoundation

public struct SlicerView: View {
    var isPro: Bool
    var colabURL: String
    var audioUnit: SlicerAudioUnit? = nil
    
    @State private var words: [WordSlice] = []
    @State private var isProcessing: Bool = false
    @State private var errorMessage: String? = nil
    @State private var showingFilePicker = false
    @State private var loadedAudioURL: URL? = nil
    @State private var exportedAudioURL: URL? = nil
    @State private var isExporting: Bool = false
    
    // Mock audio duration for UI layout
    let totalDurationMs: Double = 5000 
    
    public init(isPro: Bool = false, colabURL: String = "", audioUnit: SlicerAudioUnit? = nil) {
        self.isPro = isPro
        self.colabURL = colabURL
        self.audioUnit = audioUnit
    }

    public var body: some View {
        ZStack {
            // Dark mode Cyber-Glass background
            Color(white: 0.1).edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 0) {
                // Top header
                HStack {
                    Text("LyricSlicer AI")
                        .font(.headline)
                        .foregroundColor(.white)
                    Spacer()
                    
                    if isExporting {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .padding(.trailing, 8)
                    } else if let exportURL = exportedAudioURL {
                        ShareLink(item: exportURL) {
                            HStack {
                                Image(systemName: "square.and.arrow.up")
                                Text("Share Audio")
                            }
                            .foregroundColor(.white)
                            .padding(8)
                            .background(Color.green.opacity(0.8))
                            .cornerRadius(8)
                        }
                        .padding(.trailing, 8)
                    } else if !words.isEmpty {
                        Button(action: { generateExportedAudio() }) {
                            HStack {
                                Image(systemName: "waveform.badge.minus")
                                Text("Export")
                            }
                            .foregroundColor(.white)
                            .padding(8)
                            .background(Color.orange.opacity(0.8))
                            .cornerRadius(8)
                        }
                        .padding(.trailing, 8)
                    }

                    Button(action: { showingFilePicker = true }) {
                        HStack {
                            Image(systemName: "folder.fill")
                            Text("Load Audio")
                        }
                        .foregroundColor(.white)
                        .padding(8)
                        .background(
                            isPro ? Color.purple.opacity(0.8) : Color.blue.opacity(0.8)
                        )
                        .cornerRadius(8)
                        .shadow(color: isPro ? .purple : .blue, radius: isProcessing ? 10 : 2)
                    }
                    .disabled(isProcessing)
                }
                .padding()
                .background(.ultraThinMaterial)
                
                Spacer()
                
                if isProcessing {
                    VStack(spacing: 16) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: isPro ? .purple : .blue))
                            .scaleEffect(1.5)
                            .frame(width: 250)
                            .padding()
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .shadow(color: isPro ? .purple.opacity(0.5) : .blue.opacity(0.5), radius: 10)
                            
                        Text(isPro ? "Aligning Neural Net on Cloud GPU..." : "Processing locally on Neural Engine... (May download models on first run)")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }
                } else if let errorMessage = errorMessage {
                    Text(errorMessage)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                        .padding()
                } else if words.isEmpty {
                    Text("Load an audio file to begin slicing")
                        .foregroundColor(.gray)
                } else {
                    ScrollView(.horizontal, showsIndicators: true) {
                        WaveformTimeline(words: $words, totalDurationMs: totalDurationMs)
                            .padding()
                    }
                }
                
                Spacer()
            }
        }
        .fileImporter(
            isPresented: $showingFilePicker,
            allowedContentTypes: [.audio],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first {
                    processAudio(at: url)
                }
            case .failure(let error):
                self.errorMessage = "Failed to select file: \(error.localizedDescription)"
            }
        }
    }
    
    private func processAudio(at url: URL) {
        isProcessing = true
        errorMessage = nil
        words = []
        exportedAudioURL = nil
        
        // Try accessing security-scoped resource in case it's outside the app sandbox
        let gotAccess = url.startAccessingSecurityScopedResource()
        
        // Copy to temporary directory to bypass sandbox limits during inference and export
        let tempDir = FileManager.default.temporaryDirectory
        let localURL = tempDir.appendingPathComponent(url.lastPathComponent)
        
        do {
            if FileManager.default.fileExists(atPath: localURL.path) {
                try FileManager.default.removeItem(at: localURL)
            }
            try FileManager.default.copyItem(at: url, to: localURL)
        } catch {
            self.errorMessage = "Failed to import audio: \(error.localizedDescription)"
            self.isProcessing = false
            if gotAccess { url.stopAccessingSecurityScopedResource() }
            return
        }
        
        if gotAccess {
            url.stopAccessingSecurityScopedResource()
        }
        
        self.loadedAudioURL = localURL
        
        Task {
            do {
                // Load the audio buffer into the audio unit using the local sandbox copy
                if let unit = audioUnit {
                    let audioFile = try AVAudioFile(forReading: localURL)
                    if let format = AVAudioFormat(standardFormatWithSampleRate: 44100.0, channels: 2),
                       let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(audioFile.length)) {
                        try audioFile.read(into: buffer)
                        unit.loadAudioBuffer(buffer)
                    }
                }
                
                let engine: TranscriptionEngine
                if isPro {
                    engine = CloudEngine(apiURL: colabURL)
                } else {
                    engine = LocalEngine() // Uses WhisperKit
                }
                
                let result = try await engine.transcribeAudio(at: localURL)
                
                await MainActor.run {
                    self.words = result
                    self.isProcessing = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = "Error: \(error.localizedDescription)"
                    self.isProcessing = false
                }
            }
        }
    }
    
    private func generateExportedAudio() {
        guard let sourceURL = loadedAudioURL, !words.isEmpty else { return }
        isExporting = true
        
        Task {
            do {
                let sourceFile = try AVAudioFile(forReading: sourceURL)
                let format = sourceFile.processingFormat
                
                let tempDir = FileManager.default.temporaryDirectory
                let exportURL = tempDir.appendingPathComponent("LyricSlicer_Export.wav")
                
                // Remove existing file if any
                try? FileManager.default.removeItem(at: exportURL)
                
                // Create a destination file using standard WAV settings
                let settings: [String: Any] = [
                    AVFormatIDKey: Int(kAudioFormatLinearPCM),
                    AVSampleRateKey: format.sampleRate,
                    AVNumberOfChannelsKey: format.channelCount,
                    AVLinearPCMBitDepthKey: 16,
                    AVLinearPCMIsFloatKey: false,
                    AVLinearPCMIsBigEndianKey: false
                ]
                let destFile = try AVAudioFile(forWriting: exportURL, settings: settings, commonFormat: format.commonFormat, interleaved: format.isInterleaved)
                
                let frameCapacity: AVAudioFrameCount = 44100 // Process in 1 second chunks
                guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCapacity) else {
                    throw NSError(domain: "Export", code: -1, userInfo: [NSLocalizedDescriptionKey: "Could not create audio buffer"])
                }
                
                var currentFramePosition: AVAudioFramePosition = 0
                let totalFrames = sourceFile.length
                let sampleRate = format.sampleRate
                
                while currentFramePosition < totalFrames {
                    let framesToRead = min(AVAudioFrameCount(totalFrames - currentFramePosition), frameCapacity)
                    try sourceFile.read(into: buffer, frameCount: framesToRead)
                    
                    // Apply muting based on words
                    if let channelData = buffer.floatChannelData {
                        for frame in 0..<Int(buffer.frameLength) {
                            let currentSamplePos = currentFramePosition + AVAudioFramePosition(frame)
                            let currentMs = (Double(currentSamplePos) / sampleRate) * 1000.0
                            
                            // Check if currentMs falls within any muted word
                            var isMuted = false
                            for word in words {
                                if currentMs >= word.startMs && currentMs <= word.endMs {
                                    isMuted = word.isMuted
                                    break
                                }
                            }
                            
                            if isMuted {
                                for channel in 0..<Int(format.channelCount) {
                                    channelData[channel][frame] = 0.0
                                }
                            }
                        }
                    }
                    
                    try destFile.write(from: buffer)
                    currentFramePosition += AVAudioFramePosition(buffer.frameLength)
                }
                
                await MainActor.run {
                    self.exportedAudioURL = exportURL
                    self.isExporting = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = "Export failed: \(error.localizedDescription)"
                    self.isExporting = false
                }
            }
        }
    }
}
