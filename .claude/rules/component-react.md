---
name: component-react
description: React コンポーネント設計ガイド（manabidrill）
paths: ["src/components/**/*.tsx", "src/screens/**/*.tsx"]
metadata:
  type: project
---

# React コンポーネント設計ガイド

manabidrill の React コンポーネント作成時に従うパターン・責務分離・プラグイン設計。

## コンポーネント責務の分離

### 層別の責務

```
screens/                     ← ページ層：ナビゲーション・状態管理
├── Launch.tsx               - 起動直後の振り分け（画面を持たない）
├── CourseSelect.tsx         - 教材選択
├── Home.tsx                 - コースのホーム
├── PracticeSetup.tsx        - 演習設定（コースの性質で中身を出し分ける）
├── Session.tsx              - 問題回答
├── SessionResult.tsx        - 結果一覧
├── StudyRecord.tsx          - 学習記録
├── Manage.tsx               - 教材管理
├── ShadowingList.tsx / ShadowingView.tsx  - シャドーイング（英語のみ）
├── session/                 - 演習の進行（useSessionRunner）と採点結果の表示
├── practiceSetup/           - 汎用コース用・英語コース用の設定画面
└── manage/                  - 教材管理のカード群

components/
├── answer/                  ← 回答層：回答入力 UI のみ
│   ├── index.tsx            - 形式ごとの入力部品への振り分け
│   ├── registry.tsx         - 形式IDと入力部品の対応表
│   └── JournalInput.tsx / ChoiceInput.tsx / MultiChoiceInput.tsx /
│       TextInput.tsx / LedgerInput.tsx / VocabInput.tsx / VocabBlanks.tsx
└── *.tsx                    ← 画面から使う部品（階層を作らない）
    Layout.tsx / Sheet.tsx / ChipGroup.tsx / ConfirmDialog.tsx /
    NumericKeypad.tsx / LetterKeypad.tsx / AccountPicker.tsx /
    DictionaryPopup.tsx / EnglishSentence.tsx / SpeakButton.tsx / …
```

**`components/` の直下に階層を作らない。** `common/`（共通部品）と `question/`
（表示部品）へ分ける案は採らない。「共通かどうか」は使われ方が変われば変わる基準で、
2つ目の画面から使われた時点でファイルの移動と参照元の直しが要る。
`answer/` だけを分けているのは、問題形式のプラグインと1対1に対応させるためである
（形式を足すときに触る場所が決まる）。

**起動時に要らない画面は遅延読込にする**（`App.tsx` の `lazy`）。
起動から最初に出るのは `Launch` → `Home` か `CourseSelect` で、それ以外は
操作して初めて開く。本体へ積むと、開かない画面の分まで毎回の起動で解析される。
新しい画面を足すときも、起動直後に出るものでなければ `lazy` 側へ入れる。

### 各層の実装ルール

**ページ層（screens/）**
- 画面全体の状態管理（選択中コース、現在の問題、成績）
- ドメインロジック（採点・復習ロジック）の呼び出し
- DB（IndexedDB）との連携
- ナビゲーション・画面遷移

```typescript
// ✅ OK
export function LearningScreen() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (answer: Answer) => {
    const graded = domain.gradeQuestion(question, answer);  // ← ドメイン呼び出し
    updateStats(graded);  // ← DB 更新
    nextQuestion();
  };

  return (
    <div>
      <QuestionDisplay question={question} />
      <AnswerInput onSubmit={handleSubmit} />
    </div>
  );
}
```

**回答層（components/answer/）**
- 回答の入力 UI のみ
- ドメインロジック・DB アクセスはしない
- 問題形式ごとにプラグイン化

```typescript
// ✅ OK — 入力 UI に集中
interface JournalAnswerInputProps {
  questionId: string;
  onSubmit: (answer: JournalAnswer) => void;
}

export function JournalAnswerInput({ questionId, onSubmit }: Props) {
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');

  const handleSubmit = () => {
    onSubmit({
      debit: { account: debitAccount, amount: parseAmount(debitAmount) },
      credit: { account: creditAccount, amount: parseAmount(creditAmount) },
    });
  };

  return (
    <div>
      <AccountSelector value={debitAccount} onChange={setDebitAccount} />
      <NumericKeypad onValue={setDebitAmount} />
      {/* ... */}
    </div>
  );
}
```

**共通層（components/common/）**
- テンキー・勘定科目選択・コース選択
- どの画面からも再利用可能
- 状態管理は最小限（自身のUI状態のみ）

```typescript
// ✅ OK — 共通化された部品
interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}

export function NumericKeypad({ value, onChange, onSubmit }: Props) {
  return (
    <div className="keypad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
        <button key={num} onClick={() => onChange(value + num)}>
          {num}
        </button>
      ))}
    </div>
  );
}
```

## 問題形式プラグイン設計

### プラグイン登録パターン

新しい問題形式を追加するときに触るのは、**2つのレジストリだけ**にする。

1. `src/domain/questionTypes/<形式>.ts` … 採点・CSVの列・提出可否を定義する
2. `src/domain/questionTypes/index.ts` … 上を登録する
3. `src/components/answer/<形式>Input.tsx` … 入力UIを作る
4. `src/components/answer/registry.tsx` … 上を登録する

**`switch` で分岐を足して回らない。** どちらのレジストリも
`Record<QuestionTypeId, …>` で定義してあるため、**登録漏れはコンパイルエラーになる**。
`switch` だと足し忘れが実行時まで分からない。

