package engine

import (
	"asmroner/internal/consts"
	"asmroner/internal/database"
	"asmroner/internal/logger"
	"asmroner/internal/model"
	"asmroner/internal/utils"
	"context"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"

	"strings"
	"sync/atomic"
	"time"

	"github.com/alitto/pond/v2"
	"github.com/go-resty/resty/v2"
	"golang.org/x/net/proxy"
	_ "golang.org/x/net/proxy"
	"gorm.io/gorm/clause"

	"gorm.io/gorm"
)

// EngineManager 下载器
type EngineManager struct {
	DB           *gorm.DB
	SyncLimiter  *SmartLimiter // 专门用于同步列表
	DownLimiter  *SmartLimiter // 专门用于下载文件
	Config       *model.Config
	WorkerPool   *pond.Pool
	DownloadPool *pond.Pool
	Client       *resty.Client
	JWTToken     string
	AuthState    string
	AuthMessage  string
	ApiUrl       string
	//批量通道  在元数据初始化的时候
	MetadataWorkBatchChan chan []model.MetadataWork
	//标记是否开启  条件db中有数据了
	//MetadataWorkBatchMode bool
	SyncWorkerPool *pond.Pool
	// headers 缓存的请求头模板（由 Config.Downloader.HTTP 构建）。
	headers map[string]string
}

// staticHeaders 返回与浏览器指纹无关的固定头（accept、cache-control 等）。
func staticHeaders() map[string]string {
	return map[string]string{
		"accept":           "application/json, text/plain, */*",
		"accept-encoding":  "gzip",
		"cache-control":    "no-cache",
		"content-type":     "application/json",
		"pragma":           "no-cache",
		"priority":         "u=1, i",
		"sec-ch-ua-mobile": "?0",
		"sec-fetch-dest":   "empty",
		"sec-fetch-mode":   "cors",
		"sec-fetch-site":   "cross-site",
	}
}

// buildHeadersFromConfig 根据配置构建一份完整的请求头。
// 调用方拿到的是独立 map，可安全添加 Authorization 等动态值。
func buildHeadersFromConfig(cfg model.HTTPHeaders) map[string]string {
	defaults := model.DefaultHTTPHeaders()
	pick := func(custom, fallback string) string {
		if strings.TrimSpace(custom) != "" {
			return custom
		}
		return fallback
	}
	headers := staticHeaders()
	headers["user-agent"] = pick(cfg.UserAgent, defaults.UserAgent)
	headers["origin"] = pick(cfg.Origin, defaults.Origin)
	headers["referer"] = pick(cfg.Referer, defaults.Referer)
	headers["accept-language"] = pick(cfg.AcceptLanguage, defaults.AcceptLanguage)
	headers["sec-ch-ua"] = pick(cfg.SecChUa, defaults.SecChUa)
	headers["sec-ch-ua-platform"] = pick(cfg.SecChUaPlatform, defaults.SecChUaPlatform)
	for k, v := range cfg.Extra {
		headers[strings.ToLower(k)] = v
	}
	return headers
}

// 在初始化 EngineManager 时读取配置
func NewEngineManager(cfg *model.Config) *EngineManager {
	if cfg == nil {
		logger.Logger().Error("engine init: nil config")
		return nil
	}
	engine, err := NewEngineManagerWithConfig(cfg)
	if err != nil {
		logger.Logger().Error("engine auth login failed", slog.Any("error", err))
	}
	return engine
}

func NewEngineManagerWithConfig(config *model.Config) (*EngineManager, error) {
	if config == nil {
		return nil, fmt.Errorf("config is nil")
	}
	//limit := config.Limit
	//downloadJitterMax := limit.DownloadJitterMax
	//downloadQPS := limit.DownloadQPS
	//downloadJitterMin := limit.DownloadJitterMin
	//syncJitterMax := limit.SyncJitterMax
	//syncQPS := limit.SyncQPS
	//syncJitterMin := limit.SyncJitterMin
	// 读取 Viper 配置...

	//并发
	workers := config.Downloader.MaxWorkers
	pool := pond.NewPool(workers)
	downloadPool := pond.NewPool(workers)
	//2个并发刚好
	syncPool := pond.NewPool(2)

	//上下文
	//ctx, cancel := context.WithCancel(context.Background())

	//resty配置
	client, err := buildRestyClient(config)
	if err != nil {
		fmt.Printf("build resty client failed: %v", err)
		return nil, err
	}
	//获取api地址
	apiUrl := GetRespFastestSiteUrl(config.Downloader.ApiUrl)

	engine := &EngineManager{
		DB: database.Database,
		SyncLimiter: NewSmartLimiter(
			config.Limit.SyncQPS,
			1,
			config.Limit.SyncJitterMin,
			config.Limit.SyncJitterMax,
		),
		DownLimiter: NewSmartLimiter(
			config.Limit.DownloadQPS,
			1,
			config.Limit.DownloadJitterMin,
			config.Limit.DownloadJitterMax,
		),
		//配置
		Config:       config,
		WorkerPool:   &pool,
		DownloadPool: &downloadPool,
		Client:       client,
		JWTToken:     "",
		AuthState:    "unknown",
		AuthMessage:  "未登录",
		ApiUrl:       apiUrl,
		//批量通道  在元数据初始化的时候  队列2也刚好 不会触发429
		MetadataWorkBatchChan: make(chan []model.MetadataWork, 50),
		//后续增量使用的通道
		//标记是否开启  条件db中有数据了
		//MetadataWorkBatchMode: true,
		SyncWorkerPool: &syncPool,
		headers:        buildHeadersFromConfig(config.Downloader.HTTP),
	}
	//默认登录
	authErr := engine.AuthLogin()
	//检测需要使用batch channel
	//engine.CheckIfMetadataWorkBatchMode()
	return engine, authErr
}

