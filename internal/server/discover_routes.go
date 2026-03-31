package server

import (
	"errors"
	"net/http"
	"strconv"

	"asmroner/internal/services"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerDiscoverRoutes(group *gin.RouterGroup) {
	if s.discoverSvc == nil {
		return
	}

	group.GET("/discover/search", s.handleDiscoverSearch)
	group.GET("/discover/works/:sourceId", s.handleDiscoverWorkDetail)
}

func (s *Server) handleDiscoverSearch(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("pageSize", "24"))

	result, err := s.discoverSvc.Search(ctx.Request.Context(), services.DiscoverSearchRequest{
		Query:    ctx.Query("q"),
		Tag:      ctx.Query("tag"),
		Circle:   ctx.Query("circle"),
		Va:       ctx.Query("va"),
		Subtitle: ctx.DefaultQuery("subtitle", "0"),
		Order:    ctx.DefaultQuery("order", "dl_count"),
		Sort:     ctx.DefaultQuery("sort", "desc"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		if errors.Is(err, services.ErrInvalidDiscoverRequest) {
			respondError(ctx, http.StatusBadRequest, "INVALID_DISCOVER_REQUEST", err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, "DISCOVER_SEARCH_FAILED", err)
		return
	}
	respondOK(ctx, result)
}

func (s *Server) handleDiscoverWorkDetail(ctx *gin.Context) {
	result, err := s.discoverSvc.GetWorkDetail(ctx.Request.Context(), ctx.Param("sourceId"))
	if err != nil {
		if errors.Is(err, services.ErrInvalidDiscoverRequest) {
			respondError(ctx, http.StatusBadRequest, "INVALID_SOURCE_ID", err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, "DISCOVER_WORK_FAILED", err)
		return
	}
	respondOK(ctx, result)
}
