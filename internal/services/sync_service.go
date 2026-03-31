package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"asmroner/internal/engine"
	"asmroner/internal/events"
	"asmroner/internal/model"
	"asmroner/internal/store"

	"gorm.io/gorm"
)

// SyncService manages metadata sync tasks.
type SyncService struct {
	taskStore *store.TaskStore
	engine    *engine.EngineManager
	runner    *SyncDownloadRunner
	hub       *events.Hub
}

// SyncRequest describes metadata sync options.
type SyncRequest struct {
	Scope string `json:"scope"` // all|subtitle
}

type SyncDownloadRequest struct {
	Folder string `json:"folder"`
}

type SyncReport struct {
	Totals struct {
		Metadata int64 `json:"metadata"`
		Subtitle int64 `json:"subtitle"`
	} `json:"totals"`
	Downloads struct {
		Completed int64 `json:"completed"`
		Failed    int64 `json:"failed"`
		Pending   int64 `json:"pending"`
	} `json:"downloads"`
	Progress struct {
		Overall      float64 `json:"overall"`
		WithSubtitle float64 `json:"withSubtitle"`
	} `json:"progress"`
}

// NewSyncService builds the service.
func NewSyncService(db *gorm.DB, taskStore *store.TaskStore, engine *engine.EngineManager, hub *events.Hub) *SyncService {
	return &SyncService{
		taskStore: taskStore,
		engine:    engine,
		runner:    NewSyncDownloadRunner(db, engine),
		hub:       hub,
	}
}

// EnqueueSyncMetadata queues a metadata sync task.
func (s *SyncService) EnqueueSyncMetadata(ctx context.Context, req SyncRequest) (uint, error) {
	payload, _ := json.Marshal(req)
	task := &model.Task{
		Type:    model.TaskTypeSync,
		Status:  model.TaskStatusQueued,
		Name:    fmt.Sprintf("Sync metadata (%s)", req.Scope),
		Payload: string(payload),
		Source:  "api",
	}
	if err := s.taskStore.Create(ctx, task); err != nil {
		return 0, err
	}
	go s.runSync(task.ID, req)
	return task.ID, nil
}

func (s *SyncService) runSync(taskID uint, req SyncRequest) {
	ctx := context.Background()
	_ = s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusRunning, 0, "sync started")
	s.publish(taskID, model.TaskStatusRunning, "sync started", 0)
	s.appendLog(taskID, fmt.Sprintf("sync scope=%s", req.Scope))

	err := s.engine.SyncMetadata()
	if err != nil {
		_ = s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusFailed, 1, err.Error())
		_ = s.taskStore.UpdateResult(ctx, taskID, "", err.Error())
		s.publish(taskID, model.TaskStatusFailed, err.Error(), 1)
		s.appendLog(taskID, "failed: "+err.Error())
		return
	}
	msg := "metadata sync completed"
	_ = s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusSuccess, 1, msg)
	_ = s.taskStore.UpdateResult(ctx, taskID, fmt.Sprintf("{\"scope\":\"%s\"}", req.Scope), "")
	s.publish(taskID, model.TaskStatusSuccess, msg, 1)
	s.appendLog(taskID, msg)
}

func (s *SyncService) publish(taskID uint, status model.TaskStatus, message string, progress float64) {
	if s.hub == nil {
		return
	}
	s.hub.Publish(events.TaskEvent{
		TaskID:   taskID,
		Status:   status,
		Message:  message,
		Progress: progress,
		Time:     time.Now(),
	})
}

func (s *SyncService) EnqueueSyncDownload(ctx context.Context, req SyncDownloadRequest) (uint, error) {
	payload, _ := json.Marshal(req)
	name := "Sync download"
	task := &model.Task{
		Type:    model.TaskTypeSyncDownload,
		Status:  model.TaskStatusQueued,
		Name:    name,
		Payload: string(payload),
		Source:  "api",
	}
	if err := s.taskStore.Create(ctx, task); err != nil {
		return 0, err
	}
	go s.runSyncDownload(task.ID, req)
	return task.ID, nil
}

