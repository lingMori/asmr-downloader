package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"asmroner/internal/events"
	"asmroner/internal/model"
	"asmroner/internal/store"

	"gorm.io/gorm"
)

var ErrInvalidSyncExportRequest = errors.New("invalid sync export request")

// SyncService manages metadata sync tasks.
type SyncService struct {
	taskStore *store.TaskStore
	engine    SyncEngine
	runner    *SyncDownloadRunner
	hub       *events.Hub
	mu        sync.Mutex
	active    map[uint]context.CancelFunc
}

type SyncEngine interface {
	SyncMetadata(scope string) error
	DownloadOne(id string, storeBaseDir string) error
}

type SyncProgressEngine interface {
	SyncMetadataWithContext(ctx context.Context, scope string, progress func(done, total int, message string)) error
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
		Metadata        int64 `json:"metadata"`
		Subtitle        int64 `json:"subtitle"`
		WithoutSubtitle int64 `json:"withoutSubtitle"`
	} `json:"totals"`
	Downloads struct {
		Completed int64 `json:"completed"`
		Failed    int64 `json:"failed"`
		Pending   int64 `json:"pending"`
	} `json:"downloads"`
	Progress struct {
		Overall         float64 `json:"overall"`
		WithSubtitle    float64 `json:"withSubtitle"`
		WithoutSubtitle float64 `json:"withoutSubtitle"`
	} `json:"progress"`
}

// NewSyncService builds the service.
func NewSyncService(db *gorm.DB, taskStore *store.TaskStore, engine SyncEngine, hub *events.Hub) *SyncService {
	return &SyncService{
		taskStore: taskStore,
		engine:    engine,
		runner:    NewSyncDownloadRunner(db, engine),
		hub:       hub,
		active:    make(map[uint]context.CancelFunc),
	}
}

func (s *SyncService) SetEngine(engine SyncEngine) {
	s.engine = engine
	if s.runner != nil {
		s.runner.Engine = engine
	}
}

// EnqueueSyncMetadata queues a metadata sync task.
func (s *SyncService) EnqueueSyncMetadata(ctx context.Context, req SyncRequest) (uint, error) {
	req.Scope = strings.ToLower(strings.TrimSpace(req.Scope))
	if req.Scope == "" {
		req.Scope = "all"
	}
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
	runCtx, cancel := context.WithCancel(context.Background())
	s.registerTask(task.ID, cancel)
	go s.runSync(runCtx, task.ID, req)
	return task.ID, nil
}

func (s *SyncService) runSync(ctx context.Context, taskID uint, req SyncRequest) {
	defer s.unregisterTask(taskID)
	if err := ctx.Err(); err != nil {
		s.finishCanceled(taskID, "sync canceled")
		return
	}
	_ = s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusRunning, 0, "sync started")
	s.publish(taskID, model.TaskStatusRunning, "sync started", 0)
	s.appendLog(taskID, fmt.Sprintf("sync scope=%s", req.Scope))

	progressFn := func(done, total int, message string) {
		progress := 0.0
		if total > 0 {
			progress = float64(done) / float64(total)
		}
		_ = s.taskStore.UpdateStatus(context.Background(), taskID, model.TaskStatusRunning, progress, message)
		s.publish(taskID, model.TaskStatusRunning, message, progress)
	}
	var err error
	if progressEngine, ok := s.engine.(SyncProgressEngine); ok {
		err = progressEngine.SyncMetadataWithContext(ctx, req.Scope, progressFn)
	} else {
		err = s.engine.SyncMetadata(req.Scope)
	}
	if err != nil {
		if errors.Is(err, context.Canceled) {
			s.finishCanceled(taskID, "sync canceled")
			return
		}
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
	runCtx, cancel := context.WithCancel(context.Background())
	s.registerTask(task.ID, cancel)
	go s.runSyncDownload(runCtx, task.ID, req)
	return task.ID, nil
}

