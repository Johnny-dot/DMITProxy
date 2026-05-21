import type { ClientGuideDef, ClientId } from './types';
import { clashVergeGuide } from './clients/clashVerge';
import { flClashGuide } from './clients/flClash';
import { sparkleGuide } from './clients/sparkle';
import { singBoxGuide } from './clients/singBox';

export const CLIENT_GUIDE_REGISTRY: Partial<Record<ClientId, ClientGuideDef>> = {
  clashVerge: clashVergeGuide,
  flClash: flClashGuide,
  sparkle: sparkleGuide,
  singBox: singBoxGuide,
};
