#!/usr/bin/env python3
"""LAX NIC -> Prism traffic sync agent (python3 stdlib only).

Replaces the fragile DMIT Tampermonkey userscript. Runs ON the DMIT proxy node
(LAX, 154.17.12.1) on a timer. Reads the node's cumulative NIC bytes via
vnstat (reboot-safe) and POSTs the current billing-cycle usage to Prism's
EXISTING /local/dmit/traffic endpoint, so the machine gauge tracks DMIT's
network-layer billing without any browser.

Why NIC: DMIT bills at the network interface (both proxy legs). The eth0 rx+tx
cumulative matches DMIT's "since boot" total (~2.54 TB verified), so it is the
same measurement layer DMIT charges on -- no 2x app-layer fudge.

Cycle model (integer bytes):
    cycleUsed = seedUsedBytes + (nicTotalNow - seedNicTotal)
Re-anchored to 0 at each DMIT reset (day-3 00:00 UTC). Seeded once from DMIT's
current panel value so the FIRST partial cycle is correct; every later cycle
self-anchors from NIC alone.

Config via env:
    BACKEND_URL, SYNC_TOKEN, SERVICE_ID, PLAN_MB, IFACE, RESET_DAY, STATE_PATH
First run only: SEED_USED_GB, SEED_IN_GB, SEED_OUT_GB
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

MB = 1024 * 1024
GB = 1024 * MB


def env(key, fallback=None):
    value = os.environ.get(key)
    if value is None or value == "":
        if fallback is not None:
            return fallback
        raise SystemExit(f"missing required env {key}")
    return value


def now_ms():
    return int(datetime.now(tz=timezone.utc).timestamp() * 1000)


def next_reset_at(now, reset_day):
    """Next reset_day-of-month 00:00:00 UTC strictly after `now` (ms)."""
    d = datetime.fromtimestamp(now / 1000, tz=timezone.utc)
    year, month = d.year, d.month
    cand = int(datetime(year, month, reset_day, tzinfo=timezone.utc).timestamp() * 1000)
    if cand <= now:
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
        cand = int(datetime(year, month, reset_day, tzinfo=timezone.utc).timestamp() * 1000)
    return cand


def compute_cycle(state, nic):
    """Pure cycle math (exported for tests)."""
    seed_nic_total = state["seedNicRx"] + state["seedNicTx"]
    nic_total = nic["rx"] + nic["tx"]
    return {
        "usedBytes": state["seedUsedBytes"] + max(0, nic_total - seed_nic_total),
        "inBytes": state["seedInBytes"] + max(0, nic["rx"] - state["seedNicRx"]),
        "outBytes": state["seedOutBytes"] + max(0, nic["tx"] - state["seedNicTx"]),
    }


def read_nic(iface):
    """vnstat cumulative bytes (rx, tx) for the interface; monotonic across reboots."""
    raw = subprocess.check_output(["vnstat", "--json", "-i", iface], text=True)
    ifaces = json.loads(raw).get("interfaces") or []
    found = next((x for x in ifaces if x.get("name") == iface), ifaces[0] if ifaces else None)
    if not found:
        raise SystemExit(f"vnstat: interface {iface} not present")
    total = (found.get("traffic") or {}).get("total") or {}
    return {"rx": int(total.get("rx") or 0), "tx": int(total.get("tx") or 0)}


def load_state(path):
    try:
        with open(path) as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def save_state(path, state):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(state, fh, indent=2)


def post(cfg, cycle, next_reset):
    body = json.dumps(
        {
            "service_id": cfg["service_id"],
            "bwusage": round(cycle["usedBytes"] / MB),
            "bwlimit": cfg["plan_mb"],
            "bwusage_in": round(cycle["inBytes"] / MB),
            "bwusage_out": round(cycle["outBytes"] / MB),
            "next_reset_at": next_reset,
        }
    ).encode()
    req = urllib.request.Request(
        f"{cfg['backend_url']}/local/dmit/traffic",
        data=body,
        method="POST",
        headers={
            "content-type": "application/json",
            "authorization": f"Bearer {cfg['token']}",
            # Go DIRECT to the origin (duckdns), bypassing Cloudflare. A plain
            # identifiable UA keeps nginx logs readable; Cloudflare's 1010 rule
            # blocks the default python-urllib signature, so never route this
            # agent through the Cloudflare hostname (prismproxy.uk).
            "user-agent": "dmit-nic-sync/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, resp.read(200).decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        return err.code, err.read(200).decode("utf-8", "replace")


def main():
    cfg = {
        "backend_url": env("BACKEND_URL").rstrip("/"),
        "token": env("SYNC_TOKEN"),
        "service_id": int(env("SERVICE_ID")),
        "plan_mb": int(env("PLAN_MB", str(1000 * 1024))),  # 1000 GiB default
        "iface": env("IFACE", "eth0"),
        "reset_day": int(env("RESET_DAY", "3")),
        "state_path": env("STATE_PATH", "/var/lib/dmit-nic-sync/state.json"),
    }

    now = now_ms()
    nic = read_nic(cfg["iface"])
    state = load_state(cfg["state_path"])

    if state is None:
        # First run: seed from DMIT's current panel values (provided once).
        seed_used_gb = float(env("SEED_USED_GB"))
        state = {
            "seedUsedBytes": round(seed_used_gb * GB),
            "seedInBytes": round(float(env("SEED_IN_GB", "0")) * GB),
            "seedOutBytes": round(float(env("SEED_OUT_GB", "0")) * GB),
            "seedNicRx": nic["rx"],
            "seedNicTx": nic["tx"],
            "nextResetAt": next_reset_at(now, cfg["reset_day"]),
        }
        save_state(cfg["state_path"], state)
        reset_iso = datetime.fromtimestamp(state["nextResetAt"] / 1000, tz=timezone.utc).isoformat()
        print(f"[seed] used={seed_used_gb}GB nic={(nic['rx'] + nic['tx']) / GB:.2f}GB nextReset={reset_iso}")

    # Billing-cycle rollover at day-3 00:00 UTC: re-anchor to 0 + current NIC.
    if now >= state["nextResetAt"]:
        state = {
            "seedUsedBytes": 0,
            "seedInBytes": 0,
            "seedOutBytes": 0,
            "seedNicRx": nic["rx"],
            "seedNicTx": nic["tx"],
            "nextResetAt": next_reset_at(now, cfg["reset_day"]),
        }
        save_state(cfg["state_path"], state)
        reset_iso = datetime.fromtimestamp(state["nextResetAt"] / 1000, tz=timezone.utc).isoformat()
        print(f"[reset] re-anchored; nextReset={reset_iso}")

    cycle = compute_cycle(state, nic)
    status, text = post(cfg, cycle, state["nextResetAt"])
    print(
        f"[post] {status} used={cycle['usedBytes'] / GB:.2f}GB "
        f"in={cycle['inBytes'] / GB:.2f} out={cycle['outBytes'] / GB:.2f} resp={text}"
    )
    if not (200 <= status < 300):
        sys.exit(1)


if __name__ == "__main__":
    main()
