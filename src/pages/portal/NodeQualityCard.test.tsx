import { describe, expect, it } from 'vitest';
import type { NodeQualityProfile } from '@/src/types/nodeQuality';
import { getNodeQualityCardNotes } from './NodeQualityCard';

function createProfile(overrides: Partial<NodeQualityProfile> = {}): NodeQualityProfile {
  return {
    inboundId: 11,
    probeMode: 'server-egress',
    probeTarget: '',
    summary: '',
    fraudScore: null,
    netflixStatus: 'unknown',
    chatgptStatus: 'unknown',
    claudeStatus: 'unknown',
    tiktokStatus: 'unknown',
    instagramStatus: 'unknown',
    spotifyStatus: 'unknown',
    youtubeStatus: 'unknown',
    disneyplusStatus: 'unknown',
    primevideoStatus: 'unknown',
    xStatus: 'unknown',
    notes: '',
    egress: null,
    serviceDetails: {},
    updatedAt: null,
    ...overrides,
  };
}

describe('NodeQualityCard notes', () => {
  it('keeps legacy status-only free-form notes visible without duplicating service tooltip copy', () => {
    const notes = getNodeQualityCardNotes(
      createProfile({
        claudeStatus: 'limited',
        notes: 'Claude may ask for extra verification on first login.',
      }),
      false,
    );

    expect(notes.serviceNoteLines).toEqual([]);
    expect(notes.shouldRenderLegacyNotes).toBe(true);
    expect(notes.legacyNotesText).toBe('Claude may ask for extra verification on first login.');
  });

  it('does not repeat service detail notes or generated raw notes when tooltips already carry them', () => {
    const notes = getNodeQualityCardNotes(
      createProfile({
        egress: {
          ip: '64.186.227.197',
          country: 'United States',
          countryCode: 'US',
          regionName: 'California',
          city: 'Los Angeles',
          isp: 'DMIT Cloud Services',
          asn: 'AS906',
          proxy: false,
          hosting: true,
          mobile: false,
        },
        netflixStatus: 'supported',
        notes: 'Netflix: Raw generated duplicate notes from the probe.',
        serviceDetails: {
          netflix: {
            code: 'http_ok',
            httpStatus: 200,
            location: '',
            target: 'https://www.netflix.com/',
          },
        },
      }),
      false,
    );

    expect(notes.serviceNoteLines).toEqual([]);
    expect(notes.shouldRenderLegacyNotes).toBe(false);
    expect(notes.legacyNotesText).toBe('Netflix: Raw generated duplicate notes from the probe.');
  });
});
