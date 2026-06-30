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

## Building

Because this project uses native iOS frameworks (`AVFoundation`, `AudioToolbox`, `SwiftUI`), it must be built using Xcode on a macOS machine.

1. Transfer this folder to a Mac.
2. Create a new Xcode project or package.
3. Import all files.
4. Add `WhisperKit` via Swift Package Manager to enable the local Core ML inference.
5. Build to an iPad Simulator or physical iPad Pro (M2).
