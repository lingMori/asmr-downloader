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

type AuthStatusPayload struct {
	State   string `json:"state"`
	Message string `json:"message"`
}

type ConfigPayload struct {
	model.Config
	Auth AuthStatusPayload `json:"auth"`
}

// SystemHandler exposes system-level endpoints.
type SystemHandler struct {
	cfg        *model.Config
	authStatus AuthStatusPayload
}

// NewSystemHandler creates a handler with the provided config reference.
func NewSystemHandler(cfg *model.Config) *SystemHandler {
	return &SystemHandler{cfg: cfg}
}

func (h *SystemHandler) SetConfig(cfg *model.Config) {
	h.cfg = cfg
}

func (h *SystemHandler) SetAuthStatus(status AuthStatusPayload) {
	h.authStatus = status
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
		"data": ConfigPayload{
			Config: safeCfg,
			Auth:   h.authStatus,
		},
	})
}
