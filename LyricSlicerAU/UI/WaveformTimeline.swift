import SwiftUI

public struct WaveformTimeline: View {
    @Binding var words: [WordSlice]
    let totalDurationMs: Double
    
    public var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            
            ZStack(alignment: .leading) {
                // Background timeline track
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white.opacity(0.1))
                    .frame(height: 80)
                
                // Render Word Blocks
                ForEach($words) { $word in
                    let startRatio = word.startMs / totalDurationMs
                    let durationRatio = (word.endMs - word.startMs) / totalDurationMs
                    
                    WordBlock(word: $word)
                        .frame(width: width * CGFloat(durationRatio), height: 80)
                        .offset(x: width * CGFloat(startRatio))
                }
            }
            .frame(height: 80)
        }
    }
}
