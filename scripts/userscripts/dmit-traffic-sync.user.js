// ==UserScript==
// @name         DMITProxy Traffic Sync
// @namespace    https://github.com/yourname/dmitproxy
// @version      1.2.0
// @description  Auto-sync DMIT bandwidth + reset day to DMITProxy backend (throttled, with on-page status toast).
// @match        https://www.dmit.io/clientarea.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      __DMIT_BACKEND_HOST__
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';
  const SERVICE_ID = __DMIT_SERVICE_ID__;
  const BACKEND = '__DMIT_BACKEND_URL__';
  const TOKEN = '__DMIT_SYNC_TOKEN__';

  // Tiny self-dismissing status toast in the corner of the DMIT page, so a silent failure
  // (script disabled / backend unreachable / wrong token or URL) becomes visible instead of
  // only living in the console. Wrapped in try/catch — it must never break the sync.
  function toast(message, kind) {
    try {
      const palette = {
        ok: ['#16a34a', '#dcfce7'],
        err: ['#dc2626', '#fee2e2'],
        warn: ['#d97706', '#fef3c7'],
      };
      const tone = palette[kind] || palette.warn;
      const el = document.createElement('div');
      el.textContent = '[DMITProxy] ' + message;
      el.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:340px;' +
        'padding:10px 14px;border-radius:10px;font:13px/1.5 system-ui,-apple-system,sans-serif;' +
        'color:#111827;background:' +
        tone[1] +
        ';border:1px solid ' +
        tone[0] +
        ';' +
        'box-shadow:0 8px 28px rgba(0,0,0,.18);opacity:0;transition:opacity .2s ease;';
      (document.body || document.documentElement).appendChild(el);
      requestAnimationFrame(() => {
        el.style.opacity = '1';
      });
      setTimeout(
        () => {
          el.style.opacity = '0';
          setTimeout(() => el.remove(), 300);
        },
        kind === 'ok' ? 2600 : 6500,
      );
    } catch (e) {
      /* ignore */
    }
  }

  // DMIT sits behind Cloudflare, which issues a "Just a moment" challenge (HTTP 403)
  // when these endpoints are hit too frequently — and that challenge briefly blocks
  // DMIT's own dashboard too. A monthly-quota gauge changes slowly, so we sync at most
  // once per interval. The timestamp is stored BEFORE the request so a failed/challenged
  // attempt still counts against the throttle (never hammer Cloudflare).
  const MIN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  const STORE_KEY = 'dmit_last_sync_' + SERVICE_ID;

  const last = Number(GM_getValue(STORE_KEY, 0)) || 0;
  const now = Date.now();
  if (now - last < MIN_INTERVAL_MS) {
    return; // synced recently; skip this page load entirely
  }
  GM_setValue(STORE_KEY, now);

  try {
    const r = await fetch(
      `/index.php?m=reset_traffic&modaction=get_rules&service_id=${SERVICE_ID}`,
      {
        // Mirror the DMIT app's own axios request so the call is not flagged as a
        // non-XHR navigation by the WAF.
        headers: {
          Accept: 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
      },
    );
    if (!r.ok) {
      // Most likely a transient Cloudflare challenge (403 "Just a moment"). Allow a retry
      // on the next page load instead of waiting out the full interval.
      GM_setValue(STORE_KEY, 0);
      console.warn(
        '[DMITProxy Sync] DMIT request blocked (status ' + r.status + '); will retry next visit',
      );
      toast('DMIT 拦截了请求(' + r.status + '),稍后自动重试', 'warn');
      return;
    }
    const j = await r.json();
    if (!j || j.code !== 0 || !j.data || !j.data.traffic_info) {
      console.warn('[DMITProxy Sync] Unexpected DMIT API payload', j);
      toast('DMIT 返回异常,未能取到流量', 'warn');
      return;
    }

    const t = j.data.traffic_info;

    // Forward DMIT's raw "auto_min_days_until_due" string (e.g. "8.57 天") and let the
    // backend parse + derive the reset day. The day-from-days math is fragile near the
    // midnight boundary, so it lives server-side where it is unit-tested — this script
    // only locates the condition, it does no date arithmetic. The condition is absent at
    // low usage; that is fine — the backend treats a missing value as "no billing day".
    let days_until_reset_text = null;
    const rules = Array.isArray(j.data.rules) ? j.data.rules : [];
    for (const rule of rules) {
      const conds = Array.isArray(rule.conditions) ? rule.conditions : [];
      const cond = conds.find((c) => c && c.key === 'auto_min_days_until_due');
      if (cond && typeof cond.current === 'string') {
        days_until_reset_text = cond.current;
        break;
      }
    }

    GM_xmlhttpRequest({
      method: 'POST',
      url: BACKEND,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + TOKEN,
      },
      data: JSON.stringify({
        service_id: SERVICE_ID,
        bwusage: t.bwusage,
        bwlimit: t.bwlimit,
        bwusage_in: t.bwusage_in,
        bwusage_out: t.bwusage_out,
        usage_percentage: t.usage_percentage,
        days_until_reset_text,
      }),
      onload: function (res) {
        if (res.status === 200) {
          console.log('[DMITProxy Sync] OK', res.responseText);
          toast('已同步到 DMITProxy ✓', 'ok');
        } else {
          console.error('[DMITProxy Sync] backend returned', res.status, res.responseText);
          toast('同步失败:后端返回 ' + res.status + '(token 或地址不对?)', 'err');
        }
      },
      onerror: function (err) {
        console.error('[DMITProxy Sync] request failed', err);
        toast('同步失败:连不上 DMITProxy 后端(地址变了?重新复制脚本)', 'err');
      },
    });
  } catch (e) {
    console.error('[DMITProxy Sync] script error', e);
    toast('脚本错误:' + (e && e.message ? e.message : e), 'err');
  }
})();
