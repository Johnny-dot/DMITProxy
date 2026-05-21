import type { ClientGuideDef, ClientId } from './types';
import { clashVergeGuide } from './clients/clashVerge';
import { flClashGuide } from './clients/flClash';
import { sparkleGuide } from './clients/sparkle';
import { singBoxGuide } from './clients/singBox';
import { v2rayNGuide } from './clients/v2rayN';
import { shadowrocketGuide } from './clients/shadowrocket';
import { exclaveGuide } from './clients/exclave';
import { surgeGuide } from './clients/surge';

export const CLIENT_GUIDE_REGISTRY: Partial<Record<ClientId, ClientGuideDef>> = {
  clashVerge: clashVergeGuide,
  flClash: flClashGuide,
  sparkle: sparkleGuide,
  singBox: singBoxGuide,
  v2rayN: v2rayNGuide,
  shadowrocket: shadowrocketGuide,
  exclave: exclaveGuide,
  surge: surgeGuide,
};
