import Capacitor

class MicaViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MicaKeychain())
    }
}
