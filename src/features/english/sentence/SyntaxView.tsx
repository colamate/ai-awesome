import { getSyntax, type SyntaxToken } from './syntaxData';

export type SyntaxRole = 'subj' | 'pred' | 'obj' | 'adv' | 'attr' | 'adj' | 'other';

const ROLE_CLASS: Record<SyntaxRole, string> = {
  subj: 'bg-sky-100 text-sky-900',
  pred: 'bg-emerald-100 text-emerald-900',
  obj: 'bg-violet-100 text-violet-900',
  adv: 'bg-amber-100 text-amber-900',
  attr: 'bg-rose-100 text-rose-900',
  adj: 'bg-orange-100 text-orange-900',
  other: '',
};

const LEGEND: { role: SyntaxRole; label: string }[] = [
  { role: 'subj', label: '主语' },
  { role: 'pred', label: '谓语' },
  { role: 'obj', label: '宾语' },
  { role: 'adv', label: '状语' },
  { role: 'attr', label: '定语' },
  { role: 'adj', label: '形容词' },
];

function isPunct(token: SyntaxToken): boolean {
  return token.pos === 'PUNCT' || token.dep === 'punct';
}

function roleOf(dep: string, pos: string): SyntaxRole {
  if (dep === 'nsubj' || dep === 'csubj') return 'subj';
  if (dep === 'ROOT' || dep.startsWith('verb') || dep === 'aux') return 'pred';
  if (dep === 'dobj' || dep === 'iobj' || dep === 'obj' || dep === 'pobj') return 'obj';
  if (dep === 'advmod' || dep === 'advcl' || dep === 'npadvmod') return 'adv';
  if (dep === 'amod' || dep === 'poss' || dep === 'compound') return 'attr';
  if (dep === 'acomp' || dep === 'xcomp' || dep === 'apos' || pos === 'ADJ') return 'adj';
  return 'other';
}

interface SyntaxViewProps {
  sentence: string;
}

export default function SyntaxView({ sentence }: SyntaxViewProps) {
  const tokens = getSyntax(sentence);
  if (tokens === null || tokens.length === 0) {
    return (
      <span data-testid="syntax-plain" className="text-[17px] leading-relaxed">
        {sentence}
      </span>
    );
  }
  return (
    <span>
      <span data-testid="syntax-view" className="text-[17px] leading-relaxed">
        {tokens.map((token, i) => {
          const prev = i > 0 ? tokens[i - 1] : undefined;
          const sep = prev !== undefined && !isPunct(prev) && !isPunct(token) ? ' ' : '';
          return (
            <span key={`${token.text}-${i}`}>
              {sep}
              <span data-role={roleOf(token.dep, token.pos)} className={`rounded px-0.5 ${ROLE_CLASS[roleOf(token.dep, token.pos)]}`}>
                {token.text}
              </span>
            </span>
          );
        })}
      </span>
      <span data-testid="syntax-legend" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--x-color-text-secondary)]">
        {LEGEND.map((item) => (
          <span key={item.role} className="inline-flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${ROLE_CLASS[item.role].split(' ')[0]}`} />
            {item.label}
          </span>
        ))}
      </span>
    </span>
  );
}
