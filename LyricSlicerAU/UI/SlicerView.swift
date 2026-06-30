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
                    VStack {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(1.5)
                        Text(isPro ? "Aligning Neural Net on Cloud GPU..." : "Processing locally on Neural Engine...")
                            .foregroundColor(.gray)
                            .padding(.top)
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
        
        // Try accessing security-scoped resource in case it's outside the app sandbox
        let gotAccess = url.startAccessingSecurityScopedResource()
        
        Task {
            defer {
                if gotAccess {
                    url.stopAccessingSecurityScopedResource()
                }
            }
            
            do {
                // Load the audio buffer into the audio unit
                if let unit = audioUnit {
                    let audioFile = try AVAudioFile(forReading: url)
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
                    engine = LocalEngine() // Future WhisperKit implementation
                }
                
                let result = try await engine.transcribeAudio(at: url)
                
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
}
