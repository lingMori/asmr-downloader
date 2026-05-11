package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"asmroner/internal/consts"
	"asmroner/internal/database"
	"asmroner/internal/engine"
	"asmroner/internal/events"
	"asmroner/internal/logger"
	"asmroner/internal/model"
	"asmroner/internal/server/handlers"
	"asmroner/internal/services"
	"asmroner/internal/store"
	"asmroner/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/spf13/viper"
	"gorm.io/gorm"
)

// Server wraps the HTTP engine and app configuration.
type Server struct {
	engine        *gin.Engine
	config        *model.Config
	cfgProvider   *model.ConfigProvider
	db            *gorm.DB
	taskStore     *store.TaskStore
	taskSvc       *services.TaskService
	searchSvc     *services.SearchService
	downloadSvc   *services.DownloadService
	syncSvc       *services.SyncService
	discoverSvc   *services.DiscoverService
	librarySvc    *services.LibraryService
	systemHandler *handlers.SystemHandler
	enManager     *engine.EngineManager
	eventHub      *events.Hub
}

// New creates a server instance after ensuring configuration and database are ready.
func New() (*Server, error) {
	utils.EnSureDirExist(consts.MetaDataDir)

	// Load configuration (fail fast if missing)
	cfg, err := loadConfig()
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}
	cfgProvider := model.NewConfigProvider(cfg)

	db, err := database.InitDB()
	if err != nil {
		return nil, fmt.Errorf("init database: %w", err)
	}

	logger.InitErrorLogger()

	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "" {
		ginMode = gin.ReleaseMode
	}
	gin.SetMode(ginMode)

	router := gin.New()
	router.Use(requestIDMiddleware(), slogLoggerMiddleware(), slogRecoveryMiddleware(), corsMiddleware())

	taskStore := store.NewTaskStore(db)
	if terminated, err := taskStore.TerminateInterrupted(context.Background(), "server restarted before task completed"); err != nil {
		return nil, fmt.Errorf("terminate interrupted tasks: %w", err)
	} else if terminated > 0 {
		logger.Logger().Warn("terminated interrupted tasks", slog.Int64("count", terminated))
	}
	taskSvc := services.NewTaskService(taskStore)
	engManager := engine.NewEngineManager(cfg)
	if engManager == nil {
		return nil, fmt.Errorf("init engine manager failed")
	}
	hub := events.NewHub()
	downloadSvc := services.NewDownloadService(taskStore, engManager, hub, cfgProvider)
	searchSvc := services.NewSearchService(engManager, downloadSvc)
	syncSvc := services.NewSyncService(db, taskStore, engManager, hub, cfgProvider)
	discoverSvc := services.NewDiscoverService(db, engManager)
	librarySvc := services.NewLibraryService(cfgProvider)

	srv := &Server{
		engine:        router,
		config:        cfg,
		cfgProvider:   cfgProvider,
		db:            db,
		taskStore:     taskStore,
		taskSvc:       taskSvc,
		searchSvc:     searchSvc,
		downloadSvc:   downloadSvc,
		syncSvc:       syncSvc,
		discoverSvc:   discoverSvc,
		librarySvc:    librarySvc,
		systemHandler: handlers.NewSystemHandler(cfg),
		enManager:     engManager,
		eventHub:      hub,
	}
	srv.updateAuthStatus(engManager)
	srv.registerRoutes()
	return srv, nil
}

// Run starts serving HTTP requests on the provided address.
func (s *Server) Run(addr string) error {
	logger.Logger().Info("http server listening", slog.String("addr", addr))
	return s.engine.Run(addr)
}

