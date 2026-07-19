package services

import (
	"context"
	"encoding/json"
	"strings"

	"asmroner/internal/model"
	"asmroner/internal/store"

	"gorm.io/gorm"
)

type WorkStatusService struct {
	db          *gorm.DB
	taskStore   *store.TaskStore
	library     *LibraryService
	collections *CollectionService
}

type WorkStatusResponse struct {
	Items []WorkStatus `json:"items"`
}

type WorkStatus struct {
	SourceID  string `json:"source_id"`
	State     string `json:"state"`
	Label     string `json:"label"`
	Message   string `json:"message,omitempty"`
	TaskID    uint   `json:"task_id,omitempty"`
	LibraryID string `json:"library_id,omitempty"`
	// Collected 是否已收藏(收藏即入库),与下载状态state相互独立
	Collected bool `json:"collected"`
}

func NewWorkStatusService(db *gorm.DB, taskStore *store.TaskStore, library *LibraryService, collections *CollectionService) *WorkStatusService {
	return &WorkStatusService{db: db, taskStore: taskStore, library: library, collections: collections}
}

func (s *WorkStatusService) Status(ctx context.Context, sourceIDs []string) (WorkStatusResponse, error) {
	ids := normalizeWorkStatusIDs(sourceIDs)
	items := make([]WorkStatus, 0, len(ids))
	statuses := make(map[string]WorkStatus, len(ids))
	priorities := make(map[string]int, len(ids))

	for _, id := range ids {
		status := WorkStatus{
			SourceID: id,
			State:    "none",
			Label:    "未下载",
		}
		statuses[id] = status
		priorities[id] = 0
	}

	if len(ids) == 0 {
		return WorkStatusResponse{Items: items}, nil
	}

	if s.library != nil {
		works, err := s.library.FindWorksByMediaIDs(ctx, ids)
		if err != nil {
			return WorkStatusResponse{}, err
		}
		for id, work := range works {
			applyWorkStatus(statuses, priorities, id, 100, WorkStatus{
				SourceID:  id,
				State:     "in_library",
				Label:     "已入库",
				Message:   "本地媒体库已有该作品",
				LibraryID: work.ID,
			})
		}
	}

	if s.taskStore != nil {
		tasks, err := s.taskStore.ListDownloadTasksBySourceIDs(ctx, ids)
		if err != nil {
			return WorkStatusResponse{}, err
		}
		wanted := make(map[string]struct{}, len(ids))
		for _, id := range ids {
			wanted[id] = struct{}{}
		}
		for _, task := range tasks {
			var req DownloadRequest
			if err := json.Unmarshal([]byte(task.Payload), &req); err != nil {
				continue
			}
			for _, rawID := range req.IDs {
				id := strings.ToUpper(strings.TrimSpace(rawID))
				if _, ok := wanted[id]; !ok {
					continue
				}
				priority, status := taskWorkStatus(id, task)
				applyWorkStatus(statuses, priorities, id, priority, status)
			}
		}
	}

	if s.db != nil {
		var syncInfos []model.WorkSyncInfo
		if err := s.db.WithContext(ctx).
			Where("upper(source_id) IN ?", ids).
			Find(&syncInfos).Error; err != nil {
			return WorkStatusResponse{}, err
		}
		for _, info := range syncInfos {
			id := strings.ToUpper(strings.TrimSpace(info.SourceId))
			priority, status := syncInfoWorkStatus(id, info)
			applyWorkStatus(statuses, priorities, id, priority, status)
		}
	}

	if s.collections != nil {
		collected, err := s.collections.Collected(ctx, ids)
		if err != nil {
			return WorkStatusResponse{}, err
		}
		for id, ok := range collected {
			status, exists := statuses[id]
			if !exists || !ok {
				continue
			}
			status.Collected = true
			statuses[id] = status
		}
	}

	for _, id := range ids {
		items = append(items, statuses[id])
	}
	return WorkStatusResponse{Items: items}, nil
}

func taskWorkStatus(id string, task model.Task) (int, WorkStatus) {
	status := WorkStatus{
		SourceID: id,
		TaskID:   task.ID,
		Message:  task.Message,
	}
	switch task.Status {
	case model.TaskStatusQueued:
		status.State = "queued"
		status.Label = "已加入队列"
		return 80, status
	case model.TaskStatusRunning:
		status.State = "downloading"
		status.Label = "下载中"
		return 90, status
	case model.TaskStatusSuccess:
		status.State = "downloaded"
		status.Label = "下载完成"
		return 60, status
	case model.TaskStatusFailed:
		status.State = "failed"
		status.Label = "下载失败"
		return 70, status
	case model.TaskStatusCanceled:
		status.State = "canceled"
		status.Label = "已取消"
		return 40, status
	case model.TaskStatusTerminated:
		status.State = "terminated"
		status.Label = "已中断"
		return 50, status
	default:
		status.State = "none"
		status.Label = "未下载"
		return 0, status
	}
}

func syncInfoWorkStatus(id string, info model.WorkSyncInfo) (int, WorkStatus) {
	status := WorkStatus{
		SourceID: id,
		Message:  info.FailReason,
	}
	switch strings.ToUpper(strings.TrimSpace(info.Status)) {
	case "COMPLETED":
		status.State = "downloaded"
		status.Label = "下载完成"
		if status.Message == "" {
			status.Message = "同步下载记录已完成"
		}
		return 60, status
	case "FAILED":
		status.State = "failed"
		status.Label = "下载失败"
		if status.Message == "" {
			status.Message = "同步下载记录失败"
		}
		return 55, status
	case "PENDING":
		status.State = "queued"
		status.Label = "待下载"
		if status.Message == "" {
			status.Message = "同步下载记录待处理"
		}
		return 45, status
	default:
		status.State = "none"
		status.Label = "未下载"
		return 0, status
	}
}

func applyWorkStatus(statuses map[string]WorkStatus, priorities map[string]int, id string, priority int, status WorkStatus) {
	id = strings.ToUpper(strings.TrimSpace(id))
	if id == "" {
		return
	}
	if priority < priorities[id] {
		return
	}
	status.SourceID = id
	statuses[id] = status
	priorities[id] = priority
}

func normalizeWorkStatusIDs(sourceIDs []string) []string {
	seen := make(map[string]struct{}, len(sourceIDs))
	result := make([]string, 0, len(sourceIDs))
	for _, id := range sourceIDs {
		for _, part := range strings.Split(id, ",") {
			part = strings.ToUpper(strings.TrimSpace(part))
			if part == "" {
				continue
			}
			if _, ok := seen[part]; ok {
				continue
			}
			seen[part] = struct{}{}
			result = append(result, part)
		}
	}
	return result
}
