# Minimum Standards — Project Instructions

## Code Quality Standards

### Testability is mandatory

All code must be written so that a software engineer can write automatic pass/fail tests against it. This means:

- **Separate business logic from I/O.** Pure computation (streak calculations, stat aggregation, validation, formatting) must live in standalone functions that take inputs and return outputs — no Firestore calls, no network, no side effects. These go in `utils/` or dedicated modules.
- **Service layer for external calls.** Cloud Function callables, Firestore operations, and other I/O must go through a service module (e.g., `services/groupsService.ts`) — not inline in hooks or screens. Hooks consume services. Screens consume hooks. Tests mock services.
- **Dependency injection over hardcoded imports.** When a module needs an external dependency (Firebase functions client, Firestore instance), accept it as a parameter or import from a single service module — never copy-paste stubs across files.
- **No logic in screens.** Screens handle layout and user interaction. Business logic, data fetching, and state management belong in hooks, stores, or services.

### Modular functions

- Keep functions small and single-purpose. If a function does validation AND data fetching AND computation AND persistence, break it apart.
- Cloud Functions: extract the handler logic (validation, business rules, response shaping) from the `onCall` wrapper so each piece can be tested independently.
- Pure functions are always preferred. A function that takes data in and returns data out is trivially testable. A function that reads from and writes to Firestore is not.

### Tests are part of the work

- A work package is not complete until its testable logic has tests.
- Cloud Functions: test business logic functions (streak computation, stat aggregation, validation) with unit tests. Test the full function handlers with the Firebase emulator or by mocking the admin SDK.
- Hooks: test state transitions (loading → success, loading → error) by mocking the service layer.
- Do not test trivial wiring — test logic that could break.

## Architecture Patterns

### Existing patterns to follow

- **Hooks** live in `apps/mobile/src/hooks/` — real-time listeners use Firestore `onSnapshot`, one-shot data uses service calls.
- **Screens** live in `apps/mobile/src/screens/` — they receive data from hooks and dispatch actions. They do not call Cloud Functions directly.
- **Stores** use Zustand in `apps/mobile/src/stores/`.
- **Utils** are pure functions in `apps/mobile/src/utils/`.
- **Navigation** uses React Navigation with typed param lists in `apps/mobile/src/navigation/types.ts`.
- **Theme** — all colors come from `useTheme()`. Never hardcode colors.
- **Shared model** — types and Zod schemas live in `packages/shared-model/`. Rebuild with `npm run build` after changes.

### Firebase Cloud Functions

- All functions are `onCall` in `functions/index.js`.
- Use the admin SDK for all Firestore writes from functions — client-side rules deny writes to server-managed collections.
- The `@react-native-firebase/functions` package is not yet installed (iOS deployment target blocker — see comment in `useSuggestStandards.ts`). All callable invocations currently use stubs. When adding new callable usage, route through a centralized service module with the stub, not inline per-file.

## Don'ts

- Don't copy-paste stubs, constants, or service wrappers across files. Centralize.
- Don't write Cloud Function logic that can only be tested by deploying to an emulator. Extract the logic.
- Don't mark work as complete without tests for the non-trivial logic.
- Don't put data-fetching or mutation calls directly in screen components.
