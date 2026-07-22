# 桌面版开发与打包

ASMRoner 桌面版 = `apps/desktop` 的 Wails v3 壳 + 内嵌的完整 Go 后端(loopback 随机端口)+ 内嵌的 yoru 前端。双击即用,无需安装 Go/Node,无独立服务器进程。

## 架构

```
Finder 启动 Asmroner.app
  └─ apps/desktop (Wails v3)
       ├─ internal/app:net.Listen("127.0.0.1:0") + http.Server(与 go run . 同一套服务)
       ├─ WKWebView 窗口加载 http://127.0.0.1:<随机端口>(SPA 来自 go:embed)
       └─ 系统托盘:显示窗口 / 退出;关窗默认隐藏到托盘,播放与下载不中断
```

- 窗口材质:macOS 26 液态玻璃(`NSGlassEffectView`),15+ 自动回退 `NSVisualEffectView` 毛玻璃
- 单实例锁:二次启动聚焦已有窗口
- 数据目录(见 `internal/paths`):
  - .app 内运行 → `~/Library/Application Support/asmroner`(配置/数据库/日志),默认下载目录 `~/Movies/ASMRoner`
  - 无头/开发模式 → 维持 CWD 相对路径(`.asmroner-data`、`./syncdata`),行为不变
  - `ASMRO_DATA_DIR` 环境变量始终最高优先

## 开发

桌面壳改动后的快速验证:

```bash
go run -tags embed_web ./apps/desktop   # 需先 rsync dist 到 internal/server/webui,或直接用无头模式调接口
go run .                                # 无头模式:浏览器开 127.0.0.1:8080,日常前后端开发仍走这条
```

注意:`embed_web` tag 编译的是 `internal/server/webui/` 当时的快照;调前端时用 `npm run dev:yoru` + `go run .`,不要走桌面壳。

## 打包

```bash
./scripts/build-desktop.sh           # 版本号取自 version.go,也可 ./scripts/build-desktop.sh v1.2.0
```

产出:

- `release/Asmroner.app` — 直接拖到「应用程序」
- `release/Asmroner-<version>.dmg` — 分发用

脚本流程:`npm run build:yoru` → rsync dist 到 `internal/server/webui/` → `go build -tags embed_web`(CGO 开启,Wails 需要)→ 组装 .app → ad-hoc 签名 → hdiutil 打 dmg。

## 签名与 Gatekeeper

- 自用:ad-hoc 签名(脚本默认),首次打开右键 →「打开」即可
- 分发给别人:对方同样需要右键 →「打开」;要避免警告需 Apple 开发者证书签名 + 公证(本期不做)

## 已知限制

- 液态玻璃需 macOS 26 + Xcode 26 SDK 构建才完全生效;macOS 15 构建产物为毛玻璃,同一二进制到 26 上仍是毛玻璃(构建期 SDK 决定),后续可在 Tahoe 机器上重新打包获得完整效果
- App/托盘图标由 `scripts/generate-icons.py`(Pillow)程序化生成,源文件 `apps/desktop/build/appicon.png`、`apps/desktop/tray_icon.png`,想换设计改脚本重跑即可
- API 无鉴权:桌面版监听 loopback 随机端口,风险有限;将来支持局域网访问时按 `docs/app-roadmap.md` M1 补鉴权