func loadConfig() (*model.Config, error) {
	viper.SetConfigName(consts.ConfigFileName[:len("config")])
	viper.SetConfigType("toml")
	viper.AddConfigPath(consts.MetaDataDir)

	if err := viper.ReadInConfig(); err != nil {
		var notFound viper.ConfigFileNotFoundError
		if errors.As(err, &notFound) {
			cfg := model.NewDefaultConfig()
			if saveErr := model.SaveConfig(cfg); saveErr != nil {
				return nil, saveErr
			}
			return cfg, nil
		}
		return nil, err
	}

	cfg := model.NewDefaultConfig()
	if err := viper.Unmarshal(cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (s *Server) registerRoutes() {
	api := s.engine.Group("/api")
	s.registerSystemRoutes(api)
	s.registerSearchRoutes(api)
	s.registerDiscoverRoutes(api)
	s.registerLibraryRoutes(api)
	s.registerDownloadRoutes(api)
	s.registerSyncRoutes(api)
	s.registerTaskRoutes(api)
	s.registerEventRoutes(api)
}

func (s *Server) applyConfig(cfg *model.Config) error {
	if cfg == nil {
		return fmt.Errorf("config is nil")
	}

	s.config = cfg
	if s.cfgProvider != nil {
		s.cfgProvider.Update(cfg)
	}
	if s.systemHandler != nil {
		s.systemHandler.SetConfig(cfg)
	}
	if s.librarySvc != nil {
		s.librarySvc.SetBaseDir(cfg.Downloader.SyncDataFolder)
	}

	engManager := engine.NewEngineManager(cfg)
	if engManager == nil {
		return fmt.Errorf("init engine manager failed")
	}
	s.enManager = engManager
	s.updateAuthStatus(engManager)
	if s.downloadSvc != nil {
		s.downloadSvc.SetEngine(engManager)
	}
	if s.searchSvc != nil {
		s.searchSvc.SetEngine(engManager)
	}
	if s.syncSvc != nil {
		s.syncSvc.SetEngine(engManager)
	}
	if s.discoverSvc != nil {
		s.discoverSvc.SetEngine(engManager)
	}
	return nil
}

func (s *Server) updateAuthStatus(engManager *engine.EngineManager) {
	status := handlers.AuthStatusPayload{
		State:   "unknown",
		Message: "未登录",
	}
	if engManager != nil {
		if engManager.AuthState != "" {
			status.State = engManager.AuthState
		}
		if engManager.AuthMessage != "" {
			status.Message = engManager.AuthMessage
		}
	}
	if s.systemHandler != nil {
		s.systemHandler.SetAuthStatus(status)
	}
}

// HTTPError propagates errors in a consistent JSON shape.
type HTTPError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

func respondError(ctx *gin.Context, status int, code string, err error) {
	ctx.JSON(status, HTTPError{
		Code:    code,
		Message: err.Error(),
	})
}

func respondOK(ctx *gin.Context, data interface{}) {
	ctx.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "success",
		"data":    data,
	})
}

func corsMiddleware() gin.HandlerFunc {
	allowedOrigins := allowedOriginsFromEnv()

	return func(ctx *gin.Context) {
		origin := ctx.GetHeader("Origin")
		if origin != "" && isOriginAllowed(origin, allowedOrigins) {
			ctx.Header("Access-Control-Allow-Origin", origin)
			ctx.Header("Vary", "Origin")
			ctx.Header("Access-Control-Allow-Credentials", "true")
		}

		ctx.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		ctx.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Last-Event-ID, Range")
		ctx.Header("Access-Control-Expose-Headers", "Content-Type, Content-Length, Content-Range, Accept-Ranges, ETag")

		if ctx.Request.Method == http.MethodOptions {
			ctx.AbortWithStatus(http.StatusNoContent)
			return
		}

		ctx.Next()
	}
}

func allowedOriginsFromEnv() []string {
	raw := os.Getenv("ASMRO_CORS_ORIGINS")
	if raw == "" {
		return []string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
			"http://localhost:3000",
			"http://127.0.0.1:3000",
		}
	}

	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			origins = append(origins, part)
		}
	}
	return origins
}

func isOriginAllowed(origin string, allowedOrigins []string) bool {
	for _, allowed := range allowedOrigins {
		if allowed == "*" || strings.EqualFold(origin, allowed) {
			return true
		}
	}
	return false
}
