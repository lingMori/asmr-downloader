package services

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"asmroner/internal/model"
	"asmroner/internal/utils"

	"gorm.io/gorm"
)

var (
	ErrInvalidDiscoverRequest   = errors.New("invalid discover request")
	ErrDiscoverTrackNotFound    = errors.New("discover track not found")
	ErrDiscoverTrackNotPlayable = errors.New("discover track is not playable")
)

type DiscoverService struct {
	db     *gorm.DB
	engine DiscoverEngine
}

type DiscoverEngine interface {
	SearchForCountResult(asmrOneQueryStr string, count int) (model.SearchResult, error)
	GetWorkInfo(id string) (model.WorkInfo, error)
	GetVoiceTracks(id string) ([]model.Track, error)
	BuildTrackMediaURL(hash string) string
	OpenTrackStream(ctx context.Context, streamURL string, rangeHeader string) (*http.Response, error)
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
	PageSize int                   `json:"page_size"`
}

type DiscoverWorkSummary struct {
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
	SourceURL  string              `json:"source_url"`
	CircleID   int                 `json:"circle_id"`
	Price      int                 `json:"price"`
	ReviewCnt  int                 `json:"review_count"`
	RateCnt    int                 `json:"rate_count"`
	CreateDate string              `json:"create_date"`
	WorkAttrs  string              `json:"work_attributes"`
	Age        string              `json:"age_category"`
	Tracks     []model.Track       `json:"tracks"`
}

type DiscoverTrackStream struct {
	Track    model.Track
	Response *http.Response
}

func NewDiscoverService(db *gorm.DB, eng DiscoverEngine) *DiscoverService {
	return &DiscoverService{db: db, engine: eng}
}

