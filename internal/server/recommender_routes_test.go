package server

import (
	"testing"

	"asmroner/internal/services"

	"github.com/gin-gonic/gin"
)

func TestRecommenderAndPlaybackRoutesRegisterWithoutConflict(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	s := &Server{
		discoverSvc:    services.NewDiscoverService(nil, nil),
		recommenderSvc: services.NewRecommenderService(nil, nil),
		playbackSvc:    services.NewPlaybackService(nil),
	}

	api := router.Group("/api")
	s.registerDiscoverRoutes(api)
	s.registerRecommenderRoutes(api)
	s.registerPlaybackRoutes(api)
}
