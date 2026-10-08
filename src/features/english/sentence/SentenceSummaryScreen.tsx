import type { EngQuestion } from '@/core/english';
import type { EngSessionRecord } from '@/data/englishRepo';

interface SentenceSummaryScreenProps {
  session: EngSessionRecord | null;
  review: EngQuestion[];
  onRetry: () => void;
  onHome: () => void;
}

export default function SentenceSummaryScreen({ session, review, onRetry, onHome }: SentenceSummaryScreenProps) {
  const answers = session?.answers ?? [];
  const correctCount = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const accuracy = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  const wrongAnswers = answers.filter((a) => !a.correct);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10" data-testid="summary">
      <header className="mb-8 text-center">
        {session === null ? (
          <>
            <p className="text-3xl font-semibold tracking-tight">跟读完成</p>
            <p className="mt-1 text-sm text-[var(--x-color-text-secondary)]">
              共回顾 {review.length} 句
            </p>
          </>
        ) : (
          <>
            <p className="text-5xl font-semibold tracking-tight">{accuracy}%</p>
            <p className="mt-1 text-sm text-[var(--x-color-text-secondary)]">
              共 {total} 题，答对 {correctCount} 题
            </p>
          </>
        )}
      </header>

      {session === null ? (
        <section className="mb-6 rounded-[var(--x-radius-lg)] bg-[var(--x-color-surface)] p-5 shadow-[var(--x-shadow-card)]">
          <h2 className="mb-3 text-sm font-semibold text-[var(--x-color-text-secondary)]">跟读回顾</h2>
          <ul className="space-y-3" data-testid="review-list">
            {review.map((q) => (
              <li key={q.fingerprint} className="rounded-[var(--x-radius-md)] bg-[var(--x-color-bg)] p-3">
                <p className="text-base font-medium">{q.answerDisplay.en}</p>
                <p className="mt-1 text-sm text-[var(--x-color-text-secondary)]">{q.answerDisplay.zh}</p>
                {q.answerDisplay.zhNote !== undefined && (
                  <p className="mt-0.5 text-xs text-[var(--x-color-text-secondary)]">{q.answerDisplay.zhNote}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <section className="mb-6 rounded-[var(--x-radius-lg)] bg-[var(--x-color-surface)] p-5 shadow-[var(--x-shadow-card)]">
            <h2 className="mb-3 text-sm font-semibold text-[var(--x-color-text-secondary)]">本组题目</h2>
            <ul className="space-y-1.5">
              {answers.map((a, i) => (
                <li key={a.fingerprint} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${a.correct ? 'bg-[var(--x-color-success)]' : 'bg-[var(--x-color-danger)]'}`}
                    />
                    <span className="tabular-nums text-[var(--x-color-text-secondary)]">{i + 1}.</span>
                    <span>{a.display}</span>
                  </span>
                  <span className="text-[var(--x-color-text-secondary)]">
                    {a.correct ? '' : `你的答案 ${a.userAnswer || '（空）'}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {wrongAnswers.length > 0 && (
            <section className="mb-6 rounded-[var(--x-radius-lg)] bg-[var(--x-color-surface)] p-5 shadow-[var(--x-shadow-card)]">
              <h2 className="mb-3 text-sm font-semibold text-[var(--x-color-danger)]">答错的题</h2>
              <ul className="space-y-2">
                {wrongAnswers.map((a) => (
                  <li key={a.fingerprint} className="text-sm">
                    <span>{a.display}</span>
                    <span className="text-[var(--x-color-text-secondary)]"> — 你的答案 {a.userAnswer || '（空）'}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-[var(--x-color-accent)] py-3.5 text-[15px] font-medium text-white transition-transform hover:brightness-110 active:scale-[0.99]"
        >
          再来一组
        </button>
        <button
          type="button"
          onClick={onHome}
          className="rounded-full bg-black/5 py-3 text-sm font-medium transition-colors hover:bg-black/10"
        >
          返回设置
        </button>
      </div>
    </div>
  );
}
