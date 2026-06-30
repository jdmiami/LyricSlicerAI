import SwiftUI

public struct SlicerView: View {
    @State private var words: [WordSlice] = []
    @State private var isProcessing: Bool = false
    
    // Mock audio duration for UI layout
    let totalDurationMs: Double = 5000 
    
    public init() {}

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
                            .background(Color.blue.opacity(0.8))
                            .cornerRadius(8)
                    }
                }
                .padding()
                .background(.ultraThinMaterial)
                
                Spacer()
                
                if isProcessing {
                    VStack {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(1.5)
                        Text("Aligning Neural Net...")
                            .foregroundColor(.gray)
                            .padding(.top)
                    }
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
        isProcessing = true
        // Mock processing delay for UI
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.words = [
                WordSlice(text: "The", startMs: 100, endMs: 400),
                WordSlice(text: "pre", startMs: 450, endMs: 800),
                WordSlice(text: "drop", startMs: 850, endMs: 1200),
                WordSlice(text: "silence", startMs: 1250, endMs: 2000, isAnchor: true)
            ]
            self.isProcessing = false
        }
    }
}
