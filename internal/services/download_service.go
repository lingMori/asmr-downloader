package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"asmroner/internal/events"
	"asmroner/internal/model"
	"asmroner/internal/store"
	"asmroner/internal/utils"
)

type DownloadEngine interface {
	SimpleDownload(ids []string, storeBaseDir string) error
	DownloadHot100(count int, dir string) error
}

type DownloadProgressEngine interface {
	SimpleDownloadWithContext(ctx context.Context, ids []string, storeBaseDir string, progress func(done, total int, message string)) error
	DownloadHot100WithContext(ctx context.Context, count int, dir string, progress func(done, total int, message string)) error
}

// ErrInvalidDownloadRequest indicates an invalid payload.
var ErrInvalidDownloadRequest = errors.New("invalid download request")

// DownloadService coordinates asynchronous download operations.
type DownloadService struct {
	taskStore *store.TaskStore
	engine    DownloadEngine
	hub       *events.Hub
	provider  *model.ConfigProvider
	mu        sync.Mutex
	active    map[uint]context.CancelFunc
}

// DownloadRequest describes API payload for creating download tasks.
type DownloadRequest struct {
	Mode      string   `json:"mode"` // single|batch|hot100
	IDs       []string `json:"ids"`
	Count     int      `json:"count"`
	OutputDir string   `json:"output_dir"`
	Name      string   `json:"name"`
}

// NewDownloadService constructs a service with dependencies.
func NewDownloadService(taskStore *store.TaskStore, engine DownloadEngine, hub *events.Hub, provider *model.ConfigProvider) *DownloadService {
	return &DownloadService{
		taskStore: taskStore,
		engine:    engine,
		hub:       hub,
		provider:  provider,
		active:    make(map[uint]context.CancelFunc),
	}
}

func (s *DownloadService) SetEngine(engine DownloadEngine) {
	s.engine = engine
}

func (s *DownloadService) syncDataFolder() string {
	if s.provider == nil {
		return ""
	}
	return s.provider.Downloader().SyncDataFolder
}

// EnqueueDownload enqueues a download job and returns its task ID.
func (s *DownloadService) EnqueueDownload(ctx context.Context, req DownloadRequest) (uint, error) {
	req.IDs = uniqueStrings(req.IDs)
	if err := validateDownloadRequest(req); err != nil {
		return 0, err
	}

	payloadBytes, _ := json.Marshal(req)
	name := req.Name
	if name == "" {
		switch strings.ToLower(req.Mode) {
		case "hot100":
			name = fmt.Sprintf("Download hot %d", req.Count)
		case "batch":
			name = fmt.Sprintf("Download %d items", len(req.IDs))
		default:
			if len(req.IDs) > 0 {
				name = fmt.Sprintf("Download %s", req.IDs[0])
			} else {
				name = "Download task"
			}
		}
	}

	task := &model.Task{
		Type:    model.TaskTypeDownload,
		Status:  model.TaskStatusQueued,
		Name:    name,
		Payload: string(payloadBytes),
		Source:  "api",
	}
	if err := s.taskStore.Create(ctx, task); err != nil {
		return 0, err
	}

	runCtx, cancel := context.WithCancel(context.Background())
	s.registerTask(task.ID, cancel)
	go s.executeDownload(runCtx, task.ID, req)
	return task.ID, nil
}

func (s *DownloadService) Cancel(taskID uint) error {
	s.mu.Lock()
	cancel, ok := s.active[taskID]
	s.mu.Unlock()
	if !ok {
		return errors.New("task is not running")
	}
	cancel()
	return nil
}

func validateDownloadRequest(req DownloadRequest) error {
	mode := strings.ToLower(req.Mode)
	if mode == "" {
		mode = "batch"
		req.Mode = mode
	}
	switch mode {
	case "single":
		if len(req.IDs) != 1 {
			return fmt.Errorf("%w: single mode requires exactly one id", ErrInvalidDownloadRequest)
		}
	case "batch":
		if len(req.IDs) == 0 {
			return fmt.Errorf("%w: batch mode requires ids", ErrInvalidDownloadRequest)
		}
	case "hot100":
		if req.Count <= 0 {
			req.Count = 10
		}
		if req.Count > 100 {
			return fmt.Errorf("%w: hot100 count must be between 1 and 100", ErrInvalidDownloadRequest)
		}
	default:
		return fmt.Errorf("%w: unknown mode %s", ErrInvalidDownloadRequest, req.Mode)
	}
	return nil
}

