#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/apps/DMITProxy}"
BRANCH="${BRANCH:-main}"
DEPLOY_SHA="${DEPLOY_SHA:-}"
NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
NODE_VERSION="${NODE_VERSION:-24}"
PM2_NAME="${PM2_NAME:-dmit-proxy}"
PM2_HOME="${PM2_HOME:-${HOME}/.pm2}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3001}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-30}"
HEALTHCHECK_DELAY_SEC="${HEALTHCHECK_DELAY_SEC:-1}"
export PM2_HOME HEALTHCHECK_URL

log() { echo "[deploy] $*"; }
fail() { log "$*" >&2; exit 1; }
[[ "$DEPLOY_SHA" =~ ^[a-f0-9]{40}$ ]] || fail 'DEPLOY_SHA must be the full tested commit SHA'
[[ "$HEALTHCHECK_RETRIES" =~ ^[0-9]+$ ]] && (( HEALTHCHECK_RETRIES >= 1 && HEALTHCHECK_RETRIES <= 120 )) || fail 'Invalid healthcheck retry count'
[[ -d "$APP_DIR/.git" && ! -L "$APP_DIR/.git" ]] || fail 'APP_DIR must be a full Git checkout'
APP_DIR="$(cd "$APP_DIR" && pwd -P)"
cd "$APP_DIR"
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail 'Unexpected production branch'
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  source "$NVM_DIR/nvm.sh"
  nvm use "$NODE_VERSION" >/dev/null
fi
PM2_BIN="${PM2_BIN:-$(command -v pm2 || true)}"
[[ -n "$PM2_BIN" ]] || fail 'pm2 is not installed'
command -v flock >/dev/null || fail 'flock is required'

WORK_DIR="$APP_DIR/.git/prism-deploy"
mkdir -p -m 700 "$WORK_DIR"
exec 9>"$WORK_DIR/lock"
flock -n 9 || fail 'Another deployment is already running on this host'

clean_checkout() {
  git diff --quiet && git diff --cached --quiet && [[ -z "$(git ls-files --others --exclude-standard)" ]]
}
clean_checkout || fail 'Production checkout is dirty; preserve and review local changes before deploying'

git fetch --no-tags origin "$BRANCH" 9>&-
git cat-file -e "${DEPLOY_SHA}^{commit}"
git merge-base --is-ancestor "$DEPLOY_SHA" FETCH_HEAD || fail 'Requested SHA is not on the fetched branch'
git merge-base --is-ancestor HEAD "$DEPLOY_SHA" || fail 'Refusing a stale or divergent deployment'
if git ls-tree -r --name-only "$DEPLOY_SHA" | grep -E '^(\.env($|\.)|(data|logs|artifacts|node_modules|dist)(/|$))' | grep -vFx '.env.example' >/dev/null; then
  fail 'Candidate tracks a protected runtime path'
fi
PREVIOUS_SHA="$(git rev-parse HEAD)"
PREVIOUS_SHORT="$(git rev-parse --short HEAD)"
TARGET_SHORT="$(git rev-parse --short "$DEPLOY_SHA")"

served_commit() {
  curl -fsS --connect-timeout 2 --max-time 5 "$HEALTHCHECK_URL/local/version" 2>/dev/null |
    node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{try{process.stdout.write(JSON.parse(s).commit||"")}catch{}})'
}
wait_for_version() {
  local expected="$1" attempt current
  for ((attempt=1; attempt<=HEALTHCHECK_RETRIES; attempt++)); do
    current="$(served_commit || true)"
    if [[ "$current" == "$expected" ]] && curl -fsS --connect-timeout 2 --max-time 5 "$HEALTHCHECK_URL/" >/dev/null; then return 0; fi
    sleep "$HEALTHCHECK_DELAY_SEC"
  done
  return 1
}
PREVIOUS_SERVED="$(served_commit || true)"
if [[ "$PREVIOUS_SHA" == "$DEPLOY_SHA" && "$PREVIOUS_SERVED" == "$TARGET_SHORT" ]]; then
  log "already serving tested commit $TARGET_SHORT"
  exit 0
fi
[[ -z "$PREVIOUS_SERVED" || "$PREVIOUS_SERVED" == "$PREVIOUS_SHORT" ]] || fail 'Running commit differs from checkout; inspect the process before deploying'

STAGE="$(mktemp -d "$WORK_DIR/stage.XXXXXX")"
PREVIOUS="$WORK_DIR/previous"
ACTIVATING=0
GIT_UPDATED=0
OLD_MODULES=0
OLD_DIST=0
NEW_MODULES=0
NEW_DIST=0

