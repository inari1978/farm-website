# .claude 設定（manabidrill から移植）

`inari1978/manabidrill` の `.claude/` から、Webサイト制作に流用できるものだけをコピーした。
中身はまだ manabidrill 固有の記述（IndexedDB、問題形式プラグイン等）を含む。
技術構成が決まった段階で畑サイト向けに書き換える。

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

## セキュリティ・デザイン（inari1978/ClaudeCode-skills から移植）

出典: https://github.com/inari1978/ClaudeCode-skills （コミット a2852cb）。参照パスを保つため番号付きのフォルダ名のまま置いている。

| ファイル | 用途 |
|---|---|
| `skills/1610-security-audit` | コード全体のセキュリティ監査（「セキュリティ監査して」で起動）。方法論は Cloudflare security-audit-skill（MIT、`references/LICENSE`） |
| `agents/security-reviewer.md` + `personas/security/CLAUDE.md` | 特定ページ・コードのセキュリティ観点レビュー役 |
| `agents/designer-reviewer.md` + `personas/designer/CLAUDE.md` | UI/UX・アクセシビリティ観点のレビュー役 |

持ってこなかったもの: `9050-frontend-design`・`9130-webapp-testing`（上の公開スキルと同一内容）、`9010-brand-guidelines`（Anthropic 社のブランド用）、PM・設計書・Office系スキル（Webサイト制作に不要）。
