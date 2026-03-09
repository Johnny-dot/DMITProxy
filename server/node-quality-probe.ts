import {
  saveNodeQualityProfile,
  type NodeQualityProfile,
  type NodeQualityEgressMeta,
  type NodeQualityProbeCode,
  type NodeQualityServiceDetail,
  type UnlockStatus,
} from './node-quality.js';

interface IpApiResponse {
  status: 'success' | 'fail';
  message?: string;
  country?: string;
  countryCode?: string;
  regionName?: string;
  city?: string;
  isp?: string;
  org?: string;
  as?: string;
  proxy?: boolean;
  hosting?: boolean;
  mobile?: boolean;
  query?: string;
}

interface ProbeHttpResult {
  ok: boolean;
  status: number;
  location: string;
  body: string;
}

interface ServiceProbeResult {
  status: UnlockStatus;
  detail: string;
  probe: NodeQualityServiceDetail;
}

interface GenericServiceProbeConfig {
  serviceName: string;
  url: string;
  successDetail: string;
  blockedDetail: string;
}

const PROBE_TIMEOUT_MS = Math.max(
  3000,
  Math.min(20000, Number.parseInt(process.env.NODE_QUALITY_PROBE_TIMEOUT_MS ?? '8000', 10) || 8000),
);
const BROWSER_LIKE_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36 PrismNodeProbe/1.0',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeProbeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildServiceProbe(
  code: NodeQualityProbeCode,
  target: string,
  httpStatus: number | null = null,
  location = '',
): NodeQualityServiceDetail {
  return {
    code,
    httpStatus,
    location,
    target,
  };
}

