import { AvalonLoyalty, AvalonRole, AvalonRoleConfig } from '../models/avalon.model';

export interface PlayerRatio {
  readonly good: number;
  readonly evil: number;
}

export const PLAYER_COUNT_RATIOS: ReadonlyMap<number, PlayerRatio> = new Map<number, PlayerRatio>([
  [5, { good: 3, evil: 2 }],
  [6, { good: 4, evil: 2 }],
  [7, { good: 4, evil: 3 }],
  [8, { good: 5, evil: 3 }],
  [9, { good: 6, evil: 3 }],
  [10, { good: 6, evil: 4 }],
]);

export const QUEST_TEAM_SIZES: ReadonlyMap<
  number,
  readonly [number, number, number, number, number]
> = new Map<number, readonly [number, number, number, number, number]>([
  [5, [2, 3, 2, 3, 3]],
  [6, [2, 3, 4, 3, 4]],
  [7, [2, 3, 3, 4, 4]],
  [8, [3, 4, 4, 5, 5]],
  [9, [3, 4, 4, 5, 5]],
  [10, [3, 4, 4, 5, 5]],
]);

export function getRequiredFails(numPlayers: number, questNumber: number): number {
  if (questNumber === 4 && numPlayers >= 7) {
    return 2;
  }
  return 1;
}

export function getQuestTeamSize(numPlayers: number, questNumber: number): number {
  const sizes = QUEST_TEAM_SIZES.get(numPlayers);
  if (!sizes) {
    throw new Error(`Unsupported player count: ${numPlayers}`);
  }
  const size = sizes.at(questNumber - 1);
  if (size === undefined) {
    throw new Error(`Invalid quest number: ${questNumber}`);
  }
  return size;
}

export interface RoleMetadata {
  readonly loyalty: AvalonLoyalty;
  readonly nameKey: string;
  readonly descKey: string;
  readonly badgeClass: string;
}

export const ROLE_METADATA: ReadonlyMap<AvalonRole, RoleMetadata> = new Map<
  AvalonRole,
  RoleMetadata
>([
  [
    'merlin',
    {
      loyalty: 'good',
      nameKey: 'AVALON.ROLES.MERLIN',
      descKey: 'AVALON.ROLES.MERLIN_DESC',
      badgeClass: 'role-merlin',
    },
  ],
  [
    'percival',
    {
      loyalty: 'good',
      nameKey: 'AVALON.ROLES.PERCIVAL',
      descKey: 'AVALON.ROLES.PERCIVAL_DESC',
      badgeClass: 'role-percival',
    },
  ],
  [
    'loyal_servant',
    {
      loyalty: 'good',
      nameKey: 'AVALON.ROLES.LOYAL_SERVANT',
      descKey: 'AVALON.ROLES.LOYAL_SERVANT_DESC',
      badgeClass: 'role-loyal',
    },
  ],
  [
    'assassin',
    {
      loyalty: 'evil',
      nameKey: 'AVALON.ROLES.ASSASSIN',
      descKey: 'AVALON.ROLES.ASSASSIN_DESC',
      badgeClass: 'role-assassin',
    },
  ],
  [
    'morgana',
    {
      loyalty: 'evil',
      nameKey: 'AVALON.ROLES.MORGANA',
      descKey: 'AVALON.ROLES.MORGANA_DESC',
      badgeClass: 'role-morgana',
    },
  ],
  [
    'mordred',
    {
      loyalty: 'evil',
      nameKey: 'AVALON.ROLES.MORDRED',
      descKey: 'AVALON.ROLES.MORDRED_DESC',
      badgeClass: 'role-mordred',
    },
  ],
  [
    'oberon',
    {
      loyalty: 'evil',
      nameKey: 'AVALON.ROLES.OBERON',
      descKey: 'AVALON.ROLES.OBERON_DESC',
      badgeClass: 'role-oberon',
    },
  ],
  [
    'minion',
    {
      loyalty: 'evil',
      nameKey: 'AVALON.ROLES.MINION',
      descKey: 'AVALON.ROLES.MINION_DESC',
      badgeClass: 'role-minion',
    },
  ],
]);

export const DEFAULT_AVALON_BOT_NAMES: readonly string[] = [
  '亚瑟王 (Bot)',
  '兰斯洛特 (Bot)',
  '高文卿 (Bot)',
  '崔斯坦 (Bot)',
  '加拉哈德 (Bot)',
  '鲍斯骑士 (Bot)',
  '凯爵士 (Bot)',
  '贝狄威尔 (Bot)',
  '格温娜维尔 (Bot)',
  '莫德雷德 (Bot)',
];

export function buildRoleDeck(numPlayers: number, config: AvalonRoleConfig): AvalonRole[] {
  const ratio = PLAYER_COUNT_RATIOS.get(numPlayers);
  if (!ratio) {
    throw new Error(`Unsupported player count: ${numPlayers}`);
  }

  // Good role assembly
  const goodDeck: AvalonRole[] = ['merlin'];
  if (config.percival && goodDeck.length < ratio.good) {
    goodDeck.push('percival');
  }
  while (goodDeck.length < ratio.good) {
    goodDeck.push('loyal_servant');
  }

  // Evil role assembly
  const evilDeck: AvalonRole[] = ['assassin'];
  if (config.morgana && evilDeck.length < ratio.evil) {
    evilDeck.push('morgana');
  }
  if (config.mordred && evilDeck.length < ratio.evil) {
    evilDeck.push('mordred');
  }
  if (config.oberon && evilDeck.length < ratio.evil) {
    evilDeck.push('oberon');
  }
  while (evilDeck.length < ratio.evil) {
    evilDeck.push('minion');
  }

  return [...goodDeck, ...evilDeck];
}
