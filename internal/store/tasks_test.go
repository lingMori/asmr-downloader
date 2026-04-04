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
