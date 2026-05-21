import type { ClientGuideDef, ClientId } from './types';
import { clashVergeGuide } from './clients/clashVerge';

export const CLIENT_GUIDE_REGISTRY: Partial<Record<ClientId, ClientGuideDef>> = {
  clashVerge: clashVergeGuide,
};
