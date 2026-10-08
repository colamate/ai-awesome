/** 英语练习领域类型 — 契约见 docs/plans/002-home-english-phase2.md §2.2，签名不可擅自变更 */

export type EngKind = 'word' | 'sentence';
export type WordMode = 'en2zh' | 'zh2en' | 'dictation';
export type SentenceMode = 'en2zh' | 'zh2en' | 'readAlong';
export type EngAnswerMode = 'choice4' | 'input' | 'handwriting';
export type QuestionCount = 10 | 20 | 50;

export interface EngFilter {
  /** [1,2] 子集；空数组 = 不筛选（全部） */
  grades: number[];
  /** [1,2] 子集（1=上册 2=下册）；空数组 = 全部 */
  volumes: number[];
  /** [1..6] 子集；空数组 = 全部 */
  units: number[];
}

export interface EngPracticeConfig {
  kind: EngKind;
  filter: EngFilter;
  /** kind='word' 必填 */
  wordMode?: WordMode;
  /** kind='sentence' 必填 */
  sentenceMode?: SentenceMode;
  /** word 可三选；sentence 仅 'input' | 'choice4' */
  answerMode: EngAnswerMode;
  questionCount: QuestionCount;
}

export interface EngAnswerDisplay {
  en: string;
  zh: string;
  zhNote?: string;
  ipa?: string;
}

export interface EngQuestion {
  /** 稳定去重键：kind + mode + 规范化题面 + 答案 (FR-ENG-09) */
  fingerprint: string;
  kind: EngKind;
  /** 题面（听写模式为 ''） */
  display: string;
  /** 需 TTS 朗读的英文（dictation / readAlong 必填） */
  ttsText?: string;
  /** 标准答案（归一化后比对） */
  answer: string;
  answerDisplay: EngAnswerDisplay;
  /** 答错提示（中英对照） */
  hint: string;
  /** choice4：含正确项、乱序、恰 4 个（池 <4 抛错） */
  choices?: string[];
  /** sentence：data/syntax-en.json 的键（原句 en） */
  syntaxKey?: string;
}

export interface EngGenerateOptions {
  /** 跨练习历史指纹，优先出未做过的题 (FR-ENG-09) */
  seenFingerprints?: string[];
  /** 注入随机源以便测试；返回 [0,1) */
  random?: () => number;
}

export class EngConfigError extends Error {
  override readonly name = 'EngConfigError';
}

export class EngGenerateError extends Error {
  override readonly name = 'EngGenerateError';
}

/* ── 题池（由 data/textbooks.ts buildPool 产出，引擎只消费） ── */

export interface PoolWord {
  en: string;
  zh: string;
  unverified?: boolean;
  ipa?: string;
  grade: number;
  volume: number;
  unit: number;
  unitTitle: string;
}

export interface PoolSentence {
  en: string;
  zh: string;
  zhNote?: string;
  source?: string;
  grade: number;
  volume: number;
  unit: number;
  unitTitle: string;
}

export interface EngPool {
  words: PoolWord[];
  sentences: PoolSentence[];
  /** key: `${grade}-${volume}-${unit}` → 单元标题 */
  unitTitles: Map<string, string>;
}
