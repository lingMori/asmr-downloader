#!/bin/bash
# 打包 macOS 桌面 App:release/Asmroner.app + release/Asmroner-<version>.dmg
# 用法:./scripts/build-desktop.sh [version]
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

APP_NAME="Asmroner"
BUNDLE_ID="com.asmroner.desktop"
VERSION="${1:-$(sed -n 's/.*version   = "\([^"]*\)".*/\1/p' version.go)}"
VERSION="${VERSION:-v1.0.0}"
RELEASE_DIR="release"
APP_DIR="$RELEASE_DIR/$APP_NAME.app"
WEBUI_DIR="internal/server/webui"

echo "🚀 打包 $APP_NAME $VERSION"

# 1. 构建前端并填充 embed 目录
echo "📦 构建 yoru 前端..."
npm run build:yoru
rsync -a --delete "apps/yoru/dist/" "$WEBUI_DIR/"
touch "$WEBUI_DIR/.gitkeep"

# 2. 编译桌面壳(内嵌前端)
echo "🔨 编译桌面二进制..."
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
MACOSX_DEPLOYMENT_TARGET=15.0 CGO_ENABLED=1 \
  go build -tags embed_web \
  -ldflags="-s -w -X main.version=$VERSION" \
  -o "$APP_DIR/Contents/MacOS/asmroner" ./apps/desktop

# 3. 图标(apps/desktop/build/appicon.png → AppIcon.icns)
echo "🎨 生成图标..."
ICONSET=$(mktemp -d)/AppIcon.iconset
mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  sips -z $size $size apps/desktop/build/appicon.png --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) apps/desktop/build/appicon.png --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP_DIR/Contents/Resources/AppIcon.icns"

# 4. Info.plist
cat > "$APP_DIR/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key><string>$APP_NAME</string>
	<key>CFBundleDisplayName</key><string>ASMRoner</string>
	<key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
	<key>CFBundleVersion</key><string>$VERSION</string>
	<key>CFBundleShortVersionString</key><string>$VERSION</string>
	<key>CFBundleExecutable</key><string>asmroner</string>
	<key>CFBundlePackageType</key><string>APPL</string>
	<key>CFBundleIconFile</key><string>AppIcon</string>
	<key>LSMinimumSystemVersion</key><string>15.0</string>
	<key>NSHighResolutionCapable</key><true/>
	<key>NSSupportsAutomaticGraphicsSwitching</key><true/>
</dict>
</plist>
EOF

# 5. ad-hoc 签名(自用免开发者证书;首次打开需右键→打开)
echo "🔏 ad-hoc 签名..."
codesign --force --deep --sign - "$APP_DIR"

# 6. dmg
DMG_PATH="$RELEASE_DIR/$APP_NAME-$VERSION.dmg"
echo "💿 生成 dmg..."
rm -f "$DMG_PATH"
hdiutil create -volname "$APP_NAME" -srcfolder "$APP_DIR" -ov -format UDZO "$DMG_PATH" >/dev/null

echo "✅ 完成:"
echo "   $APP_DIR"
echo "   $DMG_PATH"
