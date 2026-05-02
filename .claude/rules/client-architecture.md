---
description: React Native client architecture — auth gate, apiFetch API layer, API host resolution, hooks pattern, theme
globs: src/**,App.tsx
alwaysApply: false
---

- **Auth gate** — `App.tsx` wraps everything in `<AuthProvider>`. `AppNavigator` switches between `MainNavigator` and `AuthNavigator` based on `useAuth().user` (which is hydrated from `GET /auth/me` on mount). Route names live in `src/navigation/types.ts`.
- **API layer** — `src/utils/api.ts`'s `apiFetch` is the only path to the backend. It (a) injects `X-Correlation-Id` (auto-generates one if missing, mirrors it into Sentry tags), (b) injects `X-API-Expected-Version`, (c) sanitizes/redacts logs (`password|token|secret` keys, `image|base64` payloads), and (d) dispatches an `auth_error` to a global handler. `AuthContext` registers that handler so any backend `auth_error` collapses local state and AppNavigator flips back to Login. **Never call `fetch` directly** — go through `apiFetch`.
- **API host resolution** — `Config.EXPO_PUBLIC_API_HOST` (via `react-native-config`), else `__DEV__` → `http://localhost:3000` / `http://10.0.2.2:3000` (Android emulator), else `https://brewmate-fe.onrender.com`.
- **Hooks own feature logic** — `src/hooks/useCoffeeMatch`, `useRecipeGenerator`, `useHomeDashboard`, `usePhotoAnalysis`, `useImagePicker`, `useAutoSaveScan`, `useSignedImageUrl`, etc. Screens are mostly composition; put new business logic in a hook, not a screen.
- **Theme** — `src/theme/theme.ts` exports `appTheme`, `palette`, and `navigationTheme`. Use `useTheme()` rather than importing `appTheme` directly so dark-mode work later is non-breaking. Material 3 primitives live in `src/components/md3.tsx`.
