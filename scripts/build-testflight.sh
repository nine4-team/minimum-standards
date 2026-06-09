#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LANE="upload_testflight"

usage() {
  cat <<'USAGE'
Usage:
  scripts/build-testflight.sh [build-number] [--external] [--groups "Group A,Group B"] [--changelog "Text"]

Examples:
  scripts/build-testflight.sh
  scripts/build-testflight.sh --external --groups "External Testers"
  scripts/build-testflight.sh 202605271530 --external --changelog "Fix group standards flows"

Environment:
  APP_STORE_CONNECT_ISSUER_ID defaults to 4827880b-e626-4e8e-a16b-c66db4355e12.
  APP_STORE_CONNECT_KEY_ID defaults to X5SX4S7NW5.
  APP_STORE_CONNECT_KEY_FILEPATH defaults to ~/.appstoreconnect/private_keys/AuthKey_${APP_STORE_CONNECT_KEY_ID}.p8.
USAGE
}

args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --external)
      LANE="external_testflight"
      shift
      ;;
    --groups)
      args+=("groups:$2")
      shift 2
      ;;
    --changelog)
      args+=("changelog:$2")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        args+=("build_number:$1")
        shift
      else
        echo "Unknown argument: $1" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

cd "$ROOT_DIR/apps/mobile"
BUNDLE_BIN="${BUNDLE_BIN:-}"
if [[ -z "$BUNDLE_BIN" ]]; then
  if [[ -x /opt/homebrew/opt/ruby/bin/bundle ]]; then
    BUNDLE_BIN=/opt/homebrew/opt/ruby/bin/bundle
  else
    BUNDLE_BIN=bundle
  fi
fi

"$BUNDLE_BIN" exec fastlane ios "$LANE" "${args[@]}"
