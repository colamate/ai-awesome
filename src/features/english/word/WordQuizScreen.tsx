import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngAnswerRecord } from '@/data/englishRepo';
import type { EngAnswerMode, EngQuestion } from '@/core/english';
import { cancelSpeak, isZhAnswer, judgeEng, speak } from '@/core/english';
import HandwritingPad from './handwriting/HandwritingPad';

const FEEDBACK_OK_MS = 900;
const FEEDBACK_WRONG_MS = 3000;

interface Feedback {
  correct: boolean;
  userAnswer: string;
}

export interface WordQuizResult {
  answers: EngAnswerRecord[];
  totalMs: number;
}

interface WordQuizScreenProps {
  questions: EngQuestion[];
  title: string;
  answerMode: EngAnswerMode;
  onFinish: (result: WordQuizResult) => void;
  onExit: () => void;
}

function nowMs(): number {
  return Date.now();
}

export default function WordQuizScreen({ questions, title, answerMode, onFinish, onExit }: WordQuizScreenProps) {
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [input, setInput] = useState('');
  const [ocrUnavailable, setOcrUnavailable] = useState(false);
  const answersRef = useRef<EngAnswerRecord[]>([]);
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
    const q = questions[index];
    if (q?.ttsText !== undefined && q.ttsText !== '') void speak(q.ttsText);
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
    setInput('');
    setIndex((i) => i + 1);
  }, [isLast, onFinish]);

  const submit = useCallback(
    (raw: string) => {
      if (feedback || !question) return;
      const elapsedMs = Math.max(0, nowMs() - shownAtRef.current - pausedMsRef.current);
      const correct = judgeEng(question, raw);
      const userAnswer = raw.trim();
      answersRef.current = [
        ...answersRef.current,
        {
          fingerprint: question.fingerprint,
          display: question.display !== '' ? question.display : question.answerDisplay.en,
          kind: question.kind,
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

  const dictation = question.display === '';
  const showIpaUnderStem = !dictation && question.display === question.answerDisplay.en && question.answerDisplay.ipa !== undefined;

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
        <div data-testid="stem">
          {dictation ? (
            <div className="flex items-center justify-center gap-4">
              <p className="text-center text-xl text-[var(--x-color-text-secondary)]">听录音，写出单词</p>
              <button
                type="button"
                data-testid="replay"
                aria-label="重播"
                onClick={() => void speak(question.ttsText ?? question.answerDisplay.en)}
                className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/10"
              >
                🔊 重播
              </button>
            </div>
          ) : (
            <p className="text-center text-4xl font-semibold tracking-wide">{question.display}</p>
          )}
          {showIpaUnderStem && (
            <p className="mt-2 text-center text-lg text-[var(--x-color-text-secondary)]" data-testid="ipa-chip">
              {question.answerDisplay.ipa}
            </p>
          )}
        </div>

        {feedback ? (
          <div className="mt-8" data-testid="feedback">
            <p
              className={`text-center text-lg font-semibold ${
                feedback.correct ? 'text-[var(--x-color-success)]' : 'text-[var(--x-color-danger)]'
              }`}
            >
              {feedback.correct ? '✓ 答对了！' : '✗ 答错了'}
            </p>
            {!feedback.correct && (
              <div
                className="mt-4 rounded-[var(--x-radius-md)] bg-[var(--x-color-bg)] p-4 text-center"
                data-testid="answer-reveal"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-semibold">{question.answerDisplay.en}</span>
                  {question.answerDisplay.ipa !== undefined && (
                    <span className="text-lg text-[var(--x-color-text-secondary)]">{question.answerDisplay.ipa}</span>
                  )}
                  <button
                    type="button"
                    data-testid="speak-answer"
                    aria-label="发音"
                    onClick={() => void speak(question.answerDisplay.en)}
                    className="rounded-full bg-black/5 px-3 py-1 text-sm transition-colors hover:bg-black/10"
                  >
                    🔊
                  </button>
                </div>
                <p className="mt-2 text-[15px] text-[var(--x-color-text-secondary)]">{question.answerDisplay.zh}</p>
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
                className="rounded-[var(--x-radius-md)] border border-black/10 bg-white px-4 py-4 text-2xl font-medium transition-all hover:border-[var(--x-color-accent)] hover:shadow-sm active:scale-[0.98]"
              >
                {choice}
              </button>
            ))}
          </div>
        ) : answerMode === 'handwriting' && !ocrUnavailable ? (
          <HandwritingPad questionIndex={index} onSubmit={submit} onUnavailable={() => setOcrUnavailable(true)} />
        ) : (
          <div className="mt-8">
            {answerMode === 'handwriting' && ocrUnavailable && (
              <p className="mb-3 text-center text-sm text-[var(--x-color-warning)]" data-testid="ocr-fallback">
                OCR 不可用，已切换键盘输入
              </p>
            )}
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
                placeholder={isZhAnswer(question.answer) ? '输入中文释义' : '输入英文单词'}
                className={`w-full rounded-[var(--x-radius-md)] border border-black/10 bg-white px-4 py-3 text-center ${
                  isZhAnswer(question.answer) ? 'text-2xl' : 'text-xl'
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
