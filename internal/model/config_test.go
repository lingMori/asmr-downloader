package model

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSaveConfigWritesConfigWithoutLeavingTempFile(t *testing.T) {
	t.Chdir(t.TempDir())

	cfg := NewDefaultConfig()
	cfg.User.Account = "tester"
	cfg.User.Password = "secret"
	cfg.Downloader.SyncDataFolder = "./media"

	if err := SaveConfig(cfg); err != nil {
		t.Fatalf("SaveConfig() error = %v", err)
	}
	if _, err := os.Stat(ConfigFilePath()); err != nil {
		t.Fatalf("expected config file to exist: %v", err)
	}
	matches, err := filepath.Glob(".asmroner-data/*.tmp*")
	if err != nil {
		t.Fatalf("glob temp config files: %v", err)
	}
	if len(matches) != 0 {
		t.Fatalf("expected temp config files to be removed, got %#v", matches)
	}

	loaded, err := LoadConfig(".asmroner-data")
	if err != nil {
		t.Fatalf("LoadConfig() error = %v", err)
	}
	if loaded.User.Account != "tester" {
		t.Fatalf("expected saved account tester, got %q", loaded.User.Account)
	}
}