func buildRestyClient(config *model.Config) (*resty.Client, error) {
	proxyStr := config.Downloader.ProxyUrl
	retries := config.Downloader.MaxRetries
	r := resty.New()
	//http://112.123.45.67:8080
	if strings.Contains(proxyStr, "http") || strings.Contains(proxyStr, "https") {
		r.SetProxy(proxyStr)
	}
	//socks5://user123:pass456@112.123.45.67:8080
	if strings.Contains(proxyStr, "socks5") {
		if strings.Contains(proxyStr, "@") {
			//use auth
			//user123:pass456@112.123.45.67:8080
			authStr := strings.Split(proxyStr, "@")[0]
			proxyAddr := strings.Split(proxyStr, "@")[1]
			username := strings.Split(authStr, ":")[0]
			password := strings.Split(authStr, ":")[1]
			auth := &proxy.Auth{
				User:     username,
				Password: password,
			}

			dialer, err := proxy.SOCKS5("tcp", proxyAddr, auth, proxy.Direct)
			if err != nil {
				return nil, fmt.Errorf("create socks5 dialer failed: %w", err)
			}
			r.SetTransport(&http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					return dialer.Dial(network, addr)
				},
			})

		} else {
			//no auth
			proxyAddr := strings.Split(proxyStr, "://")[1]
			dialer, err := proxy.SOCKS5("tcp", proxyAddr, nil, proxy.Direct)
			if err != nil {
				return nil, fmt.Errorf("create socks5 dialer failed: %w", err)
			}
			r.SetTransport(&http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					return dialer.Dial(network, addr)
				},
			})
		}

	}
	client := r.SetRetryCount(retries).
		SetRetryWaitTime(2 * time.Second)
	ua := strings.TrimSpace(config.Downloader.HTTP.UserAgent)
	if ua == "" {
		ua = utils.RandomUserAgent(consts.UserAgents)
	}
	client.SetHeader("User-Agent", ua)
	return client, nil
}

// cloneHeaders 返回当前 EngineManager 配置的请求头独立副本，供每次请求附加 Authorization 等动态字段。
func (m *EngineManager) cloneHeaders() map[string]string {
	out := make(map[string]string, len(m.headers))
	for k, v := range m.headers {
		out[k] = v
	}
	return out
}

//func (m *EngineManager) CheckIfMetadataWorkBatchMode() {
//	var data model.MetadataWork
//	has := m.DB.Model(&model.MetadataWork{}).Limit(1).Find(&data).RowsAffected > 0
//	if has {
//		m.MetadataWorkBatchMode = false
//	}
//}

// AuthLogin 登录获取JWT Token
func (m *EngineManager) AuthLogin() error {
	headers := m.cloneHeaders()
	m.JWTToken = ""
	m.AuthState = "unknown"
	m.AuthMessage = "正在登录"

	user := struct {
		Name     string `json:"name"`
		Password string `json:"password"`
	}{
		Name:     m.Config.User.Account,
		Password: m.Config.User.Password,
	}
	result := make(map[string]interface{})

	response, err := m.Client.R().
		SetHeaders(headers).
		SetResult(&result).
		SetBody(&user).
		Post(m.ApiUrl + consts.AsmrApiPath.LoginPath)
	if err != nil {
		m.AuthState = "error"
		m.AuthMessage = "登录失败: " + err.Error()
		return errors.New(m.AuthMessage)
	}
	if response == nil {
		m.AuthState = "error"
		m.AuthMessage = "登录失败: empty response"
		return errors.New(m.AuthMessage)
	}
	if !response.IsSuccess() {
		m.AuthState = "error"
		m.AuthMessage = "登录失败: " + response.Status()
		return errors.New(m.AuthMessage)
	}
	// 检查响应是否包含 token
	token, ok := result["token"].(string)
	if !ok || token == "" {
		m.AuthState = "error"
		m.AuthMessage = "登录失败: token not found in response"
		return errors.New(m.AuthMessage)
	}
	m.JWTToken = "Bearer " + token
	m.AuthState = "success"
	m.AuthMessage = "登录成功"
	// 登录成功后保存上游返回的推荐系统UUID
	if userInfo, ok := result["user"].(map[string]interface{}); ok {
		if recommenderUUID, ok := userInfo["recommenderUuid"].(string); ok && strings.TrimSpace(recommenderUUID) != "" {
			if err := saveRecommenderUUID(recommenderUUID); err != nil {
				logger.Logger().Error("save recommender uuid failed: " + err.Error())
			}
		}
	}
	return nil
}

