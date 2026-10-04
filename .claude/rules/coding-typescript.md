---
name: coding-typescript
description: TypeScript コーディング規約（manabidrill プロジェクト）
paths: ["**/*.ts", "src/domain/**"]
metadata:
  type: project
---

# TypeScript コーディング規約

このプロジェクトの TypeScript ファイル作成時に必ず従う規約。

## ファイル命名・構成

### ファイル名
- **コンポーネント**: PascalCase（例：`AnswerInput.tsx`, `QuestionCard.tsx`）
- **ユーティリティ**: camelCase（例：`helper.ts`, `validator.ts`）
- **型定義**: 定義ファイルと同ディレクトリに `types.ts` / インラインで定義
- **テスト**: `*.test.ts` / テスト対象ファイルの隣接

### ディレクトリ構成

全体像は `.claude/CLAUDE.md`「ファイル構成と責務」にある。TypeScriptを書くうえで
押さえるのは次の点。

```
src/
├── domain/              ← 採点・復習・集計ロジック（副作用なし）
│   ├── types.ts         - ドメイン型のみ
│   ├── *.ts             - 各ロジック（純粋関数）
│   └── questionTypes/   - 問題形式プラグイン。index.ts がレジストリ
├── csv/                 ← CSV解析・検証
├── db/                  ← IndexedDB リポジトリ・スキーマ
├── data/                ← 勘定科目マスタ・初期教材投入
├── auth/ sync/          ← 認証・クラウド同期
├── app/ hooks/ utils/   ← 全体の状態・データ取得・小物
├── components/          ← React 画面部品
│   ├── answer/          - 回答入力部品。index.tsx がレジストリ
│   └── *.tsx            - テンキー・シート・辞書ポップアップ等
└── screens/             ← 画面（ページ単位）
    └── manage/ practiceSetup/ session/  - 1画面が大きいものだけ分ける
```

**共通部品を `components/common/` へ分けない。** 分ける基準が「共通かどうか」だと、
2つ目の画面から使われた時点で移動が要り、参照元をまとめて直すことになる。
回答入力（`answer/`）だけを分けているのは、問題形式のプラグインと1対1に
対応させるためである。

## 型定義

### ドメイン型は明示的に定義する

**必須** — `any` は最後の手段。ドメイン知識を型で表現する。

```typescript
// ✅ OK
type AccountName = string & { readonly __brand: 'AccountName' };
function createAccountName(name: string): AccountName {
  if (!/^[\w\s一-龯]+$/.test(name)) throw new Error('Invalid account');
  return name as AccountName;
}
type Amount = number & { readonly __brand: 'Amount' };

// ✅ OK
interface JournalEntry {
  debit: { account: AccountName; amount: Amount };
  credit: { account: AccountName; amount: Amount };
}

// ❌ NG
function check(account: any, amount: any) { ... }
```

### 旧スキーマとの互換性
`legacy.ts` で旧形式を扱う場合のみ `Record<string, unknown>` 使用。新規コードでは禁止。

### Nullable への対応

```typescript
// ✅ OK — 明示的な型合成
type Nullable<T> = T | null;
type Optional<T> = T | undefined;

// ✅ OK — 使い分けが明確
interface Student {
  lastAttemptDate: Date | null;        // 「試したことない」状態がある
  memo?: string;                       // 「入力されてない」状態がある
}
```

## ドメイン層（採点・復習・集計）

### 純粋関数の原則

**副作用なし** — UI 更新・ローカルストレージ・ログ出力は別層で。

```typescript
// ✅ OK — 純粋関数
/** 仕訳の採点。行順序を無視し、同一科目は合算して比較 */
export function gradeJournal(
  expected: JournalEntry[],
  submitted: JournalEntry[]
): boolean {
  const normalizeEntry = (entry: JournalEntry) => ({
    ...entry,
    account: normalize(entry.account),
  });
  // ... 比較ロジック
}

// ❌ NG — 副作用あり
export function gradeJournal(expected, submitted) {
  console.log('採点中...');  // ← ログ出力（副作用）
  localStorage.setItem('result', JSON.stringify(result));  // ← 永続化（副作用）
  updateUI(result);  // ← UI 更新（副作用）
}
```

### ドメイン知識をコメント必須

簿記ルール・採点基準を必ず明記。一年後の保守担当者が理解できる粒度で。

```typescript
// ✅ OK
/**
 * 復習優先度を計算する
 * 
 * 式: miscount * 3 - streak
 * - miscount: 誤答回数（重要度3倍）
 * - streak: 連続正解数（習熟度を反映）
 * 
 * 例：誤答2回・連続正解1回 → 2*3-1=5
 *     誤答1回・連続正解4回 → 1*3-4=-1（習熟）
 * 
 * 単元の正答率が低い場合、単元全体の加点で補正。
 * 苦手分野を優先的に復習させる仕組み。
 */
export function reviewPriority(
  miscount: number,
  streak: number,
  categoryAccuracyRate: number
): number {
  const basePriority = miscount * 3 - streak;
  const unitBonus = categoryAccuracyRate < 0.6 ? 10 : 0;
  return basePriority + unitBonus;
}
```

