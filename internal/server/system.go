package server

import (
	"time"

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
	}
}

var version = "dev"

// SetVersion allows main package to inject build version information.
func SetVersion(v string) {
	version = v
}
