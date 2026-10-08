import { useState } from 'react';
import type { AnswerMode, ConvertCategory, OperandRole, PracticeConfig, QuestionCount, RangeTier } from '@/core/types';
import { ConfigError, GenerateError } from '@/core/types';
import { generateSession, validateConfig } from '@/core/generate';
import type { Question } from '@/core/types';

const OPS: { id: 'add' | 'sub' | 'mul' | 'div' | 'convert'; label: string }[] = [
  { id: 'add', label: '加法' },
  { id: 'sub', label: '减法' },
  { id: 'mul', label: '乘法' },
  { id: 'div', label: '除法' },
  { id: 'convert', label: '换算' },
];
const TIERS: RangeTier[] = [10, 20, 50, 100];
const COUNTS: QuestionCount[] = [10, 20, 50];
const CONVERT_LABELS: Record<ConvertCategory, string> = {
  time: '时间',
  length: '长度',
  weight: '重量',
  volume: '体积',
  temperature: '温度',
};
const OPERAND_LABELS: Partial<Record<OperandRole, string>> = {
  minuend: '被减数',
  subtrahend: '减数',
  multiplicand: '被乘数',
  multiplier: '乘数',
  dividend: '被除数',
  divisor: '除数',
};

interface ConfigScreenProps {
  seenFingerprints: string[];
  defaultConfig: PracticeConfig | null;
  onStart: (questions: Question[], config: PracticeConfig) => void;
  onPrint: (questions: Question[], config: PracticeConfig) => void;
  onOpenMistakes: () => void;
  onClearData: () => void;
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export default function ConfigScreen({
  seenFingerprints,
  defaultConfig,
  onStart,
  onPrint,
  onOpenMistakes,
  onClearData,
}: ConfigScreenProps) {
  const [operations, setOperations] = useState<PracticeConfig['operations']>(defaultConfig?.operations ?? ['add']);
  const [rangeTier, setRangeTier] = useState<RangeTier>(defaultConfig?.rangeTier ?? 20);
  const [convertCategories, setConvertCategories] = useState<ConvertCategory[]>(
    defaultConfig?.convertCategories ?? ['time', 'length'],
  );
  const [questionCount, setQuestionCount] = useState<QuestionCount>(defaultConfig?.questionCount ?? 10);
  const [answerMode, setAnswerMode] = useState<AnswerMode>(defaultConfig?.answerMode ?? 'input');
  const [fixed, setFixed] = useState<Partial<Record<OperandRole, string>>>(() => {
    const init: Partial<Record<OperandRole, string>> = {};
    for (const [role, spec] of Object.entries(defaultConfig?.operands ?? {})) {
      if (spec.mode === 'fixed') init[role as OperandRole] = String(spec.fixedValue ?? '');
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);

  const relevantOperands: OperandRole[] = [];
  if (operations.includes('sub')) relevantOperands.push('minuend', 'subtrahend');
  if (operations.includes('mul')) relevantOperands.push('multiplicand', 'multiplier');
  if (operations.includes('div')) relevantOperands.push('dividend', 'divisor');

  const buildConfig = (): PracticeConfig => {
    const operands: PracticeConfig['operands'] = {};
    for (const [role, value] of Object.entries(fixed)) {
      if (value !== undefined && value !== '') {
        operands[role as OperandRole] = { mode: 'fixed', fixedValue: Number(value) };
      }
    }
    const config: PracticeConfig = { operations, questionCount, answerMode };
    if (operations.includes('add') || operations.includes('sub')) config.rangeTier = rangeTier;
    if (operations.includes('convert')) config.convertCategories = convertCategories;
    if (relevantOperands.length > 0) config.operands = operands;
    return config;
  };

  const tryGenerate = (): { questions: Question[]; config: PracticeConfig } | null => {
    setError(null);
    try {
      const config = buildConfig();
      validateConfig(config);
      return { questions: generateSession(config, { seenFingerprints }), config };
    } catch (e) {
      if (e instanceof ConfigError || e instanceof GenerateError) setError(e.message);
      else setError('生成题目失败，请调整设置');
      return null;
    }
  };

  const handleStart = () => {
    const generated = tryGenerate();
    if (generated) onStart(generated.questions, generated.config);
  };

  const handlePrint = () => {
    const generated = tryGenerate();
    if (generated) onPrint(generated.questions, generated.config);
  };

  const handleClearData = () => {
    if (window.confirm('确定清空全部本地数据？练习记录、易错题和设置将无法恢复。')) {
      onClearData();
    }
  };

  const chip = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
      active
        ? 'bg-[var(--x-color-accent)] text-white shadow-sm'
        : 'bg-black/5 text-[var(--x-color-text)] hover:bg-black/10'
    }`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10" data-testid="config">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">数学口算</h1>
          <p className="mt-1 text-sm text-[var(--x-color-text-secondary)]">设置出题范围，开始练习</p>
        </div>
        <button
          type="button"
          onClick={onOpenMistakes}
          className="rounded-full bg-[var(--x-color-warning)]/15 px-4 py-2 text-sm font-medium text-[var(--x-color-warning)] transition-colors hover:bg-[var(--x-color-warning)]/25"
        >
          易错题
        </button>
      </header>

      <div className="space-y-6 rounded-[var(--x-radius-lg)] bg-[var(--x-color-surface)] p-6 shadow-[var(--x-shadow-card)]">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--x-color-text-secondary)]">运算类型（可多选）</h2>
          <div className="flex flex-wrap gap-2" data-testid="ops">
            {OPS.map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setOperations((ops) => toggle(ops, op.id))}
                className={chip(operations.includes(op.id))}
              >
                {op.label}
              </button>
            ))}
          </div>
        </section>

        {(operations.includes('add') || operations.includes('sub')) && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-[var(--x-color-text-secondary)]">范围档位</h2>
            <div className="flex flex-wrap gap-2" data-testid="tiers">
              {TIERS.map((tier) => (
                <button key={tier} type="button" onClick={() => setRangeTier(tier)} className={chip(rangeTier === tier)}>
                  {tier} 以内
                </button>
              ))}
            </div>
          </section>
        )}

        {operations.includes('convert') && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-[var(--x-color-text-secondary)]">换算类别（可多选）</h2>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CONVERT_LABELS) as ConvertCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setConvertCategories((cats) => toggle(cats, cat))}
                  className={chip(convertCategories.includes(cat))}
                >
                  {CONVERT_LABELS[cat]}
                </button>
              ))}
            </div>
          </section>
        )}

        {relevantOperands.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-[var(--x-color-text-secondary)]">
              操作数（留空为随机，填数则整场固定）
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {relevantOperands.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <span className="w-14 shrink-0 text-[var(--x-color-text-secondary)]">{OPERAND_LABELS[role]}</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="随机"
                    value={fixed[role] ?? ''}
                    onChange={(e) =>
                      setFixed((f) => ({ ...f, [role]: e.target.value.replace(/[^\d]/g, '') }))
                    }
                    className="w-full rounded-[var(--x-radius-sm)] border border-black/10 bg-white px-2 py-1.5 text-center tabular-nums outline-none transition-colors focus:border-[var(--x-color-accent)]"
                  />
                </label>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--x-color-text-secondary)]">题数</h2>
          <div className="flex gap-2" data-testid="counts">
            {COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setQuestionCount(count)}
                className={chip(questionCount === count)}
              >
                {count} 道
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--x-color-text-secondary)]">答题方式</h2>
          <div className="flex gap-2" data-testid="modes">
            <button type="button" onClick={() => setAnswerMode('input')} className={chip(answerMode === 'input')}>
              输入答案
            </button>
            <button type="button" onClick={() => setAnswerMode('choice4')} className={chip(answerMode === 'choice4')}>
              四选一
            </button>
          </div>
        </section>

        {error && (
          <p className="rounded-[var(--x-radius-sm)] bg-[var(--x-color-danger)]/10 px-3 py-2 text-sm text-[var(--x-color-danger)]" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleStart}
          className="w-full rounded-full bg-[var(--x-color-accent)] py-3.5 text-[15px] font-medium text-white transition-transform hover:brightness-110 active:scale-[0.99]"
          data-testid="start"
        >
          开始练习
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="w-full rounded-full bg-black/5 py-3 text-sm font-medium transition-colors hover:bg-black/10"
          data-testid="print"
        >
          生成打印试卷
        </button>
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleClearData}
          className="text-xs text-[var(--x-color-text-secondary)] transition-colors hover:text-[var(--x-color-danger)]"
          data-testid="clear-data"
        >
          清空本地数据
        </button>
      </div>
    </div>
  );
}