// CheckAuthStatus performs a lightweight authenticated request with the current token.
func (m *EngineManager) CheckAuthStatus(ctx context.Context) error {
	if strings.TrimSpace(m.JWTToken) == "" {
		m.AuthState = "error"
		m.AuthMessage = "登录状态未确认，请重新登录"
		return errors.New(m.AuthMessage)
	}

	headers := m.cloneHeaders()
	response, err := m.Client.R().
		SetContext(ctx).
		SetHeader("Authorization", m.JWTToken).
		SetHeaders(headers).
		Get(m.ApiUrl + consts.AsmrApiPath.SyncMetaPath)
	if err != nil {
		m.AuthState = "error"
		m.AuthMessage = "登录状态检查失败: " + err.Error()
		return errors.New(m.AuthMessage)
	}
	if response == nil {
		m.AuthState = "error"
		m.AuthMessage = "登录状态检查失败: empty response"
		return errors.New(m.AuthMessage)
	}
	if response.StatusCode() == http.StatusUnauthorized || response.StatusCode() == http.StatusForbidden {
		m.AuthState = "error"
		m.AuthMessage = "登录状态已失效，请重新登录"
		return errors.New(m.AuthMessage)
	}
	if !response.IsSuccess() {
		m.AuthState = "error"
		m.AuthMessage = "登录状态检查失败: " + response.Status()
		return errors.New(m.AuthMessage)
	}

	m.AuthState = "success"
	m.AuthMessage = "登录状态有效"
	return nil
}

// SimpleDownload 简单下载 可传入RJId 或者RJID列表
func (m *EngineManager) SimpleDownload(ids []string, storeBaseDir string) error {
	return m.SimpleDownloadWithContext(context.Background(), ids, storeBaseDir, nil)
}

func (m *EngineManager) DownloadOne(id string, storeBaseDir string) error {
	return m.DownloadOneWithContext(context.Background(), id, storeBaseDir)
}

func (m *EngineManager) SimpleDownloadWithContext(ctx context.Context, ids []string, storeBaseDir string, progress func(done, total int, message string)) error {
	plans := make([]downloadPlan, 0, len(ids))
	totalFiles := 0
	for _, id := range ids {
		if err := ctx.Err(); err != nil {
			return err
		}
		plan, err := m.prepareDownloadPlanWithContext(ctx, id, storeBaseDir)
		if err != nil {
			return err
		}
		plans = append(plans, plan)
		totalFiles += len(plan.Files)
	}

	if totalFiles == 0 {
		return nil
	}

	var doneFiles atomic.Int64
	for _, plan := range plans {
		if err := ctx.Err(); err != nil {
			return err
		}
		if len(plan.Files) == 0 {
			continue
		}
		if err := m.downloadPreparedFilesWithContext(ctx, plan.Files, func(fileName string) {
			if progress == nil {
				return
			}
			current := int(doneFiles.Add(1))
			progress(
				current,
				totalFiles,
				fmt.Sprintf("downloaded %s (%s)", plan.SourceID, fileName),
			)
		}); err != nil {
			return err
		}
	}
	return nil
}

func (m *EngineManager) DownloadOneWithContext(ctx context.Context, id string, storeBaseDir string) error {
	plan, err := m.prepareDownloadPlanWithContext(ctx, id, storeBaseDir)
	if err != nil {
		return err
	}
	return m.downloadPreparedFilesWithContext(ctx, plan.Files, nil)
}

type downloadPlan struct {
	SourceID string
	Files    [][]string
}

