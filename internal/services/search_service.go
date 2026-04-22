package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"asmroner/internal/model"
)

var ErrInvalidSearchRequest = errors.New("invalid search request")

type SearchEngine interface {
	SearchForCountResult(asmrOneQueryStr string, count int) (model.SearchResult, error)
}

type SearchService struct {
	engine    SearchEngine
	downloads SearchDownloadEnqueuer
}

type SearchDownloadEnqueuer interface {
	EnqueueDownload(ctx context.Context, req DownloadRequest) (uint, error)
}

type SearchRequest struct {
	Query    string `json:"query"`
	Count    int    `json:"count"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
	Order    string `json:"order"`
	Sort     string `json:"sort"`
	Subtitle string `json:"subtitle"`
}

type SearchDownloadRequest struct {
	Query     string `json:"query"`
	Count     int    `json:"count"`
	OutputDir string `json:"output_dir"`
	Name      string `json:"name"`
}

type SearchExportRequest struct {
	Query  string `json:"query"`
	Count  int    `json:"count"`
	Format string `json:"format"`
}

type SearchListResponse struct {
	Items    []SearchWorkSummary `json:"items"`
	Total    int                 `json:"total"`
	Count    int                 `json:"count"`
	Page     int                 `json:"page"`
	PageSize int                 `json:"page_size"`
}

type SearchWorkSummary struct {
	SourceID     string   `json:"source_id"`
	Title        string   `json:"title"`
	Circle       string   `json:"circle"`
	Release      string   `json:"release"`
	DlCount      int      `json:"dl_count"`
	Rate         float64  `json:"rate"`
	Duration     int      `json:"duration"`
	HasSubtitle  bool     `json:"has_subtitle"`
	Vas          []string `json:"vas"`
	Tags         []string `json:"tags"`
	ThumbnailURL string   `json:"thumbnail_url"`
	MainCoverURL string   `json:"main_cover_url"`
}

func NewSearchService(engine SearchEngine, downloads SearchDownloadEnqueuer) *SearchService {
	return &SearchService{
		engine:    engine,
		downloads: downloads,
	}
}

func (s *SearchService) SetEngine(engine SearchEngine) {
	s.engine = engine
}

func (s *SearchService) Search(_ context.Context, req SearchRequest) (SearchListResponse, error) {
	req, err := normalizeSearchRequest(req)
	if err != nil {
		return SearchListResponse{}, err
	}

	queryParams := model.NewQueryParams(req.Query)
	if err := queryParams.ParseQueryStr(); err != nil {
		return SearchListResponse{}, fmt.Errorf("%w: %s", ErrInvalidSearchRequest, err)
	}
	if queryParams.PageInfo == nil {
		queryParams.PageInfo = &model.PageInfo{}
	}
	queryParams.PageInfo.Page = req.Page
	queryParams.PageInfo.PageSize = req.PageSize
	queryParams.PageInfo.Order = req.Order
	queryParams.PageInfo.Sort = req.Sort
	queryParams.PageInfo.Subtitle = req.Subtitle

	asmrOneQueryStr, err := queryParams.BuildAsmrOneQueryStr()
	if err != nil {
		return SearchListResponse{}, fmt.Errorf("%w: %s", ErrInvalidSearchRequest, err)
	}

	result, err := s.engine.SearchForCountResult(asmrOneQueryStr, req.Count)
	if err != nil {
		return SearchListResponse{}, err
	}

	items := make([]SearchWorkSummary, 0, len(result.Works))
	for _, item := range result.Works {
		summary := SearchWorkSummary{
			SourceID:     item.SourceID,
			Title:        item.Title,
			Circle:       item.Circle.Name,
			Release:      item.Release,
			DlCount:      item.DlCount,
			Rate:         item.RateAverage2Dp,
			Duration:     item.Duration,
			HasSubtitle:  item.HasSubtitle,
			ThumbnailURL: item.ThumbnailCoverURL,
			MainCoverURL: item.MainCoverURL,
		}
		for _, va := range item.Vas {
			summary.Vas = append(summary.Vas, va.Name)
		}
		for _, tag := range item.Tags {
			summary.Tags = append(summary.Tags, tag.Name)
		}
		items = append(items, summary)
	}

	return SearchListResponse{
		Items:    items,
		Total:    result.Pagination.TotalCount,
		Count:    len(items),
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

func (s *SearchService) EnqueueDownload(ctx context.Context, req SearchDownloadRequest) (uint, error) {
	if s.downloads == nil {
		return 0, errors.New("download service not configured")
	}

	result, err := s.Search(ctx, SearchRequest{
		Query: req.Query,
		Count: req.Count,
	})
	if err != nil {
		return 0, err
	}
	if len(result.Items) == 0 {
		return 0, fmt.Errorf("%w: no search results to download", ErrInvalidSearchRequest)
	}

	name := req.Name
	if name == "" {
		name = fmt.Sprintf("Search download (%s)", truncateSearchLabel(req.Query))
	}

	return s.downloads.EnqueueDownload(ctx, DownloadRequest{
		Mode:      "batch",
		IDs:       s.idsFromResults(result.Items),
		OutputDir: req.OutputDir,
		Name:      name,
	})
}

func (s *SearchService) Export(ctx context.Context, req SearchExportRequest) ([]byte, string, string, error) {
	result, err := s.Search(ctx, SearchRequest{
		Query: req.Query,
		Count: req.Count,
	})
	if err != nil {
		return nil, "", "", err
	}

	format := strings.ToLower(strings.TrimSpace(req.Format))
	if format == "" {
		format = "csv"
	}

	switch format {
	case "csv":
		content, err := encodeSearchCSV(result.Items)
		if err != nil {
			return nil, "", "", err
		}
		return content, "text/csv; charset=utf-8", buildSearchExportFilename(req.Query, "csv"), nil
	case "json":
		content, err := json.MarshalIndent(result.Items, "", "  ")
		if err != nil {
			return nil, "", "", err
		}
		return content, "application/json; charset=utf-8", buildSearchExportFilename(req.Query, "json"), nil
	default:
		return nil, "", "", fmt.Errorf("%w: unsupported export format %s", ErrInvalidSearchRequest, req.Format)
	}
}

func normalizeSearchRequest(req SearchRequest) (SearchRequest, error) {
	req.Query = strings.TrimSpace(req.Query)
	if req.Query == "" {
		return SearchRequest{}, fmt.Errorf("%w: query is required", ErrInvalidSearchRequest)
	}
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 20
	}
	if req.PageSize > 200 {
		req.PageSize = 200
	}
	if req.Count <= 0 {
		req.Count = req.PageSize
	}
	if req.Count > 200 {
		req.Count = 200
	}
	req.Order = strings.TrimSpace(req.Order)
	if req.Order == "" {
		req.Order = "release"
	}
	req.Sort = strings.TrimSpace(req.Sort)
	if req.Sort == "" {
		req.Sort = "desc"
	}
	req.Subtitle = strings.TrimSpace(req.Subtitle)
	if req.Subtitle == "" {
		req.Subtitle = "0"
	}
	return req, nil
}

func (s *SearchService) idsFromResults(items []SearchWorkSummary) []string {
	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.SourceID)
	}
	return ids
}

func encodeSearchCSV(items []SearchWorkSummary) ([]byte, error) {
	buf := &bytes.Buffer{}
	writer := csv.NewWriter(buf)
	if err := writer.Write([]string{"source_id", "title", "circle", "release", "rate", "dl_count", "duration", "has_subtitle", "tags", "vas"}); err != nil {
		return nil, err
	}
	for _, item := range items {
		if err := writer.Write([]string{
			item.SourceID,
			item.Title,
			item.Circle,
			item.Release,
			strconv.FormatFloat(item.Rate, 'f', 2, 64),
			strconv.Itoa(item.DlCount),
			strconv.Itoa(item.Duration),
			strconv.FormatBool(item.HasSubtitle),
			strings.Join(item.Tags, ","),
			strings.Join(item.Vas, ","),
		}); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func buildSearchExportFilename(query string, ext string) string {
	return fmt.Sprintf("search_%s.%s", sanitizeExportName(truncateSearchLabel(query)), ext)
}

func truncateSearchLabel(query string) string {
	query = strings.TrimSpace(query)
	if query == "" {
		return "results"
	}
	runes := []rune(query)
	if len(runes) > 24 {
		return string(runes[:24])
	}
	return query
}

func sanitizeExportName(input string) string {
	replacer := strings.NewReplacer(
		" ", "_",
		"/", "_",
		"\\", "_",
		":", "_",
		"?", "_",
		"*", "_",
		"\"", "_",
		"<", "_",
		">", "_",
		"|", "_",
	)
	return replacer.Replace(input)
}
