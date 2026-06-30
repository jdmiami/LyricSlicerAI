#import "SlicerAudioUnit.h"
#import "../DSP/DSPKernel.hpp"
#import <AVFoundation/AVFoundation.h>

@interface SlicerAudioUnit ()
@property (nonatomic, readwrite) DSPKernel *kernel;
@end

@implementation SlicerAudioUnit

- (instancetype)initWithComponentDescription:(AudioComponentDescription)componentDescription options:(AudioComponentInstantiationOptions)options error:(NSError **)outError {
    self = [super initWithComponentDescription:componentDescription options:options error:outError];
    
    if (self) {
        _kernel = new DSPKernel();
        // Setup internal buses, allocate render resources etc.
    }
    return self;
}

- (void)dealloc {
    delete _kernel;
}

- (void)updateSlices:(const BridgeWordSlice *)slices count:(NSUInteger)count {
    std::vector<DSPKernel::KernelSlice> kernelSlices;
    kernelSlices.reserve(count);
    
    for (NSUInteger i = 0; i < count; i++) {
        DSPKernel::KernelSlice slice;
        slice.startMs = slices[i].startMs;
        slice.endMs = slices[i].endMs;
        slice.isMuted = slices[i].isMuted;
        slice.stretchRatio = slices[i].stretchRatio;
        kernelSlices.push_back(slice);
    }
    
    _kernel->updateSlices(std::move(kernelSlices));
}

- (void)loadAudioBuffer:(AVAudioPCMBuffer *)buffer {
    // Extract raw float pointers from buffer and pass to C++ kernel
    float *const *floatChannelData = buffer.floatChannelData;
    AVAudioFrameCount frameLength = buffer.frameLength;
    NSUInteger channelCount = buffer.format.channelCount;
    double sampleRate = buffer.format.sampleRate;
    
    _kernel->loadAudioBuffer(floatChannelData, frameLength, channelCount, sampleRate);
}

// Override internalRenderBlock to call _kernel->process(...)
- (AUInternalRenderBlock)internalRenderBlock {
    // Capture pointer to kernel to avoid Objective-C overhead in real-time thread
    DSPKernel *kernel = _kernel;
    
    return ^AUAudioUnitStatus(AudioUnitRenderActionFlags *actionFlags,
                              const AudioTimeStamp *timestamp,
                              AVAudioFrameCount frameCount,
                              NSInteger outputBusNumber,
                              AudioBufferList *outputData,
                              const AURenderEvent *realtimeEventListHead,
                              AURenderPullInputBlock pullInputBlock) {
        
        kernel->process(outputData, frameCount);
        return noErr;
    };
}

@end