```tsx
// src/components/answer/registry.tsx
const renderers: Record<QuestionTypeId, AnswerRenderer> = {
  // …既存の形式…

  // 回答の型が問題形式と食い違ったまま描かないためのガードを必ず置く。
  // 問題が切り替わった直後の1描画では、新しい問題と前の問題の回答が
  // 組み合わさりうる。形式が変われば回答の構造そのものが違うため、
  // ここで弾かずに描くと画面全体が落ちる
  multi: ({ question, answer, onChange, graded }) =>
    answer.type !== 'multi' ? null : (
      <MultiChoiceInput
        payload={question.payload as MultiPayload}
        answer={answer}
        onChange={onChange}
        graded={graded}
        shuffleKey={question.key}
      />
    ),
};
```

採点しない形式（`shadowing`）もレジストリには載せ、`() => null` を返す。
**載せずに済ませない。** 万一出題キューへ混入したときに、回答欄が無いことが
分かる形で止まるようにするためである。

既存のコース・問題・学習履歴には影響しない。

## Props インターフェース

### Props は専用インターフェースで

```typescript
// ✅ OK
interface QuestionDisplayProps {
  question: Question;
  showExplanation?: boolean;
}

export function QuestionDisplay({ question, showExplanation }: QuestionDisplayProps) { ... }

// ❌ NG — Props が曖昧
export function QuestionDisplay(props: any) { ... }
export function QuestionDisplay({ question, ...rest }: Record<string, unknown>) { ... }
```

### Callback Props は intent を明確に

```typescript
// ✅ OK — intent が明確
interface AnswerInputProps {
  onSubmit: (answer: Answer) => void;     // 「送信」という意図
  onSkip?: () => void;                    // 「スキップ」という意図
}

// ❌ NG — 意図不明
interface AnswerInputProps {
  onComplete: (data: unknown) => void;
  onDone?: (value: any) => void;
}
```

## State 管理の原則

### 画面・コンポーネント固有の状態のみ useState

```typescript
// ✅ OK — UI 固有の一時的な状態
const [isExpanded, setIsExpanded] = useState(false);
const [selectedTab, setSelectedTab] = useState<'stats' | 'review'>('stats');

// ❌ NG — ドメイン状態や永続化すべき状態を useState で管理
const [correctCount, setCorrectCount] = useState(0);  // ← DB から読み込むべき
const [studentProfile, setStudentProfile] = useState({ ... });  // ← IndexedDB で管理
```

### 永続化が必要な状態は IndexedDB 経由

```typescript
// ✅ OK
const [stats, setStats] = useState<Stats | null>(null);

useEffect(() => {
  // DB から読み込む
  db.getStats().then(setStats);
}, []);

const updateStats = async (newStats: Stats) => {
  await db.updateStats(newStats);  // ← DB に保存
  setStats(newStats);
};
```

## Event Handling

### 入力値の正規化

```typescript
// ✅ OK — 入力を正規化してから処理
const handleAccountNameInput = (name: string) => {
  const normalized = domain.normalize.accountName(name);
  setAccount(normalized);
};

// ✅ OK — 全角数字を半角に
const handleAmountInput = (amount: string) => {
  const normalized = domain.normalize.amount(amount);
  setAmount(normalized);
};
```

### Error Handling

```typescript
// ✅ OK
const handleSubmit = async (answer: Answer) => {
  try {
    const graded = domain.gradeQuestion(question, answer);
    await db.saveAttempt({ question, answer, graded });
    onSuccess?.();
  } catch (error) {
    console.error('採点エラー', error);
    setError('採点に失敗しました');
  }
};
```

## アクセシビリティ

### キーボード対応

スマホのソフトキーボードでも操作可能に。

```typescript
// ✅ OK
const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
  if (e.key === 'Enter') {
    onSubmit();
  }
};

return <button onKeyDown={handleKeyDown}>送信</button>;
```

### Semantic HTML

```typescript
// ✅ OK
<label htmlFor="account-select">勘定科目</label>
<select id="account-select" value={account} onChange={handleChange}>
  {accounts.map(acc => <option key={acc.id}>{acc.name}</option>)}
</select>

// ❌ NG
<div onClick={() => setAccount(account)}>勘定科目: {account}</div>
```

## スタイリング

このプロジェクトではスタイリング手法は **自由**（CSS Modules / Tailwind / Styled Components 等）。
ただし、**コンポーネント単位でスタイルを管理** する。

```typescript
// ✅ OK — コンポーネント隣接
// AnswerInput.tsx
// AnswerInput.module.css

// ✅ OK — CSS-in-JS
const buttonStyle = css`
  background: blue;
  border: none;
`;

// ❌ NG — グローバル CSS で全コンポーネント汚染
// global.css に全スタイルを詰める
```

## テスト

### コンポーネント単位でテスト

```typescript
// AnswerInput.test.tsx
describe('JournalAnswerInput', () => {
  it('仕訳入力を受け付ける', () => {
    const handleSubmit = vi.fn();
    render(<JournalAnswerInput onSubmit={handleSubmit} />);

    userEvent.type(screen.getByLabelText('借方科目'), '現金');
    userEvent.type(screen.getByLabelText('借方金額'), '10000');
    userEvent.click(screen.getByText('送信'));

    expect(handleSubmit).toHaveBeenCalledWith({
      debit: { account: '現金', amount: 10000 },
      // ...
    });
  });

  it('入力値を正規化する', () => {
    // 全角数字を入力 → 半角に正規化されることを確認
  });
});
```

## よくある落とし穴

1. **ドメインロジックをコンポーネント内に書かない** — 必ず `domain/` 層で
2. **複数の責務を1コンポーネントに詰め込まない** → 層別に分離
3. **props を `any` で受け取らない** → 専用インターフェース定義
4. **永続化状態を useState で管理しない** → IndexedDB 経由
5. **プラグイン形式を無視して問題形式を追加しない** → plugin pattern 踏襲
