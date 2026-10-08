# Phase 2 首页 + 英语练习 — 开发计划

> 来源：`docs/requirements.md` §5A（PRD，验收以 FR-ENG-* / FR-HOME-* 为准）。本文件是并行实现的共享 SSOT：**契约与文件归属以本文为准，跨单元签名不可擅自变更**。

## 0. 技术决策（在 001 基础上新增）

| 层 | 选型 | 许可 | 说明 |
|----|------|------|------|
| 路由 | 自研 hash 路由（`hashchange` 监听） | — | 不引入 react-router，零新增路由依赖 |
| TTS | 预生成标准音频（edge-tts → `public/audio/`）优先，Web Speech API 兜底 | edge-tts (MIT) / 浏览器原生 | D4 修订：发音标准优先，零运行时依赖 |
| OCR | tesseract.js（懒加载） | Apache-2.0 / MIT | Q-ENG-02；语言资产本地化到 `public/ocr/`，离线可用，失败降级键盘输入 |
| 音标 | 构建期脚本增强（CMU 发音词典 ARPAbet→IPA） | CMU dict BSD-like | Q-ENG-01，运行时零依赖 |
| 句法 | 构建期 Python + spaCy 预计算 JSON | MIT | Q-ENG-03，运行时纯前端；spaCy 缺失时脚本优雅跳过 |
| 数据导入 | `import` JSON（`resolveJsonModule`） | — | 英语屏动态加载（`React.lazy`），首页/数学不携带英语数据 chunk |

**不引入**：后端、Python 运行时服务、react-router、任何付费/遥测服务。

## 1. 目录结构与文件归属（写文件前必读 — 避免并行冲突）

```
src/
  App.tsx                       # [WU-HOME] 路由壳（hash router）
  app/
    routes.ts                   # [WU-HOME] 路由常量 + useHashRoute()
  features/
    home/HomeScreen.tsx         # [WU-HOME] 首页（三科卡片）
    chinese/ChinesePlaceholder.tsx # [WU-HOME] 语文占位页
    english/
      EnglishHub.tsx            # [WU-HOME] 英语模块首页（两个入口卡）
      word/                     # [WU-ENG-WORD] 单词练习（自包含）
        WordEntryScreen.tsx     #   入口组件（契约 §2.7）
        WordConfigScreen.tsx    #   筛选/模式/答题方式/题数
        WordQuizScreen.tsx      #   答题流程（计时/feedback/判题）
        WordSummaryScreen.tsx   #   结果+耗时分析
        WordMistakesScreen.tsx  #   易错收藏+专项
        WordPrintSheet.tsx      #   A4 打印
        handwriting/HandwritingPad.tsx # Canvas 手写 + OCR
        __tests__/
      sentence/                 # [WU-ENG-SENT] 语句练习（自包含）
        SentenceEntryScreen.tsx #   入口组件（契约 §2.7）
        SentenceConfigScreen.tsx
        SentenceQuizScreen.tsx  #   互译判题 + 跟读模式 + 对照
        SyntaxView.tsx          #   句法着色渲染
        __tests__/
  core/
    (math 既有文件 — 任何单元不得修改)
    english/                    # [WU-ENG-ENGINE] 纯 TS，零 React
      types.ts                  #   领域类型（契约 §2.2）
      generate.ts               #   generateEngSession()
      judge.ts                  #   judgeEng() + 归一化
      tts.ts                    #   Web Speech 封装（契约 §2.4）
      __tests__/
  data/
    repo.ts                     # (math 既有) 不得修改
    englishRepo.ts              # [WU-ENG-ENGINE] 英语持久化（契约 §2.5）
    textbooks.ts                # [WU-ENG-ENGINE] 英语数据加载 + buildPool()
    __tests__/
scripts/
  build_textbooks.py            # (既有) 不得修改
  ipa_enrich.py                 # [WU-ENG-IPA] 音标增强
  build_syntax.py               # [WU-ENG-SENT] 句法预计算（Python）
data/
  textbooks.json                # ipa_enrich.py 追加 ipa 字段（唯一允许改动方：WU-ENG-IPA）
  syntax-en.json                # build_syntax.py 输出（WU-ENG-SENT）
tests/
  app.test.tsx / flow.test.tsx  # [WU-HOME] 更新为路由感知（见 §4）
```

