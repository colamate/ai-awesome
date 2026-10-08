# Phase 1 数学口算 — 开发计划

> 来源：`docs/requirements.md`（PRD）。本文件是并行实现的共享 SSOT：契约与单元划分以本文为准。

## 0. 技术选型（定案）

| 层 | 选型 | 许可 | 理由 |
|----|------|------|------|
| 构建 | Vite 7 + TypeScript 5.x | MIT | 本地 `npm i && npm run dev` 即可运行，无云依赖 |
| UI | React 19 | MIT | 仓库 `.oxlintrc.json` 已配置 react/typescript/oxc 插件 |
| 样式 | Tailwind CSS v4（核心 MIT；不使用付费 Tailwind Plus 组件包） | MIT | 苹果风以自定义 design tokens 实现 |
| 持久化 | localStorage（封装 repository 层） | — | 单用户、数据量小（≤50 题/会话）；接口抽象便于日后切 IndexedDB |
| 测试 | Vitest + @testing-library/react + jsdom | MIT | 与 Vite 原生集成 |
| Lint | oxlint（沿用现有配置） | MIT | 已在仓库配置 |
| 打印 | 浏览器打印 + CSS `@media print` | — | A4 分页，无外部服务 |
| TTS/OCR（Phase 2） | Web Speech API / Tesseract.js | — | 浏览器原生 / 开源，不在本期 |

**不引入**：后端、数据库服务、状态同步服务、任何付费/遥测服务。

## 1. 目录结构

```
src/
  core/                 # 出题引擎（纯 TS，零 React 依赖）
    types.ts            # 领域类型（下方契约）
    generate.ts         # generateSession()
    judge.ts            # judge() + choices 生成
    hint.ts             # 解题思路模板
    fingerprint.ts      # 题目指纹（去重）
    __tests__/
  data/                 # 持久化（纯 TS，零 React 依赖）
    keys.ts             # localStorage 键名 + 版本前缀
    repo.ts             # config/sessions/mistakes repositories
    __tests__/
  features/
    config/             # 出题配置页
    practice/           # 答题流程（状态机宿主）
    summary/            # 结果统计 + 耗时分析
    mistakes/           # 易错收藏列表 + 专项练习入口
    print/              # A4 打印视图
  app/                  # App shell + 简单路由（hash 或 state 切换）
  styles/               # tokens.css（苹果风变量）+ 全局样式
  components/           # 共享 UI（Button/Card/SegmentedControl 等）
tests/setup.ts
```

## 2. 契约（跨单元依赖，签名不可擅自变更）

### 2.1 引擎 `src/core/types.ts`

```ts
export type OperationType = 'add' | 'sub' | 'mul' | 'div' | 'convert';
export type RangeTier = 10 | 20 | 50 | 100;
export type QuestionCount = 10 | 20 | 50;
export type AnswerMode = 'input' | 'choice4';
export type ConvertCategory = 'time' | 'length' | 'weight' | 'volume' | 'temperature';
export type OperandRole =
  | 'minuend' | 'subtrahend'            // 减法
  | 'multiplicand' | 'multiplier'       // 乘法
  | 'dividend' | 'divisor';             // 除法

export interface OperandSpec { mode: 'random' | 'fixed'; fixedValue?: number }

export interface PracticeConfig {
  operations: OperationType[];          // ≥1，混合=多选
  rangeTier?: RangeTier;                // add/sub 必填（默认 20）
  operands?: Partial<Record<OperandRole, OperandSpec>>; // FR-MATH-07
  convertCategories?: ConvertCategory[];// convert 至少 1 个
  questionCount: QuestionCount;
  answerMode: AnswerMode;
}

export interface Question {
  fingerprint: string;   // 稳定去重键（题型+规范化题面）
  type: OperationType;
  display: string;       // "12 + 7 = ?"
  answer: number;
  answerText: string;    // 显示用，换算带单位
  hint: string;          // FR-MATH-10 解题思路
  choices?: number[];    // choice4 模式下 4 个选项（含正确项）
}

export interface GenerateOptions {
  seenFingerprints?: string[]; // 跨练习历史，优先出未做过的（Q-11）
}

/** 生成一次练习的题目；单次内 fingerprint 严格唯一 */
export function generateSession(config: PracticeConfig, opts?: GenerateOptions): Question[];

/** 判题：input 模式传字符串（去空格、全半角归一）；choice4 传选项值 */
export function judge(q: Question, input: string | number): boolean;
```

生成约束：
- add/sub 档位 N ∈ {10,20,50,100}：参与运算的数与结果均 ≤ N；sub 结果 ≥ 0。
- mul/div：两数均 ≤ 9；div 为整除、除数 ≥ 1。
- convert：1 小时=60 分、1 分=60 秒；1 千米=1000 米、1 米=10 分米=100 厘米=1000 毫米；1 千克=1000 克、1 克=1000 毫克、1 毫克=1000 微克；体积 L/mL/cm³（1 L=1000 mL）；温度 ℃ 单位识别题（Q-01/Q-02/Q-03 采用 PRD 建议默认值）。方向随机。
- `operands`：role 指定 `fixed` 时整场固定该值（须在范围内，否则抛 `ConfigError`）；`random` 正常随机。
- 生成失败（约束冲突/去重穷尽）抛 `GenerateError`，UI 层给出可读提示。

