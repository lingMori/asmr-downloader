package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"asmroner/internal/database"
	"asmroner/internal/model"
	"asmroner/internal/services"

	"github.com/gin-gonic/gin"
)

func newCollectionTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	db, err := database.NewInMemoryDb()
	if err != nil {
		t.Fatalf("NewInMemoryDb() error = %v", err)
	}
	if err := db.AutoMigrate(&model.Collection{}); err != nil {
		t.Fatalf("AutoMigrate() error = %v", err)
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	s := &Server{collectionSvc: services.NewCollectionService(db)}
	s.registerCollectionRoutes(router.Group("/api"))
	return router
}

type collectionTestEnvelope struct {
	Code    string          `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func TestCollectionRoutesRoundTrip(t *testing.T) {
	router := newCollectionTestRouter(t)

	body := `{
		"source_id": "rj123456",
		"title": "demo work",
		"circle": "demo circle",
		"vas": ["佐倉綾音"],
		"tags": ["癒し"],
		"release": "2024-05-17",
		"rate": 4.5,
		"dl_count": 1234,
		"duration": 3600,
		"has_subtitle": true,
		"thumbnail_url": "https://img.example/sam.jpg",
		"main_cover_url": "https://img.example/main.jpg"
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/collections", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("POST /api/collections status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var addResp collectionTestEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &addResp); err != nil {
		t.Fatalf("POST response decode error = %v", err)
	}
	var addData struct {
		Collected bool `json:"collected"`
	}
	if err := json.Unmarshal(addResp.Data, &addData); err != nil || !addData.Collected {
		t.Fatalf("expected data.collected=true, got %s", string(addResp.Data))
	}

	req = httptest.NewRequest(http.MethodGet, "/api/collections?page=1&page_size=24", nil)
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("GET /api/collections status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var listResp collectionTestEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("GET response decode error = %v", err)
	}
	var listData struct {
		Items []struct {
			SourceID string   `json:"source_id"`
			Title    string   `json:"title"`
			Vas      []string `json:"vas"`
			Tags     []string `json:"tags"`
		} `json:"items"`
		Total    int `json:"total"`
		Page     int `json:"page"`
		PageSize int `json:"page_size"`
	}
	if err := json.Unmarshal(listResp.Data, &listData); err != nil {
		t.Fatalf("GET data decode error = %v", err)
	}
	if listData.Total != 1 || listData.Page != 1 || listData.PageSize != 24 || len(listData.Items) != 1 {
		t.Fatalf("unexpected list data: %s", string(listResp.Data))
	}
	item := listData.Items[0]
	if item.SourceID != "RJ123456" || item.Title != "demo work" || len(item.Vas) != 1 || len(item.Tags) != 1 {
		t.Fatalf("unexpected collection item: %+v", item)
	}

	req = httptest.NewRequest(http.MethodDelete, "/api/collections/RJ123456", nil)
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("DELETE /api/collections/RJ123456 status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var deleteResp collectionTestEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &deleteResp); err != nil {
		t.Fatalf("DELETE response decode error = %v", err)
	}
	var deleteData struct {
		Deleted bool `json:"deleted"`
	}
	if err := json.Unmarshal(deleteResp.Data, &deleteData); err != nil || !deleteData.Deleted {
		t.Fatalf("expected data.deleted=true, got %s", string(deleteResp.Data))
	}

	req = httptest.NewRequest(http.MethodGet, "/api/collections", nil)
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if err := json.Unmarshal(recorder.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("GET response decode error = %v", err)
	}
	if err := json.Unmarshal(listResp.Data, &listData); err != nil {
		t.Fatalf("GET data decode error = %v", err)
	}
	if listData.Total != 0 || len(listData.Items) != 0 {
		t.Fatalf("expected empty list after delete, got %s", string(listResp.Data))
	}
}

func TestCollectionRoutesRejectInvalidRequests(t *testing.T) {
	router := newCollectionTestRouter(t)

	req := httptest.NewRequest(http.MethodPost, "/api/collections", bytes.NewBufferString(`{"source_id":"RJ123456"}`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("POST without title status = %d, body = %s", recorder.Code, recorder.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/api/collections", bytes.NewBufferString(`not-json`))
	req.Header.Set("Content-Type", "application/json")
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("POST invalid json status = %d, body = %s", recorder.Code, recorder.Body.String())
	}

	req = httptest.NewRequest(http.MethodDelete, "/api/collections/not-an-id", nil)
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("DELETE invalid source id status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}
