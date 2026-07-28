import AVFoundation
import AsmronerKit
import Foundation

/// 启动进程内 Go 后端(gomobile 生成的 MobileStart/MobileStop),
/// 数据目录锚定 Application Support/asmroner;拿到 loopback URL 后交给 WebView。
@MainActor
final class BackendBridge: ObservableObject {
    @Published var url: URL?
    @Published var error: String?

    private var started = false

    func start() {
        guard !started else { return }
        started = true

        // 音频会话:.playback 让 WKWebView 的声音在锁屏/后台继续播放
        // (配合 Info.plist 的 UIBackgroundModes = audio)。
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default)
        try? session.setActive(true)

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            let dataDir = support.appendingPathComponent("asmroner", isDirectory: true)
            // gomobile 生成的是 C 风格接口(NSError**),不会导入成 Swift throws
            var nsError: NSError?
            let endpoint = MobileStart(dataDir.path, &nsError)
            DispatchQueue.main.async {
                if let nsError {
                    self?.error = nsError.localizedDescription
                } else {
                    self?.url = URL(string: endpoint)
                }
            }
        }
    }
}
