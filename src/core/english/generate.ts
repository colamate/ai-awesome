import type {
  EngGenerateOptions,
  EngPool,
  EngPracticeConfig,
  EngQuestion,
  PoolSentence,
  PoolWord,
  QuestionCount,
} from './types';
import { EngConfigError } from './types';
import { normalizeEn, normalizeZh } from './judge';

type Rng = () => number;

const COUNTS: QuestionCount[] = [10, 20, 50];

export function questionCountFor(selected: QuestionCount, poolSize: number): number {
  if (!COUNTS.includes(selected)) {
    throw new EngConfigError('题数必须为 10 / 20 / 50');
  }
  return Math.max(0, Math.min(selected, poolSize));
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = arr[i];
    const b = arr[j];
    if (a !== undefined && b !== undefined) {
      arr[i] = b;
      arr[j] = a;
    }
  }
  return arr;
}

type WordModeResolved = NonNullable<EngPracticeConfig['wordMode']>;
type SentenceModeResolved = NonNullable<EngPracticeConfig['sentenceMode']>;

function resolveWordMode(config: EngPracticeConfig): WordModeResolved {
  const mode = config.wordMode;
  if (mode === 'en2zh' || mode === 'zh2en' || mode === 'dictation') return mode;
  throw new EngConfigError('单词练习需选择练习方式：英译中 / 中译英 / 听写');
}

function resolveSentenceMode(config: EngPracticeConfig): SentenceModeResolved {
  const mode = config.sentenceMode;
  if (mode === 'en2zh' || mode === 'zh2en' || mode === 'readAlong') return mode;
  throw new EngConfigError('语句练习需选择练习方式：英译中 / 中译英 / 跟读');
}

function validate(config: EngPracticeConfig): void {
  if (!COUNTS.includes(config.questionCount)) {
    throw new EngConfigError('题数必须为 10 / 20 / 50');
  }
  if (config.kind === 'word') {
    const mode = resolveWordMode(config);
    if (!['choice4', 'input', 'handwriting'].includes(config.answerMode)) {
      throw new EngConfigError('答题方式必须为四选一 / 键盘输入 / 手写');
    }
    if (mode === 'dictation' && config.answerMode === 'choice4') {
      throw new EngConfigError('听写模式不支持四选一，请用键盘输入或手写作答');
    }
    return;
  }
  if (config.kind === 'sentence') {
    resolveSentenceMode(config);
    if (!['choice4', 'input'].includes(config.answerMode)) {
      throw new EngConfigError('语句练习答题方式必须为四选一或键盘输入');
    }
    return;
  }
  throw new EngConfigError('未知练习类型');
}

function wordDisplay(w: PoolWord, mode: NonNullable<EngPracticeConfig['wordMode']>): {
  display: string;
  ttsText?: string;
  answer: string;
} {
  switch (mode) {
    case 'en2zh':
      return { display: w.en, answer: w.zh };
    case 'zh2en':
      return { display: w.zh, answer: w.en };
    case 'dictation':
      return { display: '', ttsText: w.en, answer: w.en };
  }
}

function sentenceDisplay(
  s: PoolSentence,
  mode: NonNullable<EngPracticeConfig['sentenceMode']>,
): { display: string; ttsText?: string; answer: string } {
  switch (mode) {
    case 'en2zh':
      return { display: s.en, answer: s.zh };
    case 'zh2en':
      return { display: s.zh, answer: s.en };
    case 'readAlong':
      return { display: s.en, ttsText: s.en, answer: s.en };
  }
}

function wordHint(w: PoolWord, mode: NonNullable<EngPracticeConfig['wordMode']>): string {
  const phon = w.ipa ? ` ${w.ipa}` : '';
  if (mode === 'zh2en') return `正确答案：${w.en}${phon}（${w.zh}）`;
  if (mode === 'dictation') return `正确答案：${w.en}${phon}，意为“${w.zh}”`;
  return `${w.en}${phon} — ${w.zh}`;
}

function sentenceHint(
  s: PoolSentence,
  mode: NonNullable<EngPracticeConfig['sentenceMode']>,
): string {
  if (mode === 'zh2en') return `参考译文：${s.zh}${s.zhNote ? `（${s.zhNote}）` : ''}`;
  if (mode === 'readAlong') return '';
  return `参考译文：${s.zh}${s.zhNote ? `（${s.zhNote}）` : ''}`;
}

function buildWordQuestion(
  w: PoolWord,
  mode: NonNullable<EngPracticeConfig['wordMode']>,
): EngQuestion {
  const base = wordDisplay(w, mode);
  return {
    fingerprint: `word:${mode}:${normalizeForFp(base.answer)}:${normalizeForFp(base.display)}`,
    kind: 'word',
    display: base.display,
    ...(base.ttsText !== undefined ? { ttsText: base.ttsText } : {}),
    answer: base.answer,
    answerDisplay: {
      en: w.en,
      zh: w.zh,
      ...(w.ipa !== undefined ? { ipa: w.ipa } : {}),
    },
    hint: wordHint(w, mode),
  };
}

function buildSentenceQuestion(
  s: PoolSentence,
  mode: NonNullable<EngPracticeConfig['sentenceMode']>,
): EngQuestion {
  const base = sentenceDisplay(s, mode);
  return {
    fingerprint: `sentence:${mode}:${normalizeForFp(base.answer)}:${normalizeForFp(base.display)}`,
    kind: 'sentence',
    display: base.display,
    ...(base.ttsText !== undefined ? { ttsText: base.ttsText } : {}),
    answer: base.answer,
    answerDisplay: {
      en: s.en,
      zh: s.zh,
      ...(s.zhNote !== undefined ? { zhNote: s.zhNote } : {}),
    },
    hint: sentenceHint(s, mode),
    ...(mode !== 'readAlong' ? { syntaxKey: s.en } : {}),
  };
}

