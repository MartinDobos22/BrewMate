# Backend (Node.js + Express + TypeScript)

## Files
- `server/src/index.ts`: Express app, middleware, and routes wiring.
- `server/src/config.ts`: environment configuration helpers.
- `server/src/firebaseAdmin.ts`: Firebase Admin SDK initialization and project ID validation.
- `server/src/db.ts`: pg pool + `withUserContext` transaction helper for RLS.
- `server/src/routes/users.ts`: `/api/users/sync`, `/api/me`, `/api/me` PATCH endpoints.
- `server/src/routes/internal.ts`: `/internal/firebase/onCreate` + `/internal/firebase/onDelete` (shared secret protected).
- `server/src/middleware/requireFirebaseAuth.ts`: Firebase ID token verification and request context.
- `server/src/middleware/rateLimit.ts`: basic in-memory rate limiter.
- `server/src/middleware/logger.ts`: request logging.
- `server/tsconfig.json`: TypeScript config for backend build.

## Environment
- `FIREBASE_PROJECT_ID`
- `FIREBASE_ADMIN_CREDENTIALS_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
- `INTERNAL_SHARED_SECRET`
- `DATABASE_URL` or `PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT`
- `PORT`, `NODE_ENV`

## Notes
- The backend **never** uses Supabase service role for user requests. Use `app_api` user with RLS.
- Backend base URL: **[DOP]()** (placeholder from requirements).