func (s *DiscoverService) SetEngine(engine DiscoverEngine) {
	s.engine = engine
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
	canonicalSourceID, number, err := normalizeDiscoverSourceID(sourceID)
	if err != nil {
		return DiscoverWorkDetail{}, err
	}

	work, err := s.engine.GetWorkInfo(number)
	if err != nil {
		return DiscoverWorkDetail{}, err
	}
	tracks, err := s.engine.GetVoiceTracks(number)
	if err != nil {
		return DiscoverWorkDetail{}, err
	}

	if work.SourceID != "" {
		canonicalSourceID = work.SourceID
	}
	tracks = annotateDiscoverTracks(canonicalSourceID, tracks, s.discoverTrackMediaURL)

	summary := DiscoverWorkSummary{
		SourceID:     canonicalSourceID,
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

func (s *DiscoverService) OpenTrackStream(ctx context.Context, sourceID string, trackID string, rangeHeader string) (DiscoverTrackStream, error) {
	if s.engine == nil {
		return DiscoverTrackStream{}, errors.New("discover engine is not available")
	}

	_, number, err := normalizeDiscoverSourceID(sourceID)
	if err != nil {
		return DiscoverTrackStream{}, err
	}

	tracks, err := s.engine.GetVoiceTracks(number)
	if err != nil {
		return DiscoverTrackStream{}, err
	}
	track, ok := findDiscoverTrackByID(tracks, strings.TrimSpace(trackID))
	if !ok {
		return DiscoverTrackStream{}, ErrDiscoverTrackNotFound
	}
	streamURL := s.discoverTrackMediaURL(track)
	if isDiscoverTrackFolder(track) || !isDiscoverPlayableAudioTrack(track) || streamURL == "" {
		return DiscoverTrackStream{}, ErrDiscoverTrackNotPlayable
	}

	resp, err := s.engine.OpenTrackStream(ctx, streamURL, rangeHeader)
	if err != nil {
		return DiscoverTrackStream{}, err
	}
	track.ID = strings.TrimSpace(trackID)
	return DiscoverTrackStream{
		Track:    track,
		Response: resp,
	}, nil
}

func (s *DiscoverService) OpenTrackFile(ctx context.Context, sourceID string, trackID string, rangeHeader string) (DiscoverTrackStream, error) {
	if s.engine == nil {
		return DiscoverTrackStream{}, errors.New("discover engine is not available")
	}

	_, number, err := normalizeDiscoverSourceID(sourceID)
	if err != nil {
		return DiscoverTrackStream{}, err
	}

	tracks, err := s.engine.GetVoiceTracks(number)
	if err != nil {
		return DiscoverTrackStream{}, err
	}
	track, ok := findDiscoverTrackByID(tracks, strings.TrimSpace(trackID))
	if !ok {
		return DiscoverTrackStream{}, ErrDiscoverTrackNotFound
	}
	fileURL := s.discoverTrackMediaURL(track)
	if isDiscoverTrackFolder(track) || !isDiscoverSubtitleTrack(track) || fileURL == "" {
		return DiscoverTrackStream{}, ErrDiscoverTrackNotPlayable
	}

	resp, err := s.engine.OpenTrackStream(ctx, fileURL, rangeHeader)
	if err != nil {
		return DiscoverTrackStream{}, err
	}
	track.ID = strings.TrimSpace(trackID)
	return DiscoverTrackStream{
		Track:    track,
		Response: resp,
	}, nil
}

func normalizeDiscoverSourceID(sourceID string) (canonicalSourceID string, number string, err error) {
	valid, prefix, number, err := utils.IsValidDlsiteID(strings.ToUpper(strings.TrimSpace(sourceID)))
	if err != nil || !valid {
		return "", "", ErrInvalidDiscoverRequest
	}
	return strings.ToUpper(prefix) + number, number, nil
}

func annotateDiscoverTracks(sourceID string, tracks []model.Track, resolveMediaURL func(model.Track) string) []model.Track {
	out := make([]model.Track, len(tracks))
	for index, track := range tracks {
		out[index] = annotateDiscoverTrack(sourceID, track, strconv.Itoa(index), resolveMediaURL)
	}
	return out
}

func annotateDiscoverTrack(sourceID string, track model.Track, trackID string, resolveMediaURL func(model.Track) string) model.Track {
	track.ID = trackID
	streamURL := resolveMediaURL(track)
	if len(track.Children) > 0 {
		children := make([]model.Track, len(track.Children))
		for index, child := range track.Children {
			children[index] = annotateDiscoverTrack(sourceID, child, fmt.Sprintf("%s.%d", trackID, index), resolveMediaURL)
		}
		track.Children = children
	}
	if !isDiscoverTrackFolder(track) && isDiscoverPlayableAudioTrack(track) && streamURL != "" {
		track.PlayURL = fmt.Sprintf(
			"/api/discover/works/%s/tracks/%s/stream",
			url.PathEscape(sourceID),
			url.PathEscape(trackID),
		)
	}
	if !isDiscoverTrackFolder(track) && isDiscoverSubtitleTrack(track) && streamURL != "" {
		track.FileURL = fmt.Sprintf(
			"/api/discover/works/%s/tracks/%s/file",
			url.PathEscape(sourceID),
			url.PathEscape(trackID),
		)
	}
	track.MediaStreamURL = ""
	track.MediaDownloadURL = ""
	return track
}

func (s *DiscoverService) discoverTrackMediaURL(track model.Track) string {
	if streamURL := strings.TrimSpace(track.MediaStreamURL); streamURL != "" {
		return streamURL
	}
	if downloadURL := strings.TrimSpace(track.MediaDownloadURL); downloadURL != "" {
		return downloadURL
	}
	if hash := strings.TrimSpace(track.Hash); hash != "" && s.engine != nil {
		return s.engine.BuildTrackMediaURL(hash)
	}
	return ""
}

func findDiscoverTrackByID(tracks []model.Track, trackID string) (model.Track, bool) {
	indexes, ok := parseDiscoverTrackID(trackID)
	if !ok {
		return model.Track{}, false
	}

	current := tracks
	for depth, index := range indexes {
		if index >= len(current) {
			return model.Track{}, false
		}
		track := current[index]
		if depth == len(indexes)-1 {
			return track, true
		}
		current = track.Children
	}
	return model.Track{}, false
}

func parseDiscoverTrackID(trackID string) ([]int, bool) {
	if trackID == "" {
		return nil, false
	}
	parts := strings.Split(trackID, ".")
	indexes := make([]int, 0, len(parts))
	for _, part := range parts {
		if part == "" {
			return nil, false
		}
		index, err := strconv.Atoi(part)
		if err != nil || index < 0 {
			return nil, false
		}
		indexes = append(indexes, index)
	}
	return indexes, true
}

func isDiscoverTrackFolder(track model.Track) bool {
	return strings.Contains(strings.ToLower(track.Type), "folder") || len(track.Children) > 0
}

func isDiscoverPlayableAudioTrack(track model.Track) bool {
	trackType := strings.ToLower(strings.TrimSpace(track.Type))
	if strings.Contains(trackType, "audio") {
		return true
	}
	title := strings.ToLower(strings.TrimSpace(track.Title))
	for _, suffix := range []string{".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus"} {
		if strings.HasSuffix(title, suffix) {
			return true
		}
	}
	return false
}

func isDiscoverSubtitleTrack(track model.Track) bool {
	trackType := strings.ToLower(strings.TrimSpace(track.Type))
	if strings.Contains(trackType, "subtitle") {
		return true
	}
	title := strings.ToLower(strings.TrimSpace(track.Title))
	for _, suffix := range []string{".lrc", ".srt", ".vtt", ".ass", ".ssa"} {
		if strings.HasSuffix(title, suffix) {
			return true
		}
	}
	return false
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
	for _, tag := range splitCommaList(req.Tag) {
		query = query.Where("tags LIKE ?", "%"+tag+"%")
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

	order := "dl_count " + normalizeDiscoverSort(req.Sort)
	switch req.Order {
	case "release":
		order = "release " + normalizeDiscoverSort(req.Sort)
	case "rate_average_2dp":
		order = "rate_average_2dp " + normalizeDiscoverSort(req.Sort)
	case "review_count":
		order = "review_count " + normalizeDiscoverSort(req.Sort)
	case "price":
		order = "price " + normalizeDiscoverSort(req.Sort)
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

func normalizeDiscoverSort(sort string) string {
	if strings.EqualFold(strings.TrimSpace(sort), "asc") {
		return "asc"
	}
	return "desc"
}

func buildDiscoverQuery(req DiscoverSearchRequest) (string, error) {
	parts := make([]string, 0, 4)
	if req.Query != "" {
		parts = append(parts, req.Query)
	}
	for _, tag := range splitCommaList(req.Tag) {
		parts = append(parts, "$tag:"+tag+"$")
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
