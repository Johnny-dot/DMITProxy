import type { ClientGuideDef, ClientId } from './types';
import { clashVergeGuide } from './clients/clashVerge';
import { flClashGuide } from './clients/flClash';

export const CLIENT_GUIDE_REGISTRY: Partial<Record<ClientId, ClientGuideDef>> = {
  clashVerge: clashVergeGuide,
  flClash: flClashGuide,
};
