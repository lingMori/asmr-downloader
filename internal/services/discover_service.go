package services

import (
	"context"
	"errors"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"asmroner/internal/engine"
	"asmroner/internal/model"
	"asmroner/internal/utils"

	"gorm.io/gorm"
)

var ErrInvalidDiscoverRequest = errors.New("invalid discover request")

type DiscoverService struct {
	db     *gorm.DB
	engine *engine.EngineManager
}

type DiscoverSearchRequest struct {
	Query    string
	Tag      string
	Circle   string
	Va       string
	Subtitle string
	Order    string
	Sort     string
	Page     int
	PageSize int
}

type DiscoverSearchResponse struct {
	Items    []DiscoverWorkSummary `json:"items"`
	Facets   DiscoverFacets        `json:"facets"`
	Total    int                   `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"pageSize"`
}

type DiscoverWorkSummary struct {
	SourceID     string   `json:"sourceId"`
	Title        string   `json:"title"`
	Circle       string   `json:"circle"`
	Release      string   `json:"release"`
	DlCount      int      `json:"dlCount"`
	Rate         float64  `json:"rate"`
	Duration     int      `json:"duration"`
	HasSubtitle  bool     `json:"hasSubtitle"`
	Vas          []string `json:"vas"`
	Tags         []string `json:"tags"`
	ThumbnailURL string   `json:"thumbnailUrl"`
	MainCoverURL string   `json:"mainCoverUrl"`
}

type DiscoverFacet struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

type DiscoverFacets struct {
	Tags    []DiscoverFacet `json:"tags"`
	Circles []DiscoverFacet `json:"circles"`
	Vas     []DiscoverFacet `json:"vas"`
}

type DiscoverWorkDetail struct {
	Summary    DiscoverWorkSummary `json:"summary"`
	SourceURL  string              `json:"sourceUrl"`
	CircleID   int                 `json:"circleId"`
	Price      int                 `json:"price"`
	ReviewCnt  int                 `json:"reviewCount"`
	RateCnt    int                 `json:"rateCount"`
	CreateDate string              `json:"createDate"`
	WorkAttrs  string              `json:"workAttributes"`
	Age        string              `json:"ageCategory"`
	Tracks     []model.Track       `json:"tracks"`
}

func NewDiscoverService(db *gorm.DB, eng *engine.EngineManager) *DiscoverService {
	return &DiscoverService{db: db, engine: eng}
}

