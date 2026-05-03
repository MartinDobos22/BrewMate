# Maestro E2E Tests

Lightweight end-to-end smoke tests for BrewMate using [Maestro](https://maestro.mobile.dev).

## Local setup

```bash
# Install Maestro CLI
curl -Ls "https://get.maestro.mobile.dev" | bash

# Build and install the debug APK on a running emulator/device
npm run android

# Run all flows
npm run test:e2e

# Run a single flow
maestro test .maestro/flows/01-app-launch.yaml
```

The Android emulator must be running and the app must be installed (`com.brewmate` package). Maestro launches the installed APK — it does not build it.

## Flows

| File                                 | Purpose                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| `flows/01-app-launch.yaml`           | Smoke: app launches, Login screen renders core elements |
| `flows/02-navigate-to-register.yaml` | Login → Register navigation works                       |

## Conventions

- Match on visible Slovak text (no `testID` props in app yet).
- Always start with `launchApp: { clearState: true }` so flows are independent.
- Tag every flow with `smoke` for now; add `regression` / `auth` tags once we have more coverage.

## CI

`.github/workflows/e2e.yml` runs all flows on an Android emulator on every PR. The job is currently `continue-on-error: true` until the pipeline stabilises.
