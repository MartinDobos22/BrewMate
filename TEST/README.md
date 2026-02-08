# Test / curl examples

```bash
# 1) Sync user (requires Firebase ID token)
curl -X POST "[DOP]()/api/users/sync" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'

# 2) Get current profile
curl -X GET "[DOP]()/api/me" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>"

# 3) Update profile (whitelisted fields)
curl -X PATCH "[DOP]()/api/me" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"display_name":"New Name","photo_url":"https://example.com/photo.png"}'

# Internal triggers (cloud functions)
curl -X POST "[DOP]()/internal/firebase/onCreate" \
  -H "X-Internal-Secret: <INTERNAL_SHARED_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"uid":"firebase_uid_here","email":"user@example.com"}'

curl -X POST "[DOP]()/internal/firebase/onDelete" \
  -H "X-Internal-Secret: <INTERNAL_SHARED_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"uid":"firebase_uid_here"}'
```