func (s *SyncService) runSyncDownload(ctx context.Context, taskID uint, req SyncDownloadRequest) {
	defer s.unregisterTask(taskID)
	if err := ctx.Err(); err != nil {
		s.finishCanceled(taskID, "sync download canceled")
		return
	}
	s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusRunning, 0, "sync download started")
	s.publish(taskID, model.TaskStatusRunning, "sync download started", 0)
	s.appendLog(taskID, fmt.Sprintf("sync download folder=%s", req.Folder))
	folder := req.Folder
	if folder == "" {
		folder = model.AppConfig.Downloader.SyncDataFolder
	}
	progressFn := func(done, total int, message string) {
		progress := 0.0
		if total > 0 {
			progress = float64(done) / float64(total)
		}
		_ = s.taskStore.UpdateStatus(context.Background(), taskID, model.TaskStatusRunning, progress, message)
		s.publish(taskID, model.TaskStatusRunning, message, progress)
	}
	if err := s.runner.Run(ctx, folder, progressFn); err != nil {
		if errors.Is(err, context.Canceled) {
			s.finishCanceled(taskID, "sync download canceled")
			return
		}
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
	runCtx, cancel := context.WithCancel(context.Background())
	s.registerTask(task.ID, cancel)
	go s.runSyncRetry(runCtx, task.ID)
	return task.ID, nil
}

func (s *SyncService) runSyncRetry(ctx context.Context, taskID uint) {
	defer s.unregisterTask(taskID)
	if err := ctx.Err(); err != nil {
		s.finishCanceled(taskID, "sync retry canceled")
		return
	}
	s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusRunning, 0, "sync retry started")
	s.publish(taskID, model.TaskStatusRunning, "sync retry started", 0)
	s.appendLog(taskID, "sync retry start")
	progressFn := func(done, total int, message string) {
		progress := 0.0
		if total > 0 {
			progress = float64(done) / float64(total)
		}
		_ = s.taskStore.UpdateStatus(context.Background(), taskID, model.TaskStatusRunning, progress, message)
		s.publish(taskID, model.TaskStatusRunning, message, progress)
	}
	if err := s.runner.RetryFailed(ctx, progressFn); err != nil {
		if errors.Is(err, context.Canceled) {
			s.finishCanceled(taskID, "sync retry canceled")
			return
		}
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

func (s *SyncService) Cancel(taskID uint) error {
	s.mu.Lock()
	cancel, ok := s.active[taskID]
	s.mu.Unlock()
	if !ok {
		return errors.New("task is not running")
	}
	cancel()
	return nil
}

func (s *SyncService) registerTask(taskID uint, cancel context.CancelFunc) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.active[taskID] = cancel
}

func (s *SyncService) unregisterTask(taskID uint) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.active, taskID)
}

func (s *SyncService) finishCanceled(taskID uint, message string) {
	_ = s.taskStore.UpdateStatusKeepProgress(context.Background(), taskID, model.TaskStatusCanceled, message)
	_ = s.taskStore.UpdateResult(context.Background(), taskID, "", message)
	s.publish(taskID, model.TaskStatusCanceled, message, 1)
	s.appendLog(taskID, message)
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
		Completed                int64
		Failed                   int64
		Pending                  int64
		CompletedWithSubtitle    int64
		CompletedWithoutSubtitle int64
	}
	var downloads downloadStats
	if err := s.runner.DB.WithContext(ctx).
		Table("work_sync_infos").
		Joins("LEFT JOIN metadata_works ON work_sync_infos.metadata_work_id = metadata_works.id").
		Select("COUNT(CASE WHEN work_sync_infos.status = 'COMPLETED' THEN 1 END) AS completed, COUNT(CASE WHEN work_sync_infos.status = 'FAILED' THEN 1 END) AS failed, COUNT(CASE WHEN work_sync_infos.status = 'PENDING' THEN 1 END) AS pending, COUNT(CASE WHEN work_sync_infos.status = 'COMPLETED' AND metadata_works.has_subtitle THEN 1 END) AS completed_with_subtitle, COUNT(CASE WHEN work_sync_infos.status = 'COMPLETED' AND NOT metadata_works.has_subtitle THEN 1 END) AS completed_without_subtitle").
		Scan(&downloads).Error; err != nil {
		return report, err
	}

	report.Totals.Metadata = meta.Total
	report.Totals.Subtitle = meta.WithSubtitle
	report.Totals.WithoutSubtitle = meta.Total - meta.WithSubtitle
	report.Downloads.Completed = downloads.Completed
	report.Downloads.Failed = downloads.Failed
	report.Downloads.Pending = downloads.Pending
	if meta.Total > 0 {
		report.Progress.Overall = float64(downloads.Completed) / float64(meta.Total)
		if meta.WithSubtitle > 0 {
			report.Progress.WithSubtitle = float64(downloads.CompletedWithSubtitle) / float64(meta.WithSubtitle)
		}
		if report.Totals.WithoutSubtitle > 0 {
			report.Progress.WithoutSubtitle = float64(downloads.CompletedWithoutSubtitle) / float64(report.Totals.WithoutSubtitle)
		}
	}
	return report, nil
}

