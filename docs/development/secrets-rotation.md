# Secrets Rotation

## Exposed Secrets (Immediate Action Required)

The following secrets were exposed in session transcripts and must be rotated:

1. **`project_list_keys`** — API key secret exposed during provisioning
2. **`_APP_OPENSSL_KEY_V1`** — OpenSSL key exposed via `compose.one` read
3. **`_APP_NOTIFICATIONS_TRACKING_SECRET`** — Tracking secret exposed via `compose.one` read

## Rotation Steps

### Appwrite API Key

1. Go to Appwrite Console → Project → Settings → API Keys
2. Find the exposed key and delete it
3. Create a new key with the same scopes
4. Update `APPWRITE_API_KEY` in all `.env` files and Dokploy environment variables
5. Redeploy affected services

### OpenSSL Key (`_APP_OPENSSL_KEY_V1`)

1. Generate a new OpenSSL key
2. Update the Dokploy environment variable `_APP_OPENSSL_KEY_V1`
3. Restart the Appwrite container

### Notifications Tracking Secret

1. Generate a new secret (32+ random bytes)
2. Update `_APP_NOTIFICATIONS_TRACKING_SECRET` in Dokploy
3. Restart the Appwrite container

## Prevention

- Never commit secrets to the repository
- Use environment variables for all sensitive values
- Rotate any secret that appears in logs, transcripts, or version control
- Enable Appwrite's audit logging for key usage monitoring
