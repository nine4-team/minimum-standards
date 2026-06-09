# TestFlight Deployment

This project uses the same two-step release shape as Ledger:

1. Build/archive/upload the iOS app.
2. Attach the processed build to the external TestFlight group.

The normal path can do both in one command.

## Happy Path

From the repo root:

```bash
scripts/build-testflight.sh --external --groups "External Testers"
```

That command:

- creates a timestamp build number by default,
- builds the Release archive for `MinimumStandardsMobile (Embedded)`,
- uploads to App Store Connect/TestFlight,
- waits for processing,
- distributes the build to the `External Testers` group,
- notifies external testers.

To set an explicit build number:

```bash
scripts/build-testflight.sh 202606091030 --external --groups "External Testers"
```

To set an explicit marketing version:

```bash
scripts/build-testflight.sh 202606091030 --version "1.0" --external --groups "External Testers"
```

## Distribute an Already Uploaded Build

If the build was uploaded through Xcode or `xcodebuild -exportArchive`, attach it to external testers with:

```bash
scripts/distribute-testflight-external.sh 202606081535 --groups "External Testers"
```

If the marketing version changes:

```bash
scripts/distribute-testflight-external.sh 202606081535 --version "1.0" --groups "External Testers"
```

## Required Local Secret

The App Store Connect private key must stay out of git.

Expected local path:

```bash
~/.appstoreconnect/private_keys/AuthKey_X5SX4S7NW5.p8
```

The non-secret defaults are stored in `apps/mobile/fastlane/Fastfile`:

- bundle id: `app.assiist.minimum-standards`
- team id: `5VHL56HV63`
- API key id: `X5SX4S7NW5`
- issuer id: `4827880b-e626-4e8e-a16b-c66db4355e12`
- external group: `External Testers`

Override these only when needed:

```bash
APP_STORE_CONNECT_KEY_ID=...
APP_STORE_CONNECT_ISSUER_ID=...
APP_STORE_CONNECT_KEY_FILEPATH=...
TESTFLIGHT_GROUPS="External Testers"
MARKETING_VERSION="1.0"
BUILD_NUMBER=202606091030
```

## App Store Connect Notes

Fastlane can upload, wait for processing, set the changelog, and request external distribution. Apple may still require Beta App Review for some builds. Do not tell testers a build is installable until Fastlane or App Store Connect confirms that external distribution succeeded.

For the configurable standard pages release, Fastlane confirmed:

```text
Successfully distributed build to External testers
```

for build `1.0 (202606081535)`.

## Preflight Checks

Before release:

```bash
git status --short --branch
npm --prefix apps/mobile test -- dashboardPages.test.ts --runInBand
ruby -c apps/mobile/fastlane/Fastfile
scripts/build-testflight.sh --help
scripts/distribute-testflight-external.sh --help
```

The full mobile typecheck currently has broad pre-existing failures, so use focused tests for the release unless the release explicitly changes the typecheck surface.

## Ledger Comparison

Ledger's plain `scripts/build-testflight.sh` uploads using the Apple account signed into Xcode. External tester availability is handled separately by Fastlane's `distribute_existing_external` lane.

Minimum Standards now follows the same release model, with the working App Store Connect API key defaults captured in Fastlane and wrapper script help text.
