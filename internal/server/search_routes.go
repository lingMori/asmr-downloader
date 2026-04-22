package server

import (
	"errors"
	"net/http"
	"strconv"

	"asmroner/internal/services"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerSearchRoutes(group *gin.RouterGroup) {
	if s.searchSvc == nil {
		return
	}

	group.GET("/search", s.handleSearchList)
	group.POST("/search/download", s.handleSearchDownload)
	group.POST("/search/export", s.handleSearchExport)
}

func (s *Server) handleSearchList(ctx *gin.Context) {
	count, _ := strconv.Atoi(ctx.DefaultQuery("count", "20"))
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))
	result, err := s.searchSvc.Search(ctx.Request.Context(), services.SearchRequest{
		Query:    ctx.Query("q"),
		Count:    count,
		Page:     page,
		PageSize: pageSize,
		Order:    ctx.DefaultQuery("order", "release"),
		Sort:     ctx.DefaultQuery("sort", "desc"),
		Subtitle: ctx.DefaultQuery("subtitle", "0"),
	})
	if err != nil {
		if errors.Is(err, services.ErrInvalidSearchRequest) {
			respondError(ctx, http.StatusBadRequest, "INVALID_SEARCH_REQUEST", err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, "SEARCH_FAILED", err)
		return
	}
	respondOK(ctx, result)
}

func (s *Server) handleSearchDownload(ctx *gin.Context) {
	var req services.SearchDownloadRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondError(ctx, http.StatusBadRequest, "INVALID_REQUEST", err)
		return
	}

	taskID, err := s.searchSvc.EnqueueDownload(ctx.Request.Context(), req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidSearchRequest) {
			respondError(ctx, http.StatusBadRequest, "INVALID_SEARCH_REQUEST", err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, "SEARCH_DOWNLOAD_ENQUEUE_FAILED", err)
		return
	}
	ctx.JSON(http.StatusAccepted, gin.H{"code": "ACCEPTED", "task_id": taskID})
}

func (s *Server) handleSearchExport(ctx *gin.Context) {
	var req services.SearchExportRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondError(ctx, http.StatusBadRequest, "INVALID_REQUEST", err)
		return
	}

	content, contentType, filename, err := s.searchSvc.Export(ctx.Request.Context(), req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidSearchRequest) {
			respondError(ctx, http.StatusBadRequest, "INVALID_SEARCH_REQUEST", err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, "SEARCH_EXPORT_FAILED", err)
		return
	}

	ctx.Header("Content-Type", contentType)
	ctx.Header("Content-Disposition", "attachment; filename=\""+filename+"\"")
	ctx.Data(http.StatusOK, contentType, content)
}
