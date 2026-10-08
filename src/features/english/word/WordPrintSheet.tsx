import { useState } from 'react';
import type { EngQuestion } from '@/core/english';
import { isZhAnswer } from '@/core/english';

interface WordPrintSheetProps {
  questions: EngQuestion[];
  onBack: () => void;
}

export default function WordPrintSheet({ questions, onBack }: WordPrintSheetProps) {
  const [showAnswers, setShowAnswers] = useState(false);
  const [date] = useState(() => new Date().toISOString().slice(0, 10));

  const promptOf = (q: EngQuestion): string => (q.display !== '' ? q.display : q.answerDisplay.zh);
  const answerOf = (q: EngQuestion): string => {
    const ipa = !isZhAnswer(q.answer) && q.answerDisplay.ipa !== undefined ? ` ${q.answerDisplay.ipa}` : '';
    return `${q.answer}${ipa}`;
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="no-print mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-3 py-1 text-sm text-[var(--x-color-text-secondary)] transition-colors hover:bg-black/5"
        >
          返回
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAnswers((v) => !v)}
            className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/10"
          >
            {showAnswers ? '不含答案' : '含答案'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-[var(--x-color-accent)] px-5 py-2 text-sm font-medium text-white transition-transform active:scale-95"
          >
            打印
          </button>
        </div>
      </div>

      <div className="print-sheet bg-white p-10 text-black" data-testid="print-sheet">
        <header className="mb-6 border-b-2 border-black pb-3">
          <h1 className="text-xl font-bold">英语单词练习</h1>
          <p className="mt-1 text-sm">
            日期：{date} ｜ 共 {questions.length} 题 ｜ {showAnswers ? '含答案' : '不含答案'}
          </p>
        </header>

        <ol className="space-y-3">
          {questions.map((q, i) => (
            <li key={q.fingerprint} className="flex items-baseline justify-between border-b border-dotted border-black/30 pb-1 text-[15px]">
              <span>
                {i + 1}. {promptOf(q)}
              </span>
              {showAnswers && <span className="font-semibold">{answerOf(q)}</span>}
            </li>
          ))}
        </ol>

        {showAnswers && (
          <footer className="mt-8 border-t border-black/30 pt-3 text-xs text-black/60">
            答案与题号对应，供家长核对。
          </footer>
        )}
      </div>
    </div>
  );
}
