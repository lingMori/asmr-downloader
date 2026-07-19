# App 化路线:从本地网页到手机 / 桌面软件

> 目标:把 ASMRoner 从"本地网页端"演进为可在 iOS / Android / 桌面上以软件形态使用的产品。
> 本文是后续开发的路线规划,按代价从低到高给出四条路线与推荐顺序。

## 现状与可复用资产

当前架构天然接近"软件"形态:

- **后端**:Go 单文件服务,监听 `127.0.0.1:8080`,托管 SPA、代理 asmr.one(检索/元数据/音频流/封面),SQLite 持久化(任务、收藏、播放进度)。无 go:embed,前端按目录解析(`ASMRO_WEB_DIR` → `apps/yoru/dist` → `apps/web/dist` → `./web`)。
- **前端**:`apps/yoru` React SPA,已完成响应式双端适配(移动端底部标签栏、全屏播放器、触达目标 ≥44px),131 个测试。
- **API 契约干净**:`/api/*` 统一包络 + `/media/*` 文件伺服 + `GET /api/events`(SSE),可以直接作为原生客户端的后端。

关键缺口(任何路线都绕不开):

1. **无鉴权**——目前 API 仅靠 CORS 白名单,一旦监听非回环地址就等于裸奔。
2. **默认只听回环**——`ASMRO_HTTP_ADDR`/`--addr` 可改,但局域网使用没有文档化与安全配套。
3. **无 PWA 支持**——没有 manifest / 图标 / service worker。
4. **后台播放缺失**——网页退后台音频即停,移动端必须靠原生能力补。

## 共同前置任务

| 任务 | 说明 | 预估 |
|---|---|---|
| API 鉴权 | config 生成/存储 token;请求经 header(优先)或 query 携带;CORS 白名单同步收紧;`/media/*` 与 SSE 同样覆盖 | ~1 天 |
| 配置外化 | 监听地址、存储目录等改为环境/配置驱动,适配 App 沙盒路径(Android `filesDir`、iOS `Documents`) | ~0.5 天 |
| 后端可嵌入化 | `main.go` 的启动逻辑下沉为可复用包(如 `internal/app`):`Start(addr)/Stop()` 生命周期、不依赖进程信号处理,供 gomobile/Wails 直接调用 | ~0.5 天 |

## 路线 A:PWA + 局域网(成本最低)

后端跑在常开设备(PC / NAS / 小主机),手机浏览器访问后加入主屏幕。

- `--addr :8080` 监听局域网(或 `ASMRO_HTTP_ADDR`)
- 补 `manifest.webmanifest` + 图标 + `theme-color`(与 index.html 现有 meta 对齐);需要完整安装体验时上 HTTPS(Caddy 自签或内网域名证书)
- 移动端 UI 已就绪,无需改动

工作量:0.5-2 天(鉴权是必须项,HTTPS 可选项)。
局限:音频走局域网,出门即断;浏览器退后台播放会停;本质仍是网页。

## 路线 B:App 壳 + 内嵌 Go 后端(推荐方向)

用 gomobile 把现有 Go 后端**原样编译进 App**,壳内 WebView 指向 `127.0.0.1:8080`。前后端逻辑、测试全部零重写;下载落手机存储,断网可听——正好落实"下载为了离线"的语义。

**Android(先行)**:

- `gomobile bind` 产出 AAR;Kotlin 壳 + WebView
- 后台播放:前台服务保活 + MediaSession 桥接(锁屏/耳机控制、通知栏卡片);WebView 音频退后台即停,这一步不可省
- 存储权限与 `filesDir` 路径适配;下载目录即沙盒目录
- 分发:APK 侧载,无审核障碍
- 工作量:约 1-2 周

**iOS(按需)**:

- `gomobile bind` 产出 XCFramework;SwiftUI 壳 + WKWebView,同构
- **App Store 审核基本不可行**(内容源为 DLsite 成人内容)→ 只能 TestFlight / AltStore / 侧载
- iOS 后台音频受限更多(WKWebView 不持有后台音频会话,需原生 AVPlayer 兜底播放代理流,工作量上升)
- 工作量:约 2-3 周

## 路线 C:原生客户端(体验上限最高,代价最大)

后端继续跑在家庭服务器,用 React Native / Flutter 写原生 App,消费现有 HTTP API。播放器、字幕、后台下载、推送全部原生重写,工作量按月计。**仅当路线 B 的 WebView 体验被证明不足时启动**,否则不碰。

## 路线 D:桌面软件(顺带白捡)

macOS / Windows 的软件形态几乎免费:**Wails**(Go + 系统 WebView)与现有架构同构——Go 后端 + 静态 SPA 打包为单 App,附带系统托盘、原生通知、单实例锁。工作量:几天。

## 推荐顺序与里程碑

```
M1  路线 A   PWA + 局域网(手机立即可用,鉴权落地)
M2  路线 D   桌面 Wails 软件(成本低,先拿下"软件"形态)
M3  路线 B   Android 壳(gomobile 管线 + 后台播放)
M4  路线 B   iOS 壳(视 M3 反馈与分发需求决定)
路线 C 暂缓,作为 B 不满足时的备选
```

## 风险与注意

- **后台播放是 WebView 壳的最大技术点**:Android 用前台服务 + MediaSession;iOS 可能需要原生 AVPlayer 播放代理流,评估后再排期。
- **iOS 分发受限**:成人内容源决定了只能侧载/TF,受众面要预期管理。
- **鉴权必须先行**:路线 A/B 都会把 API 暴露给非回环环境,没有 token 不上线。
- 内容合规声明沿用 README「说明」一节,商店页/安装页同样展示。
