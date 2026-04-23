#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/apps/DMITProxy}"
BRANCH="${BRANCH:-main}"
NVM_DIR="${NVM_DIR:-/home/ubuntu/.nvm}"
NODE_VERSION="${NODE_VERSION:-24}"
PM2_NAME="${PM2_NAME:-dmit-proxy}"
PM2_HOME="${PM2_HOME:-/home/ubuntu/.pm2}"
export PM2_HOME
PM2_BIN="${PM2_BIN:-}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3001}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-30}"
HEALTHCHECK_DELAY_SEC="${HEALTHCHECK_DELAY_SEC:-1}"
PROTECTED_FILES=(
  "server/app.ts"
  "server/index.ts"
)

log() {
  echo "[deploy] $*"
}

section() {
  echo
  log "== $* =="
}

if [[ ! -d "$APP_DIR/.git" ]]; then
  log "app dir is not a git repo: $APP_DIR" >&2
  exit 1
fi

if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
  nvm use "$NODE_VERSION" >/dev/null
fi

if [[ -z "$PM2_BIN" ]]; then
  PM2_BIN="$(command -v pm2 || true)"
fi

if [[ -z "$PM2_BIN" ]]; then
  log "pm2 binary not found in PATH after nvm setup" >&2
  exit 1
fi

cd "$APP_DIR"

STASH_NAME="autodeploy-protected-$(date +%Y%m%d-%H%M%S)"
RESTORE_STASH=0

cleanup() {
  local exit_code=$?
  if [[ $exit_code -ne 0 && $RESTORE_STASH -eq 1 ]]; then
    log "deployment failed; protected-file stash kept for manual recovery: $STASH_NAME" >&2
  fi
}
trap cleanup EXIT

section "prepare"
log "branch=$BRANCH repo=$(git rev-parse --show-toplevel)"
log "head-before=$(git rev-parse --short HEAD)"

stash_args=()
for file in "${PROTECTED_FILES[@]}"; do
  if [[ -e "$file" ]]; then
    stash_args+=("$file")
  fi
done

if [[ ${#stash_args[@]} -gt 0 ]]; then
  git stash push -m "$STASH_NAME" -- "${stash_args[@]}" >/dev/null || true
  if git stash list | grep -Fq "$STASH_NAME"; then
    RESTORE_STASH=1
    log "stashed protected local patches"
  fi
fi

section "update"
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [[ $RESTORE_STASH -eq 1 ]]; then
  git stash pop --index >/dev/null
  RESTORE_STASH=0
  log "restored protected local patches"
fi

section "build"
npm ci
bash scripts/install-subconverter.sh
npm run build

section "restart"
# Restart from the ecosystem file under a scrubbed environment so the
# caller's SSH/session variables do not leak into the app process.
# Restarts every app in the ecosystem (dmit-proxy + dmit-subconverter sidecar)
# and starts any that aren't yet running.
env -i \
  HOME="${HOME:-/home/ubuntu}" \
  USER="${USER:-ubuntu}" \
  LOGNAME="${LOGNAME:-ubuntu}" \
  SHELL="${SHELL:-/bin/bash}" \
  LANG="${LANG:-C.UTF-8}" \
  PATH="$PATH" \
  PM2_HOME="$PM2_HOME" \
  "$PM2_BIN" restart ecosystem.config.cjs --update-env
"$PM2_BIN" save

# Verify the process actually restarted (uptime must be fresh)
sleep 3
PM2_UPTIME=$("$PM2_BIN" jlist 2>/dev/null | node -e "
  const list = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const app = list.find(p => p.name === '${PM2_NAME}');
  process.stdout.write(app ? String(app.pm2_env.pm_uptime ?? 0) : '0');
")
PM2_UPTIME_AGO=$(( $(date +%s%3N) - PM2_UPTIME ))
if [[ $PM2_UPTIME_AGO -gt 15000 ]]; then
  log "pm2 restart did not take effect (uptime=${PM2_UPTIME_AGO}ms ago), aborting" >&2
  exit 1
fi
log "pm2 restarted ok (uptime=${PM2_UPTIME_AGO}ms ago)"

section "healthcheck"
healthcheck_ok=0
for ((attempt = 1; attempt <= HEALTHCHECK_RETRIES; attempt++)); do
  if curl -fsS "$HEALTHCHECK_URL" >/dev/null; then
    healthcheck_ok=1
    log "healthcheck succeeded on attempt=$attempt url=$HEALTHCHECK_URL"
    break
  fi
  sleep "$HEALTHCHECK_DELAY_SEC"
done

if [[ $healthcheck_ok -ne 1 ]]; then
  log "healthcheck failed after ${HEALTHCHECK_RETRIES} attempts: $HEALTHCHECK_URL" >&2
  exit 1
fi

section "done"
log "head-after=$(git rev-parse --short HEAD)"
log "healthcheck-ok=$HEALTHCHECK_URL"
