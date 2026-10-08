export interface QuestionTime {
  fingerprint: string;
  display: string;
  elapsedMs: number;
  correct: boolean;
}

export interface TimeAnalysis {
  totalMs: number;
  avgMs: number;
  slowest: QuestionTime | null;
  fastest: QuestionTime | null;
  perQuestion: QuestionTime[];
}

/** 耗时分析 (FR-MATH-12 / Q-06)：每题耗时列表 + 最慢/最快 + 平均。结构化入参（AnswerRecord / EngAnswerRecord 均可传入） */
export function analyzeTimes(
  answers: readonly { fingerprint: string; display: string; elapsedMs: number; correct: boolean }[],
): TimeAnalysis {
  const perQuestion = answers.map((a) => ({
    fingerprint: a.fingerprint,
    display: a.display,
    elapsedMs: a.elapsedMs,
    correct: a.correct,
  }));
  if (perQuestion.length === 0) {
    return { totalMs: 0, avgMs: 0, slowest: null, fastest: null, perQuestion };
  }
  const totalMs = perQuestion.reduce((sum, q) => sum + q.elapsedMs, 0);
  const slowest = perQuestion.reduce((max, q) => (q.elapsedMs > max.elapsedMs ? q : max));
  const fastest = perQuestion.reduce((min, q) => (q.elapsedMs < min.elapsedMs ? q : min));
  return {
    totalMs,
    avgMs: Math.round(totalMs / perQuestion.length),
    slowest,
    fastest,
    perQuestion,
  };
}

export function formatMs(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} 秒`;
  return `${minutes} 分 ${seconds.toString().padStart(2, '0')} 秒`;
}
