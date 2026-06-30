import CoreAudioKit
import SwiftUI

public class AudioUnitViewController: AUViewController, AUAudioUnitFactory {
    var audioUnit: SlicerAudioUnit?
    var hostingController: UIHostingController<SlicerView>?
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        
        let slicerView = SlicerView(isPro: false, colabURL: "")
        
        let host = UIHostingController(rootView: slicerView)
        self.addChild(host)
        host.view.frame = self.view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        self.view.addSubview(host.view)
        host.didMove(toParent: self)
        
        self.hostingController = host
    }
    
    public func createAudioUnit(with componentDescription: AudioComponentDescription) throws -> AUAudioUnit {
        let au = try SlicerAudioUnit(componentDescription: componentDescription, options: [])
        self.audioUnit = au
        
        // Pass the audio unit instance into the SlicerView so it can trigger exports
        if let host = self.hostingController {
            var newView = SlicerView(isPro: false, colabURL: "")
            newView.audioUnit = au
            host.rootView = newView
        }
        
        return au
    }
}
