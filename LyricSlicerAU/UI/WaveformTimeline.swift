import SwiftUI

public struct WaveformTimeline: View {
    @Binding var words: [WordSlice]
    let totalDurationMs: Double
    
    // 100 pixels per second = 0.1 pixels per millisecond
    let pixelsPerMs: CGFloat = 0.1
    
    public var body: some View {
        let totalWidth = CGFloat(totalDurationMs) * pixelsPerMs
        
        ZStack(alignment: .leading) {
            // Background timeline track
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.white.opacity(0.1))
                .frame(width: totalWidth, height: 80)
            
            // Render Word Blocks
            ForEach($words) { $word in
                let startX = CGFloat(word.startMs) * pixelsPerMs
                let wordWidth = CGFloat(word.endMs - word.startMs) * pixelsPerMs
                
                WordBlock(word: $word)
                    .frame(width: wordWidth, height: 80)
                    .offset(x: startX)
            }
        }
        .frame(width: max(totalWidth, 100), height: 80)
    }
}
