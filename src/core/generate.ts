import type {
  AnswerMode,
  GenerateOptions,
  OperationType,
  OperandRole,
  PracticeConfig,
  Question,
  RangeTier,
} from './types';
import { ConfigError, GenerateError } from './types';
import { fingerprint } from './fingerprint';
import { arithmeticHint } from './hint';
import { buildConvertQuestion } from './convert';

/** 注入随机源便于测试；返回 [0,1) */
type Rng = () => number;

const randInt = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

const TIERS: RangeTier[] = [10, 20, 50, 100];
const OPS: OperationType[] = ['add', 'sub', 'mul', 'div', 'convert'];
const COUNTS = [10, 20, 50];

interface RawQuestion {
  type: OperationType;
  display: string;
  answer: number;
  answerText: string;
  hint: string;
}

/* ── 配置校验 ─────────────────────────────────────────────── */

function fixedValue(spec: { mode: 'random' | 'fixed'; fixedValue?: number } | undefined): number | null {
  if (!spec || spec.mode !== 'fixed') return null;
  if (spec.fixedValue === undefined || !Number.isInteger(spec.fixedValue)) {
    throw new ConfigError('固定操作数必须为整数');
  }
  return spec.fixedValue;
}

export function validateConfig(config: PracticeConfig): void {
  if (!Array.isArray(config.operations) || config.operations.length === 0) {
    throw new ConfigError('至少选择一种运算类型');
  }
  for (const op of config.operations) {
    if (!OPS.includes(op)) throw new ConfigError(`未知运算类型: ${String(op)}`);
  }
  if (!COUNTS.includes(config.questionCount)) {
    throw new ConfigError('题数必须为 10 / 20 / 50');
  }
  if (config.answerMode !== 'input' && config.answerMode !== 'choice4') {
    throw new ConfigError('答题方式必须为 input 或 choice4');
  }
  if ((config.operations.includes('add') || config.operations.includes('sub'))) {
    if (config.rangeTier === undefined || !TIERS.includes(config.rangeTier)) {
      throw new ConfigError('加法/减法需选择档位：10 / 20 / 50 / 100');
    }
  }
  if (config.operations.includes('convert')) {
    if (!config.convertCategories || config.convertCategories.length === 0) {
      throw new ConfigError('换算需至少选择一个类别');
    }
  }

  // FR-MATH-07：固定操作数范围校验
  const tier = config.rangeTier ?? 100;
  const op = config.operands ?? {};
  const bounds: Partial<Record<OperandRole, { min: number; max: number; label: string }>> = {};
  if (config.operations.includes('sub')) {
    bounds.minuend = { min: 0, max: tier, label: '被减数' };
    bounds.subtrahend = { min: 0, max: tier, label: '减数' };
  }
  if (config.operations.includes('mul')) {
    bounds.multiplicand = { min: 1, max: 9, label: '被乘数' };
    bounds.multiplier = { min: 1, max: 9, label: '乘数' };
  }
  if (config.operations.includes('div')) {
    bounds.dividend = { min: 1, max: 81, label: '被除数' };
    bounds.divisor = { min: 1, max: 9, label: '除数' };
  }
  for (const [role, bound] of Object.entries(bounds) as [OperandRole, { min: number; max: number; label: string }][]) {
    const v = fixedValue(op[role]);
    if (v !== null && (v < bound.min || v > bound.max)) {
      throw new ConfigError(`${bound.label}固定值 ${v} 超出范围 [${bound.min}, ${bound.max}]`);
    }
  }
  const subMin = fixedValue(op.minuend);
  const subMax = fixedValue(op.subtrahend);
  if (subMin !== null && subMax !== null && subMax > subMin) {
    throw new ConfigError('固定的减数不能大于固定的被减数');
  }
  const mulA = fixedValue(op.multiplicand);
  const mulB = fixedValue(op.multiplier);
  if (mulA !== null && mulB !== null && mulA * mulB > 81) {
    throw new ConfigError('固定的乘积超出 9×9 范围');
  }
  const divA = fixedValue(op.dividend);
  const divB = fixedValue(op.divisor);
  if (divA !== null && divB !== null && (divA % divB !== 0 || divA / divB > 9)) {
    throw new ConfigError('固定的被除数与除数不满足 9×9 整除');
  }
}

