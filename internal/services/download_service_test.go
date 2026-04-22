package services

import (
	"os"
	"path/filepath"
	"testing"

	"asmroner/internal/model"
)

func TestDeleteTaskFilesRemovesMatchedDownloadFolders(t *testing.T) {
	baseDir := t.TempDir()
	targetDir := filepath.Join(baseDir, "RJ123456-test")
	otherDir := filepath.Join(baseDir, "RJ999999-keep")

	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		t.Fatalf("mkdir target: %v", err)
	}
	if err := os.MkdirAll(otherDir, 0o755); err != nil {
		t.Fatalf("mkdir other: %v", err)
	}

	svc := &DownloadService{}
	task := &model.Task{
		Type: model.TaskTypeDownload,
		Payload: `{
			"mode":"single",
			"ids":["RJ123456"],
			"output_dir":"` + baseDir + `"
		}`,
	}

	removed, err := svc.DeleteTaskFiles(task)
	if err != nil {
		t.Fatalf("DeleteTaskFiles() error = %v", err)
	}
	if removed != 1 {
		t.Fatalf("expected 1 removed folder, got %d", removed)
	}
	if _, err := os.Stat(targetDir); !os.IsNotExist(err) {
		t.Fatalf("expected target dir to be removed, stat err = %v", err)
	}
	if _, err := os.Stat(otherDir); err != nil {
		t.Fatalf("expected other dir to remain, stat err = %v", err)
	}
}

func TestDeleteTaskFilesRejectsHot100(t *testing.T) {
	svc := &DownloadService{}
	task := &model.Task{
		Type:    model.TaskTypeDownload,
		Payload: `{"mode":"hot100","count":10}`,
	}

	if _, err := svc.DeleteTaskFiles(task); err == nil {
		t.Fatal("expected hot100 cleanup to be rejected")
	}
}
