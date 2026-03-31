package model

import (
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
	AppConfig = &Config{}
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
