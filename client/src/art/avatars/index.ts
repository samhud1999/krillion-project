import type { ComponentType } from 'react';
import type { AvatarId } from '@shared/types';
import type { AnimalProps } from './shared';
import { Koala } from './koala';
import { Kookaburra } from './kookaburra';
import { Echidna } from './echidna';
import { Wombat } from './wombat';
import { Platypus } from './platypus';
import { Wallaby } from './wallaby';
import { KingParrot } from './kingparrot';
import { Cockatoo } from './cockatoo';
import { Rosella } from './rosella';
import { Magpie } from './magpie';
import { Possum } from './possum';
import { BlueTongue } from './bluetongue';
import { Crab } from './crab';
import { Starfish } from './starfish';
import { Octopus } from './octopus';
import { Seal } from './seal';
import { Penguin } from './penguin';
import { Pelican } from './pelican';
import { HoodedPlover } from './hoodedplover';
import { Bluebottle } from './bluebottle';

export const ANIMALS: Record<AvatarId, ComponentType<AnimalProps>> = {
  koala: Koala,
  kookaburra: Kookaburra,
  echidna: Echidna,
  wombat: Wombat,
  platypus: Platypus,
  wallaby: Wallaby,
  kingparrot: KingParrot,
  cockatoo: Cockatoo,
  rosella: Rosella,
  magpie: Magpie,
  possum: Possum,
  bluetongue: BlueTongue,
  crab: Crab,
  starfish: Starfish,
  octopus: Octopus,
  seal: Seal,
  penguin: Penguin,
  pelican: Pelican,
  hoodedplover: HoodedPlover,
  bluebottle: Bluebottle,
};

export type { AnimalProps } from './shared';
