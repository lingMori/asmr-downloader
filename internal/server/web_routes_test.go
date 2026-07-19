package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestWebRoutesServeAssetsAndSPAFallback(t *testing.T) {
	webDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(webDir, "index.html"), []byte("<html>console</html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(webDir, "app.js"), []byte("console.log('ok')"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("ASMRO_WEB_DIR", webDir)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	server := &Server{engine: router}
	server.registerWebRoutes()

	for _, path := range []string{"/", "/settings", "/app.js"} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusOK {
			t.Fatalf("GET %s status = %d", path, response.Code)
		}
	}

	for _, path := range []string{"/api/missing", "/missing.js"} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusNotFound {
			t.Fatalf("GET %s status = %d", path, response.Code)
		}
		if strings.Contains(response.Body.String(), "console") {
			t.Fatalf("GET %s unexpectedly returned the SPA", path)
		}
	}
}

func TestResolveWebDirPrefersYoruOverLegacyWeb(t *testing.T) {
	tmp := t.TempDir()
	for _, dir := range []string{filepath.Join("apps", "yoru", "dist"), filepath.Join("apps", "web", "dist")} {
		full := filepath.Join(tmp, dir)
		if err := os.MkdirAll(full, 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(full, "index.html"), []byte("<html></html>"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("ASMRO_WEB_DIR", "")
	t.Chdir(tmp)

	got := resolveWebDir()
	want, err := filepath.Abs(filepath.Join(tmp, "apps", "yoru", "dist"))
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("resolveWebDir() = %q, want %q", got, want)
	}

	// yoru dist 缺失时回退旧包 apps/web/dist
	if err := os.RemoveAll(filepath.Join(tmp, "apps", "yoru")); err != nil {
		t.Fatal(err)
	}
	wantLegacy, err := filepath.Abs(filepath.Join(tmp, "apps", "web", "dist"))
	if err != nil {
		t.Fatal(err)
	}
	if got := resolveWebDir(); got != wantLegacy {
		t.Fatalf("resolveWebDir() after removing yoru = %q, want %q", got, wantLegacy)
	}
}