func (m *EngineManager) prepareDownloadPlanWithContext(ctx context.Context, id string, storeBaseDir string) (downloadPlan, error) {
	//检查是否是合格的id
	valid, prefix, number, err := utils.IsValidDlsiteID(id)
	if err != nil || !valid {
		return downloadPlan{}, err
	}
	if m.DownLimiter != nil {
		if err := m.DownLimiter.Wait(ctx); err != nil {
			return downloadPlan{}, err
		}
	}
	//获取作品信息
	workInfo, err := m.GetWorkInfoWithContext(ctx, number)
	if err != nil {
		return downloadPlan{}, err
	}
	log.Printf("Get WorkInfo  %s...\n", workInfo.Title)
	//获取所有的tracks
	tracks, err := m.GetVoiceTracksWithContext(ctx, number)
	if err != nil {
		return downloadPlan{}, err
	}
	log.Printf("Get TracksInfo list,size: %d...\n", len(tracks))
	hasSubtitle := ""
	if workInfo.HasSubtitle {
		hasSubtitle = "sub"
	} else {
		hasSubtitle = "nosub"
	}

	//新建下载目录名
	folderName := fmt.Sprintf(
		"%s%s-%s-%s-%s",
		strings.ToUpper(prefix),
		number,
		strings.ReplaceAll(workInfo.Release, "-", ""),
		hasSubtitle,
		//修正标题 移除目录不支持的特殊字符
		utils.NormalDirPathStr(strings.ReplaceAll(workInfo.Title, "/", "")),
	)
	//正式多协程下载 到目录RJID-date-title
	log.Println("Download folderName:", folderName)
	//根据配置需求下载tracks  比如只要mp3格式的
	storeFileDir := filepath.Join(storeBaseDir, folderName)
	needDownloadUrls, err := m.ensureDirExists(tracks, storeFileDir)
	if err != nil {
		return downloadPlan{}, err
	}
	//过滤掉不需要的格式
	needDownloadUrls = m.filterTargetAudioFormate(needDownloadUrls)
	needDownloadUrls, err = missingDownloadFiles(needDownloadUrls)
	if err != nil {
		return downloadPlan{}, err
	}
	if len(needDownloadUrls) == 0 {
		log.Printf("skip complete download: %s", storeFileDir)
	}
	return downloadPlan{
		SourceID: id,
		Files:    needDownloadUrls,
	}, nil
}

func (m *EngineManager) downloadPreparedFilesWithContext(ctx context.Context, files [][]string, onFileDone func(fileName string)) error {
	if len(files) == 0 {
		return nil
	}
	//并行下载
	pool := *m.DownloadPool
	group := pool.NewGroup()
	for _, url := range files {
		fileURL := url
		group.SubmitErr(func() error {
			if err := m.downloadFileWithContext(ctx, fileURL[0], fileURL[1], fileURL[2]); err != nil {
				return err
			}
			if onFileDone != nil {
				onFileDone(fileURL[2])
			}
			return nil
		})
	}
	err := group.Wait()
	//递归的移除空目录
	if len(files) > 0 {
		utils.RemoveEmptyDirs(files[0][1])
	}
	return err
}

func (m *EngineManager) filterTargetAudioFormate(urls [][]string) [][]string {
	// 1. 如果配置是 all，直接返回原文件列表
	config := m.Config.Downloader.PreferMedia
	if strings.ToLower(config) == "all" {
		return urls
	}
	// 2. 解析优先规则（例如 "mp3>wav>flac"）
	rules := strings.Split(strings.ToLower(config), ">")

	// 定义格式与后缀映射
	extMap := map[string][]string{
		"mp3":  {".mp3", ".mp3.vtt"},
		"wav":  {".wav", ".wav.vtt"},
		"flac": {".flac", ".flac.vtt"},
	}
	// 分成 groupA（支持的音频格式） 和 groupB（其它文件）
	groupA := make([][]string, 0)
	groupB := make([][]string, 0)

	allExtList := []string{
		".mp3", ".mp3.vtt",
		".wav", ".wav.vtt",
		".flac", ".flac.vtt",
	}

	for _, f := range urls {
		lf := strings.ToLower(f[2])

		found := false
		for _, ext := range allExtList {
			if strings.HasSuffix(lf, ext) {
				groupA = append(groupA, f)
				found = true
				break
			}
		}
		if !found {
			groupB = append(groupB, f)
		}
	}

	// 3. 按优先顺序过滤 groupA
	for _, rule := range rules {
		targetExts, ok := extMap[rule]
		if !ok {
			continue // 未知格式直接跳过
		}

		// 抽取符合该格式的文件
		selected := make([][]string, 0)
		for _, f := range groupA {
			lf := strings.ToLower(f[2])
			for _, ext := range targetExts {
				if strings.HasSuffix(lf, ext) {
					selected = append(selected, f)
					break
				}
			}
		}
		// 如果选到文件，则直接返回：选中文件 + groupB
		if len(selected) > 0 {
			return append(selected, groupB...)
		}
	}
	// 如果一个也没选到，则返回 groupB
	return groupB

}

func (m *EngineManager) ensureDirExists(tracks []model.Track, storeBaseDir string) ([][]string, error) {
	path := storeBaseDir
	path = utils.NormalDirPathStr(path)
	_ = os.MkdirAll(path, os.ModePerm)
	//url,path,title
	var needDownloadUrls [][]string

	for _, t := range tracks {
		if t.Type != "folder" {
			needDownloadUrls = append(needDownloadUrls, []string{t.MediaDownloadURL, path, t.Title})
		} else {
			needDownUrl, _ := m.ensureDirExists(t.Children, fmt.Sprintf("%s/%s", path, t.Title))
			needDownloadUrls = append(needDownloadUrls, needDownUrl...)
		}
	}
	return needDownloadUrls, nil
}

func (m *EngineManager) GetVoiceTracks(id string) ([]model.Track, error) {
	return m.GetVoiceTracksWithContext(context.Background(), id)
}

