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
SUBCONVERTER_SMOKE_BASE_URL="${SUBCONVERTER_SMOKE_BASE_URL:-http://127.0.0.1:3001}"
SERVER_PORT="${SERVER_PORT:-3001}"
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

free_port() {
  # Kill anything still listening on SERVER_PORT (e.g. a process that escaped pm2) so the
  # freshly-started managed process can bind it. Best-effort.
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${SERVER_PORT}/tcp" 2>/dev/null || true
  else
    local pids
    pids="$(ss -ltnHp 2>/dev/null | grep -E ":${SERVER_PORT}\b" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)"
    [[ -n "$pids" ]] && kill $pids 2>/dev/null || true
  fi
}

served_commit() {
  curl -fsS "${HEALTHCHECK_URL}/local/version" 2>/dev/null | sed -n 's/.*"commit":"\([^"]*\)".*/\1/p'
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
EXTRA_STASH_NAME="autodeploy-extra-$(date +%Y%m%d-%H%M%S)"
RESTORE_STASH=0
EXTRA_STASH=0

cleanup() {
  local exit_code=$?
  if [[ $exit_code -ne 0 && $RESTORE_STASH -eq 1 ]]; then
    log "deployment failed; protected-file stash kept for manual recovery: $STASH_NAME" >&2
  fi
  if [[ $exit_code -ne 0 && $EXTRA_STASH -eq 1 ]]; then
    log "deployment failed; extra local changes remain stashed for manual recovery: $EXTRA_STASH_NAME" >&2
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

if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  git stash push -u -m "$EXTRA_STASH_NAME" >/dev/null
  if git stash list | grep -Fq "$EXTRA_STASH_NAME"; then
    EXTRA_STASH=1
    log "stashed extra local changes; they will not be restored automatically: $EXTRA_STASH_NAME"
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
# `npm ci` is flaky on this host in two distinct ways:
#   1. it aborts mid-install — ENOTEMPTY during node_modules teardown, or ETXTBSY on the
#      esbuild binary (spawned while still being written) — which previously killed the
#      whole deploy and forced a manual re-run;
#   2. because package-lock.json is generated off-platform, it can skip the ARM64 optional
#      binaries for rollup/esbuild, installing "OK" but breaking `vite build`.
# Handle (1) by retrying `npm ci` on a clean tree a few times; handle (2) by falling back to
# `npm install` (which resolves the host's platform deps), restoring the committed lockfile.
install_deps() {
  local attempt
  for attempt in 1 2 3; do
    rm -rf node_modules
    if npm ci; then
      return 0
    fi
    log "npm ci failed (attempt ${attempt}/3) — retrying on a clean tree" >&2
    sleep 3
  done
  log "npm ci failed repeatedly — falling back to npm install" >&2
  rm -rf node_modules
  npm install
  git checkout -- package-lock.json 2>/dev/null || true
}
install_deps
bash scripts/install-subconverter.sh
if ! npm run build; then
  log "vite build failed after install — reinstalling with npm install (platform optional deps) and retrying" >&2
  npm install
  git checkout -- package-lock.json 2>/dev/null || true
  npm run build
fi

section "restart"
# Use `pm2 start` (not `restart`) so the ecosystem file is the source of truth:
#   - registers any newly-added apps (e.g. dmit-subconverter)
#   - restarts existing apps with the latest config from the file
# Stop the managed app and free the port first, so a stray/orphan process (one that
# escaped pm2) can't keep holding the port and force the new process to serve stale code.
"$PM2_BIN" stop "$PM2_NAME" 2>/dev/null || true
free_port
sleep 1
# Run under a scrubbed environment so the caller's SSH/session variables do
# not leak into the app process.
env -i \
  HOME="${HOME:-/home/ubuntu}" \
  USER="${USER:-ubuntu}" \
  LOGNAME="${LOGNAME:-ubuntu}" \
  SHELL="${SHELL:-/bin/bash}" \
  LANG="${LANG:-C.UTF-8}" \
  PATH="$PATH" \
  PM2_HOME="$PM2_HOME" \
  "$PM2_BIN" start ecosystem.config.cjs --update-env
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

section "version check"
# The healthcheck above only proves SOMETHING answers on the port — it can be a stale
# process serving old code. Assert the served commit matches what we just deployed; if not,
# a stray process is holding the port. Remediate once (free port + restart), then fail loud.
DEPLOYED_SHA="$(git rev-parse --short HEAD)"
SERVED_SHA="$(served_commit)"
if [[ "$SERVED_SHA" != "$DEPLOYED_SHA" ]]; then
  log "served commit '${SERVED_SHA:-none}' != deployed '$DEPLOYED_SHA' — stale process on :${SERVER_PORT}; remediating once" >&2
  "$PM2_BIN" stop "$PM2_NAME" 2>/dev/null || true
  free_port
  sleep 1
  env -i \
    HOME="${HOME:-/home/ubuntu}" \
    USER="${USER:-ubuntu}" \
    LOGNAME="${LOGNAME:-ubuntu}" \
    SHELL="${SHELL:-/bin/bash}" \
    LANG="${LANG:-C.UTF-8}" \
    PATH="$PATH" \
    PM2_HOME="$PM2_HOME" \
    "$PM2_BIN" start ecosystem.config.cjs --update-env
  sleep 3
  SERVED_SHA="$(served_commit)"
  if [[ "$SERVED_SHA" != "$DEPLOYED_SHA" ]]; then
    log "still serving '${SERVED_SHA:-none}' after remediation (deployed '$DEPLOYED_SHA'); likely a rogue pm2 daemon respawning a stale process — aborting" >&2
    exit 1
  fi
fi
log "version check ok: serving $SERVED_SHA"

section "subconverter smoke"
if [[ -n "${SUBCONVERTER_SMOKE_SUB_ID:-}" ]]; then
  npm run sub:check -- "$SUBCONVERTER_SMOKE_SUB_ID" "$SUBCONVERTER_SMOKE_BASE_URL"
else
  log "skipped; set SUBCONVERTER_SMOKE_SUB_ID to validate a real Clash subscription"
fi

section "done"
log "head-after=$(git rev-parse --short HEAD)"
log "healthcheck-ok=$HEALTHCHECK_URL"
if [[ $EXTRA_STASH -eq 1 ]]; then
  log "extra-local-stash=$EXTRA_STASH_NAME"
fi
