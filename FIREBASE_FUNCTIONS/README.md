# Firebase Cloud Functions

## Functions
- `syncUserOnCreate`: triggers on Firebase Auth user creation → calls backend `/internal/firebase/onCreate`.
- `syncUserOnDelete`: triggers on Firebase Auth user deletion → calls backend `/internal/firebase/onDelete`.

## Environment variables
- `BACKEND_BASE_URL` (e.g. `https://api.example.com`)
- `INTERNAL_SHARED_SECRET`

## Deploy steps
```bash
cd FIREBASE_FUNCTIONS/functions
npm install
npm run build
firebase functions:config:set backend.base_url="https://api.example.com" internal.shared_secret="<secret>"
# or use .env with the Firebase CLI if preferred
npm run deploy
```

## Notes
- Functions include simple retry/backoff logic for backend calls.
