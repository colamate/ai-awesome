import { useState } from 'react';
import { createRepo, type MistakeEntry } from '@/data/repo';
import type { Question } from '@/core/types';

interface MistakesScreenProps {
  onStartPractice: (questions: Question[], count: 10 | 20 | 50) => void;
  onBack: () => void;
}

export default function MistakesScreen({ onStartPractice, onBack }: MistakesScreenProps) {
  const [entries, setEntries] = useState<MistakeEntry[]>(() => createRepo().listMistakes());
  const [count, setCount] = useState<10 | 20 | 50>(10);

  const remove = (fingerprint: string) => {
    const repo = createRepo();
    repo.removeMistake(fingerprint);
    setEntries(repo.listMistakes());
  };

  const start = () => {
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    onStartPractice(shuffled.slice(0, count).map((e) => e.question), count);
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10" data-testid="mistakes">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">易错题</h1>
          <p className="mt-1 text-sm text-[var(--x-color-text-secondary)]">答错的题会自动收集到这里</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-3 py-1 text-sm text-[var(--x-color-text-secondary)] transition-colors hover:bg-black/5"
        >
          返回
        </button>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-[var(--x-radius-lg)] bg-[var(--x-color-surface)] p-8 text-center text-sm text-[var(--x-color-text-secondary)] shadow-[var(--x-shadow-card)]">
          暂无易错题，先去练习吧
        </p>
      ) : (
        <>
          <ul className="mb-6 divide-y divide-black/5 rounded-[var(--x-radius-lg)] bg-[var(--x-color-surface)] px-5 shadow-[var(--x-shadow-card)]">
            {entries.map((e) => (
              <li key={e.fingerprint} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] tabular-nums">{e.question.display}</p>
                  <p className="mt-0.5 text-xs text-[var(--x-color-text-secondary)]">错 {e.wrongCount} 次</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(e.fingerprint)}
                  className="no-print shrink-0 rounded-full px-3 py-1 text-xs text-[var(--x-color-text-secondary)] transition-colors hover:bg-black/5"
                >
                  移除
                </button>
              </li>
            ))}
          </ul>

          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-[var(--x-color-text-secondary)]">共 {entries.length} 题</span>
            <div className="flex gap-2">
              {([10, 20, 50] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    count === n
                      ? 'bg-[var(--x-color-accent)] text-white'
                      : 'bg-black/5 text-[var(--x-color-text)] hover:bg-black/10'
                  }`}
                >
                  {n} 题
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={start}
            className="w-full rounded-full bg-[var(--x-color-accent)] py-3.5 text-[15px] font-medium text-white transition-transform hover:brightness-110 active:scale-[0.99]"
            data-testid="start-mistakes"
          >
            开始易错练习（最多 {Math.min(count, entries.length)} 题）
          </button>
        </>
      )}
    </div>
  );
}
