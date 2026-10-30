import { GameMode, TileSpec } from '../models/mahjong.model';

export const SUIT_CHARS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;
export const WIND_CODES = ['we', 'ws', 'ww', 'wn'] as const;
export const WIND_LABELS = ['東', '南', '西', '北'] as const;
export const DRAGON_CODES = ['dr', 'dg', 'dw'] as const;

export const PLAYABLE_CODES: readonly string[] = [
  'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9',
  'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9',
  's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9',
  'we', 'ws', 'ww', 'wn',
  'dr', 'dg', 'dw',
];

export const CODE_INDEX_MAP: ReadonlyMap<string, number> = new Map(
  PLAYABLE_CODES.map((c, i) => [c, i])
);

export const MODE_PLAYABLE_MAP: ReadonlyMap<GameMode, readonly number[]> = new Map<
  GameMode,
  readonly number[]
>([
  ['4p', Array.from({ length: 34 }, (_, i) => i)],
  ['3p', [9, 10, 11, 12, 13, 14, 15, 16, 17, 27, 28, 29, 30, 31, 32, 33]],
]);

export const TILE_SPEC_MAP: ReadonlyMap<string, TileSpec> = (() => {
  const specs = new Map<string, TileSpec>();

  for (let n = 1; n <= 9; n++) {
    const ch = SUIT_CHARS.at(n - 1) ?? '一';
    specs.set(`m${n}`, {
      code: `m${n}`,
      kind: 'suit',
      suit: 'm',
      num: n,
      top: ch,
      bottom: '萬',
      name: `${ch}萬`,
      sort: n,
    });
    specs.set(`p${n}`, {
      code: `p${n}`,
      kind: 'suit',
      suit: 'p',
      num: n,
      top: `${n}`,
      bottom: '筒',
      name: `${ch}筒`,
      sort: 10 + n,
    });
    specs.set(`s${n}`, {
      code: `s${n}`,
      kind: 'suit',
      suit: 's',
      num: n,
      top: `${n}`,
      bottom: '索',
      name: `${ch}索`,
      sort: 20 + n,
    });
  }

  WIND_CODES.forEach((code, idx) => {
    const w = WIND_LABELS.at(idx) ?? '東';
    specs.set(code, {
      code,
      kind: 'honor',
      suit: 'w',
      wind: idx,
      glyph: w,
      name: `${w}風`,
      sort: 31 + idx,
    });
  });

  const dragons: ReadonlyArray<readonly [string, string, string, string]> = [
    ['dr', '中', '紅中', 'red'],
    ['dg', '發', '發財', 'green'],
    ['dw', '白', '白板', 'white'],
  ];
  dragons.forEach(([code, glyph, name, color], idx) => {
    specs.set(code, {
      code,
      kind: 'honor',
      suit: 'd',
      dragon: idx,
      glyph,
      name,
      color,
      sort: 41 + idx,
    });
  });

  specs.set('jk', {
    code: 'jk',
    kind: 'joker',
    glyph: '飛',
    sub: '百搭',
    name: '飛牌',
    sort: 0,
  });

  const seasons = ['春', '夏', '秋', '冬'];
  const flowers = ['梅', '蘭', '菊', '竹'];
  seasons.forEach((g, i) => {
    const code = `b${i + 1}`;
    specs.set(code, {
      code,
      kind: 'bonus',
      bonusGroup: 'season',
      flowerNum: i + 1,
      glyph: g,
      tag: `${i + 1}`,
      name: g,
      sort: 60 + i,
    });
  });
  flowers.forEach((g, i) => {
    const code = `f${i + 1}`;
    specs.set(code, {
      code,
      kind: 'bonus',
      bonusGroup: 'flower',
      flowerNum: i + 1,
      glyph: g,
      tag: `${i + 1}`,
      name: g,
      sort: 65 + i,
    });
  });

  const animals: ReadonlyArray<readonly [string, string, string, string]> = [
    ['an1', '貓', '花貓', '🐱'],
    ['an2', '鼠', '老鼠', '🐭'],
    ['an3', '雞', '公雞', '🐓'],
    ['an4', '蜈', '蜈蚣', '🐛'],
  ];
  animals.forEach(([code, glyph, name, tag], i) => {
    specs.set(code, {
      code,
      kind: 'bonus',
      bonusGroup: 'animal',
      glyph,
      tag,
      name,
      sort: 70 + i,
    });
  });

  const faces: ReadonlyArray<readonly [string, string, string, string]> = [
    ['fc1', '男', '男頭', '紳'],
    ['fc2', '男', '男頭', '紳'],
    ['fc3', '女', '女頭', '淑'],
    ['fc4', '女', '女頭', '淑'],
  ];
  faces.forEach(([code, glyph, name, tag], i) => {
    specs.set(code, {
      code,
      kind: 'bonus',
      bonusGroup: 'face',
      glyph,
      tag,
      name,
      sort: 75 + i,
    });
  });

  return specs;
})();

