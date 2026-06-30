import SwiftUI

struct ContentView: View {
    @EnvironmentObject var subscriptionManager: SubscriptionManager

    var body: some View {
        NavigationView {
            ZStack {
                // Cyber-Glass aesthetic background
                Color.black.edgesIgnoringSafeArea(.all)
                
                VStack {
                    Text("LyricSlicer AI")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .padding()
                    
                    Text(subscriptionManager.isPro ? "Pro Tier Active (Cloud GPU)" : "Free Tier Active (M2 Neural Engine)")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                    
                    Spacer()
                    
                    // Placeholder for testing the AUv3 UI within the host app
                    Text("AUv3 Plugin UI Sandbox")
                        .font(.title3)
                        .padding()
                        .background(.ultraThinMaterial)
                        .cornerRadius(12)
                    
                    Spacer()
                    
                    Button(action: {
                        subscriptionManager.isPro.toggle()
                    }) {
                        Text(subscriptionManager.isPro ? "Downgrade to Free" : "Upgrade to Pro")
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(subscriptionManager.isPro ? Color.red.opacity(0.8) : Color.blue.opacity(0.8))
                            .foregroundColor(.white)
                            .cornerRadius(10)
                            .padding(.horizontal)
                    }
                }
            }
            .navigationBarHidden(true)
        }
    }
}
