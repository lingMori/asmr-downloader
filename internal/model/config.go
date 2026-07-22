package model

import (
	"asmroner/internal/consts"
	"asmroner/internal/paths"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

type User struct {
	// 必须用 mapstructure
	Account  string `mapstructure:"account" json:"account"`
	Password string `mapstructure:"password" json:"password"`
}

type Downloader struct {
	ApiUrl         string      `mapstructure:"api_url" json:"api_url"`
	ProxyUrl       string      `mapstructure:"proxy_url" json:"proxy_url"`
	MaxWorkers     int         `mapstructure:"max_workers" json:"max_workers"`
	MaxRetries     int         `mapstructure:"max_retries" json:"max_retries"`
	SyncDataFolder string      `mapstructure:"sync_data_folder" json:"sync_data_folder"`
	SyncWantedSize string      `mapstructure:"sync_wanted_size" json:"sync_wanted_size"`
	PreferMedia    string      `mapstructure:"prefer_media" json:"prefer_media"`
	HTTP           HTTPHeaders `mapstructure:"http" json:"http"`
}

// HTTPHeaders 控制对 asmr.one 发起请求时携带的浏览器指纹 / 固定头。
// 空值表示使用内置默认值；UserAgent 为空时启用 utils.RandomUserAgent 轮换。
type HTTPHeaders struct {
	UserAgent       string            `mapstructure:"user_agent" json:"user_agent"`
	Origin          string            `mapstructure:"origin" json:"origin"`
	Referer         string            `mapstructure:"referer" json:"referer"`
	AcceptLanguage  string            `mapstructure:"accept_language" json:"accept_language"`
	SecChUa         string            `mapstructure:"sec_ch_ua" json:"sec_ch_ua"`
	SecChUaPlatform string            `mapstructure:"sec_ch_ua_platform" json:"sec_ch_ua_platform"`
	Extra           map[string]string `mapstructure:"extra" json:"extra"`
}

type Limit struct {
	SyncQPS           float64 `mapstructure:"sync_qps" json:"sync_qps"`
	SyncJitterMin     int     `mapstructure:"sync_jitter_min" json:"sync_jitter_min"`
	SyncJitterMax     int     `mapstructure:"sync_jitter_max" json:"sync_jitter_max"`
	DownloadQPS       float64 `mapstructure:"download_qps" json:"download_qps"`
	DownloadJitterMin int     `mapstructure:"download_jitter_min" json:"download_jitter_min"`
	DownloadJitterMax int     `mapstructure:"download_jitter_max" json:"download_jitter_max"`
}

type Config struct {
	User       User       `mapstructure:"user" json:"user"`
	Downloader Downloader `mapstructure:"downloader" json:"downloader"`
	Limit      Limit      `mapstructure:"limit" json:"limit"`
}

// DefaultHTTPHeaders 返回与历史 engine.defaultHeaders 一致的浏览器指纹默认值。
func DefaultHTTPHeaders() HTTPHeaders {
	return HTTPHeaders{
		UserAgent:       "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
		Origin:          "https://asmr.one",
		Referer:         "https://asmr.one/",
		AcceptLanguage:  "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
		SecChUa:         `"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"`,
		SecChUaPlatform: `"macOS"`,
	}
}

func NewDefaultConfig() *Config {
	return &Config{
		User: User{
			Account:  "guest",
			Password: "guest",
		},
		Downloader: Downloader{
			ApiUrl:         consts.AsmrBaseApiUrl,
			ProxyUrl:       "",
			MaxWorkers:     5,
			MaxRetries:     3,
			SyncDataFolder: paths.DefaultDownloadDir(),
			SyncWantedSize: "200MB",
			PreferMedia:    "all",
			HTTP:           DefaultHTTPHeaders(),
		},
		Limit: Limit{
			SyncQPS:           2,
			SyncJitterMin:     100,
			SyncJitterMax:     500,
			DownloadQPS:       0.2,
			DownloadJitterMin: 2000,
			DownloadJitterMax: 5000,
		},
	}
}

// LoadConfig 读取配置
func LoadConfig(configPath string) (*Config, error) {
	viper.SetConfigName("config") // 文件名 config
	viper.SetConfigType("toml")
	viper.AddConfigPath(configPath)

	if err := viper.ReadInConfig(); err != nil {
		return nil, err
	}
	config := NewDefaultConfig()
	if err := viper.Unmarshal(config); err != nil {
		return nil, err
	}
	return config, nil
}

func ConfigFilePath() string {
	return filepath.Join(paths.DataDir(), consts.ConfigFileName)
}

func SaveConfig(config *Config) error {
	if config == nil {
		config = NewDefaultConfig()
	}

	if err := os.MkdirAll(paths.DataDir(), 0755); err != nil {
		return err
	}

	v := viper.New()
	v.SetConfigFile(ConfigFilePath())
	v.SetConfigType("toml")

	v.Set("user.account", config.User.Account)
	v.Set("user.password", config.User.Password)

	v.Set("downloader.api_url", config.Downloader.ApiUrl)
	v.Set("downloader.proxy_url", config.Downloader.ProxyUrl)
	v.Set("downloader.max_workers", config.Downloader.MaxWorkers)
	v.Set("downloader.max_retries", config.Downloader.MaxRetries)
	v.Set("downloader.sync_data_folder", config.Downloader.SyncDataFolder)
	v.Set("downloader.sync_wanted_size", config.Downloader.SyncWantedSize)
	v.Set("downloader.prefer_media", config.Downloader.PreferMedia)

	v.Set("downloader.http.user_agent", config.Downloader.HTTP.UserAgent)
	v.Set("downloader.http.origin", config.Downloader.HTTP.Origin)
	v.Set("downloader.http.referer", config.Downloader.HTTP.Referer)
	v.Set("downloader.http.accept_language", config.Downloader.HTTP.AcceptLanguage)
	v.Set("downloader.http.sec_ch_ua", config.Downloader.HTTP.SecChUa)
	v.Set("downloader.http.sec_ch_ua_platform", config.Downloader.HTTP.SecChUaPlatform)
	if len(config.Downloader.HTTP.Extra) > 0 {
		v.Set("downloader.http.extra", config.Downloader.HTTP.Extra)
	}

	v.Set("limit.sync_qps", config.Limit.SyncQPS)
	v.Set("limit.sync_jitter_min", config.Limit.SyncJitterMin)
	v.Set("limit.sync_jitter_max", config.Limit.SyncJitterMax)
	v.Set("limit.download_qps", config.Limit.DownloadQPS)
	v.Set("limit.download_jitter_min", config.Limit.DownloadJitterMin)
	v.Set("limit.download_jitter_max", config.Limit.DownloadJitterMax)

	configPath := ConfigFilePath()
	tmpPath := filepath.Join(filepath.Dir(configPath), "."+filepath.Base(configPath)+".tmp.toml")
	_ = os.Remove(tmpPath)
	if err := v.WriteConfigAs(tmpPath); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	if err := os.Rename(tmpPath, configPath); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	return nil
}
