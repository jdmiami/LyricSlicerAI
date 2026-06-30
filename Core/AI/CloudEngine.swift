import Foundation
import CoreGraphics

/// Cloud Engine (Pro Tier) leveraging Python FastAPI and WhisperX for sample-accurate alignment
public class CloudEngine: TranscriptionEngine {
    
    // The configurable locatunnel URL 
    private let apiURL: String
    
    public init(apiURL: String) {
        self.apiURL = apiURL
    }
    
    public func transcribeAudio(at audioFileURL: URL) async throws -> [WordSlice] {
        guard !apiURL.isEmpty, let url = URL(string: "\(apiURL)/align") else {
            throw NSError(domain: "CloudEngine", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid or empty API URL. Please set the Colab Localtunnel URL."])
        }
        
        print("Starting Pro Cloud Transcription via WhisperX API to \(url.absoluteString)...")
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        // Localtunnel bypass header
        request.setValue("true", forHTTPHeaderField: "Bypass-Tunnel-Reminder")
        
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        // Build multipart body
        var body = Data()
        let filename = audioFileURL.lastPathComponent
        let mimeType = "audio/wav"
        let audioData = try Data(contentsOf: audioFileURL)
        
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        
        // Execute request
        let (data, response) = try await URLSession.shared.upload(for: request, from: body)
        
        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown server error"
            throw NSError(domain: "CloudEngine", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "API Error \(httpResponse.statusCode): \(errorMsg)"])
        }
        
        // Decode JSON
        let decoder = JSONDecoder()
        return try decoder.decode([WordSlice].self, from: data)
    }
}
