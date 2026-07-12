package services

import (
	"context"
	"errors"
	"math"
	"os"
	"path/filepath"
	"testing"
	"time"

	"asmroner/internal/database"
	"asmroner/internal/model"
	"asmroner/internal/store"
)

type cancelRaceDownloadEngine struct {
	started  chan struct{}
	finished chan struct{}
}

func (e *cancelRaceDownloadEngine) SimpleDownload(_ []string, _ string) error {
	return errors.New("unexpected SimpleDownload call")
}

func (e *cancelRaceDownloadEngine) DownloadHot100(_ int, _ string) error {
	return errors.New("unexpected DownloadHot100 call")
}

func (e *cancelRaceDownloadEngine) SimpleDownloadWithContext(ctx context.Context, _ []string, _ string, progress func(int, int, string)) error {
	progress(23, 30, "downloaded 23 of 30 files")
	close(e.started)
	<-ctx.Done()
	close(e.finished)
	return errors.New("Request error,status code: 404")
}

func (e *cancelRaceDownloadEngine) DownloadHot100WithContext(context.Context, int, string, func(int, int, string)) error {
	return errors.New("unexpected DownloadHot100WithContext call")
}

func newDownloadTaskStore(t *testing.T) *store.TaskStore {
	t.Helper()
	db, err := database.NewInMemoryDb()
	if err != nil {
		t.Fatalf("NewInMemoryDb() error = %v", err)
	}
	if err := db.AutoMigrate(&model.Task{}, &model.TaskLog{}); err != nil {
		t.Fatalf("AutoMigrate() error = %v", err)
	}
	return store.NewTaskStore(db)
}

func TestDownloadCancelWinsWhenEngineReturnsErrorAfterCancellation(t *testing.T) {
	taskStore := newDownloadTaskStore(t)
	engine := &cancelRaceDownloadEngine{
		started:  make(chan struct{}),
		finished: make(chan struct{}),
	}
	svc := NewDownloadService(taskStore, engine, nil, nil)
	taskID, err := svc.EnqueueDownload(context.Background(), DownloadRequest{
		Mode:      "single",
		IDs:       []string{"RJ123456"},
		OutputDir: t.TempDir(),
	})
	if err != nil {
		t.Fatalf("EnqueueDownload() error = %v", err)
	}

	select {
	case <-engine.started:
	case <-time.After(2 * time.Second):
		t.Fatal("download did not report progress")
	}
	if err := svc.Cancel(taskID); err != nil {
		t.Fatalf("Cancel() error = %v", err)
	}
	select {
	case <-engine.finished:
	case <-time.After(2 * time.Second):
		t.Fatal("download engine did not observe cancellation")
	}

	deadline := time.Now().Add(2 * time.Second)
	for {
		svc.mu.Lock()
		_, active := svc.active[taskID]
		svc.mu.Unlock()
		if !active {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("download task remained active after engine returned")
		}
		time.Sleep(time.Millisecond)
	}

	task, err := taskStore.Get(context.Background(), taskID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if task.Status != model.TaskStatusCanceled {
		t.Fatalf("expected canceled status after late 404, got %s", task.Status)
	}
	wantProgress := float64(23) / 30
	if math.Abs(task.Progress-wantProgress) > 0.0001 {
		t.Fatalf("expected progress %f to be preserved, got %f", wantProgress, task.Progress)
	}
	if len(task.Logs) != 2 {
		t.Fatalf("expected request and cancellation logs, got %#v", task.Logs)
	}
	if task.Logs[len(task.Logs)-1].Message != "task canceled" {
		t.Fatalf("expected cancellation log, got %#v", task.Logs)
	}
}

func TestDownloadCancelReconcilesRunningTaskMissingFromMemory(t *testing.T) {
	taskStore := newDownloadTaskStore(t)
	task := &model.Task{
		Type:     model.TaskTypeDownload,
		Status:   model.TaskStatusRunning,
		Name:     "stale running task",
		Progress: 0.77,
	}
	if err := taskStore.Create(context.Background(), task); err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	svc := NewDownloadService(taskStore, nil, nil, nil)
	if err := svc.Cancel(task.ID); err != nil {
		t.Fatalf("Cancel() stale task error = %v", err)
	}
	if err := svc.Cancel(task.ID); err != nil {
		t.Fatalf("Cancel() should be idempotent, got %v", err)
	}

	got, err := taskStore.Get(context.Background(), task.ID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got.Status != model.TaskStatusCanceled || math.Abs(got.Progress-0.77) > 0.0001 {
		t.Fatalf("expected stale task canceled at 77%%, got status=%s progress=%f", got.Status, got.Progress)
	}
	if len(got.Logs) != 1 {
		t.Fatalf("expected one idempotent cancellation log, got %#v", got.Logs)
	}
}

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

func TestValidateDownloadRequestAppliesDefaults(t *testing.T) {
	req := DownloadRequest{IDs: []string{"rj123456"}}
	req.IDs = uniqueStrings(req.IDs)
	if err := validateDownloadRequest(&req); err != nil {
		t.Fatalf("validateDownloadRequest() error = %v", err)
	}
	if req.Mode != "batch" {
		t.Fatalf("expected batch mode, got %q", req.Mode)
	}
	if len(req.IDs) != 1 || req.IDs[0] != "RJ123456" {
		t.Fatalf("expected normalized id, got %#v", req.IDs)
	}
}

func TestValidateDownloadRequestDefaultsHot100Count(t *testing.T) {
	req := DownloadRequest{Mode: "hot100"}
	if err := validateDownloadRequest(&req); err != nil {
		t.Fatalf("validateDownloadRequest() error = %v", err)
	}
	if req.Count != 10 {
		t.Fatalf("expected default count 10, got %d", req.Count)
	}
}
