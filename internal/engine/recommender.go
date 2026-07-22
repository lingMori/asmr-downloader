package engine

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"asmroner/internal/consts"
	"asmroner/internal/logger"
	"asmroner/internal/model"
	"asmroner/internal/paths"

	"github.com/google/uuid"
)

// RecommenderUUIDFileName 推荐系统UUID缓存文件名
const RecommenderUUIDFileName = "recommender_uuid"

// recommenderNeighborsPageSize 相似作品固定分页大小
const recommenderNeighborsPageSize = 20

func recommenderUUIDFilePath() string {
	return filepath.Join(paths.DataDir(), RecommenderUUIDFileName)
}

// RecommenderUUID 读取推荐系统UUID，不存在时生成UUIDv4并落盘
func (m *EngineManager) RecommenderUUID() string {
	path := recommenderUUIDFilePath()
	if data, err := os.ReadFile(path); err == nil {
		if saved := strings.TrimSpace(string(data)); saved != "" {
			return saved
		}
	}
	generated := uuid.NewString()
	if err := os.MkdirAll(paths.DataDir(), 0o755); err != nil {
		logger.Logger().Error("create metadata dir for recommender uuid failed: " + err.Error())
		return generated
	}
	if err := os.WriteFile(path, []byte(generated), 0o600); err != nil {
		logger.Logger().Error("save recommender uuid failed: " + err.Error())
	}
	return generated
}

// saveRecommenderUUID 登录成功后覆盖写入上游返回的推荐系统UUID
func saveRecommenderUUID(recommenderUUID string) error {
	if err := os.MkdirAll(paths.DataDir(), 0o755); err != nil {
		return err
	}
	return os.WriteFile(recommenderUUIDFilePath(), []byte(strings.TrimSpace(recommenderUUID)), 0o600)
}

// GetPopularWorks 热门推荐
func (m *EngineManager) GetPopularWorks(ctx context.Context, keyword string, page, pageSize, subtitle int, localSubtitledWorks []string) (model.SearchResult, error) {
	body := map[string]interface{}{
		"keyword":             keyword,
		"page":                page,
		"pageSize":            pageSize,
		"subtitle":            subtitle,
		"localSubtitledWorks": localSubtitledWorks,
		"withPlaylistStatus":  []interface{}{},
	}
	return m.postRecommenderList(ctx, consts.AsmrApiPath.PopularPath, body)
}

// GetRecommendWorks 个性化推荐（携带推荐系统UUID）
func (m *EngineManager) GetRecommendWorks(ctx context.Context, keyword string, page, pageSize, subtitle int, localSubtitledWorks []string) (model.SearchResult, error) {
	body := map[string]interface{}{
		"keyword":             keyword,
		"page":                page,
		"pageSize":            pageSize,
		"subtitle":            subtitle,
		"localSubtitledWorks": localSubtitledWorks,
		"withPlaylistStatus":  []interface{}{},
		"recommenderUuid":     m.RecommenderUUID(),
	}
	return m.postRecommenderList(ctx, consts.AsmrApiPath.RecommendPath, body)
}

// GetWorkNeighbors 相似作品推荐
func (m *EngineManager) GetWorkNeighbors(ctx context.Context, itemID int, localSubtitledWorks []string) (model.SearchResult, error) {
	body := map[string]interface{}{
		"keyword":             "",
		"itemId":              itemID,
		"pageSize":            recommenderNeighborsPageSize,
		"localSubtitledWorks": localSubtitledWorks,
		"withPlaylistStatus":  []interface{}{},
	}
	return m.postRecommenderList(ctx, consts.AsmrApiPath.NeighborsPath, body)
}

// SendFeedback 上报推荐系统反馈，上游返回非2xx才视为失败
func (m *EngineManager) SendFeedback(ctx context.Context, itemID int, feedbackType string) error {
	url := m.ApiUrl + consts.AsmrApiPath.FeedbackPath
	body := map[string]interface{}{
		"type":            feedbackType,
		"recommenderUuid": m.RecommenderUUID(),
		"itemId":          itemID,
	}

	req := m.Client.R().
		SetContext(ctx).
		SetHeaders(m.cloneHeaders()).
		SetBody(body)
	if strings.TrimSpace(m.JWTToken) != "" {
		req.SetHeader("Authorization", m.JWTToken)
	}
	resp, err := req.Post(url)
	if err != nil {
		logger.RecordFailure("RecommenderFeedback ", url, err.Error())
		return err
	}
	if !resp.IsSuccess() {
		logger.RecordFailure("RecommenderFeedback ", url, resp.Status())
		return errors.New("Request error,status code: " + strconv.Itoa(resp.StatusCode()))
	}
	return nil
}

// postRecommenderList 推荐系统列表接口通用POST，响应与作品搜索列表同构
func (m *EngineManager) postRecommenderList(ctx context.Context, path string, body map[string]interface{}) (model.SearchResult, error) {
	url := m.ApiUrl + path
	var result model.SearchResult

	req := m.Client.R().
		SetContext(ctx).
		SetHeaders(m.cloneHeaders()).
		SetBody(body).
		SetResult(&result)
	if strings.TrimSpace(m.JWTToken) != "" {
		req.SetHeader("Authorization", m.JWTToken)
	}
	resp, err := req.Post(url)
	if err != nil {
		logger.RecordFailure("Recommender ", url, err.Error())
		return model.SearchResult{}, err
	}
	if !resp.IsSuccess() {
		logger.RecordFailure("Recommender ", url, resp.Status())
		return model.SearchResult{}, errors.New("Request error,status code: " + strconv.Itoa(resp.StatusCode()))
	}
	return result, nil
}
