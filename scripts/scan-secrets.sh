#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if command -v gitleaks >/dev/null 2>&1; then
  echo "[secret-scan] Running gitleaks (local binary)..."
  exec gitleaks detect --source . --redact --exit-code 1
fi

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    echo "[secret-scan] Running gitleaks (docker image)..."
    exec docker run --rm -v "$REPO_ROOT:/repo" -w /repo zricethezav/gitleaks:8.24.2 detect --source . --redact --exit-code 1
  fi
  echo "[secret-scan] docker is installed but daemon access is unavailable."
fi

echo "[secret-scan] WARNING: unable to run gitleaks (no local binary and no usable docker daemon). Skipping local scan."
exit 0
