import type { ConvertCategory } from './types';
import { GenerateError } from './types';

interface ConvertUnit {
  unit: string;
  toBase: number;
}

const CATEGORIES: Record<ConvertCategory, { base: string; units: ConvertUnit[] }> = {
  time: { base: '秒', units: [{ unit: '小时', toBase: 3600 }, { unit: '分', toBase: 60 }, { unit: '秒', toBase: 1 }] },
  length: {
    base: '毫米',
    units: [
      { unit: '千米', toBase: 1_000_000 },
      { unit: '米', toBase: 1000 },
      { unit: '分米', toBase: 100 },
      { unit: '厘米', toBase: 10 },
      { unit: '毫米', toBase: 1 },
    ],
  },
  weight: {
    base: '克',
    units: [
      { unit: '千克', toBase: 1000 },
      { unit: '克', toBase: 1 },
      { unit: '毫克', toBase: 0.001 },
      { unit: '微克', toBase: 0.000001 },
    ],
  },
  volume: {
    base: '毫升',
    units: [
      { unit: '升', toBase: 1000 },
      { unit: '毫升', toBase: 1 },
      { unit: '立方厘米', toBase: 1 },
    ],
  },
  temperature: { base: '摄氏度', units: [{ unit: '℃', toBase: 1 }] },
};

export interface ConvertQuestionData {
  display: string;
  answer: number;
  answerText: string;
  hint: string;
}

const INT_SCALE = 1_000_000;
const MAX_VALUE = 9999;
const MAX_RESULT = 1_000_000_000;
const NICE_RESULT = 99_999;

function shuffledPairs(units: ConvertUnit[], rng: () => number): [ConvertUnit, ConvertUnit][] {
  const pairs: [ConvertUnit, ConvertUnit][] = [];
  for (const a of units) {
    for (const b of units) {
      if (a !== b && a.toBase > 0 && b.toBase > 0) pairs.push([a, b]);
    }
  }
  for (let i = pairs.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j]!, pairs[i]!];
  }
  return pairs;
}

function buildPair(from: ConvertUnit, to: ConvertUnit, rng: () => number): ConvertQuestionData | null {
  const fromInt = Math.round(from.toBase * INT_SCALE);
  const toInt = Math.round(to.toBase * INT_SCALE);

  const nice: number[] = [];
  const any: number[] = [];
  for (let v = 1; v <= MAX_VALUE; v += 1) {
    const scaled = v * fromInt;
    if (scaled % toInt !== 0) continue;
    const result = scaled / toInt;
    if (result < 1 || result > MAX_RESULT) continue;
    (result <= NICE_RESULT ? nice : any).push(v);
    if (nice.length >= 200) break;
  }
  const pool = nice.length > 0 ? nice : any;
  if (pool.length === 0) return null;

  const value = pool[Math.floor(rng() * pool.length)]!;
  const result = (value * fromInt) / toInt;

  const rateNum = fromInt;
  const rateDen = toInt;
  const rateText =
    rateNum % rateDen === 0
      ? `1${from.unit} = ${rateNum / rateDen}${to.unit}`
      : rateDen % rateNum === 0
        ? `1${to.unit} = ${rateDen / rateNum}${from.unit}`
        : null;

  return {
    display: `${value}${from.unit} = ? ${to.unit}`,
    answer: result,
    answerText: `${result}${to.unit}`,
    hint: rateText
      ? `进率换算：${rateText}，所以 ${value}${from.unit} = ${result}${to.unit}。`
      : `${value}${from.unit} 换算为 ${to.unit} 是 ${result}${to.unit}。`,
  };
}

/**
 * 生成一道单位换算题 (FR-MATH-05)。
 * 全程整数运算保证整除；方向随机 (Q-03)，该方向无合法值时回退反方向。
 * 温度类别以升/降温情境出 ℃ 数值题（1-2 年级不学负数）。
 */
export function buildConvertQuestion(category: ConvertCategory, rng: () => number): ConvertQuestionData {
  const cat = CATEGORIES[category];

  if (category === 'temperature') {
    const start = 1 + Math.floor(rng() * 20);
    const change = 1 + Math.floor(rng() * 9);
    const up = rng() < 0.5;
    const answer = up ? start + change : start - change;
    const verb = up ? '升高' : '降低';
    return {
      display: `气温 ${start}℃，${verb} ${change}℃，现在是几摄氏度？`,
      answer,
      answerText: `${answer}℃`,
      hint: up
        ? `升高用加法：${start} + ${change} = ${answer}，所以现在是 ${answer}℃。`
        : `降低用减法：${start} - ${change} = ${answer}，所以现在是 ${answer}℃。`,
    };
  }

  for (const [from, to] of shuffledPairs(cat.units, rng)) {
    const built = buildPair(from, to, rng);
    if (built) return built;
  }
  throw new GenerateError(`换算生成失败：类别 ${category} 无合法单位对`);
}
export const CONVERT_CATEGORIES: ConvertCategory[] = ['time', 'length', 'weight', 'volume', 'temperature'];
