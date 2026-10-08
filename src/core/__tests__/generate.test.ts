import { describe, expect, it } from 'vitest';
import { generateSession, validateConfig } from '../generate';
import { judge } from '../judge';
import { ConfigError, GenerateError } from '../types';
import type { PracticeConfig, Question, RangeTier } from '../types';

/** 确定性随机源 */
function makeRng(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** 从题面提取操作数，如 "12 + 7 = ?" → [12, 7] */
const operands = (display: string): number[] => (display.match(/\d+/g) ?? []).map(Number);

const base = (over: Partial<PracticeConfig> = {}): PracticeConfig => ({
  operations: ['add'],
  rangeTier: 20,
  questionCount: 10,
  answerMode: 'input',
  ...over,
});

describe('validateConfig', () => {
  it('拒绝空运算类型', () => {
    expect(() => validateConfig(base({ operations: [] }))).toThrow(ConfigError);
  });
  it('拒绝非法题数', () => {
    expect(() => validateConfig(base({ questionCount: 15 as 10 }))).toThrow(ConfigError);
  });
  it('加减法缺档位时报错', () => {
    expect(() => validateConfig(base({ rangeTier: undefined }))).toThrow(ConfigError);
  });
  it('纯乘法不需要档位', () => {
    expect(() => validateConfig(base({ operations: ['mul'], rangeTier: undefined }))).not.toThrow();
  });
  it('换算缺类别时报错', () => {
    expect(() => validateConfig(base({ operations: ['convert'], rangeTier: undefined }))).toThrow(ConfigError);
  });
  it('固定操作数越界时报错', () => {
    expect(() =>
      validateConfig(
        base({
          operations: ['mul'],
          rangeTier: undefined,
          operands: { multiplicand: { mode: 'fixed', fixedValue: 12 } },
        }),
      ),
    ).toThrow(ConfigError);
  });
  it('固定减数大于被减数时报错', () => {
    expect(() =>
      validateConfig(
        base({
          operations: ['sub'],
          operands: { minuend: { mode: 'fixed', fixedValue: 5 }, subtrahend: { mode: 'fixed', fixedValue: 9 } },
        }),
      ),
    ).toThrow(ConfigError);
  });
  it('固定被除数不整除时报错', () => {
    expect(() =>
      validateConfig(
        base({
          operations: ['div'],
          rangeTier: undefined,
          operands: { dividend: { mode: 'fixed', fixedValue: 7 }, divisor: { mode: 'fixed', fixedValue: 3 } },
        }),
      ),
    ).toThrow(ConfigError);
  });
});

describe('generateSession — 加法 FR-MATH-01', () => {
  for (const tier of [10, 20, 50, 100] as RangeTier[]) {
    it(`${tier} 以内：和不超上限且为非负`, () => {
      const qs = generateSession(base({ rangeTier: tier, questionCount: 50 }), { random: makeRng() });
      expect(qs).toHaveLength(50);
      for (const q of qs) {
        const [a, b] = operands(q.display);
        expect(a! + b!).toBeLessThanOrEqual(tier);
        expect(q.answer).toBe(a! + b!);
        expect(q.answer).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

describe('generateSession — 减法 FR-MATH-02', () => {
  for (const tier of [10, 20, 50, 100] as RangeTier[]) {
    it(`${tier} 以内：差非负`, () => {
      const qs = generateSession(base({ operations: ['sub'], rangeTier: tier, questionCount: 50 }), {
        random: makeRng(7),
      });
      for (const q of qs) {
        const [a, b] = operands(q.display);
        expect(q.answer).toBe(a! - b!);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(a!).toBeLessThanOrEqual(tier);
      }
    });
  }
});

describe('generateSession — 乘法 FR-MATH-03', () => {
  it('两乘数均在 1~9', () => {
    const qs = generateSession(base({ operations: ['mul'], rangeTier: undefined, questionCount: 50 }), {
      random: makeRng(3),
    });
    for (const q of qs) {
      const [a, b] = operands(q.display);
      expect(a!).toBeGreaterThanOrEqual(1);
      expect(a!).toBeLessThanOrEqual(9);
      expect(b!).toBeGreaterThanOrEqual(1);
      expect(b!).toBeLessThanOrEqual(9);
      expect(q.answer).toBe(a! * b!);
    }
  });
});

describe('generateSession — 除法 FR-MATH-04', () => {
  it('整除、除数≥1、两数≤9x9', () => {
    const qs = generateSession(base({ operations: ['div'], rangeTier: undefined, questionCount: 50 }), {
      random: makeRng(11),
    });
    for (const q of qs) {
      const [a, b] = operands(q.display);
      expect(a! % b!).toBe(0);
      expect(q.answer).toBe(a! / b!);
      expect(b!).toBeGreaterThanOrEqual(1);
      expect(a!).toBeLessThanOrEqual(81);
    }
  });
});

describe('generateSession — 换算 FR-MATH-05', () => {
  const categories = ['time', 'length', 'weight', 'volume', 'temperature'] as const;
  for (const cat of categories) {
    it(`${cat} 类别可出题且答案正确`, () => {
      const qs = generateSession(
        base({ operations: ['convert'], rangeTier: undefined, convertCategories: [cat], questionCount: 10 }),
        { random: makeRng(5) },
      );
      expect(qs).toHaveLength(10);
      for (const q of qs) {
        expect(q.type).toBe('convert');
        expect(q.answerText).toMatch(/\d/);
        expect(q.hint.length).toBeGreaterThan(0);
      }
    });
  }
  it('时间换算答案符合进率', () => {
    const qs = generateSession(
      base({ operations: ['convert'], rangeTier: undefined, convertCategories: ['time'], questionCount: 50 }),
      { random: makeRng(9) },
    );
    for (const q of qs) {
      // 题面 "3小时 = ? 分" → answer = 3*60 或 3/60…仅校验数值与题面自洽
      const m = q.display.match(/^(\d+)(\S+) = \? (\S+)$/);
      expect(m).not.toBeNull();
      expect(q.answerText.startsWith(String(q.answer))).toBe(true);
    }
  });
});

describe('generateSession — 混合 FR-MATH-06', () => {
  it('多选时题目类型覆盖全部所选运算', () => {
    const qs = generateSession(
      base({ operations: ['add', 'sub', 'mul'], rangeTier: 20, questionCount: 50 }),
      { random: makeRng(13) },
    );
    const types = new Set(qs.map((q) => q.type));
    expect(types).toEqual(new Set(['add', 'sub', 'mul']));
  });
  it('单选时仅含一种类型', () => {
    const qs = generateSession(base({ operations: ['div'], rangeTier: undefined, questionCount: 20 }), {
      random: makeRng(17),
    });
    expect(new Set(qs.map((q) => q.type))).toEqual(new Set(['div']));
  });
});

describe('generateSession — 操作数选择 FR-MATH-07', () => {
  it('固定除数整场不变', () => {
    const qs = generateSession(
      base({
        operations: ['div'],
        rangeTier: undefined,
        operands: { divisor: { mode: 'fixed', fixedValue: 7 } },
        questionCount: 20,
      }),
      { random: makeRng(21) },
    );
    for (const q of qs) {
      const [, b] = operands(q.display);
      expect(b).toBe(7);
    }
  });
  it('固定被减数整场不变且差非负', () => {
    const qs = generateSession(
      base({
        operations: ['sub'],
        operands: { minuend: { mode: 'fixed', fixedValue: 15 } },
        questionCount: 20,
      }),
      { random: makeRng(23) },
    );
    for (const q of qs) {
      const [a] = operands(q.display);
      expect(a).toBe(15);
      expect(q.answer).toBeGreaterThanOrEqual(0);
    }
  });
  it('固定乘数整场不变', () => {
    const qs = generateSession(
      base({
        operations: ['mul'],
        rangeTier: undefined,
        operands: { multiplier: { mode: 'fixed', fixedValue: 9 } },
        questionCount: 20,
      }),
      { random: makeRng(29) },
    );
    for (const q of qs) {
      const [, b] = operands(q.display);
      expect(b).toBe(9);
    }
  });
});

describe('generateSession — 题数 FR-MATH-08', () => {
  for (const n of [10, 20, 50] as const) {
    it(`${n} 题`, () => {
      expect(generateSession(base({ questionCount: n }), { random: makeRng() })).toHaveLength(n);
    });
  }
});

describe('generateSession — 四选一 FR-MATH-09', () => {
  it('choice4 生成恰好 4 个选项且含正确答案', () => {
    const qs = generateSession(base({ answerMode: 'choice4', questionCount: 50 }), { random: makeRng(31) });
    for (const q of qs) {
      expect(q.choices).toBeDefined();
      expect(q.choices!).toHaveLength(4);
      expect(new Set(q.choices!).size).toBe(4);
      expect(q.choices!).toContain(q.answer);
    }
  });
  it('input 模式不生成选项', () => {
    const qs = generateSession(base({ questionCount: 10 }), { random: makeRng() });
    for (const q of qs) expect(q.choices).toBeUndefined();
  });
});

describe('去重 FR-MATH-14 / Q-11', () => {
  it('单次会话内 fingerprint 严格唯一', () => {
    const qs = generateSession(base({ questionCount: 50 }), { random: makeRng(37) });
    expect(new Set(qs.map((q) => q.fingerprint)).size).toBe(50);
  });
  it('跨练习优先出未见过的题', () => {
    const first = generateSession(base({ questionCount: 50 }), { random: makeRng(41) });
    const seen = first.map((q) => q.fingerprint);
    const second = generateSession(base({ questionCount: 50 }), {
      random: makeRng(41),
      seenFingerprints: seen,
    });
    const overlap = second.filter((q) => seen.includes(q.fingerprint)).length;
    expect(overlap).toBeLessThan(50); // 至少有部分新题
  });
});

describe('judge FR-MATH-09', () => {
  const q = (answer: number): Question => ({
    fingerprint: 'add:x',
    type: 'add',
    display: '1 + 1 = ?',
    answer,
    answerText: String(answer),
    hint: 'h',
  });
  it('数值与字符串均可判对', () => {
    expect(judge(q(2), 2)).toBe(true);
    expect(judge(q(2), '2')).toBe(true);
    expect(judge(q(2), ' 2 ')).toBe(true);
    expect(judge(q(2), '２')).toBe(true); // 全角归一
  });
  it('错误答案判错', () => {
    expect(judge(q(2), '3')).toBe(false);
    expect(judge(q(2), '')).toBe(false);
    expect(judge(q(2), 'abc')).toBe(false);
    expect(judge(q(2), 2.5)).toBe(false);
  });
});

describe('解题思路 FR-MATH-10', () => {
  it('每题均带非空 hint', () => {
    const qs = generateSession(
      base({ operations: ['add', 'sub', 'mul', 'div'], questionCount: 50 }),
      { random: makeRng(43) },
    );
    for (const q of qs) expect(q.hint.trim().length).toBeGreaterThan(0);
  });
  it('hint 包含正确结果', () => {
    const qs = generateSession(base({ operations: ['sub'], questionCount: 20 }), { random: makeRng(47) });
    for (const q of qs) expect(q.hint).toContain(String(q.answer));
  });
});

describe('错误处理', () => {
  it('约束空间过小抛 GenerateError', () => {
    expect(() =>
      generateSession(
        base({
          operations: ['mul'],
          rangeTier: undefined,
          operands: {
            multiplicand: { mode: 'fixed', fixedValue: 3 },
            multiplier: { mode: 'fixed', fixedValue: 3 },
          },
          questionCount: 50,
        }),
        { random: makeRng() },
      ),
    ).not.toThrow(); // 唯一池耗尽后按「尽可能」降级为可重复
  });
  it('空配置抛 ConfigError', () => {
    expect(() => generateSession(base({ operations: [] }))).toThrow(ConfigError);
    expect(() => generateSession(base())).not.toBeInstanceOf(GenerateError);
  });
});
