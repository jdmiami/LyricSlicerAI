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
                    
                    if subscriptionManager.isPro {
                        TextField("Paste Colab Localtunnel URL (https://...loca.lt)", text: $subscriptionManager.colabURL)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .padding(.horizontal)
                            .padding(.top, 8)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                    }
                    
                    Spacer()
                    
                    // Sandbox for testing the AUv3 UI within the host app
                    SlicerView(isPro: subscriptionManager.isPro, colabURL: subscriptionManager.colabURL)
                        .cornerRadius(12)
                        .padding()
                    
                    Spacer()
                    
                    Button(action: {
                        withAnimation {
                            subscriptionManager.isPro.toggle()
                        }
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
