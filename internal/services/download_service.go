package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
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

// ErrInvalidDownloadRequest indicates an invalid payload.
var ErrInvalidDownloadRequest = errors.New("invalid download request")

// DownloadService coordinates asynchronous download operations.
type DownloadService struct {
	taskStore *store.TaskStore
	engine    DownloadEngine
	hub       *events.Hub
}

// DownloadRequest describes API payload for creating download tasks.
type DownloadRequest struct {
	Mode      string   `json:"mode"` // single|batch|hot100
	IDs       []string `json:"ids"`
	Count     int      `json:"count"`
	OutputDir string   `json:"outputDir"`
	Name      string   `json:"name"`
}

// NewDownloadService constructs a service with dependencies.
func NewDownloadService(taskStore *store.TaskStore, engine DownloadEngine, hub *events.Hub) *DownloadService {
	return &DownloadService{
		taskStore: taskStore,
		engine:    engine,
		hub:       hub,
	}
}

func (s *DownloadService) SetEngine(engine DownloadEngine) {
	s.engine = engine
}

// EnqueueDownload enqueues a download job and returns its task ID.
func (s *DownloadService) EnqueueDownload(ctx context.Context, req DownloadRequest) (uint, error) {
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

	go s.executeDownload(task.ID, req)
	return task.ID, nil
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
	default:
		return fmt.Errorf("%w: unknown mode %s", ErrInvalidDownloadRequest, req.Mode)
	}
	return nil
}

func (s *DownloadService) executeDownload(taskID uint, req DownloadRequest) {
	ctx := context.Background()
	_ = s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusRunning, 0, "starting download")
	s.publishEvent(taskID, model.TaskStatusRunning, "starting download", 0)
	s.appendLog(taskID, fmt.Sprintf("mode=%s ids=%v count=%d dir=%s", req.Mode, req.IDs, req.Count, req.OutputDir))

	outputDir := req.OutputDir
	if outputDir == "" {
		outputDir = model.AppConfig.Downloader.SyncDataFolder
	}
	absDir, err := filepath.Abs(outputDir)
	if err != nil {
		absDir = outputDir
	}
	utils.EnSureDirExist(absDir)

	mode := strings.ToLower(req.Mode)
	var runErr error
	switch mode {
	case "single", "batch":
		runErr = s.engine.SimpleDownload(req.IDs, absDir)
	case "hot100":
		runErr = s.engine.DownloadHot100(req.Count, absDir)
	default:
		runErr = fmt.Errorf("unsupported mode %s", mode)
	}

	if runErr != nil {
		_ = s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusFailed, 1, runErr.Error())
		_ = s.taskStore.UpdateResult(ctx, taskID, "", truncateLog(runErr.Error()))
		s.publishEvent(taskID, model.TaskStatusFailed, runErr.Error(), 1)
		s.appendLog(taskID, "failed: "+runErr.Error())
		return
	}

	message := fmt.Sprintf("completed %s", time.Now().Format(time.RFC3339))
	_ = s.taskStore.UpdateStatus(ctx, taskID, model.TaskStatusSuccess, 1, message)
	_ = s.taskStore.UpdateResult(ctx, taskID, fmt.Sprintf("{\"outputDir\":\"%s\"}", absDir), "")
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
