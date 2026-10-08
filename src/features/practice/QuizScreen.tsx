import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnswerRecord } from '@/data/repo';
import type { Question } from '@/core/types';
import { judge } from '@/core/judge';

const FEEDBACK_OK_MS = 900;
const FEEDBACK_WRONG_MS = 3000;

interface Feedback {
  correct: boolean;
  userAnswer: string;
}

export interface QuizResult {
  answers: AnswerRecord[];
  totalMs: number;
}

interface QuizScreenProps {
  questions: Question[];
  title: string;
  onFinish: (result: QuizResult) => void;
  onExit: () => void;
}

function nowMs(): number {
  return Date.now();
}

export default function QuizScreen({ questions, title, onFinish, onExit }: QuizScreenProps) {
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [input, setInput] = useState('');
  const answersRef = useRef<AnswerRecord[]>([]);
  const shownAtRef = useRef(nowMs());
  const pausedMsRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  useEffect(() => {
    shownAtRef.current = nowMs();
    pausedMsRef.current = 0;
  }, [index]);

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
    setInput('');
    setIndex((i) => i + 1);
  }, [isLast, onFinish]);

  const submit = useCallback(
    (raw: string | number) => {
      if (feedback || !question) return;
      const elapsedMs = Math.max(0, nowMs() - shownAtRef.current - pausedMsRef.current);
      const correct = judge(question, raw);
      const userAnswer = String(raw).trim();
      answersRef.current = [
        ...answersRef.current,
        {
          fingerprint: question.fingerprint,
          display: question.display,
          type: question.type,
          userAnswer,
          correct,
          elapsedMs,
        },
      ];
      setFeedback({ correct, userAnswer });
      timerRef.current = setTimeout(advance, correct ? FEEDBACK_OK_MS : FEEDBACK_WRONG_MS);
    },
    [advance, feedback, question],
  );

  if (!question) return null;

  return (
    <div className="mx-auto max-w-xl px-6 py-10" data-testid="quiz">
      <header className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          className="no-print rounded-full px-3 py-1 text-sm text-[var(--x-color-text-secondary)] transition-colors hover:bg-black/5"
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
          style={{ width: `${((index + (feedback ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      <section className="rounded-[var(--x-radius-lg)] bg-[var(--x-color-surface)] p-8 shadow-[var(--x-shadow-card)]">
        <p className="text-center text-4xl font-semibold tracking-wide tabular-nums">{question.display}</p>

        {feedback ? (
          <div className="mt-8" data-testid="feedback">
            <p
              className={`text-center text-lg font-semibold ${
                feedback.correct ? 'text-[var(--x-color-success)]' : 'text-[var(--x-color-danger)]'
              }`}
            >
              {feedback.correct ? '✓ 答对了！' : `✗ 答错了，正确答案是 ${question.answerText}`}
            </p>
            {!feedback.correct && (
              <div className="mt-4 rounded-[var(--x-radius-md)] bg-[var(--x-color-bg)] p-4 text-[15px] leading-relaxed text-[var(--x-color-text)]">
                <span className="font-semibold">解题思路：</span>
                {question.hint}
              </div>
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
          <div className="mt-8 grid grid-cols-2 gap-3" data-testid="choices">
            {question.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => submit(choice)}
                className="rounded-[var(--x-radius-md)] border border-black/10 bg-white px-4 py-4 text-2xl font-medium tabular-nums transition-all hover:border-[var(--x-color-accent)] hover:shadow-sm active:scale-[0.98]"
              >
                {choice}
              </button>
            ))}
          </div>
        ) : (
          <form
            className="mt-8 flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim() !== '') submit(input);
            }}
          >
            <input
              data-testid="answer-input"
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="输入答案"
              className="w-full rounded-[var(--x-radius-md)] border border-black/10 bg-white px-4 py-3 text-center text-2xl font-semibold tabular-nums outline-none transition-colors focus:border-[var(--x-color-accent)]"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-[var(--x-color-accent)] px-7 py-3 text-sm font-medium text-white transition-transform active:scale-95"
            >
              提交
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
