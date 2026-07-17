package server

import (
	"errors"
	"net/http"
	"strconv"

	"asmroner/internal/services"

	"github.com/gin-gonic/gin"
)

func (s *Server) registerRecommenderRoutes(group *gin.RouterGroup) {
	if s.recommenderSvc == nil {
		return
	}

	group.GET("/discover/popular", s.handleRecommenderPopular)
	group.GET("/discover/recommend", s.handleRecommenderRecommend)
	group.GET("/discover/works/:sourceId/neighbors", s.handleRecommenderNeighbors)
	group.POST("/discover/feedback", s.handleRecommenderFeedback)
}

func (s *Server) handleRecommenderPopular(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "24"))
	subtitle, _ := strconv.Atoi(ctx.DefaultQuery("subtitle", "0"))

	result, err := s.recommenderSvc.Popular(ctx.Request.Context(), page, pageSize, subtitle)
	if err != nil {
		respondError(ctx, http.StatusBadGateway, "RECOMMENDER_POPULAR_FAILED", err)
		return
	}
	respondOK(ctx, result)
}

func (s *Server) handleRecommenderRecommend(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "24"))
	subtitle, _ := strconv.Atoi(ctx.DefaultQuery("subtitle", "0"))

	result, err := s.recommenderSvc.Recommend(ctx.Request.Context(), page, pageSize, subtitle)
	if err != nil {
		respondError(ctx, http.StatusBadGateway, "RECOMMENDER_RECOMMEND_FAILED", err)
		return
	}
	respondOK(ctx, result)
}

func (s *Server) handleRecommenderNeighbors(ctx *gin.Context) {
	result, err := s.recommenderSvc.Neighbors(ctx.Request.Context(), ctx.Param("sourceId"))
	if err != nil {
		if errors.Is(err, services.ErrInvalidDiscoverRequest) {
			respondError(ctx, http.StatusBadRequest, "INVALID_SOURCE_ID", err)
			return
		}
		respondError(ctx, http.StatusBadGateway, "RECOMMENDER_NEIGHBORS_FAILED", err)
		return
	}
	respondOK(ctx, result)
}

type recommenderFeedbackRequest struct {
	SourceID string `json:"source_id"`
	Type     string `json:"type"`
}

func (s *Server) handleRecommenderFeedback(ctx *gin.Context) {
	var req recommenderFeedbackRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondError(ctx, http.StatusBadRequest, "INVALID_FEEDBACK_REQUEST", err)
		return
	}
	if err := s.recommenderSvc.Feedback(ctx.Request.Context(), req.SourceID, req.Type); err != nil {
		if errors.Is(err, services.ErrInvalidDiscoverRequest) {
			respondError(ctx, http.StatusBadRequest, "INVALID_FEEDBACK_REQUEST", err)
			return
		}
		respondError(ctx, http.StatusBadGateway, "RECOMMENDER_FEEDBACK_FAILED", err)
		return
	}
	respondOK(ctx, gin.H{"sent": true})
}
