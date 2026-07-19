package services

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"asmroner/internal/database"
	"asmroner/internal/model"
	"asmroner/internal/store"
)

func TestWorkStatusServiceStatus(t *testing.T) {
	db, err := database.NewInMemoryDb()
	if err != nil {
		t.Fatalf("NewInMemoryDb() error = %v", err)
	}
	if err := db.AutoMigrate(&model.WorkSyncInfo{}, &model.Task{}, &model.TaskLog{}, &model.Collection{}); err != nil {
		t.Fatalf("AutoMigrate() error = %v", err)
	}

	baseDir := t.TempDir()
	workDir := filepath.Join(baseDir, "RJ123456-20240517-sub-local-work")
	if err := os.MkdirAll(workDir, 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(filepath.Join(workDir, "track.mp3"), []byte("audio"), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	taskStore := store.NewTaskStore(db)
	queuedTask := &model.Task{
		Type:    model.TaskTypeDownload,
		Status:  model.TaskStatusQueued,
		Name:    "queued download",
		Payload: `{"mode":"single","ids":["RJ222222"]}`,
		Message: "waiting",
	}
	if err := taskStore.Create(context.Background(), queuedTask); err != nil {
		t.Fatalf("Create queued task error = %v", err)
	}

	now := time.Now()
	if err := db.Create(&model.WorkSyncInfo{
		SourceId:   "RJ333333",
		Status:     "FAILED",
		FailReason: "network",
		UpdatedAt:  now,
		FailedAt:   now,
	}).Error; err != nil {
		t.Fatalf("Create sync info error = %v", err)
	}

	library := NewLibraryService(nil)
	library.SetBaseDir(baseDir)
	collections := NewCollectionService(db)
	// 收藏与下载状态相互独立:一个已在媒体库,一个仍在队列
	for _, collection := range []model.Collection{
		{SourceID: "RJ123456", Title: "in library and collected"},
		{SourceID: "RJ222222", Title: "queued and collected"},
	} {
		if err := collections.Add(context.Background(), collection); err != nil {
			t.Fatalf("Add collection error = %v", err)
		}
	}
	service := NewWorkStatusService(db, taskStore, library, collections)

	res, err := service.Status(context.Background(), []string{"rj123456", "RJ222222", "RJ333333", "RJ444444"})
	if err != nil {
		t.Fatalf("Status() error = %v", err)
	}

	got := make(map[string]WorkStatus)
	for _, item := range res.Items {
		got[item.SourceID] = item
	}
	if got["RJ123456"].State != "in_library" {
		t.Fatalf("expected RJ123456 in_library, got %+v", got["RJ123456"])
	}
	if got["RJ222222"].State != "queued" || got["RJ222222"].TaskID != queuedTask.ID {
		t.Fatalf("expected RJ222222 queued with task id, got %+v", got["RJ222222"])
	}
	if got["RJ333333"].State != "failed" || got["RJ333333"].Message != "network" {
		t.Fatalf("expected RJ333333 failed from sync info, got %+v", got["RJ333333"])
	}
	if got["RJ444444"].State != "none" {
		t.Fatalf("expected RJ444444 none, got %+v", got["RJ444444"])
	}
	if !got["RJ123456"].Collected || !got["RJ222222"].Collected {
		t.Fatalf("expected RJ123456/RJ222222 collected, got %+v / %+v", got["RJ123456"], got["RJ222222"])
	}
	if got["RJ333333"].Collected || got["RJ444444"].Collected {
		t.Fatalf("expected RJ333333/RJ444444 not collected, got %+v / %+v", got["RJ333333"], got["RJ444444"])
	}
}
