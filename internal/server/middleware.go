package server

import (
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"asmroner/internal/logger"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/term"
)

const (
	requestIDHeader = "X-Request-ID"
	requestIDKey    = "request_id"
)

// requestIDMiddleware 为每个请求注入 request_id，并回写到响应头。
func requestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		rid := c.GetHeader(requestIDHeader)
		if rid == "" {
			rid = uuid.NewString()
		}
		c.Set(requestIDKey, rid)
		c.Writer.Header().Set(requestIDHeader, rid)
		c.Next()
	}
}

// colorful 判断是否在 TTY 且非 JSON 输出模式，用于访问日志染色。
var colorful = func() bool {
	if strings.ToLower(os.Getenv("LOG_FORMAT")) == "json" {
		return false
	}
	if os.Getenv("NO_COLOR") != "" {
		return false
	}
	return term.IsTerminal(int(os.Stdout.Fd()))
}()

const (
	colReset  = "\x1b[0m"
	colDim    = "\x1b[90m"
	colBold   = "\x1b[1m"
	colGreen  = "\x1b[97;42m"
	colWhite  = "\x1b[90;47m"
	colYellow = "\x1b[90;43m"
	colRed    = "\x1b[97;41m"
	colBlue   = "\x1b[97;44m"
	colCyan   = "\x1b[97;46m"
	colMagenta = "\x1b[97;45m"
)

func statusColor(code int) string {
	switch {
	case code >= 200 && code < 300:
		return colGreen
	case code >= 300 && code < 400:
		return colWhite
	case code >= 400 && code < 500:
		return colYellow
	default:
		return colRed
	}
}

func methodColor(method string) string {
	switch method {
	case "GET":
		return colBlue
	case "POST":
		return colCyan
	case "PUT":
		return colYellow
	case "DELETE":
		return colRed
	case "PATCH":
		return colGreen
	case "HEAD":
		return colMagenta
	case "OPTIONS":
		return colWhite
	default:
		return colReset
	}
}

// slogLoggerMiddleware 替换 gin.Logger()。
// TTY + 非 JSON 模式下输出带颜色的单行摘要（兼容 gin.Logger 视觉风格），其余情况走 slog。
func slogLoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery
		if raw != "" {
			path = path + "?" + raw
		}

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		method := c.Request.Method
		clientIP := c.ClientIP()
		rid, _ := c.Get(requestIDKey)
		ridStr, _ := rid.(string)

		if colorful {
			fmt.Fprintf(os.Stdout,
				"%s[ASMR]%s %s | %s %3d %s | %s%13v%s | %s%15s%s | %s %-7s %s %s\n",
				colDim, colReset,
				start.Format("2006/01/02 - 15:04:05"),
				statusColor(status), status, colReset,
				colBold, latency, colReset,
				colBold, clientIP, colReset,
				methodColor(method), method, colReset,
				path,
			)
			return
		}

		attrs := []any{
			slog.String("method", method),
			slog.String("path", path),
			slog.Int("status", status),
			slog.Duration("latency", latency),
			slog.String("client_ip", clientIP),
		}
		if ridStr != "" {
			attrs = append(attrs, slog.String("request_id", ridStr))
		}
		if len(c.Errors) > 0 {
			attrs = append(attrs, slog.String("errors", c.Errors.String()))
			logger.Logger().Error("http request", attrs...)
			return
		}
		logger.Logger().Info("http request", attrs...)
	}
}

// slogRecoveryMiddleware 替换 gin.Recovery()，panic 事件走 slog。
func slogRecoveryMiddleware() gin.HandlerFunc {
	return gin.CustomRecoveryWithWriter(nil, func(c *gin.Context, recovered any) {
		rid, _ := c.Get(requestIDKey)
		attrs := []any{
			slog.String("path", c.Request.URL.Path),
			slog.Any("panic", recovered),
		}
		if s, ok := rid.(string); ok && s != "" {
			attrs = append(attrs, slog.String("request_id", s))
		}
		logger.Logger().Error("http panic recovered", attrs...)
		c.AbortWithStatus(500)
	})
}
