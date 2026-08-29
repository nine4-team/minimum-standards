# Minimum Standards

Minimum Standards is a mobile tracker for the baseline commitments that should
happen even on a bad day. Users define a measurable standard, log progress in
seconds, and see whether each daily, weekly, or monthly period is met, missed, or
still in progress.

[View the product site](https://minimum-standards.nine4.co/)

## Product behavior

- reusable activities and measurable standards
- daily, weekly, and monthly evaluation periods
- fast repeat logging with backdated entries
- deterministic progress and status calculations
- history views, scorecards, and activity-level reporting
- accountability groups and shared progress
- iOS and Android clients backed by Firebase

## Architecture

The repository is a TypeScript monorepo. The React Native app lives in
`apps/mobile`; shared schemas and domain calculations live in `packages`; Firebase
Cloud Functions and security rules own trusted writes and access control.

Business logic is kept out of screens where practical. Pure calculations, Zod
schemas, service boundaries, and Zustand stores make the important behavior easier
to test independently of React Native and Firebase.

```text
React Native screens
        ↓
hooks and stores
        ↓
services + shared domain packages
        ↓
Firebase Auth, Firestore, and Cloud Functions
```

## Repository guide

- `apps/mobile/` — React Native application, native projects, screens, hooks, and tests
- `packages/shared-model/` — shared types, schemas, and deterministic domain logic
- `packages/firestore-model/` — Firestore mapping and persistence boundaries
- `packages/firestore-rules-tests/` — emulator-backed authorization tests
- `packages/ui-kit/` — product-specific interface components and tokens
- `functions/` — trusted Firebase operations

## Local development

The mobile app requires Node 20 or later, platform build tooling, and a Firebase
project configuration. From `apps/mobile`:

```bash
npm install
npm run ios       # or npm run android
```

The deterministic shared layers have focused checks at the repository root:

```bash
npm -w @minimum-standards/shared-model test
npm -w @minimum-standards/firestore-model test
npm -w @nine4/ui-kit run build
```

Firebase-rules tests additionally require the local Firebase emulators.

## Testing approach

The test suites concentrate on period calculations, aggregation, validation,
service behavior, state transitions, Cloud Function logic, and Firestore access
rules. UI and end-to-end harnesses cover the interactions that cannot be validated
as pure domain logic.

## Privacy

No Firebase administrative credentials are stored in the repository. Client
configuration identifies the app project but does not grant trusted backend access;
authorization is enforced by authentication, Firestore rules, and Cloud Functions.
