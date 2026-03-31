package server

import (
	"io"
	"net/http"

	"asmroner/internal/services"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerSyncRoutes(group *gin.RouterGroup) {
	if s.syncSvc == nil {
		return
	}
	group.GET("/sync/report", s.handleSyncReport)
	group.POST("/sync", s.handleSyncMetadata)
	group.POST("/sync/download", s.handleSyncDownload)
	group.POST("/sync/retry", s.handleSyncRetry)
}

func (s *Server) handleSyncReport(ctx *gin.Context) {
	report, err := s.syncSvc.Report(ctx.Request.Context())
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "SYNC_REPORT_FAILED", err)
		return
	}
	respondOK(ctx, report)
}

func (s *Server) handleSyncMetadata(ctx *gin.Context) {
	var req services.SyncRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondError(ctx, http.StatusBadRequest, "INVALID_REQUEST", err)
		return
	}
	if req.Scope == "" {
		req.Scope = "all"
	}
	taskID, err := s.syncSvc.EnqueueSyncMetadata(ctx.Request.Context(), req)
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "SYNC_ENQUEUE_FAILED", err)
		return
	}
	ctx.JSON(http.StatusAccepted, gin.H{"code": "ACCEPTED", "taskId": taskID})
}

func (s *Server) handleSyncDownload(ctx *gin.Context) {
	var req services.SyncDownloadRequest
	if err := ctx.ShouldBindJSON(&req); err != nil && err != io.EOF {
		respondError(ctx, http.StatusBadRequest, "INVALID_REQUEST", err)
		return
	}
	taskID, err := s.syncSvc.EnqueueSyncDownload(ctx.Request.Context(), req)
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "SYNC_DOWNLOAD_ENQUEUE_FAILED", err)
		return
	}
	ctx.JSON(http.StatusAccepted, gin.H{"code": "ACCEPTED", "taskId": taskID})
}

func (s *Server) handleSyncRetry(ctx *gin.Context) {
	taskID, err := s.syncSvc.EnqueueSyncRetry(ctx.Request.Context())
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "SYNC_RETRY_ENQUEUE_FAILED", err)
		return
	}
	ctx.JSON(http.StatusAccepted, gin.H{"code": "ACCEPTED", "taskId": taskID})
}
