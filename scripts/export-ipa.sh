#!/bin/bash
# 导出 Asmroner.ipa(development 签名;Personal Team 免费账号可用,
# 只能装到该账号注册过的设备,证书 7 天有效,到期重跑本脚本重装即可)
# 用法:./scripts/export-ipa.sh [TEAM_ID]   (缺省读证书里的个人团队 ID)
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

TEAM_ID="${1:-669B8FP37A}"
BUILD_DIR="apps/ios/build"
ARCHIVE="$BUILD_DIR/Asmroner.xcarchive"
EXPORT="$BUILD_DIR/ipa"
PLIST="$BUILD_DIR/ExportOptions.plist"

mkdir -p "$BUILD_DIR"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>development</string>
	<key>teamID</key>
	<string>$TEAM_ID</string>
	<key>signingStyle</key>
	<string>automatic</string>
</dict>
</plist>
EOF

echo "📦 archive(TEAM_ID=$TEAM_ID)..."
xcodebuild -project apps/ios/Asmroner.xcodeproj -scheme Asmroner \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  -allowProvisioningUpdates \
  archive

echo "🚚 导出 ipa..."
xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT" -exportOptionsPlist "$PLIST" \
  -allowProvisioningUpdates

echo ""
echo "✅ 完成:$EXPORT/Asmroner.ipa"
echo "安装:Apple Configurator 2 拖入手机,或 Xcode → Devices and Simulators → 拖到已安装 App 列表"
