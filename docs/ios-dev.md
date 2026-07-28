# iOS 版开发与打包(よる for iPhone)

iOS 版 = `apps/ios` 的 SwiftUI 壳(WKWebView)+ gomobile bind 出的 `AsmronerKit.xcframework`
(**同一套 Go 后端在 iPhone 进程内运行**,loopback 随机端口,内嵌 yoru 前端)。
与桌面版同构:桌面是 Wails 壳,这里是一个 ~80 行的 Swift 壳;业务代码零分叉。

> 链接方式说明:gomobile 的 xcframework 二进制实际是 ar 静态库(非 dylib),
> Xcode 把它**静态链接进主二进制**(主二进制 ~28MB 含全部 Go 代码)。
> 因此工程**不做 Embed Frameworks**——嵌入了反而会被 Xcode 当作 codeless framework
> 注入空 stub,且 ar 库会让 zsign/LiveContainer 这类侧载签名工具崩掉。
> 若未来 gomobile 产出真正的 dylib,需要重新打开 Embed 并留意
> `STRIP_BITCODE_FROM_COPIED_FILES=NO`(Apple 二进制工具解析不了 Go 的字符串表)。

## 架构

```
App 启动
  └─ BackendBridge(Swift)
       ├─ MobileStart(dataDir)   ← gomobile 绑定 mobile/(公开包;internal/ 对 gobind 不可见)
       │    ├─ ASMRO_DATA_DIR = <Application Support>/asmroner
       │    ├─ 首启预写 config.toml(下载目录锚进沙盒,默认实现依赖 CWD 在 iOS 不可写)
       │    └─ internal/app:net.Listen("127.0.0.1:0")+ http.Server(与 go run . 同一套)
       └─ WKWebView 加载 http://127.0.0.1:<随机端口>(SPA 来自 go:embed,embed_web tag)
```

- 数据目录:`Application Support/asmroner`(配置/SQLite/日志),下载在 `…/asmroner/downloads`
- 后台播放:`AVAudioSession .playback` + Info.plist `UIBackgroundModes=audio`,锁屏继续出声
- ATS:WKWebView 只走 loopback;上游 asmr.one 请求都在 Go 侧发出,不受 ATS 约束

## 构建

```bash
./scripts/build-ios.sh          # 前端 → embed 快照 → gomobile bind(约 5-15 分钟)
open apps/ios/Asmroner.xcodeproj
```

Xcode 里:Signing & Capabilities → Team 选 **Personal Team**(免费 Apple ID 即可),
连上 iPhone Run。免费证书 7 天有效,到期重新 Run 一次即可。

前端/后端改动后重跑 `scripts/build-ios.sh` 再 Run。

## 导出 .ipa(development 签名)

```bash
./scripts/export-ipa.sh       # 默认用本机证书里的个人团队 ID;也可 ./scripts/export-ipa.sh <TEAM_ID>
# 产出:apps/ios/build/ipa/Asmroner.ipa
```

- 内部流程:xcodebuild archive(`-allowProvisioningUpdates` 自动建描述文件)→ exportArchive(method=development)
- 只能装到该 Apple ID **已注册**的设备:第一次先在 Xcode 里 Run 一次(自动注册设备),之后
  这个 ipa 就能用 Apple Configurator 2 / Xcode Devices 面板直接拖装;7 天到期重跑脚本重装
- 未注册的设备装不上(免费账号限制),TestFlight/任意分发需 99 美元开发者账号

## 依赖与前提

- Xcode 16+(工程为 objectVersion 77 的同步文件夹格式,低版本 Xcode 打不开)
- `gomobile`/`gobind`(脚本会自动 `go install` 到 GOPATH/bin;go.mod 里有
  `tool golang.org/x/mobile/cmd/gobind` 指令,gomobile 需要 x/mobile 在模块图内)
- iPhone 需 ≥ iOS 16(IPHONEOS_DEPLOYMENT_TARGET)

## 侧载安装(免费 Apple ID,3 个名额限制)

- 免费账号**最多同时 3 个侧载 App**(系统硬限制);满了以后新装的 App 图标秒退、
  无任何报错,安装列表里也看不到——这不是应用问题,在 AltStore 里 Deactivate 一个不用的即可
- **LiveContainer 不能用来跑本应用**:其免 JIT 加载器把 28MB 的 Go 二进制映射进宿主进程时
  页面签名校验失败,整个 LiveContainer 被 SIGKILL(无崩溃报告、无日志)。走 AltStore/直装
- 直装命令(连好手机、名额有空时;`.app` 取自 archive 产物):
  `xcrun devicectl device install app --device <id> apps/ios/build/Asmroner.xcarchive/Products/Applications/Asmroner.app`

## 已知限制

- 后台/锁屏:音频播放可持续;**下载任务**只在 App 存活期间推进——iOS 挂起进程即暂停,
  回到前台自动继续(任务落库,不会丢)。需要长时间后台下载时让播放保持进行。
- 锁屏播放控制(上一首/下一首/进度)未接 MPRemoteCommandCenter,锁屏只有系统音量键可用。
- 免费证书签名:7 天过期;一台设备可装的 App 数受免费账号限制。
- `apps/ios/AsmronerKit.xcframework` 是构建产物,不入库(.gitignore 已排除)。
