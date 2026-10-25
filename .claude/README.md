# .claude 設定（manabidrill から移植）

`inari1978/manabidrill` の `.claude/` から、Webサイト制作に流用できるものだけをコピーした。
中身はまだ manabidrill 固有の記述（IndexedDB、問題形式プラグイン等）を含む。

**このサイトの技術構成（決定）**：React も TypeScript も使っていない。ページは Nunjucks のひな形（`src/`）、文字は YAML（`content/`）、動きは素の JavaScript（`assets/*.js`）、組み立ては Node.js（`scripts/`）。
そのため `rules/coding-typescript.md` と `rules/component-react.md` は、このサイトには当てはまらない（対象のファイルがないので読み込まれない）。レビュー役の判断基準も React 前提の部分は読み替える。

| ファイル | 用途 |
|---|---|
| `agents/frontend-dev-reviewer.md` | 実装・UX・スマホ操作性のレビュー役 |
| `personas/frontend-dev/CLAUDE.md` | 上記レビュー役の判断基準 |
| `rules/coding-typescript.md` | TypeScript 規約 |
| `rules/component-react.md` | React コンポーネント設計 |

持ってこなかったもの: 簿記・PM教材のレビュー役、CSV処理、採点ロジック、テスト規約（いずれも学習アプリ専用）。

## 公開スキル（anthropics/skills から移植）

出典: https://github.com/anthropics/skills （コミット 8a1541c）。ライセンスは各フォルダの `LICENSE.txt`。

| スキル | 用途 |
|---|---|
| `skills/frontend-design` | テンプレ感のない見た目づくり（配色・書体・レイアウトの方向性） |
| `skills/webapp-testing` | Playwright でページを実際に開いて表示確認・スクリーンショット |

## レビュー役・デザイン（inari1978/ClaudeCode-skills から移植）

出典: https://github.com/inari1978/ClaudeCode-skills （コミット a2852cb）。参照パスを保つため番号付きのフォルダ名のまま置いている。

| ファイル | 用途 |
|---|---|
| `skills/1610-security-audit` | コード全体のセキュリティ監査（「セキュリティ監査して」で起動）。方法論は Cloudflare security-audit-skill（MIT、`references/LICENSE`） |
| `agents/security-reviewer.md` + `personas/security/CLAUDE.md` | 特定ページ・コードのセキュリティ観点レビュー役 |
| `agents/designer-reviewer.md` + `personas/designer/CLAUDE.md` | UI/UX・アクセシビリティ観点のレビュー役 |
| `agents/customer-reviewer.md` + `personas/customer/CLAUDE.md` | サイト訪問者の目で、伝わるか・信頼できるか・問い合わせまで進めるかを見るレビュー役。元は IT 案件の顧客向けだったため、本サイトの訪問者（畑・作り置き・AI相談）向けに書き換えた |
| `skills/9110-theme-factory` | 配色・書体のテーマ見本10種（botanical-garden、forest-canopy など）。色決めのたたき台に使う |
| `skills/9020-canvas-design` | チラシ・SNSシェア画像（OGP）などを PNG/PDF で作る（`canvas-fonts/` 同梱） |

持ってこなかったもの: `9050-frontend-design`・`9130-webapp-testing`（上の公開スキルと同一内容）、`9010-brand-guidelines`（Anthropic 社のブランド用）、PM・設計書・構成図・Office系スキル、PM／PMO／プリセールス／QA／SE／テックリードのレビュー役、コーディング規約とコミット前チェック（TypeScript／Python 前提で静的サイトには合わない）。
