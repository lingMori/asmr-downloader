package server

import (
	"errors"
	"net/http"
	"strconv"

	"asmroner/internal/model"
	"asmroner/internal/services"

	"github.com/gin-gonic/gin"
)

var errPlaybackProgressNotFound = errors.New("play progress not found")

func (s *Server) registerPlaybackRoutes(group *gin.RouterGroup) {
	if s.playbackSvc == nil {
		return
	}

	group.PUT("/playback/progress", s.handlePlaybackProgressSave)
	group.GET("/playback/progress/latest", s.handlePlaybackProgressLatest)
	group.GET("/playback/progress/:sourceId", s.handlePlaybackProgressGet)
	group.DELETE("/playback/progress/:sourceId", s.handlePlaybackProgressDelete)
}

func (s *Server) handlePlaybackProgressSave(ctx *gin.Context) {
	var progress model.PlayProgress
	if err := ctx.ShouldBindJSON(&progress); err != nil {
		respondError(ctx, http.StatusBadRequest, "INVALID_PLAYBACK_PROGRESS", err)
		return
	}
	if err := s.playbackSvc.Save(ctx.Request.Context(), progress); err != nil {
		if errors.Is(err, services.ErrInvalidPlaybackRequest) {
			respondError(ctx, http.StatusBadRequest, "INVALID_PLAYBACK_PROGRESS", err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, "PLAYBACK_PROGRESS_SAVE_FAILED", err)
		return
	}
	respondOK(ctx, gin.H{"saved": true})
}

func (s *Server) handlePlaybackProgressLatest(ctx *gin.Context) {
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "1"))

	items, err := s.playbackSvc.Latest(ctx.Request.Context(), limit)
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "PLAYBACK_PROGRESS_QUERY_FAILED", err)
		return
	}
	respondOK(ctx, gin.H{"items": items})
}

func (s *Server) handlePlaybackProgressGet(ctx *gin.Context) {
	item, err := s.playbackSvc.Get(ctx.Request.Context(), ctx.Param("sourceId"))
	if err != nil {
		if errors.Is(err, services.ErrInvalidPlaybackRequest) {
			respondError(ctx, http.StatusBadRequest, "INVALID_SOURCE_ID", err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, "PLAYBACK_PROGRESS_QUERY_FAILED", err)
		return
	}
	if item == nil {
		respondError(ctx, http.StatusNotFound, "PLAYBACK_PROGRESS_NOT_FOUND", errPlaybackProgressNotFound)
		return
	}
	respondOK(ctx, item)
}

func (s *Server) handlePlaybackProgressDelete(ctx *gin.Context) {
	if err := s.playbackSvc.Delete(ctx.Request.Context(), ctx.Param("sourceId")); err != nil {
		if errors.Is(err, services.ErrInvalidPlaybackRequest) {
			respondError(ctx, http.StatusBadRequest, "INVALID_SOURCE_ID", err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, "PLAYBACK_PROGRESS_DELETE_FAILED", err)
		return
	}
	respondOK(ctx, gin.H{"deleted": true})
}
