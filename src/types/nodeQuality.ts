export type UnlockStatus = 'unknown' | 'supported' | 'limited' | 'blocked';
export type NodeQualityProbeMode = 'server-egress' | 'proxy-outbound';
export type UnlockServiceId =
  | 'netflix'
  | 'chatgpt'
  | 'claude'
  | 'tiktok'
  | 'instagram'
  | 'spotify'
  | 'youtube'
  | 'disneyplus'
  | 'primevideo'
  | 'x';

export type NodeQualityProbeCode =
  | 'http_ok'
  | 'challenge'
  | 'region_block'
  | 'unsupported_browser'
  | 'probe_failed'
  | 'trace_unreachable'
  | 'static_unreachable'
  | 'http_status'
  | 'unknown';

export interface NodeQualityServiceDetail {
  code: NodeQualityProbeCode;
  httpStatus: number | null;
  location: string;
  target: string;
}

export interface NodeQualityEgressMeta {
  ip: string;
  country: string;
  countryCode: string;
  regionName: string;
  city: string;
  isp: string;
  asn: string;
  proxy: boolean | null;
  hosting: boolean | null;
  mobile: boolean | null;
}

export type NodeQualityServiceDetails = Partial<Record<UnlockServiceId, NodeQualityServiceDetail>>;

export interface NodeQualityProfile {
  inboundId: number;
  probeMode: NodeQualityProbeMode;
  probeTarget: string;
  summary: string;
  fraudScore: number | null;
  netflixStatus: UnlockStatus;
  chatgptStatus: UnlockStatus;
  claudeStatus: UnlockStatus;
  tiktokStatus: UnlockStatus;
  instagramStatus: UnlockStatus;
  spotifyStatus: UnlockStatus;
  youtubeStatus: UnlockStatus;
  disneyplusStatus: UnlockStatus;
  primevideoStatus: UnlockStatus;
  xStatus: UnlockStatus;
  notes: string;
  egress: NodeQualityEgressMeta | null;
  serviceDetails: NodeQualityServiceDetails;
  updatedAt: number | null;
}
