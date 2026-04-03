# Current Project Map

## 项目状态

仓库已经完成从旧 CLI / 内嵌 WebUI 到新 HTTP 服务 / React 控制台的收敛。

当前只有一套正式业务入口：

- 后端入口：`main.go`
- 前端入口：`apps/web`

旧的 `cmd/*` Cobra 命令和 `webui/*` 静态页面已经删除。

## 后端结构

- `internal/server`
  - Gin 路由与 HTTP 响应编排
- `internal/services`
  - 业务服务层
  - 包含搜索、下载、同步、配置、媒体库、任务查询
- `internal/store`
  - `tasks` 与 `task_logs` 的 SQLite 存取
- `internal/engine`
  - asmr.one 搜索、作品详情、音轨、下载、同步引擎
- `internal/model`
  - 配置、任务、元数据、同步状态、音轨模型
- `internal/events`
  - SSE 推送中心
- `internal/database`
  - SQLite 初始化与迁移

## 前端结构

- `apps/web/src/routes/screens/Dashboard.tsx`
  - 总览页
- `apps/web/src/routes/screens/Discover.tsx`
  - 搜索、搜索导出、搜索下载、RJ 批量下载、hot100
- `apps/web/src/routes/screens/Queue.tsx`
  - 任务列表与任务详情
- `apps/web/src/routes/screens/Library.tsx`
  - 本地媒体浏览、播放、字幕匹配、文件访问
- `apps/web/src/routes/screens/Sync.tsx`
  - 同步、失败重试、同步导出
- `apps/web/src/routes/screens/Settings.tsx`
  - 配置编辑与保存

## 旧业务映射结果

### 已由新版本覆盖

- `config`
  - 由 `Settings` 页面 + `PUT /api/config` 替代
- `search`
  - 由 `Discover` 页 + `GET /api/search` 替代
- `search download`
  - 由 `POST /api/search/download` + `Discover` 替代
- `search export`
  - 由 `POST /api/search/export` + `Discover` 替代
- `download`
  - 由 `POST /api/downloads` + `Discover` 替代
- `download hot100`
  - 由 `Discover` 中的 Hot100 操作替代
- `sync`
  - 由 `Sync` 页 + `/api/sync*` 路由替代
- `sync export`
  - 由 `GET /api/sync/export` + `Sync` 页替代
- `listen`
  - 由 `Library` 页的浏览、播放、字幕逻辑替代

### 新版本额外能力

- 任务统一入库
- SSE 实时状态推送
- 前端任务详情查看
- 配置默认自动生成
- 动态媒体目录切换

## 运行与验证

后端：

```bash
go run . --addr :8080
go test ./...
```

前端：

```bash
npm run test:web
npm run build:web
```
