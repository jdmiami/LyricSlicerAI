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
                    
                    // Sandbox for testing the AUv3 UI within the host app
                    SlicerView()
                        .cornerRadius(12)
                        .padding()
                    
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
