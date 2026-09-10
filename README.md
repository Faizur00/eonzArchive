# eonzArchive

A self-hosted personal ebook archive and web reader integrating with Google Drive.

## Security Setup & Abuse Prevention

The server implements multi-layered security controls to protect the Google Drive API quota and prevent unauthorized access:

### 1. API Token Authentication
All `/api/*` endpoints require authentication via the `X-Request-Token` header or `?token=` query parameter.
- The web UI automatically injects this token when loaded from the same origin.
- To generate a cryptographically strong token:
  ```bash
  openssl rand -hex 32
  ```
- If `API_TOKEN` is unset in `.env`, the server automatically generates a secure 64-byte random hex string.
- If a weak or dictionary-based token is detected, the server logs a warning on startup.

### 2. Rate Limiting
Express rate limiting is enforced with standard `RateLimit-*` draft-7 headers:
- **Global API Limiter**: 200 requests per 15 minutes per IP on all `/api/*` routes.
- **Stream Limiter**: 30 requests per 15 minutes per IP on `/api/book/:id/stream`.
- **Sync Limiter**: 3 requests per hour per IP on `/api/sync`.

When limits are exceeded, the server responds with HTTP `429 Too Many Requests` and a structured JSON error response.

### 3. File ID Validation
The streaming endpoint `/api/book/:id/stream` strictly validates book IDs against the indexed library (`libraryData.books`).
- Requests for non-existent IDs fail immediately with HTTP `404 Book not found in library`.
- No upstream Google Drive API calls are made for invalid IDs, closing enumeration and arbitrary file proxy vulnerabilities.

### 4. Sync Cooldown
Manual synchronization via `/api/sync` includes an automated cooldown mechanism:
- Default cooldown: `5 minutes` (300,000 ms).
- Configurable via `SYNC_COOLDOWN_MS` environment variable.
- Rapid successive calls return `{ status: 'cooldown', retryAfterMs }` rather than initiating redundant Drive crawls.
- Sync can be explicitly forced if needed by passing `?force=true` or `{ "force": true }` in the request body.

---

## Environment Variables

| Variable | Description | Default / Recommended |
|---|---|---|
| `ARCHIVE_FOLDER_URL` | Google Drive folder URL or folder ID | *(Required)* |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account credentials JSON content | *(Required)* |
| `API_TOKEN` | Secret token for `/api` requests | `openssl rand -hex 32` |
| `SYNC_COOLDOWN_MS` | Cooldown period between sync calls in milliseconds | `300000` (5 minutes) |
| `ALLOWED_HOSTS` | Comma-separated list of allowed Host header values | `localhost, 127.0.0.1, [::1]` |
| `HOST` | Interface host address to bind | `0.0.0.0` or `127.0.0.1` |
| `PORT` | HTTP port | `3000` |

---

## Deployment & HTTPS Guidance

### LAN-Only Deployment
For internal home network or LAN use, HTTP is sufficient when binding to your local network interface (e.g. `10.x.x.x` or `192.168.x.x`). Set `ALLOWED_HOSTS` to include your device's LAN IP.

### Internet-Exposed Deployment
When exposing the archive over the public internet, put a TLS-terminating reverse proxy (such as Caddy or Nginx) in front of the application:

#### Using Caddy (Automatic HTTPS)
Create a `Caddyfile`:
```caddyfile
yourdomain.com {
    reverse_proxy localhost:3000
}
```

#### Docker Compose with Caddy
Add Caddy to `docker-compose.yml`:
```yaml
services:
  eonzarchive:
    build: .
    container_name: eonzarchive
    restart: unless-stopped
    env_file: .env
    expose:
      - "3000"
    volumes:
      - ./data:/app/data

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
```
