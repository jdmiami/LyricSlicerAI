# LyricSlicer AI (iPad Edition)

LyricSlicer AI represents a fundamental paradigm shift in mobile vocal production: transitioning from editing blind waveforms to interacting directly with semantic language. It is a touch-first, intelligent audio manipulation environment designed specifically for the tactile nature of the iPad Pro.

## Architecture

This repository contains the scaffolded codebase for the iPadOS application and AUv3 instrument.

- **`LyricSlicerApp/`**: The standalone host application in SwiftUI. Manages subscription tiers and provides a sandbox.
- **`LyricSlicerAU/`**: The core AUv3 Audio Unit plugin.
  - **`UI/`**: The Cyber-Glass SwiftUI frontend.
  - **`Bridge/`**: The Objective-C++ communication layer.
  - **`DSP/`**: The real-time C++ audio manipulation kernel.
- **`Core/`**: Shared Swift logic.
  - **`Models/`**: Data models like `WordSlice`.
  - **`AI/`**: The Strategy Pattern implementation for Dual-Engine inference (`LocalEngine` for WhisperKit, `CloudEngine` for API).

## Building (No Mac Required)

We have configured a **GitHub Actions CI/CD pipeline** to compile the iOS App and AUv3 plugin automatically in the cloud whenever code is pushed.

1. Go to the **Actions** tab on your GitHub repository.
2. Click the latest successful `iOS Build` workflow run.
3. Scroll down to **Artifacts** and download the `LyricSlicerAI-iPad-Build` zip file.
4. Unzip it to get your `LyricSlicerAI.ipa` file.
5. Because this is an unsigned IPA (to avoid needing a paid $99/yr Apple Developer Account), you can install it onto your physical iPad using a free sideloading tool like **AltStore** or **Sideloadly** directly from your Windows PC.
6. Once installed on your iPad, you can test the "Cyber-Glass" standalone app, or open **Logic Pro for iPad** and load the LyricSlicer AUv3 plugin!

## Building (Manual)

Because this project uses native iOS frameworks (`AVFoundation`, `AudioToolbox`, `SwiftUI`), it must be built using Xcode on a macOS machine.

1. Transfer this folder to a Mac.
2. Create a new Xcode project or package.
3. Import all files.
4. Add `WhisperKit` via Swift Package Manager to enable the local Core ML inference.
5. Build to an iPad Simulator or physical iPad Pro (M2).
