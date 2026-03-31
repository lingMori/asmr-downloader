package server

import (
	"net/http"
	"strconv"

	"asmroner/internal/model"
	"asmroner/internal/store"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerTaskRoutes(group *gin.RouterGroup) {
	if s.taskSvc == nil {
		return
	}

	group.GET("/tasks", s.handleTaskList)
	group.GET("/tasks/:id", s.handleTaskGet)
}

func (s *Server) handleTaskList(ctx *gin.Context) {
	filter := store.TaskFilter{
		Source: ctx.Query("source"),
		Search: ctx.Query("search"),
	}

	if page, err := strconv.Atoi(ctx.DefaultQuery("page", "1")); err == nil {
		filter.Page = page
	}
	if size, err := strconv.Atoi(ctx.DefaultQuery("pageSize", "20")); err == nil {
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
	idParam := ctx.Param("id")
	id64, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		respondError(ctx, http.StatusBadRequest, "INVALID_ID", err)
		return
	}

	task, err := s.taskSvc.Get(ctx.Request.Context(), uint(id64))
	if err != nil {
		if err == store.ErrTaskNotFound {
			respondError(ctx, http.StatusNotFound, "TASK_NOT_FOUND", err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, "TASK_FETCH_FAILED", err)
		return
	}
	respondOK(ctx, task)
}
