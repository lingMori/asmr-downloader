package server

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"asmroner/internal/model"
	"asmroner/internal/server/handlers"
	"asmroner/internal/utils"

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
	if err := validateConfig(next); err != nil {
		respondError(ctx, http.StatusBadRequest, "INVALID_CONFIG", err)
		return
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

func validateConfig(cfg model.Config) error {
	if strings.TrimSpace(cfg.User.Account) == "" {
		return fmt.Errorf("user account is required")
	}
	rawAPIURL := strings.TrimSpace(cfg.Downloader.ApiUrl)
	if rawAPIURL == "" {
		return fmt.Errorf("downloader api url is required")
	}
	parsedURL, err := url.Parse(rawAPIURL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") || parsedURL.Host == "" {
		return fmt.Errorf("downloader api url must be a valid http or https URL")
	}
	if cfg.Downloader.MaxWorkers <= 0 {
		return fmt.Errorf("max workers must be greater than 0")
	}
	if cfg.Downloader.MaxRetries < 0 {
		return fmt.Errorf("max retries must be greater than or equal to 0")
	}
	if strings.TrimSpace(cfg.Downloader.SyncDataFolder) == "" {
		return fmt.Errorf("sync data folder is required")
	}
	if _, err := filepath.Abs(cfg.Downloader.SyncDataFolder); err != nil {
		return fmt.Errorf("sync data folder is invalid: %w", err)
	}
	if _, err := utils.FileSize2Byte(strings.TrimSpace(cfg.Downloader.SyncWantedSize)); err != nil {
		return fmt.Errorf("sync wanted size is invalid: %w", err)
	}
	if !validPreferMedia(cfg.Downloader.PreferMedia) {
		return fmt.Errorf("prefer media must be all, mp3, wav, flac, or a priority chain such as mp3>wav>flac")
	}
	if cfg.Limit.SyncQPS <= 0 {
		return fmt.Errorf("sync qps must be greater than 0")
	}
	if cfg.Limit.DownloadQPS <= 0 {
		return fmt.Errorf("download qps must be greater than 0")
	}
	if cfg.Limit.SyncJitterMin < 0 || cfg.Limit.SyncJitterMax < 0 || cfg.Limit.DownloadJitterMin < 0 || cfg.Limit.DownloadJitterMax < 0 {
		return fmt.Errorf("jitter values must be greater than or equal to 0")
	}
	if cfg.Limit.SyncJitterMax < cfg.Limit.SyncJitterMin {
		return fmt.Errorf("sync jitter max must be greater than or equal to sync jitter min")
	}
	if cfg.Limit.DownloadJitterMax < cfg.Limit.DownloadJitterMin {
		return fmt.Errorf("download jitter max must be greater than or equal to download jitter min")
	}
	return nil
}

func validPreferMedia(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "all" {
		return true
	}
	parts := strings.Split(value, ">")
	if len(parts) == 0 {
		return false
	}
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		switch part {
		case "mp3", "wav", "flac":
		default:
			return false
		}
		if _, ok := seen[part]; ok {
			return false
		}
		seen[part] = struct{}{}
	}
	return true
}
