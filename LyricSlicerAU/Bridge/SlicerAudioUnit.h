#import <AudioToolbox/AudioToolbox.h>
#import <AVFoundation/AVFoundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Represents a slice of audio passed from Swift down to C++
typedef struct {
    double startMs;
    double endMs;
    bool isMuted;
    double stretchRatio;
} BridgeWordSlice;

@interface SlicerAudioUnit : AUAudioUnit

/// Passes an array of WordSlices from Swift UI to the internal C++ DSP Kernel
- (void)updateSlices:(const BridgeWordSlice *)slices count:(NSUInteger)count;

/// Loads an audio file buffer into the C++ DSP Kernel for manipulation
- (void)loadAudioBuffer:(AVAudioPCMBuffer *)buffer;

@end

NS_ASSUME_NONNULL_END
