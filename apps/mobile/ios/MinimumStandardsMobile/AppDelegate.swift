import UIKit
import React
import FirebaseCore
import GoogleSignIn

@main
class AppDelegate: UIResponder, UIApplicationDelegate, RCTBridgeDelegate {
  var window: UIWindow?
  private let reactModuleName = "MinimumStandardsMobile"

  // Allows forcing the embedded JS bundle even for Debug builds to eliminate Metro from the equation.
  private var shouldForceEmbeddedBundle: Bool {
    guard let flag = ProcessInfo.processInfo.environment["FORCE_EMBEDDED_JS_BUNDLE"]?.lowercased() else {
      return false
    }
    return flag == "1" || flag == "true"
  }

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Configure Firebase BEFORE bootstrapping the React Native bridge.
    FirebaseApp.configure()

    let bridge = RCTBridge(delegate: self, launchOptions: launchOptions)!
    let rootView = RCTRootView(bridge: bridge, moduleName: reactModuleName, initialProperties: nil)

    if #available(iOS 13.0, *) {
        rootView.backgroundColor = UIColor.systemBackground
    } else {
        rootView.backgroundColor = UIColor.white
    }

    self.window = UIWindow(frame: UIScreen.main.bounds)
    let rootViewController = UIViewController()
    rootViewController.view = rootView
    self.window?.rootViewController = rootViewController
    self.window?.makeKeyAndVisible()

    NSLog("[AppDelegate] didFinishLaunching completed, moduleName: \(reactModuleName) (Paper bridge)")
    return true
  }

  func sourceURL(for bridge: RCTBridge!) -> URL! {
    return bundleURL()
  }

  func bundleURL() -> URL? {
#if DEBUG
    if shouldForceEmbeddedBundle {
      NSLog("[AppDelegate] FORCE_EMBEDDED_JS_BUNDLE enabled - loading embedded bundle")
      return embeddedBundleURL()
    }
    let bundleURLProvider = RCTBundleURLProvider.sharedSettings()
    bundleURLProvider.jsLocation = "192.168.68.57:8082"
    let metroURL = bundleURLProvider.jsBundleURL(forBundleRoot: "index")
    NSLog("[AppDelegate] Using Metro bundle at: \(metroURL?.absoluteString ?? "nil")")
    return metroURL
#else
    NSLog("[AppDelegate] Production build - loading embedded bundle")
    return embeddedBundleURL()
#endif
  }

  private func embeddedBundleURL() -> URL? {
    let url = Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    if let url = url {
      NSLog("[AppDelegate] Found embedded bundle at: \(url.path)")
    } else {
      NSLog("[AppDelegate] ERROR: main.jsbundle not found in app bundle")
    }
    return url
  }

  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if GIDSignIn.sharedInstance.handle(url) {
      NSLog("[AppDelegate] GIDSignIn handled incoming URL: \(url.absoluteString)")
      return true
    }
    return RCTLinkingManager.application(app, open: url, options: options)
  }
}