**冲突铁律**：
- `src/App.tsx` 仅 WU-HOME 写；其余单元通过 §2.7 入口组件契约接入，集成由收尾阶段完成。
- `src/core/types.ts`、`src/data/repo.ts`、数学 features、`src/core/generate.ts` 等数学文件**只读**。
- 每个单元只写自己目录 + §中明确归属的文件；`tsconfig.json` 仅 WU-ENG-ENGINE 允许加 `resolveJsonModule` 一行。

## 2. 契约（签名不可擅自变更）

### 2.1 路由（WU-HOME 内部，供集成理解）

| hash | 视图 |
|------|------|
| `#/`（默认） | 首页 HomeScreen |
| `#/math` | 现有数学 App（原 App.tsx 状态机原样迁移为 `MathApp`，行为零变化） |
| `#/english` | EnglishHub |
| `#/chinese` | 语文占位页 |

- `useHashRoute()`：读 `location.hash`，订阅 `hashchange`，未知 hash → `#/`。
- 浏览器前进/后退可用；`<a href="#/...">` 或 `location.hash = ...` 导航。

### 2.2 英语引擎类型 `src/core/english/types.ts`

```ts
export type EngKind = 'word' | 'sentence';
export type WordMode = 'en2zh' | 'zh2en' | 'dictation';
export type SentenceMode = 'en2zh' | 'zh2en' | 'readAlong';
export type EngAnswerMode = 'choice4' | 'input' | 'handwriting'; // handwriting 仅 word
export type QuestionCount = 10 | 20 | 50;

export interface EngFilter {
  grades: number[];   // [1,2] 子集
  volumes: number[];  // [1,2] 子集（1=上册 2=下册）
  units: number[];    // [1..6] 子集
}

export interface EngPracticeConfig {
  kind: EngKind;
  filter: EngFilter;
  wordMode?: WordMode;         // kind='word' 必填
  sentenceMode?: SentenceMode; // kind='sentence' 必填
  answerMode: EngAnswerMode;   // word 可三选；sentence 仅 'input' | 'choice4'
  questionCount: QuestionCount;
}

export interface EngAnswerDisplay {
  en: string;
  zh: string;
  zhNote?: string;
  ipa?: string;
}

export interface EngQuestion {
  fingerprint: string;         // 稳定去重键：kind + mode + 规范化题面 + 答案
  kind: EngKind;
  display: string;             // 题面（听写模式为 ''）
  ttsText?: string;            // 需 TTS 朗读的英文（dictation / readAlong 必填）
  answer: string;              // 标准答案（归一化后比对）
  answerDisplay: EngAnswerDisplay;
  hint: string;                // 答错提示（中英对照，见 §5）
  choices?: string[];          // choice4：含正确项、乱序、恰 4 个（池 <4 抛错）
  syntaxKey?: string;          // sentence：data/syntax-en.json 的键（原句 en）
}

export interface EngGenerateOptions {
  seenFingerprints?: string[]; // 跨练习历史，优先未做过的
  random?: () => number;       // 注入随机源 [0,1)，测试用
}

export class EngConfigError extends Error { override readonly name = 'EngConfigError' }
export class EngGenerateError extends Error { override readonly name = 'EngGenerateError' }
```

### 2.3 数据加载 `src/data/textbooks.ts` 与生成 `src/core/english/generate.ts`

