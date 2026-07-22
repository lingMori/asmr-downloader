// Package app 封装应用生命周期,供无头入口(main.go)与桌面壳(apps/desktop)复用。
package app

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"asmroner/internal/logger"
	"asmroner/internal/server"
)

// Options 控制应用启动方式。
type Options struct {
	// Addr HTTP 监听地址;桌面壳传 "127.0.0.1:0" 使用随机回环端口。
	Addr string
	// Version 版本号,透传给 server 包用于响应头/日志。
	Version string
}

// App 持有 HTTP 服务实例,可启动与优雅停止。
type App struct {
	server   *server.Server
	httpSrv  *http.Server
	listener net.Listener
}

// New 初始化配置、数据库与全部服务。
func New(opts Options) (*App, error) {
	if opts.Version != "" {
		server.SetVersion(opts.Version)
	}
	srv, err := server.New()
	if err != nil {
		return nil, err
	}
	addr := strings.TrimSpace(opts.Addr)
	if addr == "" {
		return nil, errors.New("addr is required")
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("listen %s: %w", addr, err)
	}
	return &App{
		server:   srv,
		listener: ln,
		httpSrv:  &http.Server{Handler: srv.Handler()},
	}, nil
}

// Start 在后台 goroutine 开始服务,返回实际可访问的 URL。
func (a *App) Start(_ context.Context) (string, error) {
	if a.listener == nil {
		return "", errors.New("app not initialized")
	}
	go func() {
		if err := a.httpSrv.Serve(a.listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Logger().Error("http server exited: " + err.Error())
		}
	}()
	return "http://" + a.listener.Addr().String(), nil
}

// Stop 优雅关闭 HTTP 服务;ctx 超时则强制关闭。
func (a *App) Stop(ctx context.Context) error {
	if a.httpSrv == nil {
		return nil
	}
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
	}
	return a.httpSrv.Shutdown(ctx)
}