func (m *EngineManager) GetVoiceTracksWithContext(ctx context.Context, id string) ([]model.Track, error) {
	url := m.ApiUrl + consts.AsmrApiPath.TracksPath + id + "?v=2"
	headers := m.cloneHeaders()

	var result []model.Track

	resp, err := m.Client.R().
		SetContext(ctx).
		SetHeader("Authorization", m.JWTToken).
		SetHeaders(headers).
		SetResult(&result).
		Get(url)

	if err != nil {
		log.Println("获取音轨信息失败: ", err.Error())
		return nil, err
	}
	if !resp.IsSuccess() {
		return nil, errors.New("Request error,status code: " + strconv.Itoa(resp.StatusCode()))
	}
	return result, nil
}

func (m *EngineManager) BuildTrackMediaURL(hash string) string {
	hash = strings.Trim(strings.TrimSpace(hash), "/")
	if hash == "" {
		return ""
	}
	parts := strings.Split(hash, "/")
	for index, part := range parts {
		parts[index] = url.PathEscape(part)
	}
	return strings.TrimRight(m.ApiUrl, "/") + "/api/media/" + strings.Join(parts, "/")
}

func (m *EngineManager) OpenTrackStream(ctx context.Context, streamURL string, rangeHeader string) (*http.Response, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	parsed, err := url.Parse(strings.TrimSpace(streamURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, errors.New("invalid track stream url")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, errors.New("unsupported track stream url scheme")
	}

	headers := m.cloneHeaders()
	delete(headers, "content-type")
	headers["accept"] = "audio/*, application/octet-stream, */*"
	headers["accept-encoding"] = "identity"

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, err
	}
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	if strings.TrimSpace(m.JWTToken) != "" {
		request.Header.Set("Authorization", m.JWTToken)
	}
	if strings.TrimSpace(rangeHeader) != "" {
		request.Header.Set("Range", rangeHeader)
	}

	raw, err := m.Client.GetClient().Do(request)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return nil, ctxErr
		}
		return nil, err
	}
	if raw == nil {
		return nil, errors.New("empty track stream response")
	}
	if raw.StatusCode < http.StatusOK || raw.StatusCode >= http.StatusMultipleChoices {
		raw.Body.Close()
		return nil, fmt.Errorf("track stream request failed: %s", raw.Status)
	}
	return raw, nil
}

func (m *EngineManager) GetWorkInfo(id string) (model.WorkInfo, error) {
	return m.GetWorkInfoWithContext(context.Background(), id)
}

func (m *EngineManager) GetWorkInfoWithContext(ctx context.Context, id string) (model.WorkInfo, error) {
	url := m.ApiUrl + consts.AsmrApiPath.WorkinfoPath + id
	headers := m.cloneHeaders()

	var result = model.WorkInfo{}

	resp, err := m.Client.R().
		SetContext(ctx).
		SetHeader("Authorization", m.JWTToken).
		SetHeaders(headers).
		SetResult(&result).
		Get(url)

	if err != nil {
		log.Println("获取作品信息失败: ", err.Error())
		return result, err
	}
	if !resp.IsSuccess() {
		return result, errors.New("Request error,status code: " + strconv.Itoa(resp.StatusCode()))
	}
	return result, nil
}

func (m *EngineManager) SyncMetadata(scope string) error {
	return m.SyncMetadataWithContext(context.Background(), scope, nil)
}

func (m *EngineManager) SyncMetadataWithContext(ctx context.Context, scope string, progress func(done, total int, message string)) error {
	scope = strings.ToLower(strings.TrimSpace(scope))
	if scope == "" {
		scope = "all"
	}

	basePath := consts.AsmrApiPath.SyncMetaPath
	firstURL := m.ApiUrl + basePath
	if scope == "subtitle" {
		firstURL += "&subtitle=1"
	}

	firstResult, err := m.fetchMetaDataRespWithContext(ctx, firstURL)
	if err != nil {
		return err
	}

	switch scope {
	case "subtitle":
		var localSubtitleCount int64
		if err := m.DB.Model(&model.MetadataWork{}).
			Where("has_subtitle = ?", true).
			Count(&localSubtitleCount).Error; err != nil {
			return err
		}
		if int64(firstResult.Pagination.TotalCount) == localSubtitleCount {
			log.Println("✅ 带字幕元数据与本地数据一致,无需同步")
			return nil
		}
		log.Printf("同步带字幕元数据: 远端=%d 本地=%d", firstResult.Pagination.TotalCount, localSubtitleCount)
		return m.syncMetadataPagesWithContext(ctx, basePath+"&subtitle=1", firstResult.Pagination.TotalCount, progress)
	case "all":
		allSubPageResult, err := m.fetchMetaDataRespWithContext(ctx, firstURL+"&subtitle=1")
		if err != nil {
			return errors.New("获取带字幕元数据首页信息失败")
		}
		siteAll, localAll := m.printSyncMetadataStatics(firstResult, allSubPageResult)
		if siteAll == localAll {
			log.Println("✅ 网页数据与本地数据一致,无需同步")
			return nil
		}
		if siteAll < localAll {
			log.Println("本地数据存在逻辑错误,请检查数据库是否存在重复数据")
		}
		return m.syncMetadataPagesWithContext(ctx, basePath, firstResult.Pagination.TotalCount, progress)
	default:
		return fmt.Errorf("unsupported sync scope %s", scope)
	}
}

