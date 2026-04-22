package server

import (
	"errors"
	"net/http"

	"asmroner/internal/services"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerDownloadRoutes(group *gin.RouterGroup) {
	if s.downloadSvc == nil {
		return
	}
	group.POST("/downloads", s.handleDownloadCreate)
}

func (s *Server) handleDownloadCreate(ctx *gin.Context) {
	var req services.DownloadRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondError(ctx, http.StatusBadRequest, "INVALID_REQUEST", err)
		return
	}

	taskID, err := s.downloadSvc.EnqueueDownload(ctx.Request.Context(), req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidDownloadRequest) {
			respondError(ctx, http.StatusBadRequest, "INVALID_REQUEST", err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, "DOWNLOAD_ENQUEUE_FAILED", err)
		return
	}
	ctx.JSON(http.StatusAccepted, gin.H{
		"code":   "ACCEPTED",
		"task_id": taskID,
	})
}