const FALLBACK_SPEC: TileSpec = {
  code: 'unknown',
  kind: 'honor',
  glyph: '?',
  name: '?',
  sort: 99,
};

export function tileCode(tileOrCode: string): string {
  const idx = tileOrCode.indexOf('_');
  return idx === -1 ? tileOrCode : tileOrCode.slice(0, idx);
}

export function tileSpec(tileOrCode: string): TileSpec {
  return TILE_SPEC_MAP.get(tileCode(tileOrCode)) ?? FALLBACK_SPEC;
}

export function windLabel(windIdx: number): string {
  return WIND_LABELS.at(windIdx) ?? '東';
}

export function playableIndicesForMode(mode: GameMode): readonly number[] {
  return MODE_PLAYABLE_MAP.get(mode) ?? [];
}

export function isBonusTile(tileOrCode: string): boolean {
  return TILE_SPEC_MAP.get(tileCode(tileOrCode))?.kind === 'bonus';
}

export function isJokerTile(tileOrCode: string): boolean {
  return tileCode(tileOrCode) === 'jk';
}

export function isTerminalOrHonorIndex(idx: number): boolean {
  if (idx >= 27) return true;
  const num = (idx % 9) + 1;
  return num === 1 || num === 9;
}

export function isTerminalIndex(idx: number): boolean {
  if (idx >= 27) return false;
  const num = (idx % 9) + 1;
  return num === 1 || num === 9;
}

export function sortHandIds(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => {
    const sa = tileSpec(a).sort;
    const sb = tileSpec(b).sort;
    return sa !== sb ? sa - sb : a.localeCompare(b);
  });
}

function cryptoRandom(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf.at(0) ?? 0) / 4294967296;
  }
  return Math.random();
}

export function createDeck(mode: GameMode = '4p', rng: () => number = Math.random): string[] {
  const rand = rng === Math.random ? cryptoRandom : rng;
  const tiles: string[] = [];

  if (mode === '4p') {
    for (const code of PLAYABLE_CODES) {
      for (let copy = 0; copy < 4; copy++) tiles.push(`${code}_${copy}`);
    }
    for (let i = 1; i <= 4; i++) {
      tiles.push(`b${i}_0`, `f${i}_0`);
    }
  } else {
    for (const idx of playableIndicesForMode('3p')) {
      const code = PLAYABLE_CODES.at(idx);
      if (code) {
        for (let copy = 0; copy < 4; copy++) tiles.push(`${code}_${copy}`);
      }
    }
    for (let i = 1; i <= 4; i++) {
      tiles.push(`b${i}_0`, `f${i}_0`, `an${i}_0`, `fc${i}_0`);
    }
    for (let copy = 0; copy < 4; copy++) tiles.push(`jk_${copy}`);
  }

  for (let pass = 0; pass < 3; pass++) {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      if (i === j) continue;
      const vi = tiles.at(i);
      const vj = tiles.at(j);
      if (vi !== undefined && vj !== undefined) {
        tiles.splice(i, 1, vj);
        tiles.splice(j, 1, vi);
      }
    }
  }

  const diceSum =
    (Math.floor(rand() * 6) + 1) +
    (Math.floor(rand() * 6) + 1) +
    (Math.floor(rand() * 6) + 1);
  const cutOffset = (diceSum * 2) % tiles.length;
  if (cutOffset > 0) {
    return [...tiles.slice(cutOffset), ...tiles.slice(0, cutOffset)];
  }
  return tiles;
}
