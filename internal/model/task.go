package model

import "time"

// TaskType enumerates backend job types.
type TaskType string

const (
	TaskTypeDownload      TaskType = "download"
	TaskTypeSync          TaskType = "sync"
	TaskTypeSyncDownload  TaskType = "sync-download"
	TaskTypeSyncRetry     TaskType = "sync-retry"
	TaskTypeSearchExport  TaskType = "search-export"
	TaskTypeMediaScan     TaskType = "media-scan"
	TaskTypeConfiguration TaskType = "configuration"
)

// TaskStatus represents lifecycle states of a job.
type TaskStatus string

const (
	TaskStatusQueued     TaskStatus = "QUEUED"
	TaskStatusRunning    TaskStatus = "RUNNING"
	TaskStatusSuccess    TaskStatus = "SUCCESS"
	TaskStatusFailed     TaskStatus = "FAILED"
	TaskStatusCanceled   TaskStatus = "CANCELED"
	TaskStatusTerminated TaskStatus = "TERMINATED"
)

// Task captures asynchronous job metadata stored in SQLite.
type Task struct {
	ID uint `gorm:"primaryKey" json:"id"`

	Type   TaskType   `gorm:"type:varchar(64);index" json:"type"`
	Status TaskStatus `gorm:"type:varchar(32);index" json:"status"`

	// Human readable name or label to display in UI.
	Name string `gorm:"type:varchar(255)" json:"name"`

	// Serialized payload/result for auditing or retries (JSON string).
	Payload string `gorm:"type:text" json:"payload"`
	Result  string `gorm:"type:text" json:"result"`

	// Optional tag or source identifier (e.g., CLI, API user).
	Source string `gorm:"type:varchar(64);index" json:"source"`

	Progress   float64 `gorm:"type:real" json:"progress"`
	Message    string  `gorm:"type:text" json:"message"`
	LogExcerpt string  `gorm:"type:text" json:"log_excerpt"`

	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Logs []TaskLog `gorm:"foreignKey:TaskID" json:"logs"`
}

// TaskLog stores textual log entries for a task.
type TaskLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	TaskID    uint      `gorm:"index" json:"task_id"`
	Message   string    `gorm:"type:text" json:"message"`
	CreatedAt time.Time `json:"created_at"`
}
