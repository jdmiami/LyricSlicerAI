#pragma once

#include <vector>
#include <mutex>
#include <AudioToolbox/AudioToolbox.h>

class DSPKernel {
public:
    struct KernelSlice {
        double startMs;
        double endMs;
        bool isMuted;
        double stretchRatio;
    };

    DSPKernel();
    ~DSPKernel();

    /// Updates the internal slice metadata from the UI
    void updateSlices(std::vector<KernelSlice> slices);

    /// Loads the audio buffer to be sliced/stretched
    void loadAudioBuffer(float *const *channelData, uint32_t frameLength, uint32_t channelCount, double sampleRate);

    /// The main audio render callback
    void process(AudioBufferList *outputData, uint32_t frameCount);

private:
    std::mutex mMutex; // Ensure thread-safe updates from UI thread to Audio thread
    std::vector<KernelSlice> mSlices;
    
    // Audio Buffer Storage
    std::vector<std::vector<float>> mAudioBuffer;
    uint32_t mFrameLength;
    uint32_t mChannelCount;
    double mSampleRate;
    
    // Playback state
    uint64_t mCurrentPlayheadFrame;
    
    /// Helper to determine if a specific frame falls within a muted slice
    bool isFrameMuted(uint64_t frameIndex);
};
