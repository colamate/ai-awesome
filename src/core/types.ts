/** 出题引擎领域类型 — 契约见 docs/plans/001-math-phase1.md §2.1，签名不可擅自变更 */

export type OperationType = 'add' | 'sub' | 'mul' | 'div' | 'convert';
export type RangeTier = 10 | 20 | 50 | 100;
export type QuestionCount = 10 | 20 | 50;
export type AnswerMode = 'input' | 'choice4';
export type ConvertCategory = 'time' | 'length' | 'weight' | 'volume' | 'temperature';

export type OperandRole =
  | 'minuend'
  | 'subtrahend'
  | 'multiplicand'
  | 'multiplier'
  | 'dividend'
  | 'divisor';

export interface OperandSpec {
  mode: 'random' | 'fixed';
  /** 固定值；mode='fixed' 时必填 */
  fixedValue?: number;
}

export interface PracticeConfig {
  /** ≥1 种运算；多选即混合练习 (FR-MATH-06) */
  operations: OperationType[];
  /** 加/减档位 (FR-MATH-01/02)；选择 add/sub 时必填 */
  rangeTier?: RangeTier;
  /** 操作数选择 (FR-MATH-07)：固定或随机 */
  operands?: Partial<Record<OperandRole, OperandSpec>>;
  /** 换算类别 (FR-MATH-05)；选择 convert 时至少 1 个 */
  convertCategories?: ConvertCategory[];
  /** 题数 10/20/50 (FR-MATH-08) */
  questionCount: QuestionCount;
  answerMode: AnswerMode;
}

export interface Question {
  /** 稳定去重键：题型 + 规范化题面 (FR-MATH-14) */
  fingerprint: string;
  type: OperationType;
  /** 题面，如 "12 + 7 = ?" */
  display: string;
  /** 数值答案（换算为换算后数值） */
  answer: number;
  /** 显示用答案（换算带单位） */
  answerText: string;
  /** 解题思路 (FR-MATH-10) */
  hint: string;
  /** choice4 模式下 4 个选项（含正确项，乱序） */
  choices?: number[];
}

export interface GenerateOptions {
  /** 跨练习历史指纹，优先出未做过的题 (Q-11) */
  seenFingerprints?: string[];
  /** 注入随机源以便测试；返回 [0,1) */
  random?: () => number;
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

export class GenerateError extends Error {
  override readonly name = 'GenerateError';
}
