---
name: update-testflight
description: Use when asked to upload any iOS app build to TestFlight, update TestFlight, create an App Store Connect build, archive iOS Release builds, or diagnose an app's TestFlight release process across the user's projects.
---

# Update TestFlight

Prefer an app's repo-local release script when it exists. Common names:

```bash
scripts/build-testflight.sh
scripts/release-testflight.sh
scripts/upload-testflight.sh
```

For Minimum Standards, use:

```bash
scripts/build-testflight.sh
```

For a dry run that archives and exports an IPA without upload:

```bash
scripts/build-testflight.sh --no-upload
```

## Workflow

1. Identify the current app/repo and inspect its release scripts before inventing a new path.
2. Check `git status --short` and identify unrelated dirty files before staging, committing, or releasing.
3. Run focused tests for the change being released.
4. Commit the intended release changes before uploading, unless the user explicitly asks for an uncommitted build.
5. Run the app's TestFlight script. If no script exists, adapt the generic `xcodebuild archive` + `xcodebuild -exportArchive` flow below and consider adding a script.
6. Watch the archive/export/upload output until it completes. Do not leave the command running when ending the turn.
7. Report the uploaded build number and any App Store Connect processing caveat.

## Generic Script Pattern

App scripts should usually:

- Accept `[build-number] [--no-upload]`.
- Bump `CURRENT_PROJECT_VERSION` or `CFBundleVersion` to a unique numeric build number.
- Archive the Release scheme for `generic/platform=iOS`.
- Generate an `ExportOptions.plist` with `method = app-store-connect`, automatic signing, and the app's team ID.
- Use `xcodebuild -exportArchive` with `destination = upload` for App Store Connect upload.
- Use `destination = export` for `--no-upload`.

Timestamp build numbers like `YYYYMMDDHHMM` are a good default when an app has already used timestamp builds. Otherwise increment the existing numeric build number.

## App Profiles

### Minimum Standards

The Minimum Standards script:

- Uses `apps/mobile/ios/MinimumStandardsMobile.xcworkspace`.
- Archives scheme `MinimumStandardsMobile (Embedded)` with `Release`.
- Sets `CURRENT_PROJECT_VERSION` in the Xcode project to a timestamp build number by default.
- Exports with `method = app-store-connect`, automatic signing, and team `5VHL56HV63`.
- Uploads through `xcodebuild -exportArchive`, using the Apple account signed into Xcode.

Before release, confirm `apps/mobile/ios/MinimumStandardsMobile/Info.plist` contains:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

Without that App Store Connect may require manual export compliance answers.

Current repo caveat: `npm --prefix apps/mobile run typecheck` has broad pre-existing failures unrelated to the group standards change, so do not block a focused TestFlight release solely on that command unless the user asks for a full type cleanup.

Focused test used for the group standards CRUD work:

```bash
npm --prefix apps/mobile test -- MemberDashboardScreen.test.tsx --runInBand
```

### Ledger Mobile

Ledger has an existing script at:

```bash
/Users/benjaminmackenzie/Dev/ledger_mobile/scripts/build-testflight.sh
```

It archives project `LedgeriOS/LedgeriOS.xcodeproj`, scheme `LedgeriOS`, Release configuration, team `5VHL56HV63`, and defaults to incrementing `CFBundleVersion`.

If a duplicate build number or signing error occurs, rerun with an explicit higher numeric build number only after checking the current project build number and the latest TestFlight build.
