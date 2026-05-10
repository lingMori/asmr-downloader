package store

import (
	"context"
	"testing"

	"asmroner/internal/database"
	"asmroner/internal/model"
)

func TestTaskStoreDeleteRemovesTaskAndLogs(t *testing.T) {
	db, err := database.NewInMemoryDb()
	if err != nil {
		t.Fatalf("NewInMemoryDb() error = %v", err)
	}
	if err := db.AutoMigrate(&model.Task{}, &model.TaskLog{}); err != nil {
		t.Fatalf("AutoMigrate() error = %v", err)
	}

	store := NewTaskStore(db)
	task := &model.Task{
		Type:   model.TaskTypeDownload,
		Status: model.TaskStatusSuccess,
		Name:   "done",
	}
	if err := store.Create(context.Background(), task); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if err := store.AppendLog(context.Background(), task.ID, "completed"); err != nil {
		t.Fatalf("AppendLog() error = %v", err)
	}

	if err := store.Delete(context.Background(), task.ID); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}

	if _, err := store.Get(context.Background(), task.ID); err != ErrTaskNotFound {
		t.Fatalf("expected ErrTaskNotFound after delete, got %v", err)
	}

	var logCount int64
	if err := db.Model(&model.TaskLog{}).Count(&logCount).Error; err != nil {
		t.Fatalf("Count() error = %v", err)
	}
	if logCount != 0 {
		t.Fatalf("expected logs to be deleted, got %d", logCount)
	}
}

func TestTaskStoreTerminateInterruptedMarksActiveTasks(t *testing.T) {
	db, err := database.NewInMemoryDb()
	if err != nil {
		t.Fatalf("NewInMemoryDb() error = %v", err)
	}
	if err := db.AutoMigrate(&model.Task{}, &model.TaskLog{}); err != nil {
		t.Fatalf("AutoMigrate() error = %v", err)
	}

	store := NewTaskStore(db)
	active := []*model.Task{
		{Type: model.TaskTypeDownload, Status: model.TaskStatusQueued, Name: "queued"},
		{Type: model.TaskTypeSync, Status: model.TaskStatusRunning, Name: "running"},
		{Type: model.TaskTypeSyncRetry, Status: model.TaskStatusFailed, Name: "failed"},
	}
	for _, task := range active {
		if err := store.Create(context.Background(), task); err != nil {
			t.Fatalf("Create() error = %v", err)
		}
	}

	count, err := store.TerminateInterrupted(context.Background(), "restart")
	if err != nil {
		t.Fatalf("TerminateInterrupted() error = %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 terminated tasks, got %d", count)
	}

	for _, task := range active[:2] {
		got, err := store.Get(context.Background(), task.ID)
		if err != nil {
			t.Fatalf("Get() error = %v", err)
		}
		if got.Status != model.TaskStatusTerminated {
			t.Fatalf("expected task %d to be terminated, got %s", task.ID, got.Status)
		}
		if got.CompletedAt == nil {
			t.Fatalf("expected task %d completed_at to be set", task.ID)
		}
		if len(got.Logs) != 1 || got.Logs[0].Message != "restart" {
			t.Fatalf("expected restart log for task %d, got %#v", task.ID, got.Logs)
		}
	}

	failed, err := store.Get(context.Background(), active[2].ID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if failed.Status != model.TaskStatusFailed {
		t.Fatalf("expected failed task to stay failed, got %s", failed.Status)
	}
}
