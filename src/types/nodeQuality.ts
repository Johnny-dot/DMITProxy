export type UnlockStatus = 'unknown' | 'supported' | 'limited' | 'blocked';

export interface NodeQualityProfile {
  inboundId: number;
  summary: string;
  fraudScore: number | null;
  netflixStatus: UnlockStatus;
  chatgptStatus: UnlockStatus;
  claudeStatus: UnlockStatus;
  notes: string;
  updatedAt: number | null;
}
