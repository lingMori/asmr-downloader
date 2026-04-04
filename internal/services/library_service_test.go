package services

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestLibraryServiceListWorksSupportsFallbackFolders(t *testing.T) {
	baseDir := t.TempDir()
	workDir := filepath.Join(baseDir, "custom RJ01001234 sample")
	if err := os.MkdirAll(workDir, 0755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(filepath.Join(workDir, "track01.mp3"), []byte("a"), 0644); err != nil {
		t.Fatalf("WriteFile(audio) error = %v", err)
	}
	if err := os.WriteFile(filepath.Join(workDir, "track01.vtt"), []byte("b"), 0644); err != nil {
		t.Fatalf("WriteFile(subtitle) error = %v", err)
	}

	service := &LibraryService{baseDir: baseDir}

	result, err := service.ListWorks(context.Background(), 1, 24, "")
	if err != nil {
		t.Fatalf("ListWorks() error = %v", err)
	}
	if len(result.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(result.Items))
	}
	item := result.Items[0]
	if item.MediaID != "RJ01001234" {
		t.Fatalf("expected fallback media id, got %q", item.MediaID)
	}
	if !item.HasSubtitles || item.AudioFileCount != 1 || item.SubtitleCount != 1 {
		t.Fatalf("unexpected fallback summary: %+v", item)
	}
}