func (s *DiscoverService) Search(ctx context.Context, req DiscoverSearchRequest) (DiscoverSearchResponse, error) {
	normalizeDiscoverRequest(&req)

	if req.Query == "" && req.Tag == "" && req.Circle == "" && req.Va == "" {
		return s.searchFromMetadata(ctx, req)
	}

	query, err := buildDiscoverQuery(req)
	if err != nil {
		return DiscoverSearchResponse{}, err
	}

	result, err := s.engine.SearchForCountResult(query, req.PageSize)
	if err != nil {
		return DiscoverSearchResponse{}, err
	}

	items := make([]DiscoverWorkSummary, 0, len(result.Works))
	tagCounts := map[string]int{}
	circleCounts := map[string]int{}
	vaCounts := map[string]int{}

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
			if va.Name != "" {
				vaCounts[va.Name]++
			}
		}
		for _, tag := range work.Tags {
			item.Tags = append(item.Tags, tag.Name)
			if tag.Name != "" {
				tagCounts[tag.Name]++
			}
		}
		if item.Circle != "" {
			circleCounts[item.Circle]++
		}
		items = append(items, item)
	}

	return DiscoverSearchResponse{
		Items:    items,
		Facets:   buildDiscoverFacets(tagCounts, circleCounts, vaCounts),
		Total:    result.Pagination.TotalCount,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

func (s *DiscoverService) GetWorkDetail(_ context.Context, sourceID string) (DiscoverWorkDetail, error) {
	valid, _, number, err := utils.IsValidDlsiteID(strings.ToUpper(strings.TrimSpace(sourceID)))
	if err != nil || !valid {
		return DiscoverWorkDetail{}, ErrInvalidDiscoverRequest
	}

	work, err := s.engine.GetWorkInfo(number)
	if err != nil {
		return DiscoverWorkDetail{}, err
	}
	tracks, err := s.engine.GetVoiceTracks(number)
	if err != nil {
		return DiscoverWorkDetail{}, err
	}

	summary := DiscoverWorkSummary{
		SourceID:     work.SourceID,
		Title:        work.Title,
		Circle:       work.Circle.Name,
		Release:      work.Release,
		DlCount:      work.DlCount,
		Rate:         float64(work.RateAverage2Dp),
		Duration:     work.Duration,
		HasSubtitle:  work.HasSubtitle,
		ThumbnailURL: work.ThumbnailCoverURL,
		MainCoverURL: work.MainCoverURL,
	}
	for _, va := range work.Vas {
		summary.Vas = append(summary.Vas, va.Name)
	}
	for _, tag := range work.Tags {
		summary.Tags = append(summary.Tags, tag.Name)
	}

	return DiscoverWorkDetail{
		Summary:    summary,
		SourceURL:  work.SourceURL,
		CircleID:   work.CircleID,
		Price:      work.Price,
		ReviewCnt:  work.ReviewCount,
		RateCnt:    work.RateCount,
		CreateDate: work.CreateDate,
		WorkAttrs:  work.WorkAttributes,
		Age:        work.AgeCategoryString,
		Tracks:     tracks,
	}, nil
}

func (s *DiscoverService) searchFromMetadata(ctx context.Context, req DiscoverSearchRequest) (DiscoverSearchResponse, error) {
	if s.db == nil {
		return DiscoverSearchResponse{}, nil
	}

	var works []model.MetadataWork
	query := s.db.WithContext(ctx).Model(&model.MetadataWork{})
	if req.Subtitle == "1" {
		query = query.Where("has_subtitle = ?", true)
	}
	if req.Tag != "" {
		query = query.Where("tags LIKE ?", "%"+req.Tag+"%")
	}
	if req.Circle != "" {
		query = query.Where("name = ?", req.Circle)
	}
	if req.Va != "" {
		query = query.Where("vas LIKE ?", "%"+req.Va+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return DiscoverSearchResponse{}, err
	}

	order := "dl_count desc"
	if req.Order == "release" {
		order = "release desc"
	}

	if err := query.Order(order).
		Offset((req.Page - 1) * req.PageSize).
		Limit(req.PageSize).
		Find(&works).Error; err != nil {
		return DiscoverSearchResponse{}, err
	}

	items := make([]DiscoverWorkSummary, 0, len(works))
	tagCounts := map[string]int{}
	circleCounts := map[string]int{}
	vaCounts := map[string]int{}

	for _, work := range works {
		item := DiscoverWorkSummary{
			SourceID:    work.SourceID,
			Title:       work.Title,
			Circle:      work.Name,
			Release:     work.Release,
			DlCount:     work.DlCount,
			Rate:        work.RateAverage2Dp,
			Duration:    work.Duration,
			HasSubtitle: work.HasSubtitle,
			Vas:         splitCommaList(work.Vas),
			Tags:        splitCommaList(work.Tags),
		}
		for _, tag := range item.Tags {
			tagCounts[tag]++
		}
		for _, va := range item.Vas {
			vaCounts[va]++
		}
		if item.Circle != "" {
			circleCounts[item.Circle]++
		}
		items = append(items, item)
	}

	return DiscoverSearchResponse{
		Items:    items,
		Facets:   buildDiscoverFacets(tagCounts, circleCounts, vaCounts),
		Total:    int(total),
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

func normalizeDiscoverRequest(req *DiscoverSearchRequest) {
	req.Query = strings.TrimSpace(req.Query)
	req.Tag = strings.TrimSpace(req.Tag)
	req.Circle = strings.TrimSpace(req.Circle)
	req.Va = strings.TrimSpace(req.Va)
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 || req.PageSize > 48 {
		req.PageSize = 24
	}
	if req.Order == "" {
		req.Order = "dl_count"
	}
	if req.Sort == "" {
		req.Sort = "desc"
	}
	if req.Subtitle == "" {
		req.Subtitle = "0"
	}
}

func buildDiscoverQuery(req DiscoverSearchRequest) (string, error) {
	parts := make([]string, 0, 4)
	if req.Query != "" {
		parts = append(parts, req.Query)
	}
	if req.Tag != "" {
		parts = append(parts, "$tag:"+req.Tag+"$")
	}
	if req.Circle != "" {
		parts = append(parts, "$circle:"+req.Circle+"$")
	}
	if req.Va != "" {
		parts = append(parts, "$va:"+req.Va+"$")
	}
	if len(parts) == 0 {
		return "", ErrInvalidDiscoverRequest
	}

	encoded := url.QueryEscape(strings.Join(parts, " "))
	encoded = strings.ReplaceAll(encoded, "+", "%20")

	pageInfo := model.PageInfo{
		Order:                   req.Order,
		Sort:                    req.Sort,
		Subtitle:                req.Subtitle,
		IncludeTranslationWorks: true,
		Page:                    req.Page,
		PageSize:                req.PageSize,
	}

	return encoded + buildPageInfoQuery(pageInfo), nil
}

func buildPageInfoQuery(pageInfo model.PageInfo) string {
	return "?order=" + pageInfo.Order +
		"&sort=" + pageInfo.Sort +
		"&page=" + intToString(pageInfo.Page) +
		"&pageSize=" + intToString(pageInfo.PageSize) +
		"&subtitle=" + pageInfo.Subtitle +
		"&includeTranslationWorks=true"
}

func buildDiscoverFacets(tags, circles, vas map[string]int) DiscoverFacets {
	return DiscoverFacets{
		Tags:    topFacets(tags, 12),
		Circles: topFacets(circles, 8),
		Vas:     topFacets(vas, 8),
	}
}

func topFacets(source map[string]int, limit int) []DiscoverFacet {
	values := make([]DiscoverFacet, 0, len(source))
	for key, count := range source {
		if key == "" {
			continue
		}
		values = append(values, DiscoverFacet{Value: key, Count: count})
	}
	sort.Slice(values, func(i, j int) bool {
		if values[i].Count == values[j].Count {
			return values[i].Value < values[j].Value
		}
		return values[i].Count > values[j].Count
	})
	if len(values) > limit {
		values = values[:limit]
	}
	return values
}

func splitCommaList(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}

func intToString(v int) string {
	if v < 0 {
		v = 0
	}
	return strconv.Itoa(v)
}