```ts
// textbooks.ts — 数据结构与 data/textbooks.json english 节点一致
export interface PoolWord {
  en: string; zh: string; unverified?: boolean; ipa?: string;
  grade: number; volume: number; unit: number; unitTitle: string;
}
export interface PoolSentence {
  en: string; zh: string; zhNote?: string; source?: string;
  grade: number; volume: number; unit: number; unitTitle: string;
}
export interface EngPool { words: PoolWord[]; sentences: PoolSentence[]; unitTitles: Map<string, string> }

export function loadEnglishTextbook(): EnglishTextbook;   // 静态 import JSON
export function buildPool(tb: EnglishTextbook, filter: EngFilter): EngPool; // 空数组=无命中
export function countPool(tb: EnglishTextbook, filter: EngFilter): { words: number; sentences: number };

// generate.ts — 纯函数，不做 IO
export function generateEngSession(
  config: EngPracticeConfig, pool: EngPool, opts?: EngGenerateOptions,
): EngQuestion[];

export function questionCountFor(selected: QuestionCount, poolSize: number): number; // min + UI 用
```

生成规则：
- **word / en2zh**：题面=en，答案=zh；**zh2en**：题面=zh，答案=en；**dictation**：`display=''`，`ttsText=answer=en`。
- **sentence / en2zh、zh2en** 同理；**readAlong**：`ttsText=en`，`answer=en`（不计分模式，UI 不落库，见 §5-D6）。
- choice4 干扰项：同 kind、同方向、来自同一 pool 的**其它条目**（优先同单元），恰 3 个干扰项；`pool.length < 4` → 抛 `EngConfigError`。
- 实际题数 = `min(questionCount, poolSize)`；poolSize=0 → 抛 `EngConfigError`。
- 单次生成 fingerprint 严格唯一；`seenFingerprints` 存在时优先未见题目，穷尽则复用。
- random 缺省用 `Math.random`。

### 2.4 判题 `src/core/english/judge.ts` 与 TTS `src/core/english/tts.ts`

```ts
// judge.ts
/** 归一化：trim、压缩空白、全半角、英文转小写、弯引号→直引号、去首尾标点 */
export function normalizeEn(s: string): string;
/** 中文归一化：trim、去空白、去中英文标点 */
export function normalizeZh(s: string): string;
/**
 * 判题（Q-ENG-05）：
 * - 英文作答（答案为 en）：normalizeEn 全等
 * - 中文作答（答案为 zh）：normalizeZh 全等，或与答案按 ，,、；/ 分段之一全等
 */
export function judgeEng(q: EngQuestion, input: string): boolean;

// tts.ts — Web Speech 封装
export interface SpeakOptions { rate?: number; lang?: string } // 默认 rate 0.9, lang 'en-US'
export function speak(text: string, opts?: SpeakOptions): Promise<void>; // 含排队去重（新调用取消旧的）
export function cancelSpeak(): void;
export function isTtsSupported(): boolean;
```

### 2.5 持久化 `src/data/englishRepo.ts`（键前缀 `xstudy:v1:eng:*`，Q-ENG-09）

```ts
export interface EngAnswerRecord {
  fingerprint: string; display: string; kind: EngKind;
  userAnswer: string; correct: boolean; elapsedMs: number;
}
export interface EngSessionRecord {
  id: string; startedAt: number; endedAt: number;
  mode: 'normal' | 'mistake';
  config: EngPracticeConfig;
  answers: EngAnswerRecord[];
  totalMs: number;             // 切后台暂停已扣除
}
export interface EngMistakeEntry {
  fingerprint: string;
  question: EngQuestion;       // 快照（JSON 可序列化）
  wrongCount: number; firstWrongAt: number; lastWrongAt: number;
}
export interface EngRepo {
  getConfig(): (EngPracticeConfig & { updatedAt: number }) | null;
  saveConfig(c: EngPracticeConfig): void;
  listSessions(): EngSessionRecord[];
  saveSession(s: EngSessionRecord): void;
  listMistakes(): EngMistakeEntry[];
  addMistake(q: EngQuestion, at: number): void;  // 已存在 wrongCount+1
  removeMistake(fingerprint: string): void;
  getSeenFingerprints(): string[];
  clearEngData(): void;
}
export function createEngRepo(storage?: Storage): EngRepo;
```

