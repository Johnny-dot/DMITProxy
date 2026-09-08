#!/usr/bin/env bash
set -euo pipefail
SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/remote-deploy.sh"
REAL_NODE="$(command -v node)"
ORIGINAL_PATH="$PATH"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/prism-deploy-test.XXXXXX")"
TEST_ROOT="$(cd "$TEST_ROOT" && pwd -P)"
cleanup() {
  local resolved
  resolved="$(realpath -m "$TEST_ROOT")"
  case "$resolved" in "$(realpath -m "${TMPDIR:-/tmp}")"/prism-deploy-test.*) rm -rf --one-file-system -- "$resolved" ;; *) exit 99 ;; esac
}
trap cleanup EXIT
fail() { echo "[deploy-test] FAIL: $*" >&2; cat "$ROOT/run.log" >&2 2>/dev/null || true; exit 1; }
pass() { echo "[deploy-test] PASS: $*"; }
setup_case() {
  ROOT="$TEST_ROOT/$1"; mkdir -p "$ROOT/origin" "$ROOT/bin" "$ROOT/state"
  APP="$ROOT/app"; STATE="$ROOT/state"; BIN="$ROOT/bin"
  git -C "$ROOT/origin" init -q -b main
  git -C "$ROOT/origin" config user.name 'Deployment fixture'
  git -C "$ROOT/origin" config user.email 'fixture@example.invalid'
  mkdir -p "$ROOT/origin/server" "$ROOT/origin/scripts/deploy"
  printf 'node_modules/\ndist/\ndata/\n.env\n' > "$ROOT/origin/.gitignore"
  printf 'old source\n' > "$ROOT/origin/server/app.ts"
  printf '{}\n' > "$ROOT/origin/package.json"
  printf 'module.exports = {};\n' > "$ROOT/origin/ecosystem.config.cjs"
  git -C "$ROOT/origin" add .
  git -C "$ROOT/origin" -c commit.gpgsign=false commit -qm baseline
  git clone -q "$ROOT/origin" "$APP"
  PREV="$(git -C "$APP" rev-parse HEAD)"; PREV_SHORT="$(git -C "$APP" rev-parse --short HEAD)"
  printf 'new source\n' > "$ROOT/origin/server/app.ts"
  printf '// fixture\n' > "$ROOT/origin/scripts/deploy/backup.ts"
  printf '// fixture\n' > "$ROOT/origin/scripts/deploy/smoke.ts"
  git -C "$ROOT/origin" add .
  git -C "$ROOT/origin" -c commit.gpgsign=false commit -qm candidate
  NEXT="$(git -C "$ROOT/origin" rev-parse HEAD)"
  mkdir -p "$APP/node_modules" "$APP/dist" "$APP/data"
  printf old > "$APP/node_modules/marker"; printf old > "$APP/dist/index.html"
  printf '%s' "$PREV_SHORT" > "$APP/dist/version"
  printf keep-live-data > "$APP/data/keep"
  printf 'FIXTURE_ONLY=true\n' > "$APP/.env"
  printf '%s' "$PREV_SHORT" > "$STATE/current"
  cat > "$BIN/npm" <<'SH'
#!/usr/bin/env bash
set -e
if [[ "$1" == ci ]]; then
  [[ ! -f "$FIXTURE_STATE/fail-install" ]] || exit 21
  mkdir -p node_modules; printf new > node_modules/marker
elif [[ "$1" == run && "$2" == build ]]; then
  [[ ! -f "$FIXTURE_STATE/fail-build" ]] || exit 22
  mkdir -p dist; printf new > dist/index.html; printf '%s' "$PRISM_BUILD_COMMIT" > dist/version
else exit 23
fi
SH
  cat > "$BIN/node" <<'SH'
#!/usr/bin/env bash
if [[ "$*" == *scripts/deploy/backup.ts* ]]; then
  [[ ! -f "$FIXTURE_STATE/fail-backup" ]] || exit 24
  echo '[deploy] fixture database backup verified'
elif [[ "$*" == *scripts/deploy/smoke.ts* ]]; then
  [[ ! -f "$FIXTURE_STATE/fail-smoke" ]] || exit 25
  echo '[deploy] fixture subscription smoke passed'
else exec "$REAL_NODE" "$@"
fi
SH
  cat > "$BIN/pm2" <<'SH'
#!/usr/bin/env bash
set -e
printf '%s\n' "$*" >> "$PM2_HOME/calls"
case "$1" in
  stop) [[ "$2" == dmit-proxy ]] || exit 26; rm -f "$PM2_HOME/current" ;;
  start)
    [[ "$*" == *'--only dmit-proxy'* ]] || exit 27
    if [[ -f "$PM2_HOME/fail-start" ]]; then rm -f "$PM2_HOME/fail-start"; exit 28; fi
    if [[ -f "$PM2_HOME/operator-edit" || -f "$PM2_HOME/operator-commit" ]]; then
      printf 'operator-change\n' >> server/app.ts
      if [[ -f "$PM2_HOME/operator-commit" ]]; then
        git -c user.name=Fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false commit -qam 'operator fixture edit'
      fi
      rm -f "$PM2_HOME/operator-edit" "$PM2_HOME/operator-commit"
    fi
    git rev-parse --short HEAD > "$PM2_HOME/current"
    ;;
  save) : ;;
  *) exit 29 ;;
