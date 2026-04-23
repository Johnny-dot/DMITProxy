#!/usr/bin/env bash
#
# Idempotent installer for the subconverter sidecar.
#
# Downloads tindy2013/subconverter at a pinned version into vendor/subconverter/
# and writes a minimal pref.toml that binds it to localhost only. Safe to re-run
# from the deploy script: a no-op when the requested version is already present.
#
# Override version or asset via env vars (rare):
#   SUBCONVERTER_VERSION=v0.9.0
#   SUBCONVERTER_ASSET=subconverter_linux64.tar.gz   # auto-detected by default

set -Eeuo pipefail

SUBCONVERTER_VERSION="${SUBCONVERTER_VERSION:-v0.9.0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_DIR="$PROJECT_ROOT/vendor/subconverter"
VERSION_MARKER="$INSTALL_DIR/.installed-version"

log() {
  echo "[install-subconverter] $*"
}

detect_asset() {
  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) echo "subconverter_linux64.tar.gz" ;;
    aarch64|arm64) echo "subconverter_aarch64.tar.gz" ;;
    armv7l) echo "subconverter_armv7.tar.gz" ;;
    i386|i686) echo "subconverter_linux32.tar.gz" ;;
    *)
      log "unsupported arch: $arch" >&2
      exit 1
      ;;
  esac
}

ASSET="${SUBCONVERTER_ASSET:-$(detect_asset)}"
DOWNLOAD_URL="https://github.com/tindy2013/subconverter/releases/download/${SUBCONVERTER_VERSION}/${ASSET}"

if [[ -x "$INSTALL_DIR/subconverter" && -f "$VERSION_MARKER" ]]; then
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

# Release tarballs ship as a top-level `subconverter/` directory.
SRC_DIR="$TMP_DIR/subconverter"
if [[ ! -d "$SRC_DIR" ]]; then
  log "expected $SRC_DIR after extraction; aborting" >&2
  exit 1
fi

# Preserve the user pref.toml across reinstalls.
PRESERVE_PREF=""
if [[ -f "$INSTALL_DIR/pref.toml" ]]; then
  PRESERVE_PREF="$(mktemp)"
  cp "$INSTALL_DIR/pref.toml" "$PRESERVE_PREF"
fi

# Wipe the install dir contents but keep the directory itself (in case other
# things were placed there manually).
find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 ! -name '.installed-version' -exec rm -rf {} +

cp -a "$SRC_DIR/." "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/subconverter"

# Restore preserved pref or install our minimal localhost-only override.
if [[ -n "$PRESERVE_PREF" ]]; then
  cp "$PRESERVE_PREF" "$INSTALL_DIR/pref.toml"
  rm -f "$PRESERVE_PREF"
  log "preserved existing pref.toml"
elif [[ -f "$INSTALL_DIR/pref.example.toml" && ! -f "$INSTALL_DIR/pref.toml" ]]; then
  cp "$INSTALL_DIR/pref.example.toml" "$INSTALL_DIR/pref.toml"
fi

# Force localhost-only bind and a stable port. Subconverter's [common] section
# uses listen_address / listen_port — we patch them in place if the keys exist.
if [[ -f "$INSTALL_DIR/pref.toml" ]]; then
  sed -i.bak \
    -e 's/^listen_address[[:space:]]*=.*/listen_address = "127.0.0.1"/' \
    -e 's/^listen_port[[:space:]]*=.*/listen_port = 25500/' \
    -e 's/^api_mode[[:space:]]*=.*/api_mode = false/' \
    "$INSTALL_DIR/pref.toml" || true
  rm -f "$INSTALL_DIR/pref.toml.bak"
fi

echo "$SUBCONVERTER_VERSION" > "$VERSION_MARKER"

log "installed $SUBCONVERTER_VERSION at $INSTALL_DIR"
