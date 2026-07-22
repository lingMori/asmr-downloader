// ASMRoner 桌面壳:内嵌 Go 后端(loopback 随机端口)+ WKWebView 窗口 + 菜单栏托盘。
package main

import (
	"context"
	_ "embed"
	"log"
	"time"

	"asmroner/internal/app"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

var version = "dev"

//go:embed tray_icon.png
var trayIcon []byte

func main() {
	backend, err := app.New(app.Options{Addr: "127.0.0.1:0", Version: version})
	if err != nil {
		log.Fatalf("init backend: %v", err)
	}
	url, err := backend.Start(context.Background())
	if err != nil {
		log.Fatalf("start backend: %v", err)
	}

	desktop := application.New(application.Options{
		Name:        "ASMRoner",
		Description: "你的本地 ASMR 电台",
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "com.asmroner.desktop",
		},
	})

	window := desktop.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "ASMRoner · よる",
		Width:  1280,
		Height: 800,
		// ?desktop=1 让前端切换到桌面模式(半透明根背景,窗口玻璃透出)
		URL: url + "/?desktop=1",
		Mac: application.MacWindow{
			// macOS 26 为液态玻璃,低版本自动回退 NSVisualEffectView 毛玻璃
			Backdrop:                application.MacBackdropLiquidGlass,
			InvisibleTitleBarHeight: 50,
			TitleBar:                application.MacTitleBarHidden,
		},
	})

	// 关窗不退出:隐藏到托盘,音频与下载继续
	window.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		window.Hide()
		e.Cancel()
	})

	window.Show()
	window.Focus()

	tray := desktop.SystemTray.New()
	tray.SetTemplateIcon(trayIcon)
	menu := desktop.NewMenu()
	menu.Add("显示 ASMRoner").OnClick(func(*application.Context) {
		window.Show()
		window.Focus()
	})
	menu.AddSeparator()
	menu.Add("退出 ASMRoner").OnClick(func(*application.Context) {
		desktop.Quit()
	})
	tray.SetMenu(menu)

	if err := desktop.Run(); err != nil {
		log.Printf("desktop exited: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := backend.Stop(ctx); err != nil {
		log.Printf("backend shutdown: %v", err)
	}
}
