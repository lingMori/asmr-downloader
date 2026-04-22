package engine

import (
	"asmroner/internal/model"
	"testing"
)

func TestEngineManager_AuthLogin(t *testing.T) {
	t.Skip("requires local config and real credentials")
	cfg, err := model.LoadConfig("/Users/sunrise/CodeGround/GolandProjects/asmroner/.asmroner-data")
	if err != nil {
		t.Errorf("LoadConfig() failed, err: %v", err)
	}
	manager := NewEngineManager(cfg)
	manager.AuthLogin()
	if manager.JWTToken == "" {
		t.Errorf("AuthLogin() failed, JWTToken is empty")
	}
}