/* ── 单题生成 ─────────────────────────────────────────────── */

function buildAdd(tier: RangeTier, rng: Rng): RawQuestion {
  const a = randInt(rng, 0, tier);
  const b = randInt(rng, 0, tier - a);
  const answer = a + b;
  const display = `${a} + ${b} = ?`;
  return { type: 'add', display, answer, answerText: String(answer), hint: arithmeticHint('add', a, b, answer) };
}

function buildSub(config: PracticeConfig, tier: RangeTier, rng: Rng): RawQuestion {
  const spec = config.operands ?? {};
  const fixedMin = fixedValue(spec.minuend);
  const fixedSub = fixedValue(spec.subtrahend);
  let a: number;
  let b: number;
  if (fixedMin !== null) {
    a = fixedMin;
    b = fixedSub ?? randInt(rng, 0, a);
  } else if (fixedSub !== null) {
    b = fixedSub;
    a = randInt(rng, b, tier);
  } else {
    a = randInt(rng, 0, tier);
    b = randInt(rng, 0, a);
  }
  const answer = a - b;
  const display = `${a} - ${b} = ?`;
  return { type: 'sub', display, answer, answerText: String(answer), hint: arithmeticHint('sub', a, b, answer) };
}

function buildMul(config: PracticeConfig, rng: Rng): RawQuestion {
  const spec = config.operands ?? {};
  const fixedM = fixedValue(spec.multiplicand);
  const fixedR = fixedValue(spec.multiplier);
  const a = fixedM ?? randInt(rng, 1, 9);
  const b = fixedR ?? randInt(rng, 1, 9);
  const answer = a * b;
  const display = `${a} × ${b} = ?`;
  return { type: 'mul', display, answer, answerText: String(answer), hint: arithmeticHint('mul', a, b, answer) };
}

function buildDiv(config: PracticeConfig, rng: Rng): RawQuestion {
  const spec = config.operands ?? {};
  const fixedD = fixedValue(spec.dividend);
  const fixedR = fixedValue(spec.divisor);
  let dividend: number;
  let divisor: number;
  if (fixedD !== null && fixedR !== null) {
    dividend = fixedD;
    divisor = fixedR;
  } else if (fixedR !== null) {
    divisor = fixedR;
    dividend = divisor * randInt(rng, 1, 9);
  } else if (fixedD !== null) {
    dividend = fixedD;
    // 选择能整除且商 ≤ 9 的除数
    const divisors: number[] = [];
    for (let d = 1; d <= 9; d += 1) {
      if (dividend % d === 0 && dividend / d <= 9) divisors.push(d);
    }
    if (divisors.length === 0) throw new ConfigError(`被除数 ${dividend} 无法在 9×9 内整除`);
    divisor = divisors[randInt(rng, 0, divisors.length - 1)]!;
  } else {
    divisor = randInt(rng, 1, 9);
    dividend = divisor * randInt(rng, 1, 9);
  }
  const answer = dividend / divisor;
  const display = `${dividend} ÷ ${divisor} = ?`;
  return {
    type: 'div',
    display,
    answer,
    answerText: String(answer),
    hint: arithmeticHint('div', dividend, divisor, answer),
  };
}

function buildConvert(config: PracticeConfig, rng: Rng): RawQuestion {
  const categories = config.convertCategories!;
  const category = categories[randInt(rng, 0, categories.length - 1)]!;
  const q = buildConvertQuestion(category, rng);
  return { type: 'convert', ...q };
}

function buildRaw(config: PracticeConfig, op: OperationType, rng: Rng): RawQuestion {
  const tier = config.rangeTier ?? 10;
  switch (op) {
    case 'add':
      return buildAdd(tier, rng);
    case 'sub':
      return buildSub(config, tier, rng);
    case 'mul':
      return buildMul(config, rng);
    case 'div':
      return buildDiv(config, rng);
    case 'convert':
      return buildConvert(config, rng);
  }
}

/* ── 四选一干扰项 (Q-04) ──────────────────────────────────── */

