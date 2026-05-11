package server

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"asmroner/internal/logger"
	"asmroner/internal/services"

	"github.com/gin-gonic/gin"
)

const statusClientClosedRequest = 499

func (s *Server) registerDiscoverRoutes(group *gin.RouterGroup) {
	if s.discoverSvc == nil {
		return
	}

	group.GET("/discover/search", s.handleDiscoverSearch)
	group.GET("/discover/works/:sourceId/tracks/:trackId/stream", s.handleDiscoverTrackStream)
	group.GET("/discover/works/:sourceId", s.handleDiscoverWorkDetail)
}

func (s *Server) handleDiscoverSearch(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "24"))

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

func (s *Server) handleDiscoverTrackStream(ctx *gin.Context) {
	stream, err := s.discoverSvc.OpenTrackStream(
		ctx.Request.Context(),
		ctx.Param("sourceId"),
		ctx.Param("trackId"),
		ctx.GetHeader("Range"),
	)
	if err != nil {
		if isClientCanceledError(err) {
			logger.Logger().Info("discover stream canceled",
				slog.String("source_id", ctx.Param("sourceId")),
				slog.String("track_id", ctx.Param("trackId")),
				slog.String("range", ctx.GetHeader("Range")),
			)
			ctx.AbortWithStatus(statusClientClosedRequest)
			return
		}
		logger.Logger().Warn("discover stream rejected",
			slog.String("source_id", ctx.Param("sourceId")),
			slog.String("track_id", ctx.Param("trackId")),
			slog.String("range", ctx.GetHeader("Range")),
			slog.String("error", err.Error()),
		)
		switch {
		case errors.Is(err, services.ErrInvalidDiscoverRequest):
			respondError(ctx, http.StatusBadRequest, "INVALID_SOURCE_ID", err)
		case errors.Is(err, services.ErrDiscoverTrackNotFound):
			respondError(ctx, http.StatusNotFound, "DISCOVER_TRACK_NOT_FOUND", err)
		case errors.Is(err, services.ErrDiscoverTrackNotPlayable):
			respondError(ctx, http.StatusBadRequest, "DISCOVER_TRACK_NOT_PLAYABLE", err)
		default:
			respondError(ctx, http.StatusBadGateway, "DISCOVER_STREAM_FAILED", err)
		}
		return
	}
	defer stream.Response.Body.Close()

	copyStreamHeaders(ctx, stream.Response.Header)
	ensureStreamContentType(ctx, stream.Track.Title)
	logger.Logger().Info("discover stream proxy",
		slog.String("source_id", ctx.Param("sourceId")),
		slog.String("track_id", ctx.Param("trackId")),
		slog.String("track_title", stream.Track.Title),
		slog.String("track_type", stream.Track.Type),
		slog.String("track_hash", stream.Track.Hash),
		slog.String("range", ctx.GetHeader("Range")),
		slog.Int("upstream_status", stream.Response.StatusCode),
		slog.String("content_type", ctx.Writer.Header().Get("Content-Type")),
		slog.String("content_range", ctx.Writer.Header().Get("Content-Range")),
	)
	ctx.Status(stream.Response.StatusCode)
	_, _ = io.Copy(ctx.Writer, stream.Response.Body)
}

func isClientCanceledError(err error) bool {
	return errors.Is(err, context.Canceled)
}

func ensureStreamContentType(ctx *gin.Context, title string) {
	contentType := strings.ToLower(strings.TrimSpace(ctx.Writer.Header().Get("Content-Type")))
	if contentType != "" && contentType != "application/octet-stream" && !strings.HasPrefix(contentType, "text/plain") {
		return
	}
	if guessed := mime.TypeByExtension(strings.ToLower(filepath.Ext(title))); guessed != "" {
		ctx.Header("Content-Type", guessed)
		return
	}
	ctx.Header("Content-Type", "application/octet-stream")
}

func copyStreamHeaders(ctx *gin.Context, headers http.Header) {
	for _, key := range []string{
		"Accept-Ranges",
		"Cache-Control",
		"Content-Length",
		"Content-Range",
		"Content-Type",
		"ETag",
		"Last-Modified",
	} {
		values := headers.Values(key)
		for _, value := range values {
			ctx.Writer.Header().Add(key, value)
		}
	}
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
