import Foundation
import WhisperKit

/// Local Engine (Free Tier) leveraging WhisperKit for on-device M2 Neural Engine inference
public class LocalEngine: TranscriptionEngine {
    
    public init() {}
    
    public func transcribeAudio(at audioFileURL: URL) async throws -> [WordSlice] {
        print("Starting Local Offline Transcription via WhisperKit on Neural Engine...")
        
        let pipe = try await WhisperKit()
        
        let anyResult = try await pipe.transcribe(audioPath: audioFileURL.path, decodeOptions: DecodingOptions(wordTimestamps: true)) as Any
        
        var wordSlices: [WordSlice] = []
        
        // Handle both older optional TranscriptionResult and newer Array of results
        let segments: [TranscriptionSegment]?
        if let array = anyResult as? [Any], let first = array.first as? TranscriptionResult {
            segments = first.segments
        } else if let single = anyResult as? TranscriptionResult {
            segments = single.segments
        } else {
            segments = nil
        }
        
        if let segs = segments {
            for segment in segs {
                if let words = segment.words {
                    for word in words {
                        wordSlices.append(WordSlice(
                            text: word.word, 
                            startMs: Double(word.start * 1000), 
                            endMs: Double(word.end * 1000)
                        ))
                    }
                }
            }
        }
        
        // Fallback if no words were detected
        if wordSlices.isEmpty {
            return [
                WordSlice(text: "No", startMs: 0, endMs: 300),
                WordSlice(text: "words", startMs: 310, endMs: 500),
                WordSlice(text: "found", startMs: 510, endMs: 700)
            ]
        }
        
        return wordSlices
    }
}
