import SwiftUI

public struct WordBlock: View {
    @Binding var word: WordSlice
    @State private var isHovering: Bool = false
    
    public var body: some View {
        ZStack {
            // Block background
            RoundedRectangle(cornerRadius: 6)
                .fill(word.isMuted ? Color.gray.opacity(0.3) : Color.blue.opacity(0.6))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(word.isAnchor ? Color.yellow : Color.clear, lineWidth: 2)
                )
                .shadow(color: isHovering ? Color.blue : Color.clear, radius: 4)
            
            Text(word.text)
                .font(.caption)
                .bold()
                .foregroundColor(word.isMuted ? .gray : .white)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .padding(.horizontal, 4)
        }
        .onHover { hovering in
            // Apple Pencil Hover / Mouse Hover
            withAnimation(.easeInOut(duration: 0.2)) {
                self.isHovering = hovering
            }
        }
        .onTapGesture {
            // Mute / Unmute
            withAnimation {
                word.isMuted.toggle()
            }
        }
        .contextMenu {
            Button(action: { word.isAnchor.toggle() }) {
                Label(word.isAnchor ? "Remove Anchor" : "Set as Anchor", systemImage: "pin")
            }
            Button(action: { /* Stutter Logic */ }) {
                Label("Stutter Chop", systemImage: "scissors")
            }
        }
    }
}
