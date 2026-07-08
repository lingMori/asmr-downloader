package engine

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"asmroner/internal/model"

	"github.com/go-resty/resty/v2"
)

func TestEngineManager_AuthLogin(t *testing.T) {
	t.Skip("requires local config and real credentials")
	cfg, err := model.LoadConfig("/Users/sunrise/CodeGround/GolandProjects/asmroner/.asmroner-data")
	if err != nil {
		t.Errorf("LoadConfig() failed, err: %v", err)
	}
	manager := NewEngineManager(cfg)
	manager.AuthLogin()
	if manager.JWTToken == "" {
		t.Errorf("AuthLogin() failed, JWTToken is empty")
	}
}

func TestCheckAuthStatusUsesCurrentToken(t *testing.T) {
	var gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"works":[]}`))
	}))
	defer server.Close()

	manager := &EngineManager{
		Client:   resty.New(),
		JWTToken: "Bearer test-token",
		ApiUrl:   server.URL,
		headers:  map[string]string{"accept": "application/json"},
	}

	if err := manager.CheckAuthStatus(context.Background()); err != nil {
		t.Fatalf("CheckAuthStatus() error = %v", err)
	}
	if gotAuth != "Bearer test-token" {
		t.Fatalf("expected Authorization header to be forwarded, got %q", gotAuth)
	}
	if manager.AuthState != "success" {
		t.Fatalf("expected auth state success, got %q", manager.AuthState)
	}
}

func TestCheckAuthStatusMarksExpiredToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	manager := &EngineManager{
		Client:   resty.New(),
		JWTToken: "Bearer expired-token",
		ApiUrl:   server.URL,
		headers:  map[string]string{},
	}

	if err := manager.CheckAuthStatus(context.Background()); err == nil {
		t.Fatal("expected CheckAuthStatus() to report expired token")
	}
	if manager.AuthState != "error" {
		t.Fatalf("expected auth state error, got %q", manager.AuthState)
	}
	if !strings.Contains(manager.AuthMessage, "已失效") {
		t.Fatalf("expected expired message, got %q", manager.AuthMessage)
	}
}

func TestSelectHotWorksClampsToAvailableResults(t *testing.T) {
	works := []model.MetadataWork{
		{SourceID: "RJ1"},
		{SourceID: "RJ2"},
	}

	selected, err := selectHotWorks(works, 10)
	if err != nil {
		t.Fatalf("selectHotWorks() error = %v", err)
	}
	if len(selected) != len(works) {
		t.Fatalf("expected %d works, got %d", len(works), len(selected))
	}
}

func TestSelectHotWorksRejectsEmptyResults(t *testing.T) {
	if _, err := selectHotWorks(nil, 10); err == nil {
		t.Fatal("expected empty hot works to be rejected")
	}
}

func TestOpenTrackStreamReturnsContextCanceled(t *testing.T) {
	manager := &EngineManager{
		Client: resty.New(),
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := manager.OpenTrackStream(ctx, "https://media.example/audio.mp3", "")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestOpenTrackStreamForwardsRangeAndUsesIdentityEncoding(t *testing.T) {
	var gotRange string
	var gotAcceptEncoding string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotRange = r.Header.Get("Range")
		gotAcceptEncoding = r.Header.Get("Accept-Encoding")
		w.Header().Set("Content-Type", "audio/mpeg")
		w.Header().Set("Content-Range", "bytes 10-15/16")
		w.WriteHeader(http.StatusPartialContent)
		_, _ = w.Write([]byte("audio"))
	}))
	defer server.Close()

	manager := &EngineManager{
		Client: resty.New(),
		headers: map[string]string{
			"accept-encoding": "gzip",
			"user-agent":      "asmroner-test",
		},
	}

	resp, err := manager.OpenTrackStream(context.Background(), server.URL, "bytes=10-")
	if err != nil {
		t.Fatalf("OpenTrackStream() error = %v", err)
	}
	defer resp.Body.Close()

	if gotRange != "bytes=10-" {
		t.Fatalf("expected range to be forwarded, got %q", gotRange)
	}
	if !strings.EqualFold(gotAcceptEncoding, "identity") {
		t.Fatalf("expected identity encoding for range streaming, got %q", gotAcceptEncoding)
	}
	if resp.StatusCode != http.StatusPartialContent {
		t.Fatalf("expected 206 response, got %d", resp.StatusCode)
	}
}
