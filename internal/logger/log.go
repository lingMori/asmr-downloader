package logger

import (
	"io"
	"log"
	"log/slog"
	"os"
	"strings"
	"sync"
)

var (
	errorLogFile *os.File
	ErrorLogger  *log.Logger
	mu           sync.Mutex

	rootLogger *slog.Logger
)

// InitErrorLogger 兼容旧的文件错误日志，并初始化全局 slog Logger。
func InitErrorLogger() {
	var err error
	// 以追加模式打开，如果没有则创建
	errorLogFile, err = os.OpenFile("download_errors.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatal(err)
	}
	ErrorLogger = log.New(errorLogFile, "ERROR: ", log.Ldate|log.Ltime)

	rootLogger = New(envLevel(), envFormat() == "json")
	slog.SetDefault(rootLogger)

	// 将 stdlib log.Print* 桥接到 slog，保证既有 log.Printf 调用自动获得结构化输出。
	log.SetFlags(0)
	log.SetOutput(slogWriter{logger: rootLogger.With(slog.String("source", "legacy_log"))})
}

// slogWriter 将传统 log.Print* 的字节流转换成 slog 事件。
type slogWriter struct {
	logger *slog.Logger
}

func (w slogWriter) Write(p []byte) (int, error) {
	msg := strings.TrimRight(string(p), "\n")
	if msg == "" {
		return len(p), nil
	}
	w.logger.Info(msg)
	return len(p), nil
}

// New 构建一个 slog.Logger，输出到 stdout。
func New(level slog.Level, jsonFormat bool) *slog.Logger {
	opts := &slog.HandlerOptions{Level: level}
	var handler slog.Handler
	if jsonFormat {
		handler = slog.NewJSONHandler(io.Writer(os.Stdout), opts)
	} else {
		handler = slog.NewTextHandler(io.Writer(os.Stdout), opts)
	}
	return slog.New(handler)
}

// Logger 返回全局根 logger。InitErrorLogger 之前调用会回退到 slog 默认值。
func Logger() *slog.Logger {
	if rootLogger == nil {
		return slog.Default()
	}
	return rootLogger
}

func envLevel() slog.Level {
	switch strings.ToLower(os.Getenv("LOG_LEVEL")) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func envFormat() string {
	f := strings.ToLower(os.Getenv("LOG_FORMAT"))
	if f == "json" {
		return "json"
	}
	return "text"
}

// RecordFailure 线程安全地记录错误：同时写入 download_errors.log 与全局 slog。
func RecordFailure(id string, url string, errMsg string) {
	mu.Lock()
	defer mu.Unlock()
	// 格式：ID | URL | 错误原因
	if ErrorLogger != nil {
		ErrorLogger.Printf("[%s] %s | Reason: %s\n", id, url, errMsg)
	}
	Logger().Error("download failure",
		slog.String("source_id", id),
		slog.String("url", url),
		slog.String("reason", errMsg),
	)
}

func Close() {
	if errorLogFile != nil {
		errorLogFile.Close()
	}
}
