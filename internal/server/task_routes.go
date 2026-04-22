package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"asmroner/internal/model"
	"asmroner/internal/services"
	"asmroner/internal/store"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerTaskRoutes(group *gin.RouterGroup) {
	if s.taskSvc == nil {
		return
	}

	group.GET("/tasks", s.handleTaskList)
	group.GET("/tasks/:id", s.handleTaskGet)
	group.POST("/tasks/:id/cancel", s.handleTaskCancel)
	group.POST("/tasks/:id/retry", s.handleTaskRetry)
	group.DELETE("/tasks/:id", s.handleTaskDelete)
}

func (s *Server) handleTaskList(ctx *gin.Context) {
	filter := store.TaskFilter{
		Source: ctx.Query("source"),
		Search: ctx.Query("search"),
	}

	if page, err := strconv.Atoi(ctx.DefaultQuery("page", "1")); err == nil {
		filter.Page = page
	}
	if size, err := strconv.Atoi(ctx.DefaultQuery("page_size", "20")); err == nil {
		filter.PageSize = size
	}

	if types := ctx.QueryArray("type"); len(types) > 0 {
		for _, t := range types {
			filter.Types = append(filter.Types, model.TaskType(t))
		}
	}
	if statuses := ctx.QueryArray("status"); len(statuses) > 0 {
		for _, st := range statuses {
			filter.Statuses = append(filter.Statuses, model.TaskStatus(st))
		}
	}

	result, err := s.taskSvc.List(ctx.Request.Context(), filter)
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "TASK_LIST_FAILED", err)
		return
	}
	respondOK(ctx, result)
}

func (s *Server) handleTaskGet(ctx *gin.Context) {
	task, err := s.taskFromParam(ctx)
	if err != nil {
		return
	}
	respondOK(ctx, task)
}

func (s *Server) handleTaskRetry(ctx *gin.Context) {
	task, err := s.taskFromParam(ctx)
	if err != nil {
		return
	}
	if task.Status == model.TaskStatusQueued || task.Status == model.TaskStatusRunning {
		respondError(ctx, http.StatusConflict, "TASK_NOT_RETRYABLE", errors.New("running or queued task cannot be retried"))
		return
	}

	var taskID uint
	switch task.Type {
	case model.TaskTypeDownload:
		var req services.DownloadRequest
		if err := json.Unmarshal([]byte(task.Payload), &req); err != nil {
			respondError(ctx, http.StatusBadRequest, "TASK_PAYLOAD_INVALID", err)
			return
		}
		taskID, err = s.downloadSvc.EnqueueDownload(ctx.Request.Context(), req)
	case model.TaskTypeSync:
		var req services.SyncRequest
		if err := json.Unmarshal([]byte(task.Payload), &req); err != nil {
			respondError(ctx, http.StatusBadRequest, "TASK_PAYLOAD_INVALID", err)
			return
		}
		taskID, err = s.syncSvc.EnqueueSyncMetadata(ctx.Request.Context(), req)
	case model.TaskTypeSyncDownload:
		var req services.SyncDownloadRequest
		if err := json.Unmarshal([]byte(task.Payload), &req); err != nil {
			respondError(ctx, http.StatusBadRequest, "TASK_PAYLOAD_INVALID", err)
			return
		}
		taskID, err = s.syncSvc.EnqueueSyncDownload(ctx.Request.Context(), req)
	case model.TaskTypeSyncRetry:
		taskID, err = s.syncSvc.EnqueueSyncRetry(ctx.Request.Context())
	default:
		respondError(ctx, http.StatusBadRequest, "TASK_NOT_RETRYABLE", errors.New("task type does not support retry"))
		return
	}
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "TASK_RETRY_FAILED", err)
		return
	}
	ctx.JSON(http.StatusAccepted, gin.H{"code": "ACCEPTED", "task_id": taskID})
}

func (s *Server) handleTaskCancel(ctx *gin.Context) {
	task, err := s.taskFromParam(ctx)
	if err != nil {
		return
	}
	if task.Status != model.TaskStatusQueued && task.Status != model.TaskStatusRunning {
		respondError(ctx, http.StatusConflict, "TASK_NOT_CANCELABLE", errors.New("only queued or running tasks can be canceled"))
		return
	}

	switch task.Type {
	case model.TaskTypeDownload:
		err = s.downloadSvc.Cancel(task.ID)
	case model.TaskTypeSync, model.TaskTypeSyncDownload, model.TaskTypeSyncRetry:
		err = s.syncSvc.Cancel(task.ID)
	default:
		respondError(ctx, http.StatusBadRequest, "TASK_NOT_CANCELABLE", errors.New("task type does not support cancel"))
		return
	}
	if err != nil {
		respondError(ctx, http.StatusConflict, "TASK_CANCEL_FAILED", err)
		return
	}
	respondOK(ctx, gin.H{"canceled": true})
}

func (s *Server) handleTaskDelete(ctx *gin.Context) {
	task, err := s.taskFromParam(ctx)
	if err != nil {
		return
	}
	if task.Status == model.TaskStatusQueued || task.Status == model.TaskStatusRunning {
		respondError(ctx, http.StatusConflict, "TASK_NOT_DELETABLE", errors.New("running or queued task cannot be deleted"))
		return
	}
	withFiles := ctx.Query("with_files") == "1" || ctx.Query("with_files") == "true"
	filesDeleted := 0
	if withFiles {
		if s.downloadSvc == nil {
			respondError(ctx, http.StatusInternalServerError, "TASK_FILE_CLEANUP_FAILED", errors.New("download service unavailable"))
			return
		}
		filesDeleted, err = s.downloadSvc.DeleteTaskFiles(task)
		if err != nil {
			respondError(ctx, http.StatusBadRequest, "TASK_FILE_CLEANUP_FAILED", err)
			return
		}
	}

	if err := s.taskStore.Delete(ctx.Request.Context(), task.ID); err != nil {
		if err == store.ErrTaskNotFound {
			respondError(ctx, http.StatusNotFound, "TASK_NOT_FOUND", err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, "TASK_DELETE_FAILED", err)
		return
	}
	respondOK(ctx, gin.H{"deleted": true, "filesDeleted": filesDeleted})
}

func (s *Server) taskFromParam(ctx *gin.Context) (*model.Task, error) {
	idParam := ctx.Param("id")
	id64, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		respondError(ctx, http.StatusBadRequest, "INVALID_ID", err)
		return nil, err
	}

	task, err := s.taskSvc.Get(ctx.Request.Context(), uint(id64))
	if err != nil {
		if err == store.ErrTaskNotFound {
			respondError(ctx, http.StatusNotFound, "TASK_NOT_FOUND", err)
			return nil, err
		}
		respondError(ctx, http.StatusInternalServerError, "TASK_FETCH_FAILED", err)
		return nil, err
	}
	return task, nil
}
