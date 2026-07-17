package services

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"asmroner/internal/database"
	"asmroner/internal/model"
)

const fakeRecommenderWorksJSON = `{
  "works": [
    {
      "id": 123456,
      "title": "demo work",
      "release": "2024-01-02",
      "dl_count": 100,
      "rate_average_2dp": 4.5,
      "duration": 3600,
      "has_subtitle": true,
      "source_id": "RJ123456",
      "thumbnailCoverUrl": "https://img.example/thumb.jpg",
      "mainCoverUrl": "https://img.example/main.jpg",
      "circle": {"id": 7, "name": "demo circle", "source_id": "RG7", "source_type": "circle"},
      "vas": [{"id": "va1", "name": "CV One"}],
      "tags": [{"id": 1, "name": "tag-one"}, {"id": 2, "name": "tag-two"}]
    }
  ],
  "pagination": {"currentPage": 2, "pageSize": 24, "totalCount": 99}
}`

func mustSearchResult(t *testing.T, payload string) model.SearchResult {
	t.Helper()
	var result model.SearchResult
	if err := json.Unmarshal([]byte(payload), &result); err != nil {
		t.Fatalf("unmarshal search result: %v", err)
	}
	return result
}

type fakeRecommenderEngine struct {
	result model.SearchResult
	err    error

	lastKeyword             string
	lastPage                int
	lastPageSize            int
	lastSubtitle            int
	lastLocalSubtitledWorks []string
	lastItemID              int
	lastFeedbackType        string
	uuid                    string
}

func (f *fakeRecommenderEngine) GetPopularWorks(_ context.Context, keyword string, page, pageSize, subtitle int, localSubtitledWorks []string) (model.SearchResult, error) {
	f.lastKeyword = keyword
	f.lastPage = page
	f.lastPageSize = pageSize
	f.lastSubtitle = subtitle
	f.lastLocalSubtitledWorks = localSubtitledWorks
	return f.result, f.err
}

func (f *fakeRecommenderEngine) GetRecommendWorks(_ context.Context, keyword string, page, pageSize, subtitle int, localSubtitledWorks []string) (model.SearchResult, error) {
	f.lastKeyword = keyword
	f.lastPage = page
	f.lastPageSize = pageSize
	f.lastSubtitle = subtitle
	f.lastLocalSubtitledWorks = localSubtitledWorks
	return f.result, f.err
}

func (f *fakeRecommenderEngine) GetWorkNeighbors(_ context.Context, itemID int, localSubtitledWorks []string) (model.SearchResult, error) {
	f.lastItemID = itemID
	f.lastLocalSubtitledWorks = localSubtitledWorks
	return f.result, f.err
}

func (f *fakeRecommenderEngine) SendFeedback(_ context.Context, itemID int, feedbackType string) error {
	f.lastItemID = itemID
	f.lastFeedbackType = feedbackType
	return f.err
}

func (f *fakeRecommenderEngine) RecommenderUUID() string {
	return f.uuid
}

func TestRecommenderPopularMapsWorksAndPagination(t *testing.T) {
	fake := &fakeRecommenderEngine{result: mustSearchResult(t, fakeRecommenderWorksJSON)}
	svc := NewRecommenderService(nil, fake)

	resp, err := svc.Popular(context.Background(), 2, 24, 1)
	if err != nil {
		t.Fatalf("Popular() error = %v", err)
	}

	if fake.lastPage != 2 || fake.lastPageSize != 24 || fake.lastSubtitle != 1 {
		t.Fatalf("unexpected upstream params: page=%d pageSize=%d subtitle=%d", fake.lastPage, fake.lastPageSize, fake.lastSubtitle)
	}
	if resp.Page != 2 || resp.PageSize != 24 || resp.Total != 99 {
		t.Fatalf("unexpected pagination: %+v", resp)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}
	item := resp.Items[0]
	if item.SourceID != "RJ123456" || item.Title != "demo work" || item.Circle != "demo circle" {
		t.Fatalf("unexpected item mapping: %+v", item)
	}
	if item.Release != "2024-01-02" || item.DlCount != 100 || item.Rate != 4.5 || item.Duration != 3600 || !item.HasSubtitle {
		t.Fatalf("unexpected item fields: %+v", item)
	}
	if item.ThumbnailURL != "https://img.example/thumb.jpg" || item.MainCoverURL != "https://img.example/main.jpg" {
		t.Fatalf("unexpected cover mapping: %+v", item)
	}
	if len(item.Vas) != 1 || item.Vas[0] != "CV One" {
		t.Fatalf("unexpected vas mapping: %+v", item.Vas)
	}
	if len(item.Tags) != 2 || item.Tags[0] != "tag-one" || item.Tags[1] != "tag-two" {
		t.Fatalf("unexpected tags mapping: %+v", item.Tags)
	}
}

