import 'dotenv/config';
import { parse as parseYaml } from 'yaml';
import {
  fetchXuiInbounds,
  getXuiCredentials,
  parseInboundClients,
} from '../../server/xui-admin.js';

const baseUrl = process.env.HEALTHCHECK_URL || 'http://127.0.0.1:3001';
if (!getXuiCredentials()) {
  console.log('[deploy] subscription check unavailable: service credentials are not configured');
} else {
  const inbounds = await fetchXuiInbounds();
  const subId = inbounds
    .filter((ib) => ib.enable)
    .flatMap((ib) =>
      parseInboundClients(ib.settings)
        .filter(
          (client) =>
            client.enable !== false &&
            (ib.clientStats ?? []).some((stat) => stat.email === client.email && stat.enable),
        )
        .map((client) => String(client.subId ?? '')),
    )
    .find(Boolean);
  if (!subId) {
    console.log('[deploy] subscription check unavailable: no active client');
  } else {
    for (const flag of ['', 'clash', 'sing-box']) {
      const response = await fetch(
        `${baseUrl}/sub/${encodeURIComponent(subId)}${flag ? '?flag=' + flag : ''}`,
        { signal: AbortSignal.timeout(30_000) },
      );
      if (!response.ok)
        throw new Error(`Subscription ${flag || 'universal'} returned HTTP ${response.status}`);
      const body = await response.text();
      const valid =
        flag === 'clash'
          ? Array.isArray(parseYaml(body)?.proxies) && parseYaml(body).proxies.length > 0
          : flag === 'sing-box'
            ? JSON.parse(body).outbounds?.length > 0
            : /vless:\/\/|vmess:\/\/|trojan:\/\/|ss:\/\//.test(
                Buffer.from(body, 'base64').toString('utf8'),
              );
      if (!valid) throw new Error(`Invalid ${flag || 'universal'} subscription output`);
      console.log(`[deploy] subscription ${flag || 'universal'}: HTTP 200, valid format`);
    }
  }
}
