import {
  saveNodeQualityProfile,
  type NodeQualityProfile,
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
    text.includes('service is not available in your region')
  );
}

async function probeChatgpt(): Promise<ServiceProbeResult> {
  const trace = await fetchTextProbe('https://chat.openai.com/cdn-cgi/trace', {
    'user-agent': BROWSER_LIKE_HEADERS['user-agent'],
    accept: 'text/plain,*/*',
  });
  if (!trace.ok || trace.status < 200 || trace.status >= 400) {
    return { status: 'unknown', detail: 'OpenAI edge trace is unreachable.' };
  }

  const home = await fetchTextProbe('https://chatgpt.com/', BROWSER_LIKE_HEADERS);
  if (!home.ok) {
    return { status: 'unknown', detail: 'ChatGPT homepage probe failed.' };
  }
  if (home.status >= 200 && home.status < 400) {
    return { status: 'supported', detail: `HTTP ${home.status} from chatgpt.com.` };
  }
  if (isRegionBlocked(home.body)) {
    return { status: 'blocked', detail: 'ChatGPT responded with a region restriction page.' };
  }
  if (home.status === 403 || home.status === 429 || isChallengePage(home.body)) {
    return {
      status: 'limited',
      detail: 'ChatGPT is reachable, but anti-bot or challenge checks are present.',
    };
  }
  return { status: 'limited', detail: `ChatGPT returned HTTP ${home.status}.` };
}

async function probeClaude(): Promise<ServiceProbeResult> {
  const favicon = await fetchTextProbe('https://claude.ai/favicon.ico', {
    'user-agent': BROWSER_LIKE_HEADERS['user-agent'],
    accept: 'image/*,*/*',
  });
  if (!favicon.ok || favicon.status < 200 || favicon.status >= 400) {
    return { status: 'unknown', detail: 'Claude static assets are unreachable.' };
  }

  const login = await fetchTextProbe('https://claude.ai/login', BROWSER_LIKE_HEADERS);
  if (!login.ok) {
    return { status: 'unknown', detail: 'Claude login probe failed.' };
  }
  if (login.status >= 200 && login.status < 400) {
    return { status: 'supported', detail: `HTTP ${login.status} from claude.ai/login.` };
  }
  if (isRegionBlocked(login.body)) {
    return { status: 'blocked', detail: 'Claude responded with a region restriction page.' };
  }
  if (login.status === 403 || login.status === 429 || isChallengePage(login.body)) {
    return {
      status: 'limited',
      detail: 'Claude is reachable, but anti-bot or verification checks are present.',
    };
  }
  return { status: 'limited', detail: `Claude returned HTTP ${login.status}.` };
}

async function probeNetflix(): Promise<ServiceProbeResult> {
  const probe = await fetchTextProbe(
    'https://www.netflix.com/title/81215567',
    BROWSER_LIKE_HEADERS,
  );
  if (!probe.ok) {
    return { status: 'unknown', detail: 'Netflix title probe failed.' };
  }

  const location = probe.location.toLowerCase();
  if (probe.status >= 200 && probe.status < 300) {
    return { status: 'supported', detail: `HTTP ${probe.status} from the Netflix title page.` };
  }
  if (location.includes('/unsupportedbrowser')) {
    return {
      status: 'limited',
      detail:
        'Netflix is reachable, but the probe hit an unsupported-browser fallback instead of a normal title response.',
    };
  }
  if (isRegionBlocked(probe.body)) {
    return { status: 'blocked', detail: 'Netflix responded with a regional restriction page.' };
  }
  return {
    status: 'limited',
    detail: `Netflix returned HTTP ${probe.status}${probe.location ? ` (${probe.location})` : ''}.`,
  };
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

function buildNotes(
  meta: IpApiResponse | null,
  chatgpt: ServiceProbeResult,
  claude: ServiceProbeResult,
  netflix: ServiceProbeResult,
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
  ];
  return lines.join('\n');
}

export async function probeAndStoreNodeQualityProfile(
  inboundId: number,
): Promise<NodeQualityProfile> {
  const [meta, chatgpt, claude, netflix] = await Promise.all([
    fetchIpMeta(),
    probeChatgpt(),
    probeClaude(),
    probeNetflix(),
  ]);

  const fraudScore = estimateFraudScore(meta);
  return saveNodeQualityProfile({
    inboundId,
    summary: buildSummary(meta, fraudScore),
    fraudScore,
    netflixStatus: netflix.status,
    chatgptStatus: chatgpt.status,
    claudeStatus: claude.status,
    notes: buildNotes(meta, chatgpt, claude, netflix),
    updatedAt: Date.now(),
  });
}
