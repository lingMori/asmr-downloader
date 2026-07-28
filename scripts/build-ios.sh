#!/bin/bash
# 构建 iOS 后端框架:apps/ios/AsmronerKit.xcframework(gomobile bind,内嵌前端)
# 用法:./scripts/build-ios.sh
# 之后打开 apps/ios/Asmroner.xcodeproj,Signing 选 Personal Team 即可 Run 到设备。
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# gomobile 依赖同目录的 gobind 二进制,确保 GOPATH/bin 在 PATH 上
export PATH="$(go env GOPATH)/bin:$PATH"

WEBUI_DIR="internal/server/webui"
OUT="apps/ios/AsmronerKit.xcframework"

echo "📦 构建 yoru 前端并填充 embed 目录..."
npm run build:yoru
rsync -a --delete "apps/yoru/dist/" "$WEBUI_DIR/"
touch "$WEBUI_DIR/.gitkeep"

GOMOBILE="${GOMOBILE:-$(go env GOPATH)/bin/gomobile}"
if [ ! -x "$GOMOBILE" ]; then
  echo "⬇️  安装 gomobile/gobind 到 GOPATH/bin..."
  go install golang.org/x/mobile/cmd/gomobile@latest
  go install golang.org/x/mobile/cmd/gobind@latest
fi

echo "🔨 gomobile bind → $OUT(ios/arm64 + 模拟器 arm64,含 embed 前端,-s -w 精简符号)"
rm -rf "$OUT"
"$GOMOBILE" bind -target=ios -iosversion=16.0 -tags=embed_web \
  -ldflags="-s -w" \
  -o "$OUT" asmroner/mobile

echo ""
echo "✅ 框架构建完成。下一步:"
echo "  1. open apps/ios/Asmroner.xcodeproj"
echo "  2. Signing & Capabilities → Team 选你的 Personal Team(免费 Apple ID 即可)"
echo "  3. 选你的 iPhone → Run(免费证书 7 天有效,到期重 Run 即可)"
