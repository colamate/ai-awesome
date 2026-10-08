import type { EngSessionRecord } from '@/data/englishRepo';
import { analyzeTimes, formatMs } from '@/features/summary/timeAnalysis';

interface WordSummaryScreenProps {
  session: EngSessionRecord;
  onRetry: () => void;
  onMistakes: () => void;
  onHome: () => void;
}

export default function WordSummaryScreen({ session, onRetry, onMistakes, onHome }: WordSummaryScreenProps) {
  const analysis = analyzeTimes(session.answers);
  const correctCount = session.answers.filter((a) => a.correct).length;
  const total = session.answers.length;
  const accuracy = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  const wrongAnswers = session.answers.filter((a) => !a.correct);

  const stat = (label: string, value: string) => (
    <div className="flex-1 rounded-[var(--x-radius-md)] bg-[var(--x-color-bg)] px-4 py-3 text-center">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-[var(--x-color-text-secondary)]">{label}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-10" data-testid="summary">
      <header className="mb-8 text-center">
        <p className="text-5xl font-semibold tracking-tight">{accuracy}%</p>
        <p className="mt-1 text-sm text-[var(--x-color-text-secondary)]">
          共 {total} 题，答对 {correctCount} 题
        </p>
      </header>

      <div className="mb-4 flex gap-3">
        {stat('总用时', formatMs(analysis.totalMs))}
        {stat('平均每题', formatMs(analysis.avgMs))}
      </div>
      <div className="mb-6 flex gap-3">
        {stat('最慢', analysis.slowest ? formatMs(analysis.slowest.elapsedMs) : '—')}
        {stat('最快', analysis.fastest ? formatMs(analysis.fastest.elapsedMs) : '—')}
      </div>

      <section className="mb-6 rounded-[var(--x-radius-lg)] bg-[var(--x-color-surface)] p-5 shadow-[var(--x-shadow-card)]">
        <h2 className="mb-3 text-sm font-semibold text-[var(--x-color-text-secondary)]">每题用时</h2>
        <ul className="space-y-1.5">
          {analysis.perQuestion.map((q, i) => (
            <li key={q.fingerprint} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${q.correct ? 'bg-[var(--x-color-success)]' : 'bg-[var(--x-color-danger)]'}`}
                />
                <span className="tabular-nums text-[var(--x-color-text-secondary)]">{i + 1}.</span>
                <span className="tabular-nums">{q.display}</span>
              </span>
              <span className="tabular-nums text-[var(--x-color-text-secondary)]">{formatMs(q.elapsedMs)}</span>
            </li>
          ))}
        </ul>
      </section>

      {wrongAnswers.length > 0 && (
        <section className="mb-6 rounded-[var(--x-radius-lg)] bg-[var(--x-color-surface)] p-5 shadow-[var(--x-shadow-card)]">
          <h2 className="mb-3 text-sm font-semibold text-[var(--x-color-danger)]">答错的题（已加入易错题）</h2>
          <ul className="space-y-2">
            {wrongAnswers.map((a) => (
              <li key={a.fingerprint} className="text-sm">
                <span className="tabular-nums">{a.display}</span>
                <span className="text-[var(--x-color-text-secondary)]">
                  {' '}
                  — 你的答案 {a.userAnswer || '（空）'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-[var(--x-color-accent)] py-3.5 text-[15px] font-medium text-white transition-transform hover:brightness-110 active:scale-[0.99]"
        >
          再来一组
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onMistakes}
            className="flex-1 rounded-full bg-black/5 py-3 text-sm font-medium transition-colors hover:bg-black/10"
          >
            易错题专项
          </button>
          <button
            type="button"
            onClick={onHome}
            className="flex-1 rounded-full bg-black/5 py-3 text-sm font-medium transition-colors hover:bg-black/10"
          >
            返回设置
          </button>
        </div>
      </div>
    </div>
  );
}
