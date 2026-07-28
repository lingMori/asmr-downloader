# Current Project Map

## 项目状态

仓库已收敛为「Go 单文件后端 + React SPA 前端」的本地电台形态(夜 · YORU)。

正式业务入口：

- 后端入口：`main.go`
- 前端入口：`apps/yoru`(默认);`apps/web` 为旧前端，保留但不再迭代
- 桌面入口：`apps/desktop`(Wails v3 壳,内嵌后端与前端,产出 macOS .app)
- iOS 入口：`apps/ios`(SwiftUI 壳 + WKWebView)+ `mobile`(gomobile 绑定包,
  同一套 Go 后端在 iPhone 进程内运行;`scripts/build-ios.sh` 产出 XCFramework,见 docs/ios-dev.md)

旧的 `cmd/*` Cobra 命令和 `webui/*` 静态页面已经删除。

## 后端结构

- `internal/app`
  - 应用生命周期封装(`Start`/`Stop`),无头入口与桌面壳共用
- `internal/paths`
  - 数据目录锚定：.app 内运行落 `~/Library/Application Support/asmroner`,否则维持 CWD 相对
- `internal/server`
  - Gin 路由、SSE 推送、静态资源与 SPA 托管
  - SPA 解析顺序：`ASMRO_WEB_DIR` → 内嵌 FS(`embed_web` 构建,桌面 App)→ `apps/yoru/dist` → `apps/web/dist` → `./web`
- `internal/services`
  - 业务服务层：搜索/发现、推荐、媒体库、收藏、任务、同步、播放进度、配置
- `internal/engine`
  - asmr.one 上游代理(检索/元数据/音轨)、下载引擎、推荐反馈
- `internal/store`
  - `tasks` 与 `task_logs` 的 SQLite 存取
- `internal/database`
  - SQLite 初始化与迁移
- `internal/events`
  - SSE 推送中心
- `internal/model`
  - 配置、任务、元数据、同步状态、音轨模型

## 前端结构(apps/yoru)

- `src/routes/screens/Discover.tsx`
  - 搜索(关键词/RJ 号/高级语法)、facet 聚合筛选、批量下载、搜索导出
- `src/routes/screens/Online.tsx`
  - 热门与推荐在线曲库,无限滚动,即点即播
- `src/routes/screens/Library.tsx`
  - 本地媒体库与收藏,「继续收听」入口
- `src/routes/screens/WorkDetail.tsx`
  - 作品完整档案 + 文件树(本地与在线并排),点轨即播
- `src/routes/screens/Transfer.tsx`
  - 下载队列、任务详情、同步与失败重试
- `src/routes/screens/Settings.tsx`
  - 配置编辑与保存、外观主题
- `src/player/`
  - 全局播放条/全屏播放器、逐句字幕、播放进度持久化
- `src/shell/AppShell.tsx`
  - 全局壳,响应式双端(移动端底部标签栏)

前端包内约定见 `apps/yoru/AGENTS.md`。

## 接口约定

- `/api/*` 统一 `{code, message, data}` 包络,路由清单见 `docs/server-dev.md`
- `GET /api/events` SSE 实时推送任务进度
- `/media/*` 本地媒体文件伺服;远端音频经 `/api/discover/works/.../stream` 代理(支持 Range);
  非音频叶经 `.../file` 代理;封面经 `.../cover` 代理(同源,供前端 canvas 取色)

## 运行与验证

后端：

```bash
go run .
go test ./...
```

前端：

```bash
npm run dev:yoru      # 开发(127.0.0.1:5173)
npm run test:yoru     # vitest
npm run build:yoru    # 生产构建,之后 go run . 单端口 8080
```

## 历史文档

旧 CLI → Web 迁移时期的规划与审计文档已归档至 `docs/archive/`,仅供查证。
