//go:build !embed_web

package server

import "io/fs"

// embeddedWebFS 非 embed_web 构建(开发/无头模式)始终返回 nil,走文件系统解析。
func embeddedWebFS() fs.FS {
	return nil
}
