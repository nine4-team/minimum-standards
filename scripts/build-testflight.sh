#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/mobile"
WORKSPACE="$APP_DIR/ios/MinimumStandardsMobile.xcworkspace"
SCHEME="MinimumStandardsMobile (Embedded)"
CONFIGURATION="Release"
TEAM_ID="5VHL56HV63"
DEFAULT_VERSION="1.0"
DEFAULT_GROUPS="External Testing Group"

BUILD_NUMBER="${BUILD_NUMBER:-}"
VERSION="${MARKETING_VERSION:-$DEFAULT_VERSION}"
CHANGELOG="${TESTFLIGHT_CHANGELOG:-Minimum Standards beta update}"
GROUPS="${TESTFLIGHT_GROUPS:-$DEFAULT_GROUPS}"
EXTERNAL=false

usage() {
  cat <<'USAGE'
Usage:
  scripts/build-testflight.sh [build-number] [--external] [--groups "Group A,Group B"] [--version "1.0"] [--changelog "Text"]

Examples:
  scripts/build-testflight.sh
  scripts/build-testflight.sh --external --groups "External Testing Group"
  scripts/build-testflight.sh 202605271530 --external --changelog "Fix group standards flows"

Behavior:
  Archives with xcodebuild automatic signing, uploads with explicit
  app-store-connect export options, then attaches the uploaded build to the
  external TestFlight group when --external is supplied.

Environment:
  Xcode must be signed into the Apple developer account for upload.
  APP_STORE_CONNECT_ISSUER_ID defaults to 4827880b-e626-4e8e-a16b-c66db4355e12.
  APP_STORE_CONNECT_KEY_ID defaults to X5SX4S7NW5.
  APP_STORE_CONNECT_KEY_FILEPATH defaults to ~/.appstoreconnect/private_keys/AuthKey_${APP_STORE_CONNECT_KEY_ID}.p8.
  TESTFLIGHT_GROUPS defaults to External Testing Group.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --external)
      EXTERNAL=true
      shift
      ;;
    --groups)
      GROUPS="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    --changelog)
      CHANGELOG="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        BUILD_NUMBER="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$BUILD_NUMBER" ]]; then
  BUILD_NUMBER="$(date +%Y%m%d%H%M)"
fi

ARCHIVE_DATE="$(date +%Y-%m-%d)"
ARCHIVE_DIR="$HOME/Library/Developer/Xcode/Archives/$ARCHIVE_DATE"
ARCHIVE_PATH="$ARCHIVE_DIR/MinimumStandardsMobile $ARCHIVE_DATE $BUILD_NUMBER.xcarchive"
BUILD_DIR="$ROOT_DIR/build/TestFlight/manual-$BUILD_NUMBER"
EXPORT_PATH="$BUILD_DIR/export"
OPTIONS_PLIST="$BUILD_DIR/ExportOptions.plist"

mkdir -p "$ARCHIVE_DIR" "$BUILD_DIR"
rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH" "$OPTIONS_PLIST"

echo "Archiving Minimum Standards $VERSION ($BUILD_NUMBER)"
cd "$APP_DIR"
xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  MARKETING_VERSION="$VERSION" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  -allowProvisioningUpdates

echo "Creating App Store Connect upload export options"
/usr/libexec/PlistBuddy -c 'Clear dict' "$OPTIONS_PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c 'Add :destination string upload' "$OPTIONS_PLIST"
/usr/libexec/PlistBuddy -c 'Add :manageAppVersionAndBuildNumber bool false' "$OPTIONS_PLIST"
/usr/libexec/PlistBuddy -c 'Add :method string app-store-connect' "$OPTIONS_PLIST"
/usr/libexec/PlistBuddy -c 'Add :signingStyle string automatic' "$OPTIONS_PLIST"
/usr/libexec/PlistBuddy -c "Add :teamID string $TEAM_ID" "$OPTIONS_PLIST"
/usr/libexec/PlistBuddy -c 'Add :uploadSymbols bool true' "$OPTIONS_PLIST"

echo "Uploading Minimum Standards $VERSION ($BUILD_NUMBER) to App Store Connect"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$OPTIONS_PLIST" \
  -allowProvisioningUpdates

if [[ "$EXTERNAL" == true ]]; then
  echo "Waiting for processing and distributing $VERSION ($BUILD_NUMBER) to $GROUPS"
  "$ROOT_DIR/scripts/distribute-testflight-external.sh" "$BUILD_NUMBER" \
    --groups "$GROUPS" \
    --version "$VERSION" \
    --changelog "$CHANGELOG"
else
  echo "Uploaded Minimum Standards $VERSION ($BUILD_NUMBER) to App Store Connect."
fi
