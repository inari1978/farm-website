# farm-website

DiDiFarm のホームページ（GitHub Pages で公開）。

## 文字と写真の編集

編集画面（[Pages CMS](https://app.pagescms.org)）から編集する。保存すると1〜2分でサイトに反映される。

- 編集できるのは `content/*.yml`（文字）と `images/`（写真）だけ。編集画面の項目は `.pages.yml` で決めている
- 編集画面の左上が **`main`** になっていることを確かめてから編集する（ほかのブランチで保存してもサイトに出ない）
- 写真のアップロードは **1枚3MBまで**。公開のときに自動で縮小し、撮影場所などの情報を消す（`scripts/optimize-images.mjs`）

## しくみ

| 場所 | 中身 |
|---|---|
| `content/` | ページの文字と写真のパス（編集画面が書き換える） |
| `src/` | ページのひな形（デザイン）。`{{ }}` の部分に `content/` の文字が入る |
| `assets/` | CSS・JS・アイコン |
| `images/` | 写真 |
| `scripts/build.mjs` | `src/` と `content/` から `_site/` にサイトを組み立てる |
| `.github/workflows/deploy.yml` | main に変更が入るたびに、写真の縮小 → 組み立て → 公開 |

使っている言語：HTML（Nunjucks のひな形）・CSS・JavaScript。サーバーで動くプログラム（PHP など）やデータベースはない。

## 公開

- GitHub の Settings → Pages の Source は **GitHub Actions**。「Deploy from a branch」に戻すと、このリポジトリがそのまま公開され、トップに README が出る
- 公開をやり直すとき：Actions → Deploy → Run workflow
- デザインやしくみ（`src/`・`assets/`・`scripts/`）の変更はプルリクエストで。プルリクエストでは組み立てられるかだけを確かめ、公開はしない
- CSS・JS の `?v=` の番号は公開のたびに自動で新しくなる

手元で確かめるとき：`npm ci && npm run build` で `_site/` ができる。

- 写真の置き方：`images/README.md`
- 仕様書・運用ガイドは非公開のリポジトリで管理しています。
