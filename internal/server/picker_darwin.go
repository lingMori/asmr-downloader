//go:build darwin

package server

import (
	"os/exec"
	"strings"
)

// pickDirectoryNative 打开 macOS 原生目录选择对话框,返回所选路径(无尾斜杠)。
// 用户取消时返回 errPickCancelled。
func pickDirectoryNative(prompt string) (string, error) {
	script := `POSIX path of (choose folder with prompt "` + prompt + `")`
	out, err := exec.Command("osascript", "-e", script).Output()
	if err != nil {
		return "", errPickCancelled
	}
	return strings.TrimRight(strings.TrimSpace(string(out)), "/"), nil
}
