import SwiftUI

@main
struct AsmronerApp: App {
    @StateObject private var backend = BackendBridge()

    var body: some Scene {
        WindowGroup {
            Group {
                if let url = backend.url {
                    WebView(url: url)
                        .ignoresSafeArea()
                } else if let error = backend.error {
                    VStack(spacing: 12) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.largeTitle)
                        Text("本地服务启动失败")
                            .font(.headline)
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                } else {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("よる · 夜间电台")
                            .font(.headline)
                    }
                }
            }
            .onAppear { backend.start() }
        }
    }
}
