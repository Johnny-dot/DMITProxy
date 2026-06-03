// ==UserScript==
// @name         DMITProxy Traffic Sync
// @namespace    https://github.com/yourname/dmitproxy
// @version      1.0.0
// @description  Auto-sync DMIT bandwidth + reset day to DMITProxy backend.
// @match        https://www.dmit.io/clientarea.php*
// @grant        GM_xmlhttpRequest
// @connect      __DMIT_BACKEND_HOST__
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';
  const SERVICE_ID = __DMIT_SERVICE_ID__;
  const BACKEND = '__DMIT_BACKEND_URL__';
  const TOKEN = '__DMIT_SYNC_TOKEN__';

  try {
    const r = await fetch(
      `/index.php?m=reset_traffic&modaction=get_rules&service_id=${SERVICE_ID}`,
      { credentials: 'same-origin' },
    );
    const j = await r.json();
    if (!j || j.code !== 0 || !j.data || !j.data.traffic_info) {
      console.warn('[DMITProxy Sync] Unexpected DMIT API payload', j);
      return;
    }

    const t = j.data.traffic_info;

    // Forward DMIT's raw "auto_min_days_until_due" string (e.g. "8.57 天") and let the
    // backend parse + derive the reset day. The day-from-days math is fragile near the
    // midnight boundary, so it lives server-side where it is unit-tested — this script
    // only locates the condition, it does no date arithmetic.
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
        } else {
          console.error('[DMITProxy Sync] backend returned', res.status, res.responseText);
        }
      },
      onerror: function (err) {
        console.error('[DMITProxy Sync] request failed', err);
      },
    });
  } catch (e) {
    console.error('[DMITProxy Sync] script error', e);
  }
})();
