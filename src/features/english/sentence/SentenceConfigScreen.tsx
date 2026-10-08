import { useState } from 'react';
import type { EngAnswerMode, EngPracticeConfig, EngQuestion, EngFilter, QuestionCount, SentenceMode } from '@/core/english';
import { EngConfigError, EngGenerateError, generateEngSession, questionCountFor } from '@/core/english';
import { buildPool, countPool, type EnglishTextbook } from '@/data/textbooks';
import type { EngConfigRecord } from '@/data/englishRepo';

const GRADES: { id: number; label: string }[] = [
  { id: 1, label: '一年级' },
  { id: 2, label: '二年级' },
];
const VOLUMES: { id: number; label: string }[] = [
  { id: 1, label: '上册' },
  { id: 2, label: '下册' },
];
const UNITS: { id: number; label: string }[] = [1, 2, 3, 4, 5, 6].map((n) => ({ id: n, label: `第 ${n} 单元` }));
const SENTENCE_MODES: { id: SentenceMode; label: string }[] = [
  { id: 'en2zh', label: '英译中' },
  { id: 'zh2en', label: '中译英' },
  { id: 'readAlong', label: '跟读' },
];
const ANSWER_MODES: { id: EngAnswerMode; label: string }[] = [
  { id: 'choice4', label: '四选一' },
  { id: 'input', label: '键盘输入' },
];
const COUNTS: QuestionCount[] = [10, 20, 50];

interface SentenceConfigScreenProps {
  tb: EnglishTextbook;
  seenFingerprints: string[];
  defaultConfig: EngConfigRecord | null;
  onStart: (questions: EngQuestion[], config: EngPracticeConfig) => void;
  onExit: () => void;
}

function toggle(list: number[], item: number): number[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export default function SentenceConfigScreen({
  tb,
  seenFingerprints,
  defaultConfig,
  onStart,
  onExit,
}: SentenceConfigScreenProps) {
  const def = defaultConfig?.kind === 'sentence' ? defaultConfig : null;
  const [grades, setGrades] = useState<number[]>(def?.filter.grades ?? []);
  const [volumes, setVolumes] = useState<number[]>(def?.filter.volumes ?? []);
  const [units, setUnits] = useState<number[]>(def?.filter.units ?? []);
  const [sentenceMode, setSentenceMode] = useState<SentenceMode>(def?.sentenceMode ?? 'en2zh');
  const [answerMode, setAnswerMode] = useState<EngAnswerMode>(
    def?.answerMode === 'choice4' ? 'choice4' : 'input',
  );
  const [questionCount, setQuestionCount] = useState<QuestionCount>(def?.questionCount ?? 10);
  const [error, setError] = useState<string | null>(null);

  const readAlong = sentenceMode === 'readAlong';
  const effectiveAnswerMode: EngAnswerMode = readAlong ? 'input' : answerMode;
  const filter: EngFilter = { grades, volumes, units };
  const poolSentences = countPool(tb, filter).sentences;
  const actualCount = questionCountFor(questionCount, poolSentences);

  const buildConfig = (): EngPracticeConfig => ({
    kind: 'sentence',
    filter,
    sentenceMode,
    answerMode: effectiveAnswerMode,
    questionCount,
  });

  const handleStart = () => {
    setError(null);
    try {
      const config = buildConfig();
      const questions = generateEngSession(config, buildPool(tb, config.filter), { seenFingerprints });
      onStart(questions, config);
    } catch (e) {
      if (e instanceof EngConfigError || e instanceof EngGenerateError) setError(e.message);
      else setError('生成题目失败，请调整设置');
    }
  };

  const chip = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
      active
        ? 'bg-[var(--x-color-accent)] text-white shadow-sm'
        : 'bg-black/5 text-[var(--x-color-text)] hover:bg-black/10'
    }`;

  const multiSection = (
    label: string,
    testid: string,
    items: { id: number; label: string }[],
    selected: number[],
    setSelected: (updater: (prev: number[]) => number[]) => void,
  ) => (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-[var(--x-color-text-secondary)]">{label}（可多选，不选为全部）</h2>
      <div className="flex flex-wrap gap-2" data-testid={testid}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected((prev) => toggle(prev, item.id))}
            className={chip(selected.includes(item.id))}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );

  const poolEmpty = poolSentences === 0;
  const countCapped = !poolEmpty && actualCount < questionCount;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10" data-testid="config">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">语句练习</h1>
          <p className="mt-1 text-sm text-[var(--x-color-text-secondary)]">设置出题范围，开始练习</p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-full px-3 py-1 text-sm text-[var(--x-color-text-secondary)] transition-colors hover:bg-black/5"
        >
          返回
        </button>
      </header>

      <div className="space-y-6 rounded-[var(--x-radius-lg)] bg-[var(--x-color-surface)] p-6 shadow-[var(--x-shadow-card)]">
        {multiSection('年级', 'grades', GRADES, grades, setGrades)}
        {multiSection('学期', 'volumes', VOLUMES, volumes, setVolumes)}
        {multiSection('单元', 'units', UNITS, units, setUnits)}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--x-color-text-secondary)]">练习方式</h2>
          <div className="flex flex-wrap gap-2" data-testid="sentence-modes">
            {SENTENCE_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSentenceMode(mode.id)}
                className={chip(sentenceMode === mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </section>

        {!readAlong && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-[var(--x-color-text-secondary)]">答题方式</h2>
            <div className="flex flex-wrap gap-2" data-testid="answer-modes">
              {ANSWER_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setAnswerMode(mode.id)}
                  className={chip(effectiveAnswerMode === mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--x-color-text-secondary)]">题数</h2>
          <div className="flex gap-2" data-testid="counts">
            {COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setQuestionCount(count)}
                className={chip(questionCount === count)}
              >
                {count} 道
              </button>
            ))}
          </div>
        </section>

        <p className="text-sm text-[var(--x-color-text-secondary)]" data-testid="pool-count">
          题池 {poolSentences} 句
          {countCapped && <span className="text-[var(--x-color-warning)]">（题池仅 {actualCount} 题）</span>}
        </p>
        {poolEmpty && (
          <p className="rounded-[var(--x-radius-sm)] bg-[var(--x-color-warning)]/10 px-3 py-2 text-sm text-[var(--x-color-warning)]">
            题池为空，请调整年级/学期/单元筛选
          </p>
        )}

        {error && (
          <p className="rounded-[var(--x-radius-sm)] bg-[var(--x-color-danger)]/10 px-3 py-2 text-sm text-[var(--x-color-danger)]" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleStart}
          disabled={poolEmpty}
          className="w-full rounded-full bg-[var(--x-color-accent)] py-3.5 text-[15px] font-medium text-white transition-transform hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="start"
        >
          {readAlong ? '开始跟读' : '开始练习'}
        </button>
      </div>
    </div>
  );
}
