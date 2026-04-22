package model

import "sync"

// ConfigProvider 提供线程安全的配置读取与更新能力。
// 所有运行期读取 Config 的代码都应当通过 Provider 拿到快照。
type ConfigProvider struct {
	mu  sync.RWMutex
	cfg *Config
}

// NewConfigProvider 构造一个 Provider；cfg 可为 nil（后续通过 Update 注入）。
func NewConfigProvider(cfg *Config) *ConfigProvider {
	return &ConfigProvider{cfg: cfg}
}

// Snapshot 返回当前配置的深拷贝。永远不会返回 nil：未初始化时返回默认配置。
func (p *ConfigProvider) Snapshot() Config {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.cfg == nil {
		return *NewDefaultConfig()
	}
	return *p.cfg
}

// Update 原子替换配置。传入 nil 视为 no-op。
func (p *ConfigProvider) Update(cfg *Config) {
	if cfg == nil {
		return
	}
	p.mu.Lock()
	p.cfg = cfg
	p.mu.Unlock()
}

// Downloader 返回 Downloader 配置快照。
func (p *ConfigProvider) Downloader() Downloader {
	snap := p.Snapshot()
	return snap.Downloader
}

// Limit 返回 Limit 配置快照。
func (p *ConfigProvider) Limit() Limit {
	snap := p.Snapshot()
	return snap.Limit
}

// User 返回 User 配置快照。
func (p *ConfigProvider) User() User {
	snap := p.Snapshot()
	return snap.User
}
