package server

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerEventRoutes(group *gin.RouterGroup) {
	if s.eventHub == nil {
		return
	}
	group.GET("/events", s.handleEvents)
}

func (s *Server) handleEvents(ctx *gin.Context) {
	flusher, ok := ctx.Writer.(http.Flusher)
	if !ok {
		ctx.Status(http.StatusInternalServerError)
		return
	}

	ctx.Writer.Header().Set("Content-Type", "text/event-stream")
	ctx.Writer.Header().Set("Cache-Control", "no-cache")
	ctx.Writer.Header().Set("Connection", "keep-alive")

	ch := s.eventHub.Subscribe()
	defer s.eventHub.Unsubscribe(ch)

	heartbeat := time.NewTicker(25 * time.Second)
	defer heartbeat.Stop()

	ctx.Writer.WriteHeader(http.StatusOK)
	flusher.Flush()

	for {
		select {
		case <-ctx.Request.Context().Done():
			return
		case ev := <-ch:
			fmt.Fprintf(ctx.Writer, "event: task\n")
			fmt.Fprintf(ctx.Writer, "data: {\"taskId\":%d,\"status\":\"%s\",\"message\":\"%s\",\"progress\":%.2f,\"time\":\"%s\"}\n\n",
				ev.TaskID, ev.Status, escapeForJSON(ev.Message), ev.Progress, ev.Time.Format(time.RFC3339))
			flusher.Flush()
		case <-heartbeat.C:
			fmt.Fprintf(ctx.Writer, "event: heartbeat\n")
			fmt.Fprintf(ctx.Writer, "data: %q\n\n", time.Now().Format(time.RFC3339))
			flusher.Flush()
		}
	}
}

func escapeForJSON(input string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `"`, `\"`)
	return replacer.Replace(input)
}
