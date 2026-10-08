import { useState } from 'react';
import WordConfigScreen from './WordConfigScreen';
import WordQuizScreen, { type WordQuizResult } from './WordQuizScreen';
import WordSummaryScreen from './WordSummaryScreen';
import WordMistakesScreen from './WordMistakesScreen';
import WordPrintSheet from './WordPrintSheet';
import { EMPTY_FILTER, loadEnglishTextbook, type EnglishTextbook } from '@/data/textbooks';
import { createEngRepo, type EngSessionRecord } from '@/data/englishRepo';
import type { EngAnswerMode, EngPracticeConfig, EngQuestion, WordMode } from '@/core/english';

function wordModeOf(q: EngQuestion | undefined): WordMode {
  const m = q?.fingerprint.split(':')[1];
  return m === 'zh2en' || m === 'dictation' ? m : 'en2zh';
}

type View =
  | { name: 'config' }
  | { name: 'quiz'; questions: EngQuestion[]; config: EngPracticeConfig; title: string; startedAt: number; mode: 'normal' | 'mistake' }
  | { name: 'summary'; session: EngSessionRecord }
  | { name: 'mistakes' }
  | { name: 'print'; questions: EngQuestion[] };

interface WordEntryScreenProps {
  onExit: () => void;
}

export default function WordEntryScreen({ onExit }: WordEntryScreenProps) {
  const [view, setView] = useState<View>({ name: 'config' });
  const [configEpoch, setConfigEpoch] = useState(0);
  const [tb] = useState<EnglishTextbook>(() => loadEnglishTextbook());

  const startPractice = (questions: EngQuestion[], config: EngPracticeConfig, title: string, mode: 'normal' | 'mistake') => {
    setView({ name: 'quiz', questions, config, title, startedAt: Date.now(), mode });
  };

  const finishQuiz = (
    result: WordQuizResult,
    meta: { config: EngPracticeConfig; title: string; startedAt: number; mode: 'normal' | 'mistake' },
    questions: EngQuestion[],
  ) => {
    const repo = createEngRepo();
    const now = Date.now();
    const session: EngSessionRecord = {
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

  const content = (() => {
    switch (view.name) {
      case 'quiz':
        return (
          <WordQuizScreen
            questions={view.questions}
            title={view.title}
            answerMode={view.config.answerMode}
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
          <WordSummaryScreen
            session={view.session}
            onRetry={() => setView({ name: 'config' })}
            onMistakes={() => setView({ name: 'mistakes' })}
            onHome={() => setView({ name: 'config' })}
          />
        );
      case 'mistakes':
        return (
          <WordMistakesScreen
            onStartPractice={(questions, count) => {
              const answerMode: EngAnswerMode = questions.some((q) => q.choices) ? 'choice4' : 'input';
              const config: EngPracticeConfig = {
                kind: 'word',
                filter: EMPTY_FILTER,
                wordMode: wordModeOf(questions[0]),
                answerMode,
                questionCount: count,
              };
              startPractice(questions, config, '易错专项', 'mistake');
            }}
            onBack={() => setView({ name: 'config' })}
          />
        );
      case 'print':
        return <WordPrintSheet questions={view.questions} onBack={() => setView({ name: 'config' })} />;
      case 'config':
        return (
          <WordConfigScreen
            key={configEpoch}
            tb={tb}
            seenFingerprints={createEngRepo().getSeenFingerprints()}
            defaultConfig={createEngRepo().getConfig()}
            onStart={(questions, config) => startPractice(questions, config, '单词练习', 'normal')}
            onPrint={(questions) => setView({ name: 'print', questions })}
            onOpenMistakes={() => setView({ name: 'mistakes' })}
            onExit={onExit}
            onClearData={() => {
              createEngRepo().clearEngData();
              setConfigEpoch((e) => e + 1);
            }}
          />
        );
    }
  })();

  return <div data-testid="english-word">{content}</div>;
}
