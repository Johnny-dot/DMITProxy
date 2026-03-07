export type UnlockStatus = 'unknown' | 'supported' | 'limited' | 'blocked';
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

export interface NodeQualityProfile {
  inboundId: number;
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
  updatedAt: number | null;
}