esac
SH
  cat > "$BIN/curl" <<'SH'
#!/usr/bin/env bash
[[ -f "$PM2_HOME/current" ]] || exit 7
if [[ "${@: -1}" == */local/version ]]; then printf '{"commit":"%s"}' "$(cat "$PM2_HOME/current")"; else printf '<html>fixture</html>'; fi
SH
  chmod +x "$BIN/"*
}
run_deploy() {
  APP_DIR="$APP" BRANCH=main DEPLOY_SHA="$NEXT" PM2_HOME="$STATE" PM2_BIN="$BIN/pm2" \
    NVM_DIR="$ROOT/no-nvm" HEALTHCHECK_RETRIES=2 HEALTHCHECK_DELAY_SEC=0 \
    PATH="$BIN:$ORIGINAL_PATH" REAL_NODE="$REAL_NODE" FIXTURE_STATE="$STATE" \
    bash "$SCRIPT" > "$ROOT/run.log" 2>&1
}
assert_old() {
  [[ "$(git -C "$APP" rev-parse HEAD)" == "$PREV" ]] || fail 'previous commit was not restored'
  [[ "$(cat "$APP/node_modules/marker")" == old ]] || fail 'previous dependencies were not restored'
  [[ "$(cat "$APP/dist/index.html")" == old ]] || fail 'previous build was not restored'
  [[ "$(cat "$STATE/current")" == "$PREV_SHORT" ]] || fail 'previous process was not restored'
  [[ "$(cat "$APP/data/keep")" == keep-live-data ]] || fail 'live data changed'
}
setup_case success
run_deploy || fail 'successful deployment failed'
[[ "$(git -C "$APP" rev-parse HEAD)" == "$NEXT" ]] || fail 'wrong deployed SHA'
[[ "$(cat "$APP/dist/version")" == "$(git -C "$APP" rev-parse --short HEAD)" ]] || fail 'wrong frontend build SHA'
[[ "$(cat "$APP/.git/prism-deploy/previous/node_modules/marker")" == old ]] || fail 'previous runtime not retained'
[[ "$(cat "$APP/data/keep")" == keep-live-data ]] || fail 'live data changed'
BEFORE_CALLS="$(wc -l < "$STATE/calls")"
run_deploy || fail 'idempotent deployment failed'
[[ "$(wc -l < "$STATE/calls")" == "$BEFORE_CALLS" ]] || fail 'idempotent run restarted the process'
pass 'exact SHA, previous runtime retention and idempotent rerun'

for phase in install build backup; do
  setup_case "$phase"; touch "$STATE/fail-$phase"
  if run_deploy; then fail "$phase failure falsely succeeded"; fi
  assert_old
  [[ ! -s "$STATE/calls" ]] || fail "$phase failure touched the running process"
  pass "$phase failure leaves the live application intact"
done
for phase in start smoke; do
  setup_case "$phase"; touch "$STATE/fail-$phase"
  if run_deploy; then fail "$phase failure falsely succeeded"; fi
  assert_old
  grep -q 'rollback verified' "$ROOT/run.log" || fail 'rollback was not verified'
  pass "$phase failure rolls back code, dependencies and build"
done
setup_case dirty
printf 'operator-change\n' >> "$APP/server/app.ts"
if run_deploy; then fail 'dirty checkout was accepted'; fi
grep -q operator-change "$APP/server/app.ts" || fail 'operator changes were lost'
[[ ! -s "$STATE/calls" ]] || fail 'dirty checkout touched the process'
pass 'dirty checkout preserves operator changes'
setup_case stale
run_deploy || fail 'stale fixture setup failed'
DEPLOYED="$NEXT"; NEXT="$PREV"
if run_deploy; then fail 'stale deployment was accepted'; fi
[[ "$(git -C "$APP" rev-parse HEAD)" == "$DEPLOYED" ]] || fail 'stale deployment changed HEAD'
pass 'stale deployment is rejected'
for change in edit commit; do
  setup_case "operator-$change"; touch "$STATE/operator-$change"
  if run_deploy; then fail 'concurrent operator change falsely succeeded'; fi
  grep -q operator-change "$APP/server/app.ts" || fail 'concurrent operator change was overwritten'
  if [[ "$change" == commit ]]; then
    [[ "$(git -C "$APP" log -1 --format=%s)" == 'operator fixture edit' ]] || fail 'operator commit was reset'
  fi
  pass "concurrent operator $change is preserved"
done
