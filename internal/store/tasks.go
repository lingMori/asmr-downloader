package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"asmroner/internal/model"

	"gorm.io/gorm"
)

// ErrTaskNotFound indicates the requested task does not exist.
var ErrTaskNotFound = errors.New("task not found")

// TaskStore wraps CRUD helpers for asynchronous tasks.
type TaskStore struct {
	db *gorm.DB
}

// NewTaskStore builds a store backed by the given gorm DB.
func NewTaskStore(db *gorm.DB) *TaskStore {
	return &TaskStore{db: db}
}

// TaskFilter describes filtering options for listing tasks.
type TaskFilter struct {
	Types    []model.TaskType
	Statuses []model.TaskStatus
	Source   string
	Search   string
	Page     int
	PageSize int
}

const defaultTaskPageSize = 20

// Create inserts a new task row and returns the persisted entity.
func (s *TaskStore) Create(ctx context.Context, task *model.Task) error {
	if task == nil {
		return errors.New("task is nil")
	}
	if task.Status == "" {
		task.Status = model.TaskStatusQueued
	}
	if task.Type == "" {
		return errors.New("task type is required")
	}
	return s.db.WithContext(ctx).Create(task).Error
}

// UpdateStatus updates status/progress/message timestamps for a task.
func (s *TaskStore) UpdateStatus(ctx context.Context, id uint, status model.TaskStatus, progress float64, message string) error {
	updates := map[string]interface{}{
		"status":   status,
		"progress": progress,
		"message":  message,
	}

	now := time.Now()
	switch status {
	case model.TaskStatusRunning:
		updates["started_at"] = gorm.Expr("COALESCE(started_at, ?)", now)
	case model.TaskStatusSuccess, model.TaskStatusFailed, model.TaskStatusCanceled, model.TaskStatusTerminated:
		updates["completed_at"] = now
	}

	tx := s.db.WithContext(ctx).Model(&model.Task{}).Where("id = ?", id).Updates(updates)
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return ErrTaskNotFound
	}
	return nil
}

// UpdateResult stores serialized result/log info.
func (s *TaskStore) UpdateResult(ctx context.Context, id uint, result string, logExcerpt string) error {
	tx := s.db.WithContext(ctx).Model(&model.Task{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"result":      result,
			"log_excerpt": logExcerpt,
		})
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return ErrTaskNotFound
	}
	return nil
}

// AppendLog inserts a log entry for the task.
func (s *TaskStore) AppendLog(ctx context.Context, taskID uint, message string) error {
	logEntry := model.TaskLog{
		TaskID:  taskID,
		Message: message,
	}
	return s.db.WithContext(ctx).Create(&logEntry).Error
}

// Get retrieves a single task by ID.
func (s *TaskStore) Get(ctx context.Context, id uint) (*model.Task, error) {
	var task model.Task
	if err := s.db.WithContext(ctx).Preload("Logs").First(&task, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTaskNotFound
		}
		return nil, err
	}
	return &task, nil
}

// Delete removes a task and its logs.
func (s *TaskStore) Delete(ctx context.Context, id uint) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("task_id = ?", id).Delete(&model.TaskLog{}).Error; err != nil {
			return err
		}
		result := tx.Delete(&model.Task{}, id)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrTaskNotFound
		}
		return nil
	})
}

// List returns tasks matching the filter alongside the total count.
func (s *TaskStore) List(ctx context.Context, filter TaskFilter) ([]model.Task, int64, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = defaultTaskPageSize
	}

	query := s.db.WithContext(ctx).Model(&model.Task{})

	if len(filter.Types) > 0 {
		query = query.Where("type IN ?", filter.Types)
	}
	if len(filter.Statuses) > 0 {
		query = query.Where("status IN ?", filter.Statuses)
	}
	if filter.Source != "" {
		query = query.Where("source = ?", filter.Source)
	}
	if filter.Search != "" {
		like := "%" + strings.ToLower(filter.Search) + "%"
		query = query.Where("lower(name) LIKE ? OR lower(message) LIKE ?", like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var tasks []model.Task
	err := query.Order("created_at DESC").
		Limit(filter.PageSize).
		Offset((filter.Page - 1) * filter.PageSize).
		Find(&tasks).Error
	if err != nil {
		return nil, 0, err
	}

	return tasks, total, nil
}
