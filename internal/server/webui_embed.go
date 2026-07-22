//go:build embed_web

package server

import (
	"embed"
	"io/fs"
)

// webuiAssets 由构建脚本在编译前填充(apps/yoru/dist → internal/server/webui)。
//
//go:embed all:webui
var webuiAssets embed.FS

// embeddedWebFS 返回内嵌的前端产物;未填充(无 index.html)时返回 nil。
func embeddedWebFS() fs.FS {
	sub, err := fs.Sub(webuiAssets, "webui")
	if err != nil {
		return nil
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return nil
	}
	return sub
}
