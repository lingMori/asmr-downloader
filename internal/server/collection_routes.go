package server

import (
	"errors"
	"net/http"
	"strconv"

	"asmroner/internal/consts"
	"asmroner/internal/model"
	"asmroner/internal/services"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerCollectionRoutes(group *gin.RouterGroup) {
	if s.collectionSvc == nil {
		return
	}

	group.GET("/collections", s.handleCollectionList)
	group.POST("/collections", s.handleCollectionAdd)
	group.DELETE("/collections/:sourceId", s.handleCollectionRemove)
}

func (s *Server) handleCollectionList(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "24"))

	result, err := s.collectionSvc.List(ctx.Request.Context(), page, pageSize)
	if err != nil {
		respondError(ctx, http.StatusInternalServerError, consts.ErrCodeCollectionListFailed, err)
		return
	}
	respondOK(ctx, result)
}

func (s *Server) handleCollectionAdd(ctx *gin.Context) {
	var collection model.Collection
	if err := ctx.ShouldBindJSON(&collection); err != nil {
		respondError(ctx, http.StatusBadRequest, consts.ErrCodeInvalidCollectionRequest, err)
		return
	}
	if err := s.collectionSvc.Add(ctx.Request.Context(), collection); err != nil {
		if errors.Is(err, services.ErrInvalidCollectionRequest) {
			respondError(ctx, http.StatusBadRequest, consts.ErrCodeInvalidCollectionRequest, err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, consts.ErrCodeCollectionSaveFailed, err)
		return
	}
	respondOK(ctx, gin.H{"collected": true})
}

func (s *Server) handleCollectionRemove(ctx *gin.Context) {
	if err := s.collectionSvc.Remove(ctx.Request.Context(), ctx.Param("sourceId")); err != nil {
		if errors.Is(err, services.ErrInvalidCollectionRequest) {
			respondError(ctx, http.StatusBadRequest, consts.ErrCodeInvalidCollectionRequest, err)
			return
		}
		respondError(ctx, http.StatusInternalServerError, consts.ErrCodeCollectionDeleteFailed, err)
		return
	}
	respondOK(ctx, gin.H{"deleted": true})
}
