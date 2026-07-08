package server

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

var errMissingSourceID = errors.New("source_id is required")

func (s *Server) registerWorkStatusRoutes(group *gin.RouterGroup) {
	if s.workStatusSvc == nil {
		return
	}
	group.GET("/works/status", s.handleWorkStatus)
}

func (s *Server) handleWorkStatus(ctx *gin.Context) {
	sourceIDs := ctx.QueryArray("source_id")
	if raw := ctx.Query("source_ids"); raw != "" {
		sourceIDs = append(sourceIDs, raw)
	}
	if len(sourceIDs) == 0 {
		respondError(ctx, http.StatusBadRequest, "INVALID_SOURCE_IDS", errMissingSourceID)
		return
	}

	result, err := s.workStatusSvc.Status(ctx.Request.Context(), sourceIDs)
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "WORK_STATUS_FAILED", err)
		return
	}
	respondOK(ctx, result)
}
