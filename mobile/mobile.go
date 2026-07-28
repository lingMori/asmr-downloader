// Package mobile 供 gomobile bind 生成 iOS XCFramework(AsmronerKit):
// 在 iPhone 上进程内启动与桌面/无头完全相同的 Asmroner 后端
// (loopback 随机端口 + embed 前端),Swift 壳用 WKWebView 加载返回的 URL。
//
// gomobile 绑定约束:只导出标量/字符串/error 的顶层函数。
package mobile

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"asmroner/internal/app"
	"asmroner/internal/model"
)

var (
	mu     sync.Mutex
	cur    *app.App
	curURL string
)

// Start 在 dataDir(iOS 沙盒可写目录,由 Swift 侧传 Application Support/asmroner)
// 初始化数据目录并启动后端,返回 WKWebView 应加载的 URL(http://127.0.0.1:<port>)。
// 重复调用直接返回已在运行的实例 URL。
func Start(dataDir string) (string, error) {
	mu.Lock()
	defer mu.Unlock()
	if cur != nil {
		return curURL, nil
	}
	if dataDir == "" {
		return "", errors.New("dataDir is required")
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return "", err
	}
	if err := os.Setenv("ASMRO_DATA_DIR", dataDir); err != nil {
		return "", err
	}

	// 首启:预写默认配置,把下载目录锚进沙盒。
	// 默认实现 paths.DefaultDownloadDir() 依赖 CWD 相对路径,iOS 上 CWD 不可写,
	// 因此先落一份 config.toml,server 启动时直接读取而不再走默认生成。
	if _, err := os.Stat(model.ConfigFilePath()); errors.Is(err, os.ErrNotExist) {
		cfg := model.NewDefaultConfig()
		cfg.Downloader.SyncDataFolder = filepath.Join(dataDir, "downloads")
		if err := model.SaveConfig(cfg); err != nil {
			return "", err
		}
	}

	a, err := app.New(app.Options{Addr: "127.0.0.1:0"})
	if err != nil {
		return "", err
	}
	url, err := a.Start(context.Background())
	if err != nil {
		return "", err
	}
	cur = a
	curURL = url
	return url, nil
}

// Stop 优雅停止后端(进入后台或被终止前调用)。
func Stop() {
	mu.Lock()
	defer mu.Unlock()
	if cur == nil {
		return
	}
	_ = cur.Stop(context.Background())
	cur = nil
	curURL = ""
}
