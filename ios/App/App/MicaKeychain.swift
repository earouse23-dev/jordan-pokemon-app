import Capacitor
import Foundation
import Security

@objc(MicaKeychain)
public class MicaKeychain: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MicaKeychain"
    public let jsName = "MicaKeychain"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise)
    ]
    private let keys: Set<String> = ["mica.auth", "mica.auth-code-verifier", "mica.auth-user", "mica.auth-return"]

    private func query(_ call: CAPPluginCall) -> [String: Any]? {
        guard let url = bridge?.webView?.url,
              url.scheme == "capacitor", url.host == "localhost",
              let bundle = Bundle.main.bundleIdentifier,
              let key = call.getString("key"), keys.contains(key) else {
            call.reject("Unsupported secure storage request.")
            return nil
        }
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: bundle + ".auth",
            kSecAttrAccount as String: key,
            kSecAttrSynchronizable as String: false
        ]
    }
    private func reject(_ call: CAPPluginCall) {
        // No OSStatus, key, value, token or diagnostic payload is exposed/logged.
        call.reject("Secure session storage is unavailable.")
    }

    @objc public func get(_ call: CAPPluginCall) {
        guard var query = query(call) else { return }
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            call.resolve(["value": NSNull()])
        } else if status == errSecSuccess,
                  let data = result as? Data,
                  data.count <= 128_000,
                  let value = String(data: data, encoding: .utf8) {
            call.resolve(["value": value])
        } else { reject(call) }
    }

    @objc public func set(_ call: CAPPluginCall) {
        guard var query = query(call) else { return }
        guard let value = call.getString("value"),
              let data = value.data(using: .utf8), data.count <= 128_000 else {
            call.reject("Invalid secure storage value.")
            return
        }
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            for (key, value) in attributes { query[key] = value }
            status = SecItemAdd(query as CFDictionary, nil)
        }
        if status == errSecSuccess { call.resolve() }
        else { reject(call) }
    }

    @objc public func remove(_ call: CAPPluginCall) {
        guard let query = query(call) else { return }
        let status = SecItemDelete(query as CFDictionary)
        if status == errSecSuccess || status == errSecItemNotFound { call.resolve() }
        else { reject(call) }
    }
}
