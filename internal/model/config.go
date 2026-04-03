package model

import (
	"asmroner/internal/consts"
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
	ApiUrl         string `mapstructure:"api_url" json:"api_url"`
	ProxyUrl       string `mapstructure:"proxy_url" json:"proxy_url"`
	MaxWorkers     int    `mapstructure:"max_workers" json:"max_workers"`
	MaxRetries     int    `mapstructure:"max_retries" json:"max_retries"`
	SyncDataFolder string `mapstructure:"sync_data_folder" json:"sync_data_folder"`
	SyncWantedSize string `mapstructure:"sync_wanted_size" json:"sync_wanted_size"`
	PreferMedia    string `mapstructure:"prefer_media" json:"prefer_media"`
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

// AppConfig 全局变量
var AppConfig *Config

func NewDefaultConfig() *Config {
	AppConfig = &Config{
		User: User{
			Account:  "guest",
			Password: "guest",
		},
		Downloader: Downloader{
			ApiUrl:         consts.AsmrBaseApiUrl,
			ProxyUrl:       "",
			MaxWorkers:     5,
			MaxRetries:     3,
			SyncDataFolder: "./syncdata",
			SyncWantedSize: "200MB",
			PreferMedia:    "all",
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
	return AppConfig
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
	AppConfig = config
	return AppConfig, nil
}

func ConfigFilePath() string {
	return filepath.Join(consts.MetaDataDir, consts.ConfigFileName)
}

func SaveConfig(config *Config) error {
	if config == nil {
		config = NewDefaultConfig()
	}

	if err := os.MkdirAll(consts.MetaDataDir, 0755); err != nil {
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

	v.Set("limit.sync_qps", config.Limit.SyncQPS)
	v.Set("limit.sync_jitter_min", config.Limit.SyncJitterMin)
	v.Set("limit.sync_jitter_max", config.Limit.SyncJitterMax)
	v.Set("limit.download_qps", config.Limit.DownloadQPS)
	v.Set("limit.download_jitter_min", config.Limit.DownloadJitterMin)
	v.Set("limit.download_jitter_max", config.Limit.DownloadJitterMax)

	_ = os.Remove(ConfigFilePath())
	if err := v.WriteConfigAs(ConfigFilePath()); err != nil {
		return err
	}

	AppConfig = config
	return nil
}