func (m *EngineManager) syncMetadataPagesWithContext(ctx context.Context, basePath string, totalCount int, progress func(done, total int, message string)) error {
	urls := m.buildMetaDataWorkUrls(basePath, totalCount, 100)
	for index, url := range urls {
		if err := ctx.Err(); err != nil {
			return err
		}
		resp, err := m.fetchMetaDataRespWithContext(ctx, url)
		if err != nil {
			return err
		}
		if err := m.upsertMetadataWorks(resp.BuildMetadataWork()); err != nil {
			return err
		}
		if progress != nil {
			progress(index+1, len(urls), fmt.Sprintf("synced metadata page %d/%d", index+1, len(urls)))
		}
	}
	return nil
}

func (m *EngineManager) upsertMetadataWorks(works []model.MetadataWork) error {
	for i := range works {
		works[i].UpdatedAt = time.Now()
	}
	tx := m.DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "source_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"title",
			"circle_id",
			"name",
			"nsfw",
			"release",
			"dl_count",
			"price",
			"review_count",
			"rate_count",
			"rate_average_2dp",
			"has_subtitle",
			"create_date",
			"vas",
			"tags",
			"duration",
			"source_type",
			"updated_at",
		}),
	}).Create(&works)
	return tx.Error
}

// 重试获取分页元数据
func (m *EngineManager) handleSyncMetadataRetry(retryChan chan string) {
	tick := time.NewTicker(5 * time.Second)
	defer tick.Stop()
	for {
		select {
		case url, ok := <-retryChan:
			if !ok {
				// retryChan 关闭 → 正常退出
				log.Println("Retry channel closed.")
				return
			}
			log.Println("重试获取分页元数据: ", url)
			resp, err := m.fetchMetaDataResp(url)
			if err != nil {
				log.Println("重试获取分页元数据失败: ", err.Error())
				continue
			}
			metadataWork := resp.BuildMetadataWork()
			//metadataWork := []model.MetadataWork{}
			m.MetadataWorkBatchChan <- metadataWork
		case <-tick.C:
			// 定时器唤醒但没有任务，不做任何事
			continue
		}
	}

}

func (m *EngineManager) storeSyncMetadata(batchSize int) error {
	counter := 0
	for works := range m.MetadataWorkBatchChan {
		for i := range works {
			works[i].UpdatedAt = time.Now()
		}
		//log.Println("批量保存元数据: ", len(works))
		counter += 1
		log.Printf("已保存批次数: %d 总批次: %d 进度: %.2f%%\n", counter, batchSize, float64(counter)/float64(batchSize)*100)
		tx := m.DB.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "source_id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"title",
				"circle_id",
				"name",
				"nsfw",
				"release",
				"dl_count",
				"price",
				"review_count",
				"rate_count",
				"rate_average_2dp",
				"has_subtitle",
				"create_date",
				"vas",
				"tags",
				"duration",
				"source_type",
				"updated_at",
			}),
		}).Create(&works)
		if tx.Error != nil {
			return tx.Error
		}
	}
	return nil
}

func (m *EngineManager) fetchMetaDataResp(url string) (*model.MetadataWorkResponse, error) {
	return m.fetchMetaDataRespWithContext(context.Background(), url)
}

func (m *EngineManager) fetchMetaDataRespWithContext(ctx context.Context, url string) (*model.MetadataWorkResponse, error) {
	if m.SyncLimiter != nil {
		if err := m.SyncLimiter.Wait(ctx); err != nil {
			return nil, err
		}
	}
	headers := m.cloneHeaders()

	var result = model.MetadataWorkResponse{}

	resp, err := m.Client.R().
		SetContext(ctx).
		SetHeader("Authorization", m.JWTToken).
		SetHeaders(headers).
		SetResult(&result).
		Get(url)
	if err != nil {
		log.Println("获取元数据首页信息失败: ", err.Error())
		return nil, err
	}
	if !resp.IsSuccess() {
		//log.Println("获取元数据首页信息失败: ", resp.String())
		log.Println("Cloudflare 429 响应状态: ", resp.StatusCode())
		return nil, errors.New("cloudflare 429 Too Many Requests")
	}
	return &result, nil
}

func (m *EngineManager) fetchMetaDataRespFuture(url string) chan *model.MetadataWorkResponse {
	responses := make(chan *model.MetadataWorkResponse, 1)
	go func() {
		resp, err := m.fetchMetaDataResp(url)
		if err != nil {
			log.Println("获取元数据分页失败: ", err.Error())
			responses <- nil
			return
		}
		responses <- resp
	}()
	return responses
}