镜像 `src/data/repo.ts` 的实现风格（readJson/writeJson/上限 200 条）；**不得修改** `repo.ts`。

### 2.6 句法标注 `data/syntax-en.json`（WU-ENG-SENT 产出）

```jsonc
{
  "Hello! / Hi!": {
    "tokens": [
      { "text": "Hello", "pos": "INTJ", "dep": "intj", "head": 0 },
      { "text": "!", "pos": "PUNCT", "dep": "punct", "head": 0 }
    ]
  }
}
```
- 键 = 句子 `en` 原文；值含 tokens（spaCy `token.text/pos/dep/head`）。
- `scripts/build_syntax.py`：读 `data/textbooks.json` english sentences → spaCy `en_core_web_sm` → 写 JSON。
- **优雅降级**：spaCy 未安装/模型缺失 → 打印警告、生成 `{"_skipped": true}` 并 exit 0；此时前端按"无标注"降级渲染。
- 前端 dep→成分映射（SentenceQuizScreen/SyntaxView 内）：`nsubj/csubj`→主语；`ROOT`与动词性 dep（`verb*`/`aux`）→谓语；`dobj/iobj/obj/pobj`→宾语；`advmod/advcl/npadvmod`→状语；`amod/poss/compound`→定语；`acomp/xcomp/apos`/形容词 pos→形容词；其余→默认色。

### 2.7 入口组件契约（集成期接线用）

```ts
// src/features/english/word/WordEntryScreen.tsx（WU-ENG-WORD 交付）
export default function WordEntryScreen(props: { onExit: () => void }): JSX.Element;
// 内部自包含：Config → Quiz → Summary / Mistakes / Print 全流程；onExit 返回英语首页

// src/features/english/sentence/SentenceEntryScreen.tsx（WU-ENG-SENT 交付）
export default function SentenceEntryScreen(props: { onExit: () => void }): JSX.Element;
// 内部自包含：Config → Quiz(互译/跟读) → Summary；onExit 返回英语首页
```

WU-HOME 交付的 `EnglishHub.tsx` 先以占位面板实现两卡入口（标注"开发中"），集成阶段替换为上述两个真实组件（`React.lazy` + `Suspense`，保证英语数据 chunk 懒加载）。

## 3. 工作单元（WU）与波次

| WU | 内容 | 覆盖 FR | 归属目录 | 波次 |
|----|------|---------|----------|------|
| WU-HOME | hash 路由壳、首页三科卡片、英语 Hub 骨架、语文占位、数学迁移（零回归）、测试适配 | FR-HOME-01 | App.tsx, app/, features/home, chinese, english/EnglishHub | W1 |
| WU-ENG-ENGINE | types/generate/judge/tts + englishRepo + textbooks 加载 + buildPool + 全量单测；tsconfig 加 resolveJsonModule | FR-ENG-01(池)/02/03(题)/04(题)/09/11(题) | core/english/, data/englishRepo.ts, data/textbooks.ts | W1 ∥ |
| WU-ENG-IPA | `scripts/ipa_enrich.py`（CMU dict→IPA，缓存 `data/cache/cmudict`，回写 textbooks.json ipa 字段）+ 运行说明 | FR-ENG-08 | scripts/ | W1 ∥ |
| WU-ENG-WORD | 单词练习全流程 UI：筛选、三答题方式（含 HandwritingPad+OCR 懒加载降级）、TTS 听写、计时、易错、打印、组件测试 | FR-ENG-01~09(UI) | features/english/word/ | W2（依赖 W1 契约即可开工） |
| WU-ENG-SENT | 语句练习全流程 UI + `scripts/build_syntax.py` + `data/syntax-en.json` + SyntaxView + 组件测试 | FR-ENG-10~13 | features/english/sentence/, scripts/build_syntax.py | W2 ∥ |
| WU-INTEGRATION | Hub 接线真实组件、全量 build/test/lint、验收清单核对 | 全部 | EnglishHub.tsx（集成方） | W3 |

