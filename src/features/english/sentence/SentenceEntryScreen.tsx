import { useState } from 'react';
import SentenceConfigScreen from './SentenceConfigScreen';
import SentenceQuizScreen, { type SentenceQuizResult } from './SentenceQuizScreen';
import SentenceSummaryScreen from './SentenceSummaryScreen';
import { loadEnglishTextbook, type EnglishTextbook } from '@/data/textbooks';
import { createEngRepo, type EngSessionRecord } from '@/data/englishRepo';
import type { EngPracticeConfig, EngQuestion } from '@/core/english';

type View =
  | { name: 'config' }
  | { name: 'quiz'; questions: EngQuestion[]; config: EngPracticeConfig; startedAt: number }
  | { name: 'summary'; session: EngSessionRecord | null; review: EngQuestion[] };

interface SentenceEntryScreenProps {
  onExit: () => void;
}

export default function SentenceEntryScreen({ onExit }: SentenceEntryScreenProps) {
  const [view, setView] = useState<View>({ name: 'config' });
  const [tb] = useState<EnglishTextbook>(() => loadEnglishTextbook());

  const startPractice = (questions: EngQuestion[], config: EngPracticeConfig) => {
    setView({ name: 'quiz', questions, config, startedAt: Date.now() });
  };

  const finishQuiz = (
    result: SentenceQuizResult,
    meta: { config: EngPracticeConfig; startedAt: number },
    questions: EngQuestion[],
  ) => {
    const repo = createEngRepo();
    const readAlong = meta.config.sentenceMode === 'readAlong';
    if (!readAlong) repo.saveConfig(meta.config);
    if (readAlong) {
      setView({ name: 'summary', session: null, review: questions });
      return;
    }
    const session: EngSessionRecord = {
      id: crypto.randomUUID(),
      startedAt: meta.startedAt,
      endedAt: Date.now(),
      mode: 'normal',
      config: meta.config,
      answers: result.answers,
      totalMs: result.totalMs,
    };
    repo.saveSession(session);
    setView({ name: 'summary', session, review: questions });
  };

  const content = (() => {
    switch (view.name) {
      case 'quiz':
        return (
          <SentenceQuizScreen
            questions={view.questions}
            title="语句练习"
            sentenceMode={view.config.sentenceMode ?? 'en2zh'}
            onFinish={(result) => finishQuiz(result, { config: view.config, startedAt: view.startedAt }, view.questions)}
            onExit={() => setView({ name: 'config' })}
          />
        );
      case 'summary':
        return (
          <SentenceSummaryScreen
            session={view.session}
            review={view.review}
            onRetry={() => setView({ name: 'config' })}
            onHome={() => setView({ name: 'config' })}
          />
        );
      case 'config':
        return (
          <SentenceConfigScreen
            tb={tb}
            seenFingerprints={createEngRepo().getSeenFingerprints()}
            defaultConfig={createEngRepo().getConfig()}
            onStart={startPractice}
            onExit={onExit}
          />
        );
    }
  })();

  return <div data-testid="english-sentence">{content}</div>;
}
