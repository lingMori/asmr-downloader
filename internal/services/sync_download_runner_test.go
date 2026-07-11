package services

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"testing"

	"asmroner/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type failingDownloadEngine struct{}

func (failingDownloadEngine) DownloadOne(string, string) error {
	return errors.New("download failed")
}

func newSyncRunnerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.MetadataWork{}, &model.WorkSyncInfo{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestSyncDownloadRunnerReturnsWhenNothingIsPending(t *testing.T) {
	runner := NewSyncDownloadRunner(newSyncRunnerTestDB(t), failingDownloadEngine{}, model.NewConfigProvider(model.NewDefaultConfig()))
	if err := runner.Run(context.Background(), t.TempDir(), nil); err != nil {
		t.Fatalf("Run() error = %v", err)
	}
}

func TestSyncDownloadRunnerRecordsRetryFailure(t *testing.T) {
	db := newSyncRunnerTestDB(t)
	info := model.WorkSyncInfo{MetadataWorkId: 1, SourceId: "RJ123456", Status: "FAILED", FilePath: filepath.Join(t.TempDir(), "work")}
	if err := db.Create(&info).Error; err != nil {
		t.Fatal(err)
	}
	runner := NewSyncDownloadRunner(db, failingDownloadEngine{}, nil)
	if err := runner.retryOne(context.Background(), info); err == nil {
		t.Fatal("expected retry to fail")
	}
	var saved model.WorkSyncInfo
	if err := db.First(&saved, info.ID).Error; err != nil {
		t.Fatal(err)
	}
	if saved.Status != "FAILED" || saved.RetryCount != 1 || saved.FailReason == "" || saved.FailedAt.IsZero() {
		t.Fatalf("unexpected retry state: %+v", saved)
	}
}

func TestSyncServiceSerializesDownloadRunners(t *testing.T) {
	service := &SyncService{}
	if !service.acquireRunner() {
		t.Fatal("expected first runner acquisition to succeed")
	}
	if service.acquireRunner() {
		t.Fatal("expected second runner acquisition to fail")
	}
	service.releaseRunner()
	if !service.acquireRunner() {
		t.Fatal("expected acquisition after release to succeed")
	}
	service.releaseRunner()
}
