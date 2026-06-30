import Foundation

/// Strategy Pattern Interface for Dual-Engine Architecture
public protocol TranscriptionEngine {
    /// Transcribes the provided audio file and returns a list of WordSlice objects
    /// - Parameter audioFileURL: Local URL of the audio file to process
    /// - Parameter onProgress: Callback providing progress percentage (0.0 to 1.0) and description
    /// - Returns: An array of WordSlice representing the transcribed words and their timestamps
    func transcribeAudio(at audioFileURL: URL, onProgress: @escaping @Sendable (Double, String) -> Void) async throws -> [WordSlice]
}
