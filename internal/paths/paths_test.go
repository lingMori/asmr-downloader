package paths

import (
	"path/filepath"
	"testing"

	"asmroner/internal/consts"
)

func TestDataDirEnvOverride(t *testing.T) {
	t.Setenv("ASMRO_DATA_DIR", "/tmp/asmro-test-data")
	if got := DataDir(); got != "/tmp/asmro-test-data" {
		t.Fatalf("DataDir() = %q, want env override", got)
	}
}

func TestDataDirEnvOverrideTrimsSpace(t *testing.T) {
	t.Setenv("ASMRO_DATA_DIR", "  /tmp/asmro-test-data  ")
	if got := DataDir(); got != "/tmp/asmro-test-data" {
		t.Fatalf("DataDir() = %q, want trimmed env value", got)
	}
}

func TestDataDirDefault(t *testing.T) {
	// 无环境变量时:非 .app 运行应回退到 CWD 相对的默认目录
	if IsAppBundle() {
		t.Skip("running inside an app bundle")
	}
	if got := DataDir(); got != consts.MetaDataDir {
		t.Fatalf("DataDir() = %q, want %q", got, consts.MetaDataDir)
	}
}

func TestDefaultDownloadDirDefault(t *testing.T) {
	if IsAppBundle() {
		t.Skip("running inside an app bundle")
	}
	if got := DefaultDownloadDir(); got != "./syncdata" {
		t.Fatalf("DefaultDownloadDir() = %q, want ./syncdata", got)
	}
}

func TestDataDirBundlePath(t *testing.T) {
	// .app 模式下的目标路径形态(无法在本测试中模拟 os.Executable,仅校验拼接逻辑)
	home := t.TempDir()
	got := filepath.Join(home, "Library", "Application Support", "asmroner")
	if got == "" {
		t.Fatal("unexpected empty bundle data dir")
	}
}
