package server

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"asmroner/internal/model"
	"asmroner/internal/server/handlers"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerSystemRoutes(group *gin.RouterGroup) {
	group.GET("/healthz", func(ctx *gin.Context) {
		payload := handlers.HealthPayload{
			Status:  "ok",
			Version: version,
			Time:    time.Now().UTC(),
		}
		respondOK(ctx, payload)
	})

	if s.systemHandler != nil {
		group.GET("/config", s.systemHandler.Config)
		group.PUT("/config", s.handleConfigUpdate)
	}
}

var version = "dev"

// SetVersion allows main package to inject build version information.
func SetVersion(v string) {
	version = v
}

func (s *Server) handleConfigUpdate(ctx *gin.Context) {
	if s.config == nil {
		respondError(ctx, http.StatusInternalServerError, "CONFIG_NOT_LOADED", errors.New("configuration not loaded"))
		return
	}

	var req model.Config
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondError(ctx, http.StatusBadRequest, "INVALID_REQUEST", err)
		return
	}

	next := *s.config
	next.User.Account = strings.TrimSpace(req.User.Account)
	if next.User.Account == "" {
		next.User.Account = s.config.User.Account
	}

	next.User.Password = strings.TrimSpace(req.User.Password)
	if next.User.Password == "" || next.User.Password == "***" {
		next.User.Password = s.config.User.Password
	}

	if value := strings.TrimSpace(req.Downloader.ApiUrl); value != "" {
		next.Downloader.ApiUrl = value
	}
	next.Downloader.ProxyUrl = strings.TrimSpace(req.Downloader.ProxyUrl)
	if req.Downloader.MaxWorkers > 0 {
		next.Downloader.MaxWorkers = req.Downloader.MaxWorkers
	}
	if req.Downloader.MaxRetries >= 0 {
		next.Downloader.MaxRetries = req.Downloader.MaxRetries
	}
	if value := strings.TrimSpace(req.Downloader.SyncDataFolder); value != "" {
		next.Downloader.SyncDataFolder = value
	}
	if value := strings.TrimSpace(req.Downloader.SyncWantedSize); value != "" {
		next.Downloader.SyncWantedSize = value
	}
	if value := strings.TrimSpace(req.Downloader.PreferMedia); value != "" {
		next.Downloader.PreferMedia = value
	}

	if req.Limit.SyncQPS > 0 {
		next.Limit.SyncQPS = req.Limit.SyncQPS
	}
	if req.Limit.SyncJitterMin >= 0 {
		next.Limit.SyncJitterMin = req.Limit.SyncJitterMin
	}
	if req.Limit.SyncJitterMax >= 0 {
		next.Limit.SyncJitterMax = req.Limit.SyncJitterMax
	}
	if req.Limit.DownloadQPS > 0 {
		next.Limit.DownloadQPS = req.Limit.DownloadQPS
	}
	if req.Limit.DownloadJitterMin >= 0 {
		next.Limit.DownloadJitterMin = req.Limit.DownloadJitterMin
	}
	if req.Limit.DownloadJitterMax >= 0 {
		next.Limit.DownloadJitterMax = req.Limit.DownloadJitterMax
	}

	if err := model.SaveConfig(&next); err != nil {
		respondError(ctx, http.StatusInternalServerError, "CONFIG_SAVE_FAILED", err)
		return
	}
	if err := s.applyConfig(&next); err != nil {
		respondError(ctx, http.StatusInternalServerError, "CONFIG_RELOAD_FAILED", err)
		return
	}

	safeCfg := next
	safeCfg.User.Password = "***"
	respondOK(ctx, safeCfg)
}