func (s *DownloadService) executeDownload(ctx context.Context, taskID uint, req DownloadRequest) {
	defer s.unregisterTask(taskID)
	if err := ctx.Err(); err != nil {
		s.finishCanceled(taskID)
		return
	}
	_ = s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusRunning, 0, "starting download")
	s.publishEvent(taskID, model.TaskStatusRunning, "starting download", 0)
	s.appendLog(taskID, fmt.Sprintf("mode=%s ids=%v count=%d dir=%s", req.Mode, req.IDs, req.Count, req.OutputDir))

	outputDir := req.OutputDir
	if outputDir == "" {
		outputDir = s.syncDataFolder()
	}
	absDir, err := filepath.Abs(outputDir)
	if err != nil {
		absDir = outputDir
	}
	utils.EnSureDirExist(absDir)

	mode := strings.ToLower(req.Mode)
	var runErr error
	progressFn := func(done, total int, message string) {
		progress := 0.0
		if total > 0 {
			progress = float64(done) / float64(total)
		}
		_ = s.taskStore.UpdateStatus(context.Background(), taskID, model.TaskStatusRunning, progress, message)
		s.publishEvent(taskID, model.TaskStatusRunning, message, progress)
	}
	if progressEngine, ok := s.engine.(DownloadProgressEngine); ok {
		switch mode {
		case "single", "batch":
			runErr = progressEngine.SimpleDownloadWithContext(ctx, req.IDs, absDir, progressFn)
		case "hot100":
			runErr = progressEngine.DownloadHot100WithContext(ctx, req.Count, absDir, progressFn)
		default:
			runErr = fmt.Errorf("unsupported mode %s", mode)
		}
	} else {
		switch mode {
		case "single", "batch":
			runErr = s.engine.SimpleDownload(req.IDs, absDir)
		case "hot100":
			runErr = s.engine.DownloadHot100(req.Count, absDir)
		default:
			runErr = fmt.Errorf("unsupported mode %s", mode)
		}
	}

	if runErr != nil {
		if errors.Is(runErr, context.Canceled) {
			s.finishCanceled(taskID)
			s.appendLog(taskID, "canceled")
			return
		}
		_ = s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusFailed, 1, runErr.Error())
		_ = s.taskStore.UpdateResult(ctx, taskID, "", truncateLog(runErr.Error()))
		s.publishEvent(taskID, model.TaskStatusFailed, runErr.Error(), 1)
		s.appendLog(taskID, "failed: "+runErr.Error())
		return
	}

	message := fmt.Sprintf("completed %s", time.Now().Format(time.RFC3339))
	_ = s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusSuccess, 1, message)
	_ = s.taskStore.UpdateResult(ctx, taskID, fmt.Sprintf("{\"output_dir\":\"%s\"}", absDir), "")
	s.publishEvent(taskID, model.TaskStatusSuccess, message, 1)
	s.appendLog(taskID, message)
}

func truncateLog(msg string) string {
	if len(msg) <= 1024 {
		return msg
	}
	return msg[:1024]
}

func (s *DownloadService) publishEvent(taskID uint, status model.TaskStatus, message string, progress float64) {
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

func (s *DownloadService) appendLog(taskID uint, message string) {
	if s.taskStore == nil {
		return
	}
	_ = s.taskStore.AppendLog(context.Background(), taskID, message)
}

func (s *DownloadService) registerTask(taskID uint, cancel context.CancelFunc) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.active[taskID] = cancel
}

func (s *DownloadService) unregisterTask(taskID uint) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.active, taskID)
}

func (s *DownloadService) finishCanceled(taskID uint) {
	message := "task canceled"
	_ = s.taskStore.UpdateStatusKeepProgress(context.Background(), taskID, model.TaskStatusCanceled, message)
	_ = s.taskStore.UpdateResult(context.Background(), taskID, "", message)
	s.publishEvent(taskID, model.TaskStatusCanceled, message, 1)
}

func (s *DownloadService) DeleteTaskFiles(task *model.Task) (int, error) {
	if task == nil {
		return 0, errors.New("task is nil")
	}
	if task.Type != model.TaskTypeDownload {
		return 0, errors.New("task type does not support file cleanup")
	}

	var req DownloadRequest
	if err := json.Unmarshal([]byte(task.Payload), &req); err != nil {
		return 0, fmt.Errorf("invalid task payload: %w", err)
	}

	mode := strings.ToLower(strings.TrimSpace(req.Mode))
	if mode == "" {
		mode = "batch"
	}
	if mode == "hot100" {
		return 0, errors.New("hot100 task file cleanup is not supported")
	}
	if len(req.IDs) == 0 {
		return 0, errors.New("download task has no source ids")
	}

	outputDir := strings.TrimSpace(req.OutputDir)
	if outputDir == "" {
		var result struct {
			OutputDir string `json:"output_dir"`
		}
		if err := json.Unmarshal([]byte(task.Result), &result); err == nil && result.OutputDir != "" {
			outputDir = result.OutputDir
		}
	}
	if outputDir == "" {
		outputDir = s.syncDataFolder()
	}
	if outputDir == "" {
		return 0, errors.New("output directory is empty")
	}

	absDir, err := filepath.Abs(outputDir)
	if err != nil {
		absDir = outputDir
	}

	removed := 0
	for _, id := range uniqueStrings(req.IDs) {
		pattern := filepath.Join(absDir, strings.ToUpper(strings.TrimSpace(id))+"-*")
		matches, err := filepath.Glob(pattern)
		if err != nil {
			return removed, err
		}
		for _, match := range matches {
			if err := os.RemoveAll(match); err != nil {
				return removed, err
			}
			removed++
		}
	}

	return removed, nil
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