func (m *EngineManager) buildMetaDataWorkUrls(basePath string, totalCount int, pageSize int) []string {
	urls := make([]string, 0)
	if pageSize <= 0 {
		pageSize = 100
	}
	pageCount := totalCount / pageSize
	if totalCount%pageSize != 0 {
		pageCount++
	}
	if pageCount == 0 {
		pageCount = 1
	}

	for i := 1; i <= pageCount; i++ {
		pageStr := strings.ReplaceAll(basePath, "page=1",
			fmt.Sprintf("page=%s", strconv.Itoa(i)))

		pageSizeStr := strings.ReplaceAll(pageStr, "pageSize=1",
			fmt.Sprintf("pageSize=%d", pageSize))
		url := m.ApiUrl + pageSizeStr
		urls = append(urls, url)
	}
	return urls
}

func (m *EngineManager) SyncAndDownload() error {
	return nil
}

func (m *EngineManager) SyncRetryFaild() error {
	return nil
}

func (m *EngineManager) downloadFile(url string, path string, fileName string) error {
	return m.downloadFileWithContext(context.Background(), url, path, fileName)
}

func (m *EngineManager) downloadFileWithContext(ctx context.Context, url string, path string, fileName string) error {
	// 使用 resty 或 http.Get 下载文件
	var filePathToStore = path
	var fileUrl = url
	var storePath = filepath.Join(filePathToStore, fileName)
	//使用 resty 下载文件
	resp, err := m.Client.R().
		SetContext(ctx).
		SetOutput(storePath).
		Get(fileUrl)
	if err != nil {
		log.Println("下载文件失败: ", err.Error())
		return err
	}
	if !resp.IsSuccess() {
		return errors.New("Request error,status code: " + strconv.Itoa(resp.StatusCode()))
	}
	return nil
}

func (m *EngineManager) SearchForCountResult(asmrOneQueryStr string, count int) (model.SearchResult, error) {
	url := m.ApiUrl + consts.AsmrApiPath.SearchPath + asmrOneQueryStr
	headers := m.cloneHeaders()

	var result = model.SearchResult{}

	resp, err := m.Client.R().
		SetHeader("Authorization", m.JWTToken).
		SetHeaders(headers).
		SetResult(&result).
		Get(url)

	if err != nil {
		log.Println("查询关键字信息失败: ", err.Error())
		return result, err
	}
	if !resp.IsSuccess() {
		return result, errors.New("Request error,status code: " + strconv.Itoa(resp.StatusCode()))
	}
	// 如果结果比较少
	if result.Pagination.TotalCount > count && count < result.Pagination.PageSize {
		result.Works = result.Works[:count]
		return result, nil
	}
	if result.Pagination.TotalCount < count && count > result.Pagination.PageSize {
		count = result.Pagination.TotalCount
	}
	//如果结果比count大 但是比pageSize小 则直接返回
	if result.Pagination.TotalCount >= count {
		//计算分页
		page := count / result.Pagination.PageSize
		if count%result.Pagination.PageSize != 0 {
			page++
		}
		for i := 2; i <= page; i++ {
			// 构建分页URL
			var newResult model.SearchResult
			pageURL := strings.ReplaceAll(url, "?page=1", fmt.Sprintf("?page=%d", i))
			// 发送GET请求
			resp, err := m.Client.R().
				SetHeader("Authorization", m.JWTToken).
				SetHeaders(headers).
				SetResult(&newResult).
				Get(pageURL)
			if err != nil {
				log.Println("查询分页信息失败: ", err.Error())
				return newResult, err
			}
			if !resp.IsSuccess() {
				return newResult, errors.New("Request error,status code: " + strconv.Itoa(resp.StatusCode()))
			}
			// 合并结果
			result.Works = append(result.Works, newResult.Works...)
			time.Sleep(500 * time.Millisecond)
		}
	}
	return result, nil
}

func (m *EngineManager) DownloadBatchMedias(works []model.SearchResultView, storePathDir string) error {
	var ids []string
	for _, work := range works {
		id := work.SourceID
		ids = append(ids, id)
	}
	pool := *m.WorkerPool
	group := pool.NewGroup()
	for _, id := range ids {
		// 提交任务到 Worker Pool
		group.SubmitErr(func() error {
			return m.DownloadOne(id, storePathDir)
		})
	}
	err := group.Wait()
	if err != nil {
		log.Println("下载作品失败: ", err.Error())
		return err
	}
	return nil
}

func (m *EngineManager) DownloadMediaByBatchIds(worksId []string, storePathDir string) error {
	if len(worksId) <= 0 {
		return nil
	}
	for _, id := range worksId {
		err := m.DownloadOne(id, storePathDir)
		//err := func() error {
		//	log.Println("正在下载作品: ", id)
		//	time.Sleep(5 * time.Second)
		//	return nil
		//}()
		if err != nil {
			log.Println("下载作品失败: ", err.Error())
			return err
		}
	}
	return nil
}

