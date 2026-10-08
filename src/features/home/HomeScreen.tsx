import { ROUTE_CHINESE, ROUTE_ENGLISH, ROUTE_MATH, navigate } from '@/app/routes';

interface SubjectCard {
  route: string;
  title: string;
  subtitle: string;
  accent: string;
}

const SUBJECTS: SubjectCard[] = [
  { route: ROUTE_CHINESE, title: '语文', subtitle: '字词 · 句子 · 阅读（即将推出）', accent: 'var(--x-color-red, #FF3B30)' },
  { route: ROUTE_MATH, title: '数学', subtitle: '口算练习 · 易错专项 · 打印练习', accent: 'var(--x-color-blue, #0071E3)' },
  { route: ROUTE_ENGLISH, title: '英语', subtitle: '单词 · 语句 · 听写', accent: 'var(--x-color-purple, #AF52DE)' },
];

export default function HomeScreen() {
  return (
    <main className="min-h-screen bg-[var(--x-color-bg, #f5f5f7)] px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="mb-14 text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-[var(--x-color-text, #1d1d1f)]">
            小学练习
          </h1>
          <p className="mt-4 text-lg text-[var(--x-color-text-2, #6e6e73)]">
            选择科目开始练习
          </p>
        </header>
        <div className="grid gap-6 sm:grid-cols-3" data-testid="subject-grid">
          {SUBJECTS.map((s) => (
            <button
              key={s.route}
              type="button"
              data-testid={`card-${s.title}`}
              onClick={() => navigate(s.route as never)}
              className="x-card group flex flex-col items-start gap-3 rounded-[var(--x-radius-lg, 28px)] bg-white/80 p-8 text-left shadow-[var(--x-shadow-card)] backdrop-blur transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--x-color-blue, #0071E3)]"
            >
              <span
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-white"
                style={{ backgroundColor: s.accent }}
                aria-hidden
              >
                {s.title[0]}
              </span>
              <span className="text-2xl font-semibold text-[var(--x-color-text, #1d1d1f)]">{s.title}</span>
              <span className="text-sm text-[var(--x-color-text-2, #6e6e73)]">{s.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
