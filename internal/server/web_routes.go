package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerWebRoutes() {
	webDir := resolveWebDir()
	if webDir == "" {
		return
	}

	s.engine.NoRoute(func(ctx *gin.Context) {
		if ctx.Request.Method != http.MethodGet && ctx.Request.Method != http.MethodHead {
			ctx.Status(http.StatusNotFound)
			return
		}
		if strings.HasPrefix(ctx.Request.URL.Path, "/api/") || strings.HasPrefix(ctx.Request.URL.Path, "/media/") {
			ctx.Status(http.StatusNotFound)
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
	})
}

func resolveWebDir() string {
	candidates := []string{os.Getenv("ASMRO_WEB_DIR"), filepath.Join("apps", "web", "dist"), "web"}
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