func (s *SyncService) runSyncDownload(taskID uint, req SyncDownloadRequest) {
	ctx := context.Background()
	s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusRunning, 0, "sync download started")
	s.publish(taskID, model.TaskStatusRunning, "sync download started", 0)
	s.appendLog(taskID, fmt.Sprintf("sync download folder=%s", req.Folder))
	folder := req.Folder
	if folder == "" {
		folder = model.AppConfig.Downloader.SyncDataFolder
	}
	if err := s.runner.Run(folder); err != nil {
		s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusFailed, 1, err.Error())
		s.taskStore.UpdateResult(ctx, taskID, "", err.Error())
		s.publish(taskID, model.TaskStatusFailed, err.Error(), 1)
		s.appendLog(taskID, "failed: "+err.Error())
		return
	}
	msg := "sync download completed"
	s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusSuccess, 1, msg)
	s.taskStore.UpdateResult(ctx, taskID, fmt.Sprintf("{\"folder\":\"%s\"}", folder), "")
	s.publish(taskID, model.TaskStatusSuccess, msg, 1)
	s.appendLog(taskID, msg)
}

func (s *SyncService) EnqueueSyncRetry(ctx context.Context) (uint, error) {
	task := &model.Task{
		Type:   model.TaskTypeSyncRetry,
		Status: model.TaskStatusQueued,
		Name:   "Sync retry failed downloads",
		Source: "api",
	}
	if err := s.taskStore.Create(ctx, task); err != nil {
		return 0, err
	}
	go s.runSyncRetry(task.ID)
	return task.ID, nil
}

func (s *SyncService) runSyncRetry(taskID uint) {
	ctx := context.Background()
	s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusRunning, 0, "sync retry started")
	s.publish(taskID, model.TaskStatusRunning, "sync retry started", 0)
	s.appendLog(taskID, "sync retry start")
	if err := s.runner.RetryFailed(); err != nil {
		s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusFailed, 1, err.Error())
		s.publish(taskID, model.TaskStatusFailed, err.Error(), 1)
		s.appendLog(taskID, "failed: "+err.Error())
		return
	}
	msg := "sync retry completed"
	s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusSuccess, 1, msg)
	s.publish(taskID, model.TaskStatusSuccess, msg, 1)
	s.appendLog(taskID, msg)
}

func (s *SyncService) appendLog(taskID uint, message string) {
	if s.taskStore == nil {
		return
	}
	_ = s.taskStore.AppendLog(context.Background(), taskID, message)
}

func (s *SyncService) Report(ctx context.Context) (SyncReport, error) {
	var report SyncReport

	type metaStats struct {
		Total        int64
		WithSubtitle int64
	}
	var meta metaStats
	if err := s.runner.DB.WithContext(ctx).
		Table("metadata_works").
		Select("COUNT(*) AS total, COUNT(CASE WHEN has_subtitle THEN 1 END) AS with_subtitle").
		Scan(&meta).Error; err != nil {
		return report, err
	}

	type downloadStats struct {
		Completed int64
		Failed    int64
		Pending   int64
	}
	var downloads downloadStats
	if err := s.runner.DB.WithContext(ctx).
		Table("work_sync_infos").
		Select("COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed, COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed, COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending").
		Scan(&downloads).Error; err != nil {
		return report, err
	}

	report.Totals.Metadata = meta.Total
	report.Totals.Subtitle = meta.WithSubtitle
	report.Downloads.Completed = downloads.Completed
	report.Downloads.Failed = downloads.Failed
	report.Downloads.Pending = downloads.Pending
	if meta.Total > 0 {
		report.Progress.Overall = float64(downloads.Completed) / float64(meta.Total)
		report.Progress.WithSubtitle = float64(meta.WithSubtitle) / float64(meta.Total)
	}
	return report, nil
}
