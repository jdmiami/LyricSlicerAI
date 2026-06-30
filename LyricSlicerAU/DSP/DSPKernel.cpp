#include "DSPKernel.hpp"
#include <algorithm>

DSPKernel::DSPKernel() 
    : mFrameLength(0), mChannelCount(0), mSampleRate(44100.0), mCurrentPlayheadFrame(0) {
}

DSPKernel::~DSPKernel() {
}

void DSPKernel::updateSlices(std::vector<KernelSlice> slices) {
    // Acquire lock to prevent modifying slices while the audio thread is rendering
    std::lock_guard<std::mutex> lock(mMutex);
    mSlices = std::move(slices);
}

void DSPKernel::loadAudioBuffer(float *const *channelData, uint32_t frameLength, uint32_t channelCount, double sampleRate) {
    std::lock_guard<std::mutex> lock(mMutex);
    
    mFrameLength = frameLength;
    mChannelCount = channelCount;
    mSampleRate = sampleRate;
    
    mAudioBuffer.resize(channelCount);
    for (uint32_t channel = 0; channel < channelCount; ++channel) {
        mAudioBuffer[channel].assign(channelData[channel], channelData[channel] + frameLength);
    }
    
    mCurrentPlayheadFrame = 0;
}

bool DSPKernel::isFrameMuted(uint64_t frameIndex) {
    if (mSampleRate == 0.0) return false;
    
    double currentMs = (static_cast<double>(frameIndex) / mSampleRate) * 1000.0;
    
    for (const auto& slice : mSlices) {
        if (currentMs >= slice.startMs && currentMs <= slice.endMs) {
            return slice.isMuted;
        }
    }
    return false;
}

void DSPKernel::process(AudioBufferList *outputData, uint32_t frameCount) {
    // Attempt to acquire lock without blocking the real-time thread.
    // If we can't get the lock, we bypass processing (output silence or bypass).
    std::unique_lock<std::mutex> lock(mMutex, std::try_to_lock);
    
    uint32_t outputChannelCount = outputData->mNumberBuffers;
    
    for (uint32_t channel = 0; channel < outputChannelCount; ++channel) {
        float *outBuffer = (float *)outputData->mBuffers[channel].mData;
        
        for (uint32_t frame = 0; frame < frameCount; ++frame) {
            if (!lock.owns_lock() || mAudioBuffer.empty() || mCurrentPlayheadFrame >= mFrameLength) {
                outBuffer[frame] = 0.0f; // Silence
            } else {
                // If muted via UI, output silence
                if (isFrameMuted(mCurrentPlayheadFrame)) {
                    outBuffer[frame] = 0.0f;
                } else {
                    // Output audio from internal memory
                    uint32_t sourceChannel = std::min(channel, mChannelCount - 1);
                    outBuffer[frame] = mAudioBuffer[sourceChannel][mCurrentPlayheadFrame];
                }
            }
        }
    }
    
    if (lock.owns_lock() && !mAudioBuffer.empty()) {
        mCurrentPlayheadFrame += frameCount;
    }
}