async function fetchWithTimeout(url: string, headers?: HeadersInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: 'manual',
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextProbe(url: string, headers?: HeadersInit): Promise<ProbeHttpResult> {
  try {
    const res = await fetchWithTimeout(url, headers);
    const body = await res.text().catch(() => '');
    return {
      ok: true,
      status: res.status,
      location: res.headers.get('location') ?? '',
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      location: '',
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchIpMeta(): Promise<IpApiResponse | null> {
  try {
    const res = await fetchWithTimeout(
      'http://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city,isp,org,as,proxy,hosting,mobile,query',
      { accept: 'application/json' },
    );
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as IpApiResponse | null;
    if (!data || data.status !== 'success') return null;
    return data;
  } catch {
    return null;
  }
}

function estimateFraudScore(meta: IpApiResponse | null): number | null {
  if (!meta) return null;

  let score = 18;
  if (meta.proxy) score += 40;
  if (meta.hosting) score += 22;
  if (meta.mobile) score -= 8;

  const providerText = `${meta.isp ?? ''} ${meta.org ?? ''} ${meta.as ?? ''}`.toLowerCase();
  if (/\b(host|cloud|vps|server|colo|datacenter)\b/.test(providerText)) score += 12;
  if (/\b(residential|broadband|telecom|fiber)\b/.test(providerText)) score -= 6;

  if ((meta.countryCode ?? '').toUpperCase() === 'US') score -= 4;
  return clampScore(score);
}

function isChallengePage(body: string): boolean {
  const text = normalizeProbeText(body);
  return (
    text.includes('just a moment') ||
    text.includes('verify you are human') ||
    text.includes('captcha') ||
    text.includes('attention required') ||
    text.includes('cf-challenge')
  );
}

function isRegionBlocked(body: string): boolean {
  const text = normalizeProbeText(body);
  return (
    text.includes('not available in your country') ||
    text.includes('unsupported country') ||
    text.includes('country is not supported') ||
    text.includes('service is not available in your region') ||
    text.includes('not available in your region') ||
    text.includes('unavailable in your region') ||
    text.includes("isn't available in your region")
  );
}

async function probeGenericService({
  serviceName,
  url,
  successDetail,
  blockedDetail,
}: GenericServiceProbeConfig): Promise<ServiceProbeResult> {
  const probe = await fetchTextProbe(url, BROWSER_LIKE_HEADERS);
  if (!probe.ok) {
    return {
      status: 'unknown',
      detail: `${serviceName} probe failed.`,
      probe: buildServiceProbe('probe_failed', url),
    };
  }

  if (isRegionBlocked(probe.body) || probe.status === 451) {
    return {
      status: 'blocked',
      detail: blockedDetail,
      probe: buildServiceProbe('region_block', url, probe.status, probe.location),
    };
  }

  if (probe.status >= 200 && probe.status < 400) {
    return {
      status: 'supported',
      detail: successDetail.replace('{status}', String(probe.status)),
      probe: buildServiceProbe('http_ok', url, probe.status, probe.location),
    };
  }

  if (probe.status === 403 || probe.status === 429 || isChallengePage(probe.body)) {
    return {
      status: 'limited',
      detail: `${serviceName} is reachable, but anti-bot or verification checks are present.`,
      probe: buildServiceProbe('challenge', url, probe.status, probe.location),
    };
  }

  return {
    status: 'limited',
    detail: `${serviceName} returned HTTP ${probe.status}.`,
    probe: buildServiceProbe('http_status', url, probe.status, probe.location),
  };
}

async function probeChatgpt(): Promise<ServiceProbeResult> {
  const trace = await fetchTextProbe('https://chat.openai.com/cdn-cgi/trace', {
    'user-agent': BROWSER_LIKE_HEADERS['user-agent'],
    accept: 'text/plain,*/*',
  });
  if (!trace.ok || trace.status < 200 || trace.status >= 400) {
    return {
      status: 'unknown',
      detail: 'OpenAI edge trace is unreachable.',
      probe: buildServiceProbe(
        'trace_unreachable',
        'https://chat.openai.com/cdn-cgi/trace',
        trace.status || null,
      ),
    };
  }

  const home = await fetchTextProbe('https://chatgpt.com/', BROWSER_LIKE_HEADERS);
  if (!home.ok) {
    return {
      status: 'unknown',
      detail: 'ChatGPT homepage probe failed.',
      probe: buildServiceProbe('probe_failed', 'https://chatgpt.com/'),
    };
  }
  if (home.status >= 200 && home.status < 400) {
    return {
      status: 'supported',
      detail: `HTTP ${home.status} from chatgpt.com.`,
      probe: buildServiceProbe('http_ok', 'https://chatgpt.com/', home.status, home.location),
    };
  }
  if (isRegionBlocked(home.body)) {
    return {
      status: 'blocked',
      detail: 'ChatGPT responded with a region restriction page.',
      probe: buildServiceProbe('region_block', 'https://chatgpt.com/', home.status, home.location),
    };
  }
  if (home.status === 403 || home.status === 429 || isChallengePage(home.body)) {
    return {
      status: 'limited',
      detail: 'ChatGPT is reachable, but anti-bot or challenge checks are present.',
      probe: buildServiceProbe('challenge', 'https://chatgpt.com/', home.status, home.location),
    };
  }
  return {
    status: 'limited',
    detail: `ChatGPT returned HTTP ${home.status}.`,
    probe: buildServiceProbe('http_status', 'https://chatgpt.com/', home.status, home.location),
  };
}

async function probeClaude(): Promise<ServiceProbeResult> {
  const favicon = await fetchTextProbe('https://claude.ai/favicon.ico', {
    'user-agent': BROWSER_LIKE_HEADERS['user-agent'],
    accept: 'image/*,*/*',
  });
  if (!favicon.ok || favicon.status < 200 || favicon.status >= 400) {
    return {
      status: 'unknown',
      detail: 'Claude static assets are unreachable.',
      probe: buildServiceProbe(
        'static_unreachable',
        'https://claude.ai/favicon.ico',
        favicon.status || null,
      ),
    };
  }

  const login = await fetchTextProbe('https://claude.ai/login', BROWSER_LIKE_HEADERS);
  if (!login.ok) {
    return {
      status: 'unknown',
      detail: 'Claude login probe failed.',
      probe: buildServiceProbe('probe_failed', 'https://claude.ai/login'),
    };
  }
  if (login.status >= 200 && login.status < 400) {
    return {
      status: 'supported',
      detail: `HTTP ${login.status} from claude.ai/login.`,
      probe: buildServiceProbe('http_ok', 'https://claude.ai/login', login.status, login.location),
    };
  }
  if (isRegionBlocked(login.body)) {
    return {
      status: 'blocked',
      detail: 'Claude responded with a region restriction page.',
      probe: buildServiceProbe(
        'region_block',
        'https://claude.ai/login',
        login.status,
        login.location,
      ),
    };
  }
  if (login.status === 403 || login.status === 429 || isChallengePage(login.body)) {
    return {
      status: 'limited',
      detail: 'Claude is reachable, but anti-bot or verification checks are present.',
      probe: buildServiceProbe(
        'challenge',
        'https://claude.ai/login',
        login.status,
        login.location,
      ),
    };
  }
  return {
    status: 'limited',
    detail: `Claude returned HTTP ${login.status}.`,
    probe: buildServiceProbe(
      'http_status',
      'https://claude.ai/login',
      login.status,
      login.location,
    ),
  };
}

async function probeNetflix(): Promise<ServiceProbeResult> {
  const probe = await fetchTextProbe(
    'https://www.netflix.com/title/81215567',
    BROWSER_LIKE_HEADERS,
  );
  if (!probe.ok) {
    return {
      status: 'unknown',
      detail: 'Netflix title probe failed.',
      probe: buildServiceProbe('probe_failed', 'https://www.netflix.com/title/81215567'),
    };
  }

  const location = probe.location.toLowerCase();
  if (probe.status >= 200 && probe.status < 300) {
    return {
      status: 'supported',
      detail: `HTTP ${probe.status} from the Netflix title page.`,
      probe: buildServiceProbe(
        'http_ok',
        'https://www.netflix.com/title/81215567',
        probe.status,
        probe.location,
      ),
    };
  }
  if (location.includes('/unsupportedbrowser')) {
    return {
      status: 'limited',
      detail:
        'Netflix is reachable, but the probe hit an unsupported-browser fallback instead of a normal title response.',
      probe: buildServiceProbe(
        'unsupported_browser',
        'https://www.netflix.com/title/81215567',
        probe.status,
        probe.location,
      ),
    };
  }
  if (isRegionBlocked(probe.body)) {
    return {
      status: 'blocked',
      detail: 'Netflix responded with a regional restriction page.',
      probe: buildServiceProbe(
        'region_block',
        'https://www.netflix.com/title/81215567',
        probe.status,
        probe.location,
      ),
    };
  }
  return {
    status: 'limited',
    detail: `Netflix returned HTTP ${probe.status}${probe.location ? ` (${probe.location})` : ''}.`,
    probe: buildServiceProbe(
      'http_status',
      'https://www.netflix.com/title/81215567',
      probe.status,
      probe.location,
    ),
  };
}

async function probeTiktok(): Promise<ServiceProbeResult> {
  return probeGenericService({
    serviceName: 'TikTok',
    url: 'https://www.tiktok.com/',
    successDetail: 'HTTP {status} from tiktok.com.',
    blockedDetail: 'TikTok responded with a region restriction page.',
  });
}

async function probeInstagram(): Promise<ServiceProbeResult> {
  return probeGenericService({
    serviceName: 'Instagram',
    url: 'https://www.instagram.com/accounts/login/',
    successDetail: 'HTTP {status} from instagram.com/accounts/login/.',
    blockedDetail: 'Instagram responded with a region restriction page.',
  });
}

async function probeSpotify(): Promise<ServiceProbeResult> {
  return probeGenericService({
    serviceName: 'Spotify',
    url: 'https://open.spotify.com/',
    successDetail: 'HTTP {status} from open.spotify.com.',
    blockedDetail: 'Spotify responded with a region restriction page.',
  });
}

async function probeYoutube(): Promise<ServiceProbeResult> {
  return probeGenericService({
    serviceName: 'YouTube',
    url: 'https://www.youtube.com/',
    successDetail: 'HTTP {status} from youtube.com.',
    blockedDetail: 'YouTube responded with a region restriction page.',
  });
}

async function probeDisneyPlus(): Promise<ServiceProbeResult> {
  return probeGenericService({
    serviceName: 'Disney+',
    url: 'https://www.disneyplus.com/',
    successDetail: 'HTTP {status} from disneyplus.com.',
    blockedDetail: 'Disney+ responded with a region restriction page.',
  });
}

async function probePrimeVideo(): Promise<ServiceProbeResult> {
  return probeGenericService({
    serviceName: 'Prime Video',
    url: 'https://www.primevideo.com/',
    successDetail: 'HTTP {status} from primevideo.com.',
    blockedDetail: 'Prime Video responded with a region restriction page.',
  });
}

async function probeX(): Promise<ServiceProbeResult> {
  return probeGenericService({
    serviceName: 'X',
    url: 'https://x.com/i/flow/login',
    successDetail: 'HTTP {status} from x.com/i/flow/login.',
    blockedDetail: 'X responded with a region restriction page.',
  });
}

function buildSummary(meta: IpApiResponse | null, fraudScore: number | null): string {
  if (!meta) {
    return 'Automated probe completed, but egress IP metadata is unavailable.';
  }

  const location = [meta.countryCode, meta.regionName, meta.city].filter(Boolean).join(' / ');
  const ip = meta.query ? ` · ${meta.query}` : '';
  const fraud = fraudScore === null ? '' : ` · Risk ${fraudScore}`;
  return `${location || 'Unknown region'}${ip}${fraud}`;
}

function buildEgress(meta: IpApiResponse | null): NodeQualityEgressMeta | null {
  if (!meta) return null;
  return {
    ip: meta.query ?? '',
    country: meta.country ?? '',
    countryCode: meta.countryCode ?? '',
    regionName: meta.regionName ?? '',
    city: meta.city ?? '',
    isp: meta.isp ?? '',
    asn: meta.as ?? '',
    proxy: typeof meta.proxy === 'boolean' ? meta.proxy : null,
    hosting: typeof meta.hosting === 'boolean' ? meta.hosting : null,
    mobile: typeof meta.mobile === 'boolean' ? meta.mobile : null,
  };
}

function buildNotes(
  meta: IpApiResponse | null,
  chatgpt: ServiceProbeResult,
  claude: ServiceProbeResult,
  netflix: ServiceProbeResult,
  tiktok: ServiceProbeResult,
  instagram: ServiceProbeResult,
  spotify: ServiceProbeResult,
  youtube: ServiceProbeResult,
  disneyplus: ServiceProbeResult,
  primevideo: ServiceProbeResult,
  x: ServiceProbeResult,
): string {
  const lines = [
    'Automated reachability probe from the server egress.',
    meta
      ? `IP: ${meta.query ?? 'unknown'} | ISP: ${meta.isp ?? 'unknown'} | ASN: ${meta.as ?? 'unknown'}`
      : 'IP metadata: unavailable',
    meta
      ? `Location: ${meta.city ?? 'unknown'}, ${meta.regionName ?? 'unknown'}, ${meta.country ?? 'unknown'}`
      : 'Location: unavailable',
    meta
      ? `Flags: proxy=${meta.proxy ? 'yes' : 'no'}, hosting=${meta.hosting ? 'yes' : 'no'}, mobile=${meta.mobile ? 'yes' : 'no'}`
      : 'Flags: unavailable',
    `Netflix: ${netflix.detail}`,
    `ChatGPT: ${chatgpt.detail}`,
    `Claude: ${claude.detail}`,
    `TikTok: ${tiktok.detail}`,
    `Instagram: ${instagram.detail}`,
    `Spotify: ${spotify.detail}`,
    `YouTube: ${youtube.detail}`,
    `Disney+: ${disneyplus.detail}`,
    `Prime Video: ${primevideo.detail}`,
    `X: ${x.detail}`,
  ];
  return lines.join('\n');
}

export async function probeAndStoreNodeQualityProfile(
  inboundId: number,
): Promise<NodeQualityProfile> {
  const [
    meta,
    chatgpt,
    claude,
    netflix,
    tiktok,
    instagram,
    spotify,
    youtube,
    disneyplus,
    primevideo,
    x,
  ] = await Promise.all([
    fetchIpMeta(),
    probeChatgpt(),
    probeClaude(),
    probeNetflix(),
    probeTiktok(),
    probeInstagram(),
    probeSpotify(),
    probeYoutube(),
    probeDisneyPlus(),
    probePrimeVideo(),
    probeX(),
  ]);

  const fraudScore = estimateFraudScore(meta);
  return saveNodeQualityProfile({
    inboundId,
    summary: buildSummary(meta, fraudScore),
    fraudScore,
    netflixStatus: netflix.status,
    chatgptStatus: chatgpt.status,
    claudeStatus: claude.status,
    tiktokStatus: tiktok.status,
    instagramStatus: instagram.status,
    spotifyStatus: spotify.status,
    youtubeStatus: youtube.status,
    disneyplusStatus: disneyplus.status,
    primevideoStatus: primevideo.status,
    xStatus: x.status,
    notes: buildNotes(
      meta,
      chatgpt,
      claude,
      netflix,
      tiktok,
      instagram,
      spotify,
      youtube,
      disneyplus,
      primevideo,
      x,
    ),
    egress: buildEgress(meta),
    serviceDetails: {
      netflix: netflix.probe,
      chatgpt: chatgpt.probe,
      claude: claude.probe,
      tiktok: tiktok.probe,
      instagram: instagram.probe,
      spotify: spotify.probe,
      youtube: youtube.probe,
      disneyplus: disneyplus.probe,
      primevideo: primevideo.probe,
      x: x.probe,
    },
    updatedAt: Date.now(),
  });
}
