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

func TestTaskStoreListDownloadTasksBySourceIDs(t *testing.T) {
	db, err := database.NewInMemoryDb()
	if err != nil {
		t.Fatalf("NewInMemoryDb() error = %v", err)
	}
	if err := db.AutoMigrate(&model.Task{}, &model.TaskLog{}); err != nil {
		t.Fatalf("AutoMigrate() error = %v", err)
	}

	store := NewTaskStore(db)
	tasks := []*model.Task{
		{
			Type:    model.TaskTypeDownload,
			Status:  model.TaskStatusQueued,
			Name:    "download target",
			Payload: `{"mode":"single","ids":["RJ123456"]}`,
		},
		{
			Type:    model.TaskTypeDownload,
			Status:  model.TaskStatusQueued,
			Name:    "download other",
			Payload: `{"mode":"single","ids":["RJ999999"]}`,
		},
		{
			Type:    model.TaskTypeSync,
			Status:  model.TaskStatusQueued,
			Name:    "sync mention",
			Payload: `{"ids":["RJ123456"]}`,
		},
	}
	for _, task := range tasks {
		if err := store.Create(context.Background(), task); err != nil {
			t.Fatalf("Create() error = %v", err)
		}
	}

	got, err := store.ListDownloadTasksBySourceIDs(context.Background(), []string{"rj123456"})
	if err != nil {
		t.Fatalf("ListDownloadTasksBySourceIDs() error = %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 matching download task, got %d", len(got))
	}
	if got[0].ID != tasks[0].ID {
		t.Fatalf("expected task %d, got %d", tasks[0].ID, got[0].ID)
	}
}

func TestTaskStoreSummaryUsesListFilters(t *testing.T) {
	db, err := database.NewInMemoryDb()
	if err != nil {
		t.Fatalf("NewInMemoryDb() error = %v", err)
	}
	if err := db.AutoMigrate(&model.Task{}, &model.TaskLog{}); err != nil {
		t.Fatalf("AutoMigrate() error = %v", err)
	}

	taskStore := NewTaskStore(db)
	for _, task := range []*model.Task{
		{Type: model.TaskTypeDownload, Status: model.TaskStatusRunning, Name: "download alpha"},
		{Type: model.TaskTypeDownload, Status: model.TaskStatusFailed, Name: "download beta"},
		{Type: model.TaskTypeSync, Status: model.TaskStatusRunning, Name: "sync alpha"},
	} {
		if err := taskStore.Create(context.Background(), task); err != nil {
			t.Fatalf("Create() error = %v", err)
		}
	}

	total, rows, err := taskStore.Summary(context.Background(), TaskFilter{
		Types:  []model.TaskType{model.TaskTypeDownload},
		Search: "download",
	})
	if err != nil {
		t.Fatalf("Summary() error = %v", err)
	}
	if total != 2 {
		t.Fatalf("expected total 2, got %d", total)
	}

	counts := map[model.TaskStatus]int64{}
	for _, row := range rows {
		counts[row.Status] = row.Count
	}
	if counts[model.TaskStatusRunning] != 1 || counts[model.TaskStatusFailed] != 1 {
		t.Fatalf("unexpected counts: %#v", counts)
	}
}