func (s *SyncService) Export(ctx context.Context, status string, format string) ([]byte, string, string, error) {
	if s.runner == nil || s.runner.DB == nil {
		return nil, "", "", errors.New("database not initialized")
	}

	normalizedStatus, hasStatusFilter, err := normalizeSyncExportStatus(status)
	if err != nil {
		return nil, "", "", err
	}
	format = strings.ToLower(strings.TrimSpace(format))
	if format == "" {
		format = "csv"
	}

	var syncInfos []model.WorkSyncInfo
	query := s.runner.DB.WithContext(ctx).
		Table("work_sync_infos").
		Order("updated_at DESC")
	if hasStatusFilter {
		query = query.Where("status = ?", normalizedStatus)
	}
	if err := query.Find(&syncInfos).Error; err != nil {
		return nil, "", "", err
	}

	statusLabel := "all"
	if hasStatusFilter {
		statusLabel = strings.ToLower(normalizedStatus)
	}
	filename := fmt.Sprintf("sync_%s.%s", statusLabel, format)
	switch format {
	case "csv":
		content, err := encodeSyncExportCSV(syncInfos)
		return content, "text/csv; charset=utf-8", filename, err
	case "json":
		content, err := json.MarshalIndent(syncInfos, "", "  ")
		return content, "application/json; charset=utf-8", filename, err
	default:
		return nil, "", "", fmt.Errorf("%w: unsupported export format %s", ErrInvalidSyncExportRequest, format)
	}
}

func normalizeSyncExportStatus(status string) (string, bool, error) {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "", "all":
		return "", false, nil
	case "failed":
		return "FAILED", true, nil
	case "success", "completed":
		return "COMPLETED", true, nil
	case "pending":
		return "PENDING", true, nil
	default:
		return "", false, fmt.Errorf("%w: status must be failed, success, pending, or all", ErrInvalidSyncExportRequest)
	}
}

func encodeSyncExportCSV(syncInfos []model.WorkSyncInfo) ([]byte, error) {
	buf := &bytes.Buffer{}
	writer := csv.NewWriter(buf)
	if err := writer.Write([]string{
		"id",
		"metadata_work_id",
		"source_id",
		"dir_size",
		"status",
		"file_path",
		"updated_at",
		"fail_reason",
		"retry_count",
		"failed_at",
		"has_subtitle",
	}); err != nil {
		return nil, err
	}

	for _, info := range syncInfos {
		if err := writer.Write([]string{
			strconv.Itoa(info.ID),
			strconv.Itoa(info.MetadataWorkId),
			info.SourceId,
			strconv.FormatInt(info.DirSize, 10),
			info.Status,
			info.FilePath,
			info.UpdatedAt.Format(time.RFC3339),
			info.FailReason,
			strconv.Itoa(info.RetryCount),
			info.FailedAt.Format(time.RFC3339),
			strconv.FormatBool(info.HasSubtitle),
		}); err != nil {
			return nil, err
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