### テストは共に作成

ドメインロジック追加時は同時にテストコードも作成する。複合仕訳・エッジケースを含める。

```typescript
// journal.test.ts
describe('gradeJournal', () => {
  it('複合仕訳で行順序を無視する', () => {
    const expected = [
      { debit: ('仕入', 84000), credit: ('普通預金', 81000) },
      { debit: ('仕入', 0), credit: ('現金', 3000) },
    ];
    const submitted = [
      { debit: ('仕入', 0), credit: ('現金', 3000) },  // 順序を反対に
      { debit: ('仕入', 84000), credit: ('普通預金', 81000) },
    ];
    expect(gradeJournal(expected, submitted)).toBe(true);
  });

  it('同一科目を合算して比較する', () => {
    const expected = [{ debit: ('仕入', 84000), credit: ('普通預金', 84000) }];
    const submitted = [
      { debit: ('仕入', 50000), credit: ('普通預金', 50000) },
      { debit: ('仕入', 34000), credit: ('普通預金', 34000) },
    ];
    expect(gradeJournal(expected, submitted)).toBe(true);
  });
});
```

## 関数・変数命名

### 動詞接頭詞

```typescript
// ✅ 明確な動詞で意図を示す
export function normalize(input: string): string { ... }     // 変換
export function validate(data: unknown): boolean { ... }     // 検証
export function grade(expected, submitted): boolean { ... }  // 採点
export function calculate(params): number { ... }            // 計算
export function select(pool, criteria): T { ... }            // 選択
```

### Boolean 変数・関数は is/has/can 接頭詞

```typescript
interface Question {
  isAnswered: boolean;
  hasExplanation: boolean;
  canRetry: boolean;
}

function isCorrect(grade: Grade): boolean { ... }
function hasTag(tags: string[], target: string): boolean { ... }
```

### 集計・統計は count/sum/avg 等

```typescript
const correctCount = answers.filter(a => a.isCorrect).length;
const totalAttempts = session.attemptCount;
const accuracyRate = correctCount / totalAttempts;
```

## 型チェック・strictness

TypeScript は **strict mode 推奨**。

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

## Import/Export

### Namespace Import は最小限
```typescript
// ✅ 明示的
import { gradeJournal, reviewPriority } from '../domain/index';

// ❌ なるべく避ける
import * as domain from '../domain/index';
```

### バレル・エクスポート（`index.ts` で再輸出）は作らない

**モジュールからは直接インポートする。**

```typescript
// ✅ OK — 使うものが、どのファイルにあるか読める
import { computePriority, STREAK_TO_RETIRE } from '../domain/review';
import { courseProgress } from '../domain/stats';

// ❌ NG — domain/index.ts を作って束ねる
import { computePriority, courseProgress } from '../domain';
```

理由は2つある。

1. **配信物が太る。** `export *` で束ねると、1つの関数を使うだけで束ねた側の
   モジュールがすべて依存関係へ入り、束の中に副作用のあるモジュールが1つでも
   あればツリーシェイクが効かなくなる。このアプリは起動時に読むJSの量が
   そのまま待ち時間になる（`docs/01_要件定義/学習アプリ仕様案` 13章）
2. **どこで定義されたか分からなくなる。** 束ねた名前だけを見ても、
   採点規則がどのファイルにあるのかを追えない

`index.ts` を置くのは、**再輸出ではなくレジストリとして中身を持つとき**に限る。
`domain/questionTypes/index.ts`（問題形式の登録表）と
`components/answer/index.tsx`（形式ごとの入力部品の振り分け）がこれにあたる。

## コメント・ドキュメント

### JSDoc は複雑な関数に

```typescript
/**
 * CSV行を解析してドメイン型に変換する
 * @param row - CSV行（ヘッダーなし）
 * @param schema - スキーマ定義（列順序・型）
 * @returns パース済みオブジェクト
 * @throws InvalidFormatError 形式不正時
 * @throws ValidationError 検証不備時
 */
export function parseRow(row: string[], schema: Schema): ParsedRow { ... }
```

### インラインコメントは「なぜ」を説明

```typescript
// ❌ NG — 何をしているか（コードから明白）
counter++; // counter を増やす

// ✅ OK — なぜしているか（背景・意図）
// 同一科目の複数行を1行に統合するため、まずカウント
counter++;
```

## テスト作成ルール

- **採点ロジック**: 正答・誤答・複合仕訳・複数行を含む
- **復習ロジック**: 優先度計算・セッション内再出題・優先度昇順
- **CSV検証**: 正常系・異常系・エッジケース（空行、Unicode）
- **正規化**: 全角数字・半角数字・桁区切り・空白

## よくある落とし穴

1. **採点ロジックに UI 更新を混ぜない** → 副作用層で処理
2. **複合仕訳の行順序を想定しない** → 順序独立の実装を
3. **ドメイン知識をコメント省略しない** → 簿記ルールは明示的に
4. **型安全性を甘く見ない** → `any` 多用 = 保守性低下
5. **null/undefined を混同** — 意図を明確に分け、型で表現
