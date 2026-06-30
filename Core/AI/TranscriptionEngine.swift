import Foundation

/// Strategy Pattern Interface for Dual-Engine Architecture
public protocol TranscriptionEngine {
    /// Transcribes the provided audio file and returns a list of WordSlice objects
    /// - Parameter audioFileURL: Local URL of the audio file to process
    /// - Returns: An array of WordSlice representing the transcribed words and their timestamps
    func transcribeAudio(at audioFileURL: URL) async throws -> [WordSlice]
}