function buildChoices(q: RawQuestion, rng: Rng): number[] {
  const candidates = new Set<number>();
  const add = (n: number) => {
    if (Number.isInteger(n) && n >= 0 && n !== q.answer && candidates.size < 12) candidates.add(n);
  };

  // 按题型注入常见错误：进位/退位/口诀/整除/进率
  const displayNums = (q.display.match(/\d+/g) ?? []).map(Number);
  switch (q.type) {
    case 'add': {
      const [a = 0, b = 0] = displayNums;
      add(q.answer + 1);
      add(q.answer - 1);
      add(q.answer + 10);
      if (q.answer >= 10) add(q.answer - 10);
      add(a + b + 10); // 多加进位
      break;
    }
    case 'sub': {
      const [a = 0, b = 0] = displayNums;
      add(q.answer + 1);
      add(q.answer - 1);
      if (q.answer >= 10) add(q.answer - 10);
      add(q.answer + 10);
      add(a - b + 10); // 忘记退位
      add(Math.abs(a - b - 10));
      break;
    }
    case 'mul': {
      const [a = 1, b = 1] = displayNums;
      add((a + 1) * b);
      add(a * (b + 1));
      if (a > 1) add((a - 1) * b);
      if (b > 1) add(a * (b - 1));
      add(q.answer + 1);
      add(q.answer - 1);
      break;
    }
    case 'div': {
      add(q.answer + 1);
      add(q.answer - 1);
      if (q.answer >= 2) add(q.answer + 2);
      if (q.answer >= 2) add(q.answer - 2);
      add(q.answer * 2);
      break;
    }
    case 'convert': {
      add(q.answer + 1);
      add(q.answer - 1);
      add(q.answer * 2);
      if (q.answer % 2 === 0) add(q.answer / 2);
      add(q.answer + 10);
      break;
    }
  }
  // 兜底
  let pad = 1;
  while (candidates.size < 3) {
    add(q.answer + pad);
    add(q.answer - pad);
    pad += 1;
    if (pad > 1000) break;
  }

  const pool = Array.from(candidates);
  const picked: number[] = [];
  while (picked.length < 3 && pool.length > 0) {
    const idx = randInt(rng, 0, pool.length - 1);
    picked.push(pool.splice(idx, 1)[0]!);
  }
  const all = [...picked, q.answer];
  // Fisher–Yates 乱序
  for (let i = all.length - 1; i > 0; i -= 1) {
    const j = randInt(rng, 0, i);
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all;
}

/* ── 会话生成 ─────────────────────────────────────────────── */

/**
 * 生成一次练习的题目 (FR-MATH-01~08, 14)。
 * - 单次会话内 fingerprint 严格唯一（唯一池耗尽时按「尽可能」降级为可重复）
 * - seenFingerprints：跨练习优先出未做过的题 (Q-11)
 * - choice4 模式附带 4 选项
 */
export function generateSession(config: PracticeConfig, opts: GenerateOptions = {}): Question[] {
  validateConfig(config);
  const rng = opts.random ?? Math.random;
  const seen = new Set(opts.seenFingerprints ?? []);
  const count = config.questionCount;
  const ops = config.operations;

  const results: Question[] = [];
  const used = new Set<string>();

  // 先抽取题型序列（循环随机，保证混合均匀），再逐题生成去重
  const sequence: OperationType[] = [];
  for (let i = 0; i < count; i += 1) {
    sequence.push(ops[randInt(rng, 0, ops.length - 1)]!);
  }

  for (const op of sequence) {
    let chosenUnseen: RawQuestion | null = null;
    let chosenUnique: RawQuestion | null = null;
    let anyCandidate: RawQuestion | null = null;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const candidate = buildRaw(config, op, rng);
      const fp = fingerprint(candidate.type, candidate.display);
      anyCandidate = candidate;
      if (used.has(fp)) continue; // 单次内严格去重
      chosenUnique = candidate;
      if (!seen.has(fp)) {
        chosenUnseen = candidate;
        break; // 跨练习：命中未见过的即采纳
      }
    }
    // 唯一池耗尽时按「尽可能不重复」降级为可重复
    const chosen = chosenUnseen ?? chosenUnique ?? anyCandidate;
    if (!chosen) {
      throw new GenerateError('题目生成失败：约束空间过小或配置冲突，请调整设置');
    }
    const fp = fingerprint(chosen.type, chosen.display);
    used.add(fp);
    const question: Question = { fingerprint: fp, ...chosen };
    if (config.answerMode === 'choice4') {
      question.choices = buildChoices(chosen, rng);
    }
    results.push(question);
  }
  return results;
}

export type { AnswerMode };
