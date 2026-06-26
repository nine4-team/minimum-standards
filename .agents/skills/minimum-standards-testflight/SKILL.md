---
name: "minimum-standards-testflight"
description: "Use when deploying Minimum Standards to TestFlight, checking whether a Minimum Standards build is available to internal or external testers, or troubleshooting why a tester cannot see the latest Minimum Standards build. This project-specific skill overrides generic TestFlight assumptions and should be used together with the global update-testflight skill."
---

# Minimum Standards TestFlight

This skill is the project-level guardrail for Minimum Standards releases. Also use the global `update-testflight` skill for the general TestFlight workflow.

## Project Facts

- Repo: `/Users/benjaminmackenzie/Dev/minimum_standards`
- Bundle id: `app.assiist.minimum-standards`
- App Store Connect app id: `6756938384`
- Team id: `5VHL56HV63`
- Marketing version currently used for TestFlight: `1.0`
- External group name: `External Testing Group`
- External group id: `0709878b-feb8-4a33-96a8-13f758bd5cbb`
- Public TestFlight link: `https://testflight.apple.com/join/QdJfUy7T`
- Internal group name: `Internal Testing Group`
- Internal group id: `b4dae694-84b6-49e9-aa5a-d0ab9fc0abc4`

Do not use `External Testers` for this app. That is not the actual external group name.

## Release Commands

Build, upload, and distribute externally:

```bash
scripts/build-testflight.sh --external --groups "External Testing Group"
```

Distribute an already-uploaded build externally:

```bash
scripts/distribute-testflight-external.sh <build-number> --groups "External Testing Group"
```

The App Store Connect API key must stay local:

```bash
~/.appstoreconnect/private_keys/AuthKey_X5SX4S7NW5.p8
```

## Manual Upload Fallback

If the Fastlane build lane fails during `gym` archive/export with a vague Xcode 65 or validation failure, use the Ledger-style fallback instead of guessing at signing settings. This app can be archived with automatic signing, uploaded through `xcodebuild -exportArchive`, and then attached to the external group with the existing Fastlane distribute-only lane.

Use a fresh timestamp build number:

```bash
BUILD_NUMBER="$(date +%Y%m%d%H%M)"
ARCHIVE_PATH="$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)/MinimumStandardsMobile $(date +%Y-%m-%d) $BUILD_NUMBER.xcarchive"

cd /Users/benjaminmackenzie/Dev/minimum_standards/apps/mobile
xcodebuild archive \
  -workspace ios/MinimumStandardsMobile.xcworkspace \
  -scheme "MinimumStandardsMobile (Embedded)" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  DEVELOPMENT_TEAM=5VHL56HV63 \
  CODE_SIGN_STYLE=Automatic \
  MARKETING_VERSION=1.0 \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  -allowProvisioningUpdates
```

Generate upload export options and upload the archive:

```bash
cd /Users/benjaminmackenzie/Dev/minimum_standards
BUILD_DIR="$PWD/build/TestFlight/manual-$BUILD_NUMBER"
EXPORT_PATH="$BUILD_DIR/export"
OPTIONS_PLIST="$BUILD_DIR/ExportOptions.plist"
rm -rf "$EXPORT_PATH" "$OPTIONS_PLIST"
mkdir -p "$BUILD_DIR"

/usr/libexec/PlistBuddy -c 'Clear dict' "$OPTIONS_PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c 'Add :destination string upload' "$OPTIONS_PLIST"
/usr/libexec/PlistBuddy -c 'Add :manageAppVersionAndBuildNumber bool false' "$OPTIONS_PLIST"
/usr/libexec/PlistBuddy -c 'Add :method string app-store-connect' "$OPTIONS_PLIST"
/usr/libexec/PlistBuddy -c 'Add :signingStyle string automatic' "$OPTIONS_PLIST"
/usr/libexec/PlistBuddy -c 'Add :teamID string 5VHL56HV63' "$OPTIONS_PLIST"
/usr/libexec/PlistBuddy -c 'Add :uploadSymbols bool true' "$OPTIONS_PLIST"

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$OPTIONS_PLIST" \
  -allowProvisioningUpdates
```

After upload succeeds and App Store Connect begins processing, attach the uploaded build to the external group:

```bash
cd /Users/benjaminmackenzie/Dev/minimum_standards/apps/mobile
/opt/homebrew/opt/ruby/bin/bundle exec fastlane ios distribute_existing_external \
  build_number:"$BUILD_NUMBER" \
  groups:"External Testing Group" \
  changelog:"Minimum Standards beta update"
```

This fallback was used successfully on June 26, 2026 for build `1.0 (202606261250)`. App Store Connect verification showed `processingState=VALID`, `betaReviewState=APPROVED`, `externalBuildState=IN_BETA_TESTING`, and attachment to `External Testing Group`.

## Mandatory Availability Check

Do not tell the user an external build is available just because Fastlane printed a success line. Verify App Store Connect state first.

For an external tester to see the build, confirm all of these:

- `processingState` is `VALID`
- `betaReviewState` is `APPROVED`
- `externalBuildState` is `IN_BETA_TESTING`
- attached beta groups include `External Testing Group`

If the tester still cannot see the build after those checks, have them open the public TestFlight link with the same Apple ID they use in the TestFlight app:

```text
https://testflight.apple.com/join/QdJfUy7T
```

## Known Failure Pattern

Fastlane's message `Successfully distributed build to External testers` is generic. It does not prove the build was attached to the intended project group. Always verify the actual group name through App Store Connect.

On June 9, 2026, build `1.0 (202606081535)` was initially mistaken as external-ready because of that generic Fastlane line. API verification showed the first attach only included `Internal Testing Group`. Re-running distribution with `External Testing Group` fixed it; API state then showed `APPROVED` and `IN_BETA_TESTING`.
