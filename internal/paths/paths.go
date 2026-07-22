// Package paths 解析应用数据目录的落盘位置。
//
// 解析顺序:ASMRO_DATA_DIR 环境变量 > .app 包内运行(~/Library/Application Support/asmroner)
// > 当前工作目录(保持开发与无头模式的既有行为)。
package paths

import (
	"os"
	"path/filepath"
	"strings"

	"asmroner/internal/consts"
)

// DataDir 返回应用数据目录(配置、数据库、日志)。
func DataDir() string {
	if v := strings.TrimSpace(os.Getenv("ASMRO_DATA_DIR")); v != "" {
		return v
	}
	if IsAppBundle() {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, "Library", "Application Support", "asmroner")
		}
	}
	return consts.MetaDataDir
}

// DefaultDownloadDir 返回首次生成默认配置时的下载目录。
func DefaultDownloadDir() string {
	if IsAppBundle() {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, "Movies", "ASMRoner")
		}
	}
	return "./syncdata"
}

// IsAppBundle 判断当前进程是否运行在 macOS .app 包内。
// Finder 启动时 CWD 为 /,相对路径会写错地方,因此单独锚定。
func IsAppBundle() bool {
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	return strings.Contains(exe, ".app/Contents/MacOS")
}