func TestRecommenderPopularClampsPageAndPageSize(t *testing.T) {
	fake := &fakeRecommenderEngine{result: mustSearchResult(t, fakeRecommenderWorksJSON)}
	svc := NewRecommenderService(nil, fake)

	resp, err := svc.Popular(context.Background(), 0, 100, 0)
	if err != nil {
		t.Fatalf("Popular() error = %v", err)
	}
	if fake.lastPage != 1 || fake.lastPageSize != 48 {
		t.Fatalf("expected clamped page=1 pageSize=48, got page=%d pageSize=%d", fake.lastPage, fake.lastPageSize)
	}
	if resp.Page != 1 || resp.PageSize != 48 {
		t.Fatalf("response should report clamped values: %+v", resp)
	}

	if _, err := svc.Popular(context.Background(), 1, 0, 0); err != nil {
		t.Fatalf("Popular() error = %v", err)
	}
	if fake.lastPageSize != 24 {
		t.Fatalf("expected default pageSize=24, got %d", fake.lastPageSize)
	}
}

func TestRecommenderRecommendForwardsParams(t *testing.T) {
	fake := &fakeRecommenderEngine{result: mustSearchResult(t, fakeRecommenderWorksJSON)}
	svc := NewRecommenderService(nil, fake)

	resp, err := svc.Recommend(context.Background(), 3, 12, 1)
	if err != nil {
		t.Fatalf("Recommend() error = %v", err)
	}
	if fake.lastPage != 3 || fake.lastPageSize != 12 || fake.lastSubtitle != 1 {
		t.Fatalf("unexpected upstream params: page=%d pageSize=%d subtitle=%d", fake.lastPage, fake.lastPageSize, fake.lastSubtitle)
	}
	if resp.Total != 99 || len(resp.Items) != 1 {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestRecommenderNeighborsParsesSourceID(t *testing.T) {
	fake := &fakeRecommenderEngine{
		result: mustSearchResult(t, `{"works":[{"id":123456,"source_id":"RJ123456","title":"neighbor"}],"pagination":{"currentPage":0,"pageSize":0,"totalCount":0}}`),
	}
	svc := NewRecommenderService(nil, fake)

	resp, err := svc.Neighbors(context.Background(), " rj123456 ")
	if err != nil {
		t.Fatalf("Neighbors() error = %v", err)
	}
	if fake.lastItemID != 123456 {
		t.Fatalf("expected itemId 123456, got %d", fake.lastItemID)
	}
	if resp.Total != 1 || resp.Page != 1 || resp.PageSize != 1 {
		t.Fatalf("expected fallback pagination from items, got %+v", resp)
	}
}

func TestRecommenderNeighborsRejectsInvalidSourceID(t *testing.T) {
	fake := &fakeRecommenderEngine{result: mustSearchResult(t, fakeRecommenderWorksJSON)}
	svc := NewRecommenderService(nil, fake)

	if _, err := svc.Neighbors(context.Background(), "not-an-id"); !errors.Is(err, ErrInvalidDiscoverRequest) {
		t.Fatalf("expected ErrInvalidDiscoverRequest, got %v", err)
	}
	if fake.lastItemID != 0 {
		t.Fatalf("engine should not be called for invalid source id")
	}
}

func TestRecommenderFeedbackValidatesInput(t *testing.T) {
	fake := &fakeRecommenderEngine{}
	svc := NewRecommenderService(nil, fake)

	if err := svc.Feedback(context.Background(), "rj123456", " start-listen "); err != nil {
		t.Fatalf("Feedback() error = %v", err)
	}
	if fake.lastItemID != 123456 || fake.lastFeedbackType != "start-listen" {
		t.Fatalf("unexpected feedback params: itemId=%d type=%q", fake.lastItemID, fake.lastFeedbackType)
	}

	if err := svc.Feedback(context.Background(), "RJ123456", "bogus-type"); !errors.Is(err, ErrInvalidDiscoverRequest) {
		t.Fatalf("expected ErrInvalidDiscoverRequest for unknown type, got %v", err)
	}
	if err := svc.Feedback(context.Background(), "bad-id", "start-listen"); !errors.Is(err, ErrInvalidDiscoverRequest) {
		t.Fatalf("expected ErrInvalidDiscoverRequest for bad source id, got %v", err)
	}
}

func TestRecommenderLocalSubtitleSourceIDs(t *testing.T) {
	db, err := database.NewInMemoryDb()
	if err != nil {
		t.Fatalf("NewInMemoryDb() error = %v", err)
	}
	if err := db.AutoMigrate(&model.MetadataWork{}); err != nil {
		t.Fatalf("AutoMigrate() error = %v", err)
	}
	works := []model.MetadataWork{
		{SourceID: "RJ111111", HasSubtitle: true},
		{SourceID: "RJ222222", HasSubtitle: false},
		{SourceID: "RJ333333", HasSubtitle: true},
	}
	if err := db.Create(&works).Error; err != nil {
		t.Fatalf("seed metadata works: %v", err)
	}

	fake := &fakeRecommenderEngine{result: mustSearchResult(t, fakeRecommenderWorksJSON)}
	svc := NewRecommenderService(db, fake)

	if _, err := svc.Popular(context.Background(), 1, 24, 0); err != nil {
		t.Fatalf("Popular() error = %v", err)
	}
	if len(fake.lastLocalSubtitledWorks) != 2 ||
		fake.lastLocalSubtitledWorks[0] != "RJ111111" ||
		fake.lastLocalSubtitledWorks[1] != "RJ333333" {
		t.Fatalf("unexpected localSubtitledWorks: %+v", fake.lastLocalSubtitledWorks)
	}
}
