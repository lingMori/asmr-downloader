package handlers

import (
	"net/http"
	"time"

	"asmroner/internal/model"

	"github.com/gin-gonic/gin"
)

// HealthPayload is returned by the health endpoint.
type HealthPayload struct {
	Status  string    `json:"status"`
	Version string    `json:"version"`
	Time    time.Time `json:"time"`
}

// SystemHandler exposes system-level endpoints.
type SystemHandler struct {
	cfg *model.Config
}

// NewSystemHandler creates a handler with the provided config reference.
func NewSystemHandler(cfg *model.Config) *SystemHandler {
	return &SystemHandler{cfg: cfg}
}

// Config returns sanitized configuration values.
func (h *SystemHandler) Config(ctx *gin.Context) {
	if h.cfg == nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"code":    "CONFIG_NOT_LOADED",
			"message": "configuration not loaded",
		})
		return
	}

	safeCfg := *h.cfg
	safeCfg.User.Password = "***"

	ctx.JSON(http.StatusOK, gin.H{
		"code":    "OK",
		"message": "success",
		"data":    safeCfg,
	})
}
