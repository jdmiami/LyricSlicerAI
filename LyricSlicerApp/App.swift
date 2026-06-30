import SwiftUI

@main
struct LyricSlicerApp: App {
    @StateObject private var subscriptionManager = SubscriptionManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(subscriptionManager)
                .preferredColorScheme(.dark)
        }
    }
}

// Mock Subscription Manager for standalone app
class SubscriptionManager: ObservableObject {
    @Published var isPro: Bool = false
    @Published var colabURL: String = ""
}
