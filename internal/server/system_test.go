package server

import (
	"testing"

	"asmroner/internal/model"
)

func TestValidateConfig(t *testing.T) {
	cfg := *model.NewDefaultConfig()
	if err := validateConfig(cfg); err != nil {
		t.Fatalf("expected default config to be valid, got %v", err)
	}

	cfg.Downloader.PreferMedia = "mp3>mp3"
	if err := validateConfig(cfg); err == nil {
		t.Fatalf("expected duplicate prefer media chain to be rejected")
	}

	cfg = *model.NewDefaultConfig()
	cfg.Limit.DownloadJitterMin = 10
	cfg.Limit.DownloadJitterMax = 5
	if err := validateConfig(cfg); err == nil {
		t.Fatalf("expected invalid jitter range to be rejected")
	}
}
