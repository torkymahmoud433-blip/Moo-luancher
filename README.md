# Moo Launcher — Android Cloud in Your Browser

Moo Launcher is being built as a browser-based Android cloud environment inspired by virtual Android apps. The web page is hosted separately from the Android runtime.

## Current implementation

- Responsive Arabic browser dashboard.
- Backend API protected by a bearer token.
- Start, stop, and inspect one Android 12 redroid container.
- Install an APK through the backend's private ADB connection.
- Persistent Android data volume.
- ADB is not published as a public host port.
- **Browser screen streaming, touch/audio forwarding, user accounts, and multi-device isolation are not implemented yet.**

## Architecture

- **Frontend:** GitHub Pages or another HTTPS static host.
- **API:** Node.js service in `server/`.
- **Android runtime:** redroid Android 12 64-bit container on a Linux host with the required binder kernel support.
- **Next milestone:** integrate an authenticated browser streaming/control bridge, then add per-user sessions and quotas.

## Deploy the backend

This is a single-admin prototype, not a public multi-user service. Run it only on a server you control.

1. Use a Linux host with Docker Engine and a kernel that supports the binder devices required by redroid.
2. Configure the host kernel modules according to the [redroid deployment guide](https://github.com/remote-android/redroid-doc).
3. Clone this repository on the server.
4. Copy `.env.example` to `.env`.
5. Generate a private token with `openssl rand -hex 32` and set it as `API_TOKEN` in `.env`.
6. Set `ALLOWED_ORIGINS` to the exact HTTPS origin of the deployed frontend, for example `https://your-name.github.io`.
7. Start the API with `docker compose up -d --build`.
8. Put the API behind an HTTPS reverse proxy. The Compose file binds the API to `127.0.0.1:8080` by default.

The backend uses the Docker socket to manage a privileged Android container. Anyone who obtains the API token could control the Android instance and potentially affect the host. Keep the token private, use HTTPS, and do not expose the Docker socket or ADB port to the internet.

## API

All routes except health require `Authorization: Bearer <API_TOKEN>`.

- `GET /api/health`
- `GET /api/device/status`
- `POST /api/device/start`
- `POST /api/device/stop`
- `POST /api/apps/install` with multipart field `apk`

The Android container uses the internal Docker network `moo-net` and persistent volume `moo-android-data`. Its ADB service is only reached from the backend over that private network.

## Screen streaming status

The current API can start/stop Android and install APKs, but it does not yet stream the Android display into the browser. A separate browser bridge is required for video, audio, touch, keyboard, and clipboard. Candidate projects for evaluation include [Webscreen](https://github.com/huonwe/webscreen) and [ws-scrcpy-web](https://github.com/bilbospocketses/ws-scrcpy-web). They must be audited and integrated behind Moo's own authentication before public use.

## Frontend

The GitHub Pages workflow deploys the static frontend. Configure the API URL and bearer token in the dashboard at runtime. Do not hard-code secrets into `index.html`.

## License and third-party components

Moo Launcher is an independent project. redroid and any future streaming bridge retain their own licenses and notices. Review those licenses before redistribution.
