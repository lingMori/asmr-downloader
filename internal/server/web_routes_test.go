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
