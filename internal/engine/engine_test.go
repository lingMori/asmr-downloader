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

func TestSelectHotWorksClampsToAvailableResults(t *testing.T) {
	works := []model.MetadataWork{
		{SourceID: "RJ1"},
		{SourceID: "RJ2"},
	}

	selected, err := selectHotWorks(works, 10)
	if err != nil {
		t.Fatalf("selectHotWorks() error = %v", err)
	}
	if len(selected) != len(works) {
		t.Fatalf("expected %d works, got %d", len(works), len(selected))
	}
}

func TestSelectHotWorksRejectsEmptyResults(t *testing.T) {
	if _, err := selectHotWorks(nil, 10); err == nil {
		t.Fatal("expected empty hot works to be rejected")
	}
}
