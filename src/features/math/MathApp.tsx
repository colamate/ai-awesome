import { useState } from 'react';
import ConfigScreen from '@/features/config/ConfigScreen';
import QuizScreen, { type QuizResult } from '@/features/practice/QuizScreen';
import SummaryScreen from '@/features/summary/SummaryScreen';
import MistakesScreen from '@/features/mistakes/MistakesScreen';
import PrintSheet from '@/features/print/PrintSheet';
import { createRepo } from '@/data/repo';
import type { SessionRecord } from '@/data/repo';
import type { PracticeConfig, Question } from '@/core/types';

type View =
  | { name: 'config' }
  | { name: 'quiz'; questions: Question[]; config: PracticeConfig; title: string; startedAt: number; mode: 'normal' | 'mistake' }
  | { name: 'summary'; session: SessionRecord }
  | { name: 'mistakes' }
  | { name: 'print'; questions: Question[] };

export default function MathApp() {
  const [view, setView] = useState<View>({ name: 'config' });
  const [configEpoch, setConfigEpoch] = useState(0);

  const startPractice = (questions: Question[], config: PracticeConfig, title: string, mode: 'normal' | 'mistake') => {
    setView({ name: 'quiz', questions, config, title, startedAt: Date.now(), mode });
  };

  const finishQuiz = (
    result: QuizResult,
    meta: { config: PracticeConfig; title: string; startedAt: number; mode: 'normal' | 'mistake' },
    questions: Question[],
  ) => {
    const repo = createRepo();
    const now = Date.now();
    const session: SessionRecord = {
      id: crypto.randomUUID(),
      startedAt: meta.startedAt,
      endedAt: now,
      mode: meta.mode,
      config: meta.config,
      answers: result.answers,
      totalMs: result.totalMs,
    };
    repo.saveSession(session);
    result.answers.forEach((a, i) => {
      const q = questions[i];
      if (q && !a.correct) repo.addMistake(q, now);
    });
    if (meta.mode === 'normal') repo.saveConfig(meta.config);
    setView({ name: 'summary', session });
  };

  switch (view.name) {
    case 'quiz':
      return (
        <QuizScreen
          questions={view.questions}
          title={view.title}
          onFinish={(result) =>
            finishQuiz(
              result,
              {
                config: view.config,
                title: view.title,
                startedAt: view.startedAt,
                mode: view.mode,
              },
              view.questions,
            )
          }
          onExit={() => setView({ name: 'config' })}
        />
      );
    case 'summary':
      return (
        <SummaryScreen
          session={view.session}
          onRetry={() => setView({ name: 'config' })}
          onMistakes={() => setView({ name: 'mistakes' })}
          onHome={() => setView({ name: 'config' })}
        />
      );
    case 'mistakes':
      return (
        <MistakesScreen
          onStartPractice={(questions, count) => {
            const config: PracticeConfig = { operations: [], questionCount: count, answerMode: 'input' };
            startPractice(questions, config, '易错专项', 'mistake');
          }}
          onBack={() => setView({ name: 'config' })}
        />
      );
    case 'print':
      return <PrintSheet questions={view.questions} onBack={() => setView({ name: 'config' })} />;
    case 'config':
      return (
        <ConfigScreen
          key={configEpoch}
          seenFingerprints={createRepo().getSeenFingerprints()}
          defaultConfig={createRepo().getConfig()}
          onStart={(questions, config) => startPractice(questions, config, '口算练习', 'normal')}
          onPrint={(questions) => setView({ name: 'print', questions })}
          onOpenMistakes={() => setView({ name: 'mistakes' })}
          onClearData={() => {
            createRepo().clearAll();
            setConfigEpoch((e) => e + 1);
          }}
        />
      );
  }
}
