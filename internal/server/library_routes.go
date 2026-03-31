package server

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerLibraryRoutes(group *gin.RouterGroup) {
	if s.librarySvc == nil {
		return
	}

	if baseDir := s.librarySvc.BaseDir(); baseDir != "" {
		if absDir, err := filepath.Abs(baseDir); err == nil {
			s.engine.StaticFS("/media", gin.Dir(absDir, true))
		}
	}

	group.GET("/library/works", s.handleLibraryList)
	group.GET("/library/works/:id", s.handleLibraryDetail)
}

func (s *Server) handleLibraryList(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("pageSize", "24"))

	result, err := s.librarySvc.ListWorks(ctx.Request.Context(), page, pageSize, ctx.Query("search"))
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, "LIBRARY_LIST_FAILED", err)
		return
	}
	respondOK(ctx, result)
}

func (s *Server) handleLibraryDetail(ctx *gin.Context) {
	result, err := s.librarySvc.GetWorkDetail(ctx.Request.Context(), ctx.Param("id"))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			respondError(ctx, http.StatusNotFound, "LIBRARY_WORK_NOT_FOUND", err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, "LIBRARY_WORK_FAILED", err)
		return
	}
	respondOK(ctx, result)
}
