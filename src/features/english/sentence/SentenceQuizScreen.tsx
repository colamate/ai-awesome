import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngAnswerRecord } from '@/data/englishRepo';
import type { EngQuestion, SentenceMode } from '@/core/english';
import { cancelSpeak, isZhAnswer, judgeEng, speak } from '@/core/english';
import SyntaxView from './SyntaxView';

const FEEDBACK_OK_MS = 900;
const FEEDBACK_WRONG_MS = 3000;
const RATE_SLOW = 0.6;
const RATE_NORMAL = 0.9;

interface Feedback {
  correct: boolean;
}

export interface SentenceQuizResult {
  answers: EngAnswerRecord[];
  totalMs: number;
}

interface SentenceQuizScreenProps {
  questions: EngQuestion[];
  title: string;
  sentenceMode: SentenceMode;
  onFinish: (result: SentenceQuizResult) => void;
  onExit: () => void;
}

function nowMs(): number {
  return Date.now();
}

export default function SentenceQuizScreen({
  questions,
  title,
  sentenceMode,
  onFinish,
  onExit,
}: SentenceQuizScreenProps) {
  const readAlong = sentenceMode === 'readAlong';
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [input, setInput] = useState('');
  const [showCompare, setShowCompare] = useState(false);
  const [rate, setRate] = useState<number>(RATE_NORMAL);
  const answersRef = useRef<EngAnswerRecord[]>([]);
  const shownAtRef = useRef(nowMs());
  const pausedMsRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rateRef = useRef(rate);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    const q = questions[index];
    if (q?.ttsText !== undefined && q.ttsText !== '') void speak(q.ttsText, { rate: rateRef.current });
  }, [index, questions]);

  useEffect(() => () => cancelSpeak(), []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        pausedAtRef.current = nowMs();
      } else if (pausedAtRef.current !== null) {
        pausedMsRef.current += nowMs() - pausedAtRef.current;
        pausedAtRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const advance = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isLast) {
      const answers = answersRef.current;
      onFinish({ answers, totalMs: answers.reduce((s, a) => s + a.elapsedMs, 0) });
      return;
    }
    setFeedback(null);
    setShowCompare(false);
    setInput('');
    shownAtRef.current = nowMs();
    pausedMsRef.current = 0;
    setIndex((i) => i + 1);
  }, [isLast, onFinish]);

  const submit = useCallback(
    (raw: string) => {
      if (feedback || !question) return;
      const elapsedMs = Math.max(0, nowMs() - shownAtRef.current - pausedMsRef.current);
      const correct = judgeEng(question, raw);
      answersRef.current = [
        ...answersRef.current,
        {
          fingerprint: question.fingerprint,
          display: question.display,
          kind: question.kind,
          userAnswer: raw.trim(),
          correct,
          elapsedMs,
        },
      ];
      setFeedback({ correct });
      timerRef.current = setTimeout(advance, correct ? FEEDBACK_OK_MS : FEEDBACK_WRONG_MS);
    },
    [advance, feedback, question],
  );

  if (!question) return null;

  const answerIsZh = isZhAnswer(question.answer);
  const stemIsEnglish = question.display === question.answerDisplay.en;
  const compare = (
    <div
      className="mt-4 rounded-[var(--x-radius-md)] bg-[var(--x-color-bg)] p-4"
      data-testid="compare"
    >
      <SyntaxView sentence={question.answerDisplay.en} />
      <p className="mt-2 text-center text-[15px] text-[var(--x-color-text-secondary)]">
        {question.answerDisplay.zh}
      </p>
      {question.answerDisplay.zhNote !== undefined && (
        <p className="mt-1 text-center text-sm text-[var(--x-color-text-secondary)]" data-testid="zh-note">
          {question.answerDisplay.zhNote}
        </p>
      )}
      <button
        type="button"
        data-testid="speak-answer"
        aria-label="朗读英文"
        onClick={() => void speak(question.answerDisplay.en)}
        className="mx-auto mt-3 block rounded-full bg-black/5 px-4 py-1.5 text-sm transition-colors hover:bg-black/10"
      >
        🔊 朗读
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-xl px-6 py-10" data-testid="quiz">
      <header className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          className="rounded-full px-3 py-1 text-sm text-[var(--x-color-text-secondary)] transition-colors hover:bg-black/5"
        >
          退出
        </button>
        <span className="text-sm font-medium text-[var(--x-color-text-secondary)]">
          {title} · 第 {index + 1} / {questions.length} 题
        </span>
      </header>

      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-[var(--x-color-accent)] transition-[width] duration-300"
          style={{ width: `${((index + (feedback || showCompare ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      <section className="rounded-[var(--x-radius-lg)] bg-[var(--x-color-surface)] p-8 shadow-[var(--x-shadow-card)]">
        <div data-testid="stem">
          <p className="text-center text-2xl font-semibold leading-snug tracking-wide">{question.display}</p>
          {stemIsEnglish && (
            <button
              type="button"
              data-testid="replay"
              aria-label="重播"
              onClick={() => void speak(question.answerDisplay.en, { rate: rateRef.current })}
              className="mx-auto mt-3 block rounded-full bg-black/5 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/10"
            >
              🔊 重播
            </button>
          )}
        </div>

        {readAlong ? (
          <div className="mt-6">
            <div className="flex items-center justify-center gap-2" data-testid="speeds">
              <button
                type="button"
                data-testid="speed-slow"
                aria-pressed={rate === RATE_SLOW}
                onClick={() => setRate(RATE_SLOW)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  rate === RATE_SLOW
                    ? 'bg-[var(--x-color-accent)] text-white'
                    : 'bg-black/5 text-[var(--x-color-text-secondary)] hover:bg-black/10'
                }`}
              >
                慢速
              </button>
              <button
                type="button"
                data-testid="speed-normal"
                aria-pressed={rate === RATE_NORMAL}
                onClick={() => setRate(RATE_NORMAL)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  rate === RATE_NORMAL
                    ? 'bg-[var(--x-color-accent)] text-white'
                    : 'bg-black/5 text-[var(--x-color-text-secondary)] hover:bg-black/10'
                }`}
              >
                常速
              </button>
            </div>
            {!showCompare ? (
              <button
                type="button"
                data-testid="show-compare"
                onClick={() => setShowCompare(true)}
                className="mx-auto mt-6 block rounded-full bg-[var(--x-color-accent)] px-8 py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
              >
                查看对照
              </button>
            ) : (
              <div>
                {compare}
                <button
                  type="button"
                  data-testid="next"
                  onClick={advance}
                  className="mx-auto mt-6 block rounded-full bg-[var(--x-color-accent)] px-8 py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
                >
                  {isLast ? '查看结果' : '下一题'}
                </button>
              </div>
            )}
          </div>
        ) : feedback ? (
          <div className="mt-8" data-testid="feedback">
            <p
              className={`text-center text-lg font-semibold ${
                feedback.correct ? 'text-[var(--x-color-success)]' : 'text-[var(--x-color-danger)]'
              }`}
            >
              {feedback.correct ? '✓ 答对了！' : '✗ 答错了'}
            </p>
            {compare}
            {!feedback.correct && (
              <p className="mt-3 text-center text-sm text-[var(--x-color-text-secondary)]" data-testid="hint">
                {question.hint}
              </p>
            )}
            <button
              type="button"
              onClick={advance}
              className="mx-auto mt-6 block rounded-full bg-[var(--x-color-accent)] px-8 py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
            >
              {isLast ? '查看结果' : '继续'}
            </button>
          </div>
        ) : question.choices ? (
          <div className="mt-8 grid grid-cols-1 gap-3" data-testid="choices">
            {question.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => submit(choice)}
                className="rounded-[var(--x-radius-md)] border border-black/10 bg-white px-4 py-3 text-lg font-medium transition-all hover:border-[var(--x-color-accent)] hover:shadow-sm active:scale-[0.98]"
              >
                {choice}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <form
              className="flex gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim() !== '') submit(input);
              }}
            >
              <input
                data-testid="answer-input"
                autoFocus
                inputMode="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={answerIsZh ? '输入中文句子' : '输入英文句子'}
                className={`w-full rounded-[var(--x-radius-md)] border border-black/10 bg-white px-4 py-3 text-center ${
                  answerIsZh ? 'text-lg' : 'text-base'
                } font-semibold outline-none transition-colors focus:border-[var(--x-color-accent)]`}
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-[var(--x-color-accent)] px-7 py-3 text-sm font-medium text-white transition-transform active:scale-95"
              >
                提交
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