> W2 单元在 W1 契约下**可立即并行开工**（按 §2 编码，不等待 W1 完成）；集成只在全部交付后执行一次。

## 4. 测试策略

- **ENGINE**：纯单测 — 筛选池正确性（fixture 小池）、三模式题面/答案方向、题数 min 截断、池=0 抛错、choice4 恰 4 项且无重复、干扰项来自池、fingerprint 唯一、seen 优先未见、judge 中英归一化（大小写/标点/全半角/中文分段）、repo 注入 mock Storage 往返。
- **WORD/SENT**：Testing Library 组件测试 — 走通 10 题流程（fixture 数据注入 loader 或直接构造 pool）、答错出现 hint、自动/继续下一题、summary 统计、错题入库、打印入口存在、readAlong 不落库。
- **HOME**：`tests/app.test.tsx`、`tests/flow.test.tsx` 改为路由感知 — `beforeEach` 设 `location.hash='#/math'`（或 render 后导航再断言）；新增首页断言三科卡片、`#/english` 显示英语 Hub、`#/chinese` 显示占位。**数学既有断言全部保留且必须通过**。
- W3：`npm run build && npm test && npm run lint` 全绿 + FR 验收清单人工核对。

## 5. 已决默认（源自 PRD §5A.5，不再复议）

- D1 音标：构建期 CMU dict→IPA，缺失降级不显示（FR-ENG-08）。
- D2 OCR：tesseract.js 懒加载；资产本地 `public/ocr/`（提供 `scripts/fetch-ocr-assets.mjs` 下载脚本，一次性联网）；加载失败自动降级键盘输入并提示（FR-ENG-04）。
- D3 spaCy：仅构建期脚本，运行时无 Python（FR-ENG-13）。
- D4 TTS（修订）：预生成标准音频（`scripts/fetch_tts_audio.py`，edge-tts，一次性联网 → `public/audio/*.mp3` + `data/tts-manifest.json`，与 D2 OCR 资产同模式）优先；未收录文本 / 播放失败回退 Web Speech API；`speak()` 内部先 `cancel` 再 speak（防排队叠音）。
- D5 题数：`min(所选, 题池)`，UI 提示实际题数；choice4 要求池 ≥4。
- D6 readAlong（跟读）：不判题、不落库、无分数；流程 = 自动播音→跟读→"查看对照"（中英+注释+句法）→下一题；结束页仅回顾列表。
- D7 中文答案判题：归一化全等或命中任一分段（，,、；/）。
- D8 计时/易错/打印为单词练习完整实现（FR-ENG-05/06/07）；语句练习按 study.md 仅实现 FR-ENG-10~13（互译判题 + 跟读 + 对照 + 句法），不设易错与打印。
- D9 存储命名空间 `xstudy:v1:eng:*`，与数学隔离；`clearAll` 语义各自独立。
- D10 UI 语言简体中文；苹果风 tokens 沿用 `src/index.css`（不得改既有变量语义）。

## 6. 验收清单（W3 核对）

- [x] FR-HOME-01 全部子项（路由/三卡/数学零回归/语文占位/苹果风）
- [x] FR-ENG-01~13 全部子项（对照 requirements.md §5A 勾选框）
- [x] `npm run build`（含 tsc --noEmit）Exit 0
- [x] `npm test` 全绿（数学 + 英语 + 首页）— 17 文件 / 160 用例
- [x] `npm run lint` 零报错
- [x] 断网可运行核心练习（TTS/OCR 资产本地；OCR 资产与 TTS 音频首次获取需联网一次，已文档化）