function normalizeForFp(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function distract(
  q: EngQuestion,
  pool: EngPool,
  rng: Rng,
  unitKey: string,
): EngQuestion {
  const entries =
    q.kind === 'word'
      ? pool.words.map((w) => ({ text: w.zh, unit: `${w.grade}-${w.volume}-${w.unit}`, norm: normalizeZh(w.zh) }))
      : pool.sentences.map((s) => ({ text: s.zh, unit: `${s.grade}-${s.volume}-${s.unit}`, norm: normalizeZh(s.zh) }));
  const answerNorm = normalizeZh(q.answer);
  const seen = new Set<string>([answerNorm]);
  const distractors: string[] = [];
  const ordered = [
    ...entries.filter((e) => e.unit === unitKey),
    ...entries.filter((e) => e.unit !== unitKey),
  ];
  for (const e of shuffle(ordered, rng)) {
    if (distractors.length >= 3) break;
    if (e.norm === '' || seen.has(e.norm)) continue;
    seen.add(e.norm);
    distractors.push(e.text);
  }
  if (distractors.length < 3) {
    throw new EngConfigError('题池中文释义不足，无法生成四选一（请扩大筛选范围或改用键盘输入）');
  }
  const choices = shuffle([q.answer, ...distractors], rng);
  return { ...q, choices };
}

function distractEn(
  q: EngQuestion,
  pool: EngPool,
  rng: Rng,
  unitKey: string,
): EngQuestion {
  const entries =
    q.kind === 'word'
      ? pool.words.map((w) => ({ text: w.en, unit: `${w.grade}-${w.volume}-${w.unit}`, norm: normalizeEn(w.en) }))
      : pool.sentences.map((s) => ({ text: s.en, unit: `${s.grade}-${s.volume}-${s.unit}`, norm: normalizeEn(s.en) }));
  const answerNorm = normalizeEn(q.answer);
  const seen = new Set<string>([answerNorm]);
  const distractors: string[] = [];
  const ordered = [
    ...entries.filter((e) => e.unit === unitKey),
    ...entries.filter((e) => e.unit !== unitKey),
  ];
  for (const e of shuffle(ordered, rng)) {
    if (distractors.length >= 3) break;
    if (e.norm === '' || seen.has(e.norm)) continue;
    seen.add(e.norm);
    distractors.push(e.text);
  }
  if (distractors.length < 3) {
    throw new EngConfigError('题池英文词条不足，无法生成四选一（请扩大筛选范围或改用键盘输入）');
  }
  const choices = shuffle([q.answer, ...distractors], rng);
  return { ...q, choices };
}

export function generateEngSession(
  config: EngPracticeConfig,
  pool: EngPool,
  opts: EngGenerateOptions = {},
): EngQuestion[] {
  validate(config);
  const rng = opts.random ?? Math.random;
  const seen = new Set(opts.seenFingerprints ?? []);

  const isWord = config.kind === 'word';
  const wordMode = isWord ? resolveWordMode(config) : undefined;
  const sentenceMode = isWord ? undefined : resolveSentenceMode(config);
  const source: (PoolWord | PoolSentence)[] = isWord ? pool.words : pool.sentences;
  const count = questionCountFor(config.questionCount, source.length);
  if (source.length === 0) {
    throw new EngConfigError('题池为空，请调整年级/学期/单元筛选');
  }
  if (config.answerMode === 'choice4' && source.length < 4) {
    throw new EngConfigError('题池少于 4 条，无法四选一，请调整筛选或改用键盘输入');
  }

  const unitKeyOf = (e: PoolWord | PoolSentence): string => `${e.grade}-${e.volume}-${e.unit}`;
  const build = (e: PoolWord | PoolSentence): EngQuestion => {
    if (isWord) {
      if (wordMode === undefined) throw new EngConfigError('单词练习需选择练习方式');
      return buildWordQuestion(e as PoolWord, wordMode);
    }
    if (sentenceMode === undefined) throw new EngConfigError('语句练习需选择练习方式');
    return buildSentenceQuestion(e as PoolSentence, sentenceMode);
  };

  const shuffled = shuffle(source, rng);
  const ordered = [
    ...shuffled.filter((e) => !seen.has(build(e).fingerprint)),
    ...shuffled.filter((e) => seen.has(build(e).fingerprint)),
  ];

  const picked: { q: EngQuestion; unitKey: string }[] = [];
  const usedFp = new Set<string>();
  for (const e of ordered) {
    if (picked.length >= count) break;
    const q = build(e);
    if (usedFp.has(q.fingerprint)) continue;
    usedFp.add(q.fingerprint);
    picked.push({ q, unitKey: unitKeyOf(e) });
  }

  return picked.map(({ q, unitKey }) => {
    if (config.answerMode !== 'choice4') return q;
    if (config.kind === 'sentence' && config.sentenceMode === 'readAlong') return q;
    const answerIsZh =
      config.kind === 'word'
        ? config.wordMode === 'en2zh'
        : config.sentenceMode === 'en2zh';
    return answerIsZh ? distract(q, pool, rng, unitKey) : distractEn(q, pool, rng, unitKey);
  });
}
