import { Suspense, lazy, useState } from 'react';
import { ROUTE_HOME, navigate } from '@/app/routes';

const WordEntryScreen = lazy(() => import('@/features/english/word/WordEntryScreen'));
const SentenceEntryScreen = lazy(() => import('@/features/english/sentence/SentenceEntryScreen'));

type HubView = 'hub' | 'word' | 'sentence';

export default function EnglishHub() {
  const [view, setView] = useState<HubView>('hub');

  if (view === 'word') {
    return (
      <Suspense fallback={<div data-testid="hub-loading" />}>
        <WordEntryScreen onExit={() => setView('hub')} />
      </Suspense>
    );
  }
  if (view === 'sentence') {
    return (
      <Suspense fallback={<div data-testid="hub-loading" />}>
        <SentenceEntryScreen onExit={() => setView('hub')} />
      </Suspense>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--x-color-bg, #f5f5f7)] px-6 py-16" data-testid="english-hub">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          data-testid="back-home"
          onClick={() => navigate(ROUTE_HOME)}
          className="mb-8 text-sm text-[var(--x-color-text-2, #6e6e73)] hover:text-[var(--x-color-text, #1d1d1f)]"
        >
          ← 返回首页
        </button>
        <div className="rounded-[var(--x-radius-lg, 28px)] bg-white/80 p-10 text-center shadow-[var(--x-shadow-card)]">
          <span
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#AF52DE] text-3xl font-bold text-white"
            aria-hidden
          >
            英
          </span>
          <h1 className="text-3xl font-semibold text-[var(--x-color-text, #1d1d1f)]">英语练习</h1>
          <p className="mt-4 text-[var(--x-color-text-2, #6e6e73)]">选择练习类型</p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <button
              type="button"
              data-testid="hub-word"
              onClick={() => setView('word')}
              className="flex-1 rounded-[var(--x-radius-md, 18px)] bg-white p-6 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0071E3] text-lg font-bold text-white">
                词
              </span>
              <span className="block text-lg font-semibold text-[var(--x-color-text, #1d1d1f)]">单词练习</span>
              <span className="mt-1 block text-sm text-[var(--x-color-text-2, #6e6e73)]">
                英译中 / 中译英 / 听写 · 手写 · 打印
              </span>
            </button>
            <button
              type="button"
              data-testid="hub-sentence"
              onClick={() => setView('sentence')}
              className="flex-1 rounded-[var(--x-radius-md, 18px)] bg-white p-6 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#30D158] text-lg font-bold text-white">
                句
              </span>
              <span className="block text-lg font-semibold text-[var(--x-color-text, #1d1d1f)]">语句练习</span>
              <span className="mt-1 block text-sm text-[var(--x-color-text-2, #6e6e73)]">
                英译中 / 中译英 / 跟读 · 句法着色
              </span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
