package services

import (
	"context"
	"strings"
	"testing"
	"time"

	"asmroner/internal/database"
	"asmroner/internal/model"
	"asmroner/internal/store"
)

type fakeSyncEngine struct{}

func (fakeSyncEngine) SyncMetadata() error              { return nil }
func (fakeSyncEngine) DownloadOne(string, string) error { return nil }

func TestSyncServiceReportAndExport(t *testing.T) {
	db, err := database.NewInMemoryDb()
	if err != nil {
		t.Fatalf("NewInMemoryDb() error = %v", err)
	}
	if err := db.AutoMigrate(&model.MetadataWork{}, &model.WorkSyncInfo{}, &model.Task{}, &model.TaskLog{}); err != nil {
		t.Fatalf("AutoMigrate() error = %v", err)
	}

	metadata := []model.MetadataWork{
		{ID: 1, SourceID: "RJ01000001", Title: "Work A", HasSubtitle: true},
		{ID: 2, SourceID: "RJ01000002", Title: "Work B", HasSubtitle: false},
	}
	if err := db.Create(&metadata).Error; err != nil {
		t.Fatalf("Create metadata error = %v", err)
	}

	now := time.Now()
	syncInfos := []model.WorkSyncInfo{
		{
			ID:             1,
			MetadataWorkId: 1,
			SourceId:       "RJ01000001",
			HasSubtitle:    true,
			Status:         "COMPLETED",
			FilePath:       "/tmp/work-a",
			UpdatedAt:      now,
		},
		{
			ID:             2,
			MetadataWorkId: 2,
			SourceId:       "RJ01000002",
			HasSubtitle:    false,
			Status:         "FAILED",
			FilePath:       "/tmp/work-b",
			UpdatedAt:      now,
			FailReason:     "network",
			FailedAt:       now,
		},
	}
	if err := db.Create(&syncInfos).Error; err != nil {
		t.Fatalf("Create sync info error = %v", err)
	}

	service := NewSyncService(db, store.NewTaskStore(db), fakeSyncEngine{}, nil)

	report, err := service.Report(context.Background())
	if err != nil {
		t.Fatalf("Report() error = %v", err)
	}
	if report.Totals.Metadata != 2 || report.Totals.Subtitle != 1 || report.Totals.WithoutSubtitle != 1 {
		t.Fatalf("unexpected totals: %+v", report.Totals)
	}
	if report.Downloads.Completed != 1 || report.Downloads.Failed != 1 {
		t.Fatalf("unexpected download stats: %+v", report.Downloads)
	}
	if report.Progress.Overall != 0.5 {
		t.Fatalf("expected overall progress 0.5, got %v", report.Progress.Overall)
	}
	if report.Progress.WithSubtitle != 1 {
		t.Fatalf("expected subtitle progress 1, got %v", report.Progress.WithSubtitle)
	}
	if report.Progress.WithoutSubtitle != 0 {
		t.Fatalf("expected no-subtitle progress 0, got %v", report.Progress.WithoutSubtitle)
	}

	content, contentType, filename, err := service.Export(context.Background(), "failed", "csv")
	if err != nil {
		t.Fatalf("Export() error = %v", err)
	}
	if contentType != "text/csv; charset=utf-8" {
		t.Fatalf("unexpected content type %q", contentType)
	}
	if !strings.HasSuffix(filename, ".csv") {
		t.Fatalf("expected csv filename, got %q", filename)
	}
	if !strings.Contains(string(content), "network") {
		t.Fatalf("expected csv to contain fail reason, got %q", string(content))
	}
}
