//go:build !darwin

package server

// pickDirectoryNative 非 macOS 平台暂无原生目录选择,返回 errPickUnsupported。
func pickDirectoryNative(string) (string, error) {
	return "", errPickUnsupported
}
