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

That script is the primary deployment process for this app. It archives with `xcodebuild`, uploads with explicit `app-store-connect` export options, then uses Fastlane only to attach the already-uploaded build to the external TestFlight group.

Distribute an already-uploaded build externally:

```bash
scripts/distribute-testflight-external.sh <build-number> --groups "External Testing Group"
```

The App Store Connect API key must stay local:

```bash
~/.appstoreconnect/private_keys/AuthKey_X5SX4S7NW5.p8
```

## Deployment Process

`scripts/build-testflight.sh` follows the same deployment shape as Ledger:

- Generate or accept a timestamp build number such as `202606261250`
- Archive `MinimumStandardsMobile (Embedded)` with automatic signing
- Generate an `ExportOptions.plist` with `destination=upload`, `method=app-store-connect`, `signingStyle=automatic`, `teamID=5VHL56HV63`, and `manageAppVersionAndBuildNumber=false`
- Upload the archive with `xcodebuild -exportArchive`
- When `--external` is supplied, run `scripts/distribute-testflight-external.sh <build-number> --groups "External Testing Group"`

This process was used successfully on June 26, 2026 for build `1.0 (202606261250)`. App Store Connect verification showed `processingState=VALID`, `betaReviewState=APPROVED`, `externalBuildState=IN_BETA_TESTING`, and attachment to `External Testing Group`.

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

On June 26, 2026, the old Fastlane `build_app` path failed during archive with Xcode 65. The `gym` log showed the app signed with `Apple Development: Ben Mackenzie (K85ZW2R9YD)` and `iOS Team Provisioning Profile: app.assiist.minimum-standards`, then `Validate ... -validate-for-store`, then Xcode reported `Build operation failed without specifying any errors`. A direct `xcodebuild archive` followed by `xcodebuild -exportArchive` with explicit `app-store-connect` export options uploaded the same app successfully. Keep `scripts/build-testflight.sh` on that xcodebuild archive/export/upload path; use Fastlane only for `distribute_existing_external`.
