package services

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"asmroner/internal/model"

	"gorm.io/gorm"
)

// recommenderFeedbackTypes 上游允许的反馈类型白名单
var recommenderFeedbackTypes = map[string]struct{}{
	"start-listen":     {},
	"listen-5mins":     {},
	"listen-15mins":    {},
	"listen-30mins":    {},
	"listen-60mins":    {},
	"listen-30percent": {},
}

type RecommenderService struct {
	db     *gorm.DB
	engine RecommenderEngine
}

type RecommenderEngine interface {
	GetPopularWorks(ctx context.Context, keyword string, page, pageSize, subtitle int, localSubtitledWorks []string) (model.SearchResult, error)
	GetRecommendWorks(ctx context.Context, keyword string, page, pageSize, subtitle int, localSubtitledWorks []string) (model.SearchResult, error)
	GetWorkNeighbors(ctx context.Context, itemID int, localSubtitledWorks []string) (model.SearchResult, error)
	SendFeedback(ctx context.Context, itemID int, feedbackType string) error
	RecommenderUUID() string
}

type RecommenderListResponse struct {
	Items    []DiscoverWorkSummary `json:"items"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"page_size"`
	Total    int                   `json:"total"`
}

func NewRecommenderService(db *gorm.DB, eng RecommenderEngine) *RecommenderService {
	return &RecommenderService{db: db, engine: eng}
}

func (s *RecommenderService) SetEngine(engine RecommenderEngine) {
	s.engine = engine
}

func (s *RecommenderService) Popular(ctx context.Context, page, pageSize, subtitle int) (RecommenderListResponse, error) {
	if s.engine == nil {
		return RecommenderListResponse{}, errors.New("recommender engine is not available")
	}
	page, pageSize = normalizeRecommenderPage(page, pageSize)
	result, err := s.engine.GetPopularWorks(ctx, "", page, pageSize, subtitle, s.localSubtitleSourceIDs(ctx))
	if err != nil {
		return RecommenderListResponse{}, err
	}
	return RecommenderListResponse{
		Items:    buildRecommenderItems(result),
		Page:     page,
		PageSize: pageSize,
		Total:    result.Pagination.TotalCount,
	}, nil
}

func (s *RecommenderService) Recommend(ctx context.Context, page, pageSize, subtitle int) (RecommenderListResponse, error) {
	if s.engine == nil {
		return RecommenderListResponse{}, errors.New("recommender engine is not available")
	}
	page, pageSize = normalizeRecommenderPage(page, pageSize)
	result, err := s.engine.GetRecommendWorks(ctx, "", page, pageSize, subtitle, s.localSubtitleSourceIDs(ctx))
	if err != nil {
		return RecommenderListResponse{}, err
	}
	return RecommenderListResponse{
		Items:    buildRecommenderItems(result),
		Page:     page,
		PageSize: pageSize,
		Total:    result.Pagination.TotalCount,
	}, nil
}

func (s *RecommenderService) Neighbors(ctx context.Context, sourceID string) (RecommenderListResponse, error) {
	if s.engine == nil {
		return RecommenderListResponse{}, errors.New("recommender engine is not available")
	}
	itemID, err := parseRecommenderItemID(sourceID)
	if err != nil {
		return RecommenderListResponse{}, err
	}
	result, err := s.engine.GetWorkNeighbors(ctx, itemID, s.localSubtitleSourceIDs(ctx))
	if err != nil {
		return RecommenderListResponse{}, err
	}
	items := buildRecommenderItems(result)
	total := result.Pagination.TotalCount
	if total <= 0 {
		total = len(items)
	}
	page := result.Pagination.CurrentPage
	if page <= 0 {
		page = 1
	}
	pageSize := result.Pagination.PageSize
	if pageSize <= 0 {
		pageSize = len(items)
	}
	return RecommenderListResponse{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
	}, nil
}

func (s *RecommenderService) Feedback(ctx context.Context, sourceID, feedbackType string) error {
	if s.engine == nil {
		return errors.New("recommender engine is not available")
	}
	itemID, err := parseRecommenderItemID(sourceID)
	if err != nil {
		return err
	}
	feedbackType = strings.TrimSpace(feedbackType)
	if _, ok := recommenderFeedbackTypes[feedbackType]; !ok {
		return ErrInvalidDiscoverRequest
	}
	return s.engine.SendFeedback(ctx, itemID, feedbackType)
}

// localSubtitleSourceIDs 本地已有字幕作品的source_id列表，用于上游过滤
func (s *RecommenderService) localSubtitleSourceIDs(ctx context.Context) []string {
	if s.db == nil {
		return nil
	}
	var sourceIDs []string
	if err := s.db.WithContext(ctx).
		Model(&model.MetadataWork{}).
		Where("has_subtitle = 1").
		Pluck("source_id", &sourceIDs).Error; err != nil {
		return nil
	}
	return sourceIDs
}

// parseRecommenderItemID 将RJ号等source_id解析为上游itemId
func parseRecommenderItemID(sourceID string) (int, error) {
	_, number, err := normalizeDiscoverSourceID(sourceID)
	if err != nil {
		return 0, err
	}
	itemID, err := strconv.Atoi(number)
	if err != nil {
		return 0, ErrInvalidDiscoverRequest
	}
	return itemID, nil
}

func normalizeRecommenderPage(page, pageSize int) (int, int) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 24
	}
	if pageSize > 48 {
		pageSize = 48
	}
	return page, pageSize
}

func buildRecommenderItems(result model.SearchResult) []DiscoverWorkSummary {
	items := make([]DiscoverWorkSummary, 0, len(result.Works))
	for _, work := range result.Works {
		item := DiscoverWorkSummary{
			SourceID:     work.SourceID,
			Title:        work.Title,
			Circle:       work.Circle.Name,
			Release:      work.Release,
			DlCount:      work.DlCount,
			Rate:         work.RateAverage2Dp,
			Duration:     work.Duration,
			HasSubtitle:  work.HasSubtitle,
			ThumbnailURL: work.ThumbnailCoverURL,
			MainCoverURL: work.MainCoverURL,
		}
		for _, va := range work.Vas {
			item.Vas = append(item.Vas, va.Name)
		}
		for _, tag := range work.Tags {
			item.Tags = append(item.Tags, tag.Name)
		}
		items = append(items, item)
	}
	return items
}
