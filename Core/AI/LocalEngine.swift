import Foundation
import WhisperKit

/// Local Engine (Free Tier) leveraging WhisperKit for on-device M2 Neural Engine inference
public class LocalEngine: TranscriptionEngine {
    
    // Cache the WhisperKit instance statically so it doesn't re-download/re-initialize on every run
    private static var cachedPipe: WhisperKit?
    
    public init() {}
    
    private func getPipe() async throws -> WhisperKit {
        if let pipe = Self.cachedPipe {
            return pipe
        }
        print("Initializing WhisperKit with openai/whisper-tiny...")
        let pipe = try await WhisperKit(model: "openai/whisper-tiny")
        Self.cachedPipe = pipe
        return pipe
    }
    
    public func transcribeAudio(at audioFileURL: URL) async throws -> [WordSlice] {
        print("Starting Local Offline Transcription via WhisperKit on Neural Engine...")
        
        let pipe = try await getPipe()
        
        let anyResult = try await pipe.transcribe(audioPath: audioFileURL.path, decodeOptions: DecodingOptions(wordTimestamps: true)) as Any
        
        var wordSlices: [WordSlice] = []
        
        // Accumulate segments from all transcription results (each result is a chunk)
        var segments: [TranscriptionSegment] = []
        if let array = anyResult as? [TranscriptionResult] {
            for result in array {
                segments.append(contentsOf: result.segments)
            }
        } else if let single = anyResult as? TranscriptionResult {
            segments = single.segments
        } else if let array = anyResult as? [Any] {
            for item in array {
                if let result = item as? TranscriptionResult {
                    segments.append(contentsOf: result.segments)
                }
            }
        }
        
        for segment in segments {
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
