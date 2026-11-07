# Moo Launcher API

Node.js API for a single Android 12 redroid container.

## Requirements

- Linux host with Docker Engine.
- Kernel binder support configured as described by the redroid deployment documentation.
- A private Docker network named `moo-net` (created by Compose).
- HTTPS reverse proxy in front of the API for remote browser access.

## Setup

```bash
cp .env.example .env
# Edit .env and set API_TOKEN to a unique random secret (32+ characters).
# Set ALLOWED_ORIGINS to the exact HTTPS origin serving the frontend.
docker compose up -d --build
```

Compose binds the API to localhost only. The reverse proxy should forward HTTPS requests to `127.0.0.1:8080`.

## Endpoints

- `GET /api/health` (public health check)
- `GET /api/device/status`
- `POST /api/device/start`
- `POST /api/device/stop`
- `POST /api/apps/install` (multipart form field: `apk`, max 250 MB)

All endpoints except health require a bearer token. ADB is never published on a host port.

## Security

This prototype is for one trusted administrator. It mounts the Docker socket because it creates a privileged Android container. The API token is therefore highly sensitive. Do not expose the API directly to the internet, do not commit `.env`, and use HTTPS plus an exact CORS origin allowlist. Multi-user authentication, per-user storage isolation, quotas, and streaming authorization must be implemented before offering public accounts.