func missingDownloadFiles(files [][]string) ([][]string, error) {
	missing := make([][]string, 0, len(files))
	for _, file := range files {
		if len(file) < 3 {
			return nil, fmt.Errorf("invalid download file entry")
		}
		info, err := os.Stat(filepath.Join(file[1], file[2]))
		if err == nil && !info.IsDir() && info.Size() > 0 {
			continue
		}
		if err != nil && !os.IsNotExist(err) {
			return nil, err
		}
		missing = append(missing, file)
	}
	return missing, nil
}

// 打印同步元数据统计信息
func (m *EngineManager) printSyncMetadataStatics(result *model.MetadataWorkResponse, result2 *model.MetadataWorkResponse) (int, int) {
	//输出当前数据库中存在的记录数
	//var allCount int64
	//tx := m.DB.Model(&model.MetadataWork{}).Count(&allCount)
	//if tx.Error != nil {
	//	log.Println("查询数据库出现错误" + tx.Error.Error())
	//}
	type StatResult struct {
		TotalCount        int
		SubtitleTrueCount int
	}
	var localResult StatResult
	m.DB.Raw(`
    SELECT 
        COUNT(*) AS total_count,
        SUM(CASE WHEN has_subtitle = 1 THEN 1 ELSE 0 END) AS subtitle_true_count
    FROM metadata_works`).Scan(&localResult)
	//打印一些统计信息
	log.Printf("网站作品元数据数量(所有/带字幕): %d/%d\n",
		result.Pagination.TotalCount, result2.Pagination.TotalCount)
	var syncRateTotal, syncRateSubtitle float64

	if localResult.TotalCount > 0 {
		// 总体同步率 = 已同步条目 / 总条目
		syncRateTotal = float64(localResult.TotalCount) / float64(result.Pagination.TotalCount)

		// 字幕同步率 = 带字幕条目 / 总条目
		syncRateSubtitle = float64(localResult.SubtitleTrueCount) / float64(result2.Pagination.TotalCount)
	} else {
		syncRateTotal = 0.0
		syncRateSubtitle = 0.0
	}

	log.Printf(
		"本地数据库中元数据数量(所有/带字幕): %d/%d, 同步率(总/字幕): %.2f%%/%.2f%%",
		localResult.TotalCount,
		localResult.SubtitleTrueCount,
		syncRateTotal*100,
		syncRateSubtitle*100,
	)

	return result.Pagination.TotalCount, localResult.TotalCount
}

// 按照指定数量下载热门100作品
func (m *EngineManager) DownloadHot100(count int, dir string) error {
	return m.DownloadHot100WithContext(context.Background(), count, dir, nil)
}

func (m *EngineManager) DownloadHot100WithContext(ctx context.Context, count int, dir string, progress func(done, total int, message string)) error {
	url := m.ApiUrl + consts.AsmrApiPath.HotPath
	headers := m.cloneHeaders()

	var result = model.MetadataWorkResponse{}
	body := map[string]interface{}{
		"keyword":             "",
		"page":                1,
		"pageSize":            100,
		"subtitle":            0,
		"localSubtitledWorks": []interface{}{},
		"withPlaylistStatus":  []interface{}{},
	}

	resp, err := m.Client.R().
		SetContext(ctx).
		SetHeader("Authorization", m.JWTToken).
		SetBody(body).
		SetHeaders(headers).
		SetResult(&result).
		Post(url)

	if err != nil {
		log.Println("获取作品信息失败: ", err.Error())
		logger.RecordFailure("DownloadHot100"+" ", url, err.Error())
		return err
	}
	if !resp.IsSuccess() {
		logger.RecordFailure("DownloadHot100"+" ", url, resp.Status())
		return errors.New("Request error,status code: " + strconv.Itoa(resp.StatusCode()))
	}
	if count <= 0 {
		return errors.New("下载数量选择必须大于0")
	}
	metadataWork := result.BuildMetadataWork()
	works, err := selectHotWorks(metadataWork, count)
	if err != nil {
		return err
	}
	var sourceIds []string
	for _, work := range works {
		sourceIds = append(sourceIds, work.SourceID)
	}
	for index, sourceID := range sourceIds {
		if err := ctx.Err(); err != nil {
			return err
		}
		err = m.DownloadOneWithContext(ctx, sourceID, dir)
		if err != nil {
			log.Println("下载热门100作品失败: ", err.Error())
			return err
		}
		if progress != nil {
			progress(index+1, len(sourceIds), fmt.Sprintf("downloaded hot100 %s", sourceID))
		}
	}
	return nil
}

func selectHotWorks(works []model.MetadataWork, count int) ([]model.MetadataWork, error) {
	if count <= 0 {
		return nil, errors.New("下载数量选择必须大于0")
	}
	if len(works) == 0 {
		return nil, errors.New("热门作品列表为空")
	}
	if count > len(works) {
		count = len(works)
	}
	return works[:count], nil
}
