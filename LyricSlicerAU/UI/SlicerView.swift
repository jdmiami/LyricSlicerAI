import SwiftUI

public struct SlicerView: View {
    var isPro: Bool
    var colabURL: String
    
    @State private var words: [WordSlice] = []
    @State private var isProcessing: Bool = false
    @State private var errorMessage: String? = nil
    
    // Mock audio duration for UI layout
    let totalDurationMs: Double = 5000 
    
    public init(isPro: Bool = false, colabURL: String = "") {
        self.isPro = isPro
        self.colabURL = colabURL
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
                    Button(action: processAudio) {
                        Image(systemName: "wand.and.stars")
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
                    Text("Tap the wand to slice audio")
                        .foregroundColor(.gray)
                } else {
                    WaveformTimeline(words: $words, totalDurationMs: totalDurationMs)
                        .padding()
                }
                
                Spacer()
            }
        }
    }
    
    private func processAudio() {
        guard let url = Bundle.main.url(forResource: "test_audio", withExtension: "wav") else {
            self.errorMessage = "test_audio.wav not found in app bundle!"
            return
        }
        
        isProcessing = true
        errorMessage = nil
        words = []
        
        Task {
            do {
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
