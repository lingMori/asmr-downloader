package services

import (
	"context"

	"asmroner/internal/model"
	"asmroner/internal/store"
)

// TaskService exposes application-level task operations for handlers.
type TaskService struct {
	store *store.TaskStore
}

// NewTaskService constructs the service from the given store.
func NewTaskService(store *store.TaskStore) *TaskService {
	return &TaskService{store: store}
}

// TaskListResult contains paginated tasks.
type TaskListResult struct {
	Items []model.Task `json:"items"`
	Total int64        `json:"total"`
	Page  int          `json:"page"`
	Size  int          `json:"size"`
}

// TaskSummaryResult contains aggregate task lifecycle counts.
type TaskSummaryResult struct {
	Total      int64 `json:"total"`
	Queued     int64 `json:"queued"`
	Running    int64 `json:"running"`
	Success    int64 `json:"success"`
	Failed     int64 `json:"failed"`
	Canceled   int64 `json:"canceled"`
	Terminated int64 `json:"terminated"`
}

// List returns tasks using the store filter, normalizing inputs.
func (s *TaskService) List(ctx context.Context, filter store.TaskFilter) (TaskListResult, error) {
	tasks, total, err := s.store.List(ctx, filter)
	if err != nil {
		return TaskListResult{}, err
	}
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 20
	}
	return TaskListResult{
		Items: tasks,
		Total: total,
		Page:  filter.Page,
		Size:  filter.PageSize,
	}, nil
}

// Get returns a single task by ID.
func (s *TaskService) Get(ctx context.Context, id uint) (*model.Task, error) {
	return s.store.Get(ctx, id)
}

// Summary returns aggregate lifecycle counts for the supplied filters.
func (s *TaskService) Summary(ctx context.Context, filter store.TaskFilter) (TaskSummaryResult, error) {
	total, rows, err := s.store.Summary(ctx, filter)
	if err != nil {
		return TaskSummaryResult{}, err
	}

	result := TaskSummaryResult{Total: total}
	for _, row := range rows {
		switch row.Status {
		case model.TaskStatusQueued:
			result.Queued = row.Count
		case model.TaskStatusRunning:
			result.Running = row.Count
		case model.TaskStatusSuccess:
			result.Success = row.Count
		case model.TaskStatusFailed:
			result.Failed = row.Count
		case model.TaskStatusCanceled:
			result.Canceled = row.Count
		case model.TaskStatusTerminated:
			result.Terminated = row.Count
		}
	}
	return result, nil
}
