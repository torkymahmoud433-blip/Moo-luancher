#!/usr/bin/env bash
set -euo pipefail

echo "== Moo Launcher | Android 12 ARM64 setup =="

ARCH="$(uname -m)"
if [[ "$ARCH" != "aarch64" && "$ARCH" != "arm64" ]]; then
  echo "This deployment is pinned to ARM64. Detected host architecture: $ARCH"
  echo "Use an ARM64 Linux server. The browser frontend can still be opened from any device."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Engine is required. Install Docker on this ARM64 Linux host first."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is required."
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  TOKEN="$(openssl rand -hex 32)"
  if command -v sed >/dev/null 2>&1; then
    sed -i "s|^API_TOKEN=.*|API_TOKEN=$TOKEN|" .env
  fi
  echo "Created .env with a fresh private API token."
fi

if ! grep -q '^API_TOKEN=' .env || grep -q '^API_TOKEN=replace-with-' .env; then
  echo "Set API_TOKEN in .env to a private random value before continuing."
  exit 1
fi

echo "Checking host Binder support (redroid needs compatible kernel modules)..."
if [[ ! -e /dev/binder && ! -e /dev/binderfs/binder ]]; then
  echo "WARNING: Binder device not found. Configure binder_linux on the host using the redroid documentation before expecting Android to boot."
fi

echo "Building and starting the ARM64 API + Android 12 container stack..."
docker compose up -d --build

echo
echo "Moo API container status:"
docker compose ps
echo
echo "API health endpoint: http://127.0.0.1:8080/api/health"
echo "Put the API behind HTTPS before connecting from a remote browser."
echo "Do not expose Docker socket or ADB ports to the public internet."