### 2.2 持久化 `src/data/repo.ts`

```ts
export interface AnswerRecord {
  fingerprint: string; display: string; type: OperationType;
  userAnswer: string; correct: boolean; elapsedMs: number;
}
export interface SessionRecord {
  id: string; startedAt: number; endedAt: number;
  mode: 'normal' | 'mistake';           // 专项练习标记
  config: PracticeConfig;
  answers: AnswerRecord[];
  totalMs: number;                      // 有效作答总时长（暂停不计，Q-09）
}
export interface MistakeEntry {
  fingerprint: string; question: Question; // 题目快照
  wrongCount: number; firstWrongAt: number; lastWrongAt: number;
}
export interface ConfigRecord extends PracticeConfig { updatedAt: number }

export interface Repo {
  getConfig(): ConfigRecord | null;
  saveConfig(c: PracticeConfig): void;
  listSessions(): SessionRecord[];          // 最新在前，上限 200 条
  saveSession(s: SessionRecord): void;
  listMistakes(): MistakeEntry[];
  addMistake(q: Question, at: number): void; // 已存在则 wrongCount+1（Q-10）
  removeMistake(fingerprint: string): void;
  getSeenFingerprints(): string[];           // Q-11 跨练习去重
  clearAll(): void;                          // Q-13
}
export function createRepo(): Repo;          // 注入 Storage，默认 localStorage
```

### 2.3 会话状态机 `src/features/practice/`

```
configure → practicing → summary
              │  ↑
              │  └── feedback（判题瞬时态：对→~900ms 自动下一题；错→展示 hint，
              │                ~3s 自动下一题，可点「继续」跳过；Q-08）
              └── 详见每题：shownAt 起计时，提交/暂停区间扣除（visibilitychange 暂停，Q-09）
```

- summary：对错数、总耗时、每题耗时列表、最慢/最快题、平均耗时（Q-06）；错题调 `repo.addMistake`。
- 打印入口在 configure 与 summary 两处；含答案/不含答案两版（Q-07）。

## 3. 工作单元（WU）与并行波次

| WU | 内容 | 覆盖 FR | 依赖 | 波次 |
|----|------|---------|------|------|
| WU-01 | 脚手架：Vite+React+TS+Tailwind+oxlint+vitest、app shell、tokens、四命令绿 | NFR-01/02/03 | — | W0（单独） |
| WU-02 | 出题引擎 + 全量单测 | 01–08, 14 | — | W1（∥WU-03） |
| WU-03 | 持久化层 + 单测 | 数据需求, 13 | — | W1（∥WU-02） |
| WU-04 | 答题流程：配置页→答题（输入/四选一、自动判题、feedback、hint）→summary（基础统计+每题计时落库） | 09, 10, 12(采集), 08 | W0–W3 | W2 |
| WU-05 | 耗时分析视图增强（最慢/最快/均值/列表） | 12 | WU-04 | W3（∥06,07） |
| WU-06 | 易错收藏列表 + 专项练习入口 + 移除 | 13 | WU-04 | W3（∥05,07） |
| WU-07 | A4 打印视图（含答案/不含答案两版） | 11 | WU-04 | W3（∥05,06） |
| WU-08 | 苹果风打磨（留白/圆角/字体/过渡/响应式） | NFR-01 | W3 全部 | W4 |
| WU-09 | 验证：build+test+验收标准逐项核对 | 全部 | W4 | W5 |

**FR 覆盖**：01→WU-02｜02→WU-02｜03→WU-02｜04→WU-02｜05→WU-02｜06→WU-02｜07→WU-02｜08→WU-02/04｜09→WU-04｜10→WU-02(hint 模板)/WU-04(展示)｜11→WU-07｜12→WU-04(采集)/WU-05(分析)｜13→WU-03(存储)/WU-06(功能)｜14→WU-02(生成期去重)。

## 4. 已采用的默认值（源自 PRD 第 8 节，不再复议）

Q-01 体积=L/mL/cm³、温度=℃｜Q-02 数值进率换算｜Q-03 方向随机｜Q-04 按题型生成干扰项（进位/退位/相邻乘法口诀错误）｜Q-05 题型模板+动态代入｜Q-06 每题耗时列表+最慢/最快+平均｜Q-07 打印含答案/不含答案两版｜Q-08 练习前选答题方式、答后自动跳下一题｜Q-09 切后台暂停计时｜Q-10 错题按指纹去重累计次数、可手动移除｜Q-11 单次严格不重复、跨练习优先未做过的题｜Q-12 Phase 1 不做年级筛选｜Q-13 提供清空本地数据。

## 5. 测试策略

- WU-02：纯单测（每题型档位边界、整除、固定操作数、混合抽取、指纹去重、干扰项恰 3 个且不含正确值、judge 归一化）。
- WU-03：注入 mock Storage 单测（读写往返、错题累计、上限裁剪、clearAll）。
- WU-04~07：组件测试（Testing Library）：走通 10 题流程、答错出现 hint、自动前进、结果统计、错题入库、打印按钮存在。
- WU-09：`npm run build` + `npm test` + PRD 验收清单人工核对。

## 6. 阶段外

- Phase 2（语文/英语）不在本计划内。
- 不执行 git commit（除非用户明确要求）。