remove_owned() {
  local target resolved
  target="$1"
  resolved="$(realpath -m -- "$target")"
  case "$resolved" in
    "$WORK_DIR"/*|"$APP_DIR/node_modules"|"$APP_DIR/dist") rm -rf --one-file-system -- "$target" ;;
    *) log "refusing cleanup outside deployment paths: $resolved" >&2; return 1 ;;
  esac
}
restart_app() {
  "$PM2_BIN" stop "$PM2_NAME" 9>&- >/dev/null 2>&1 || true
  env -i HOME="$HOME" USER="${USER:-ubuntu}" LOGNAME="${LOGNAME:-ubuntu}" \
    SHELL="${SHELL:-/bin/bash}" LANG="${LANG:-C.UTF-8}" PATH="$PATH" PM2_HOME="$PM2_HOME" \
    "$PM2_BIN" start ecosystem.config.cjs --only "$PM2_NAME" --update-env 9>&-
}
rollback() {
  log 'activation failed; restoring the previous application'
  clean_checkout || { log 'Checkout changed during deployment; backups retained for manual recovery' >&2; return 1; }
  local current_head
  current_head="$(git rev-parse HEAD)"
  [[ "$current_head" == "$DEPLOY_SHA" || "$current_head" == "$PREVIOUS_SHA" ]] || { log 'HEAD changed outside this deployment; refusing to overwrite it' >&2; return 1; }
  "$PM2_BIN" stop "$PM2_NAME" 9>&- >/dev/null 2>&1 || true
  if (( NEW_MODULES )); then remove_owned "$APP_DIR/node_modules" || return 1; fi
  if (( NEW_DIST )); then remove_owned "$APP_DIR/dist" || return 1; fi
  if (( OLD_MODULES )); then mv -- "$PREVIOUS/node_modules" "$APP_DIR/node_modules" || return 1; fi
  if (( OLD_DIST )); then mv -- "$PREVIOUS/dist" "$APP_DIR/dist" || return 1; fi
  if (( GIT_UPDATED )); then git reset --hard "$PREVIOUS_SHA" >/dev/null || return 1; fi
  if [[ -n "$PREVIOUS_SERVED" ]]; then
    restart_app || return 1
    wait_for_version "$PREVIOUS_SHORT" || { log 'Rollback version check failed; operator action required' >&2; return 1; }
    "$PM2_BIN" save 9>&- >/dev/null || return 1
    log "rollback verified: serving $PREVIOUS_SHORT"
  else
    log 'Previous files restored; there was no previously running application'
  fi
}
cleanup() {
  local code=$?
  trap - EXIT
  if (( code != 0 && ACTIVATING )); then
    rollback || log "Automatic rollback could not finish; retained files: $PREVIOUS" >&2
  fi
  remove_owned "$STAGE" || true
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

log "preparing tested commit $DEPLOY_SHA; current=$PREVIOUS_SHA"
git archive "$DEPLOY_SHA" | tar -xf - -C "$STAGE"
(
  cd "$STAGE"
  HUSKY=0 npm ci
  if [[ -f "$APP_DIR/.env" ]]; then cp -- "$APP_DIR/.env" .env; chmod 600 .env; fi
  PRISM_BUILD_COMMIT="$TARGET_SHORT" npm run build
  node --import tsx/esm scripts/deploy/backup.ts "$APP_DIR"
) 9>&-
[[ -d "$STAGE/node_modules" && -f "$STAGE/dist/index.html" ]] || fail 'Build did not produce the required runtime files'
# Recheck after the potentially slow build; never silently stash operator edits.
clean_checkout || fail 'Production checkout changed during the build'
[[ "$(git rev-parse HEAD)" == "$PREVIOUS_SHA" ]] || fail 'Production HEAD changed during the build'
remove_owned "$PREVIOUS"
mkdir -p -m 700 "$PREVIOUS"
printf '%s\n' "$PREVIOUS_SHA" > "$PREVIOUS/commit"

ACTIVATING=1
GIT_UPDATED=1
git merge --ff-only "$DEPLOY_SHA" >/dev/null
if [[ -d node_modules ]]; then mv -- node_modules "$PREVIOUS/node_modules"; OLD_MODULES=1; fi
if [[ -d dist ]]; then mv -- dist "$PREVIOUS/dist"; OLD_DIST=1; fi
mv -- "$STAGE/node_modules" node_modules
NEW_MODULES=1
mv -- "$STAGE/dist" dist
NEW_DIST=1
restart_app
wait_for_version "$TARGET_SHORT" || fail 'New application did not serve the tested version'
node --import tsx/esm scripts/deploy/smoke.ts 9>&-
clean_checkout || fail 'Checkout changed during activation'
[[ "$(git rev-parse HEAD)" == "$DEPLOY_SHA" ]] || fail 'HEAD changed during activation'
"$PM2_BIN" save 9>&- >/dev/null
ACTIVATING=0
log "version check ok: serving $TARGET_SHORT"
log "deployment complete; previous runtime retained at $PREVIOUS"
