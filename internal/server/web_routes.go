package server

import (
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerWebRoutes() {
	// embed_web 构建(桌面 App)优先使用内嵌产物;ASMRO_WEB_DIR 仍可覆盖,便于调试
	if os.Getenv("ASMRO_WEB_DIR") == "" {
		if webFS := embeddedWebFS(); webFS != nil {
			s.engine.NoRoute(spaFSHandler(webFS))
			return
		}
	}

	webDir := resolveWebDir()
	if webDir == "" {
		return
	}

	s.engine.NoRoute(spaDirHandler(webDir))
}

// spaDirHandler 从文件系统目录伺服 SPA,未命中路径回退 index.html。
func spaDirHandler(webDir string) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if !isSPARequest(ctx) {
			return
		}
		cleanPath := filepath.Clean(strings.TrimPrefix(ctx.Request.URL.Path, "/"))
		if cleanPath != "." && cleanPath != "" && !strings.HasPrefix(cleanPath, "..") {
			candidate := filepath.Join(webDir, cleanPath)
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				ctx.File(candidate)
				return
			}
			if filepath.Ext(cleanPath) != "" {
				ctx.Status(http.StatusNotFound)
				return
			}
		}
		ctx.File(filepath.Join(webDir, "index.html"))
	}
}

// spaFSHandler 从内嵌 fs.FS 伺服 SPA,未命中路径回退 index.html。
func spaFSHandler(fsys fs.FS) gin.HandlerFunc {
	fileSrv := http.FileServer(http.FS(fsys))
	return func(ctx *gin.Context) {
		if !isSPARequest(ctx) {
			return
		}
		cleanPath := path.Clean(strings.TrimPrefix(ctx.Request.URL.Path, "/"))
		if cleanPath != "." && cleanPath != "" && !strings.HasPrefix(cleanPath, "..") {
			if info, err := fs.Stat(fsys, cleanPath); err == nil && !info.IsDir() {
				fileSrv.ServeHTTP(ctx.Writer, ctx.Request)
				return
			}
			if path.Ext(cleanPath) != "" {
				ctx.Status(http.StatusNotFound)
				return
			}
		}
		index, err := fs.ReadFile(fsys, "index.html")
		if err != nil {
			ctx.Status(http.StatusNotFound)
			return
		}
		ctx.Data(http.StatusOK, "text/html; charset=utf-8", index)
	}
}

// isSPARequest 过滤非 GET 请求与 /api、/media 前缀,命中时直接 404。
func isSPARequest(ctx *gin.Context) bool {
	if ctx.Request.Method != http.MethodGet && ctx.Request.Method != http.MethodHead {
		ctx.Status(http.StatusNotFound)
		return false
	}
	if strings.HasPrefix(ctx.Request.URL.Path, "/api/") || strings.HasPrefix(ctx.Request.URL.Path, "/media/") {
		ctx.Status(http.StatusNotFound)
		return false
	}
	return true
}

func resolveWebDir() string {
	// 解析顺序:ASMRO_WEB_DIR 环境变量 > 新前端 apps/yoru/dist > 旧前端 apps/web/dist > ./web > 可执行文件旁 web
	candidates := []string{os.Getenv("ASMRO_WEB_DIR"), filepath.Join("apps", "yoru", "dist"), filepath.Join("apps", "web", "dist"), "web"}
	if executable, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(executable), "web"))
	}
	for _, candidate := range candidates {
		if strings.TrimSpace(candidate) == "" {
			continue
		}
		abs, err := filepath.Abs(candidate)
		if err != nil {
			continue
		}
		if info, err := os.Stat(filepath.Join(abs, "index.html")); err == nil && !info.IsDir() {
			return abs
		}
	}
	return ""
}
