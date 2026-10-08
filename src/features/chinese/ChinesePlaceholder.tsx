import { ROUTE_HOME, navigate } from '@/app/routes';

export default function ChinesePlaceholder() {
  return (
    <main className="min-h-screen bg-[var(--x-color-bg, #f5f5f7)] px-6 py-16" data-testid="chinese-placeholder">
      <div className="mx-auto max-w-3xl rounded-[var(--x-radius-lg, 28px)] bg-white/80 p-10 text-center shadow-[var(--x-shadow-card)]">
        <span
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF3B30] text-3xl font-bold text-white"
          aria-hidden
        >
          语
        </span>
        <h1 className="text-3xl font-semibold text-[var(--x-color-text, #1d1d1f)]">语文练习</h1>
        <p className="mt-4 text-[var(--x-color-text-2, #6e6e73)]">
          即将推出（Phase 3）——字词听写、句子练习将接入此处。
        </p>
        <button
          type="button"
          onClick={() => navigate(ROUTE_HOME)}
          className="mt-8 rounded-full bg-[#0071E3] px-7 py-3 font-medium text-white transition-opacity hover:opacity-90"
        >
          返回首页
        </button>
      </div>
    </main>
  );
}
