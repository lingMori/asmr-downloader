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
