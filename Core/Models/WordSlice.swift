import Foundation

/// Represents a single segmented word or syllable from the audio transcription
public struct WordSlice: Identifiable, Codable, Equatable {
    public var id = UUID()
    
    /// The transcribed text
    public var text: String
    
    /// Exact start time in milliseconds
    public var startMs: Double
    
    /// Exact end time in milliseconds
    public var endMs: Double
    
    /// Mute state toggled by the user via single tap
    public var isMuted: Bool
    
    /// Time-stretch ratio (1.0 = original speed, >1.0 = slower, <1.0 = faster)
    public var stretchRatio: Double
    
    /// Marks if this word is serving as a phrase anchor (Smart Handle)
    public var isAnchor: Bool

    public init(text: String, startMs: Double, endMs: Double, isMuted: Bool = false, stretchRatio: Double = 1.0, isAnchor: Bool = false) {
        self.text = text
        self.startMs = startMs
        self.endMs = endMs
        self.isMuted = isMuted
        self.stretchRatio = stretchRatio
        self.isAnchor = isAnchor
    }
}
