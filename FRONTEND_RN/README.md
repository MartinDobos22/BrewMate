# React Native updates

## New/updated files
- `src/utils/apiClient.ts`: Firebase-authenticated API client with token refresh.
- `src/context/AuthContext.tsx`: loads profile via `/api/me`.
- `src/screens/LoginScreen.tsx`: Firebase email/password login + sync.
- `src/screens/RegisterScreen.tsx`: Firebase email/password signup + sync.
- `src/utils/socialAuth.ts`: Firebase-only social sign-in (backend sync handled separately).
