#!/usr/bin/env bash
#
# Idempotent installer for the subconverter sidecar.
#
# Uses Aethersailor/SubConverter-Extended — a community fork built on top of
# tindy2013/subconverter that integrates the mihomo (Clash.Meta) parsing
# kernel. We need this fork (not mainline tindy2013) because mainline v0.9.0
# rejects VLESS + Reality subscription content with "No nodes were found!",
# which is exactly what 3X-UI panels emit by default.
#
# Behavior:
#   - Pinned at SUBCONVERTER_VERSION (override via env to bump).
#   - Detects arch (amd64 / arm64). Other architectures are not published
#     by this fork; the script aborts with a clear error.
#   - Downloads the release tarball into vendor/subconverter/, flattening
#     the archive's top-level "SubConverter-Extended/" directory.
#   - Generates base/pref.toml from the bundled pref.example.toml and
#     forces the [server] block to bind 127.0.0.1:25500. Verifies the
#     bind address after patching and aborts if it is not 127.0.0.1.
#   - Records the installed version in vendor/subconverter/.installed-version
#     so re-runs are no-ops when nothing has changed.

set -Eeuo pipefail

SUBCONVERTER_VERSION="${SUBCONVERTER_VERSION:-v1.0.24}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_DIR="$PROJECT_ROOT/vendor/subconverter"
VERSION_MARKER="$INSTALL_DIR/.installed-version"
PREF_FILE="$INSTALL_DIR/base/pref.toml"
PREF_EXAMPLE="$INSTALL_DIR/base/pref.example.toml"

log() {
  echo "[install-subconverter] $*"
}

detect_asset() {
  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) echo "SubConverter-Extended-${SUBCONVERTER_VERSION}-linux-amd64.tar.gz" ;;
    aarch64|arm64) echo "SubConverter-Extended-${SUBCONVERTER_VERSION}-linux-arm64.tar.gz" ;;
    *)
      log "unsupported arch: $arch (Aethersailor/SubConverter-Extended publishes amd64/arm64 only)" >&2
      exit 1
      ;;
  esac
}

ASSET="${SUBCONVERTER_ASSET:-$(detect_asset)}"
DOWNLOAD_URL="https://github.com/Aethersailor/SubConverter-Extended/releases/download/${SUBCONVERTER_VERSION}/${ASSET}"

if [[ -x "$INSTALL_DIR/start.sh" && -f "$VERSION_MARKER" ]]; then
  current="$(cat "$VERSION_MARKER" 2>/dev/null || true)"
  if [[ "$current" == "$SUBCONVERTER_VERSION" ]]; then
    log "already installed at $SUBCONVERTER_VERSION; skipping download"
    exit 0
  fi
  log "found $current, replacing with $SUBCONVERTER_VERSION"
fi

mkdir -p "$INSTALL_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

log "downloading $DOWNLOAD_URL"
curl -fSL --retry 3 --retry-delay 2 -o "$TMP_DIR/$ASSET" "$DOWNLOAD_URL"

log "extracting"
tar -xzf "$TMP_DIR/$ASSET" -C "$TMP_DIR"

# Release tarballs ship as a top-level "SubConverter-Extended/" directory.
SRC_DIR="$TMP_DIR/SubConverter-Extended"
if [[ ! -d "$SRC_DIR" ]]; then
  log "expected $SRC_DIR after extraction; aborting" >&2
  exit 1
fi

# Wipe install dir contents before laying down the new tree. Keep the dir
# itself so the .gitignore that pins this path stays in place.
find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 ! -name '.installed-version' -exec rm -rf {} +

cp -a "$SRC_DIR/." "$INSTALL_DIR/"

if [[ ! -x "$INSTALL_DIR/start.sh" || ! -f "$INSTALL_DIR/subconverter" ]]; then
  log "expected start.sh and subconverter binary after extraction; aborting" >&2
  exit 1
fi

# Generate pref.toml from the example and force a localhost bind.
if [[ ! -f "$PREF_EXAMPLE" ]]; then
  log "missing $PREF_EXAMPLE; tarball layout has changed?" >&2
  exit 1
fi
cp "$PREF_EXAMPLE" "$PREF_FILE"

# Section-aware patch: only touch `listen`/`port` keys inside [server]. Other
# TOML sections may have keys with the same names (mihomo bridge, etc.) and
# we must not clobber them.
sed -i.bak \
  -e '/^\[server\]/,/^\[/ {
        s/^[[:space:]]*listen[[:space:]]*=.*/listen = "127.0.0.1"/
        s/^[[:space:]]*port[[:space:]]*=.*/port = 25500/
      }' \
  "$PREF_FILE"
rm -f "$PREF_FILE.bak"

# Verify the patch landed. If the upstream pref.example.toml ever changes its
# section layout we want a loud failure here, not a silently-public sidecar.
listen_line="$(awk '/^\[server\]/{p=1; next} p && /^\[/{p=0} p && /^[[:space:]]*listen[[:space:]]*=/{print; exit}' "$PREF_FILE")"
port_line="$(awk '/^\[server\]/{p=1; next} p && /^\[/{p=0} p && /^[[:space:]]*port[[:space:]]*=/{print; exit}' "$PREF_FILE")"

if ! echo "$listen_line" | grep -q '"127.0.0.1"'; then
  log "pref.toml [server].listen was not patched to 127.0.0.1 (got: $listen_line); aborting" >&2
  exit 1
fi
if ! echo "$port_line" | grep -q '25500'; then
  log "pref.toml [server].port was not patched to 25500 (got: $port_line); aborting" >&2
  exit 1
fi

echo "$SUBCONVERTER_VERSION" > "$VERSION_MARKER"

log "installed Aethersailor/SubConverter-Extended ${SUBCONVERTER_VERSION} at $INSTALL_DIR"
log "  listen: $listen_line"
log "  port:   $port_line"
