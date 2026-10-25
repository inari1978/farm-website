// サイトを組み立てる：src/ のテンプレートに content/*.yml の文字を流し込み、_site/ に書き出す
// 使い方：npm run build（GitHub Actions が公開前に実行する）
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import nunjucks from "nunjucks";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "_site");
// 公開URL。独自ドメインにしたらここと src/404.html を直す
const SITE_URL = "https://inari1978.github.io/farm-website/";

const PAGES = [
  { page: "top", template: "index.njk", out: "index.html", root: "",
    title: "DiDiFarm｜長野の畑と、畑の野菜の作り置き",
    description: "長野の畑で野菜を育て、東京・神奈川のご家庭でその野菜の作り置きをつくります。" },
  { page: "farm", template: "farm.njk", out: "farm/index.html", root: "../",
    title: "長野の畑｜DiDiFarm",
    description: "東京と長野の二拠点で、ゼロから畑をはじめます。" },
  { page: "kitchen", template: "kitchen.njk", out: "kitchen/index.html", root: "../",
    title: "畑の野菜で作り置き｜DiDiFarm",
    description: "長野の畑で育てた野菜を持って、東京・神奈川のご家庭で作り置きをつくります。" },
  { page: "contact", template: "contact.njk", out: "contact/index.html", root: "../",
    title: "お問い合わせ｜DiDiFarm",
    description: "DiDiFarmへのお問い合わせはこちらから。畑の野菜や作り置きについて、お気軽にどうぞ。",
    // 送信先（Googleスプレッドシート）とつなぐまでは検索に載せない
    noindex: true, ogp: false },
];

const content = {};
for (const name of ["site", "top", "farm", "kitchen"]) {
  content[name] = yaml.load(fs.readFileSync(path.join(ROOT, "content", `${name}.yml`), "utf8")) ?? {};
}

const escape = (s) => nunjucks.lib.escape(String(s ?? ""));
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(ROOT, "src")), {
  autoescape: true,
  throwOnUndefined: false,
});

// 改行を <br> にする（キャッチコピー用）
env.addFilter("lines", (s) => new nunjucks.runtime.SafeString(escape(s).trim().replace(/\r?\n/g, "<br>")));
// 1行を1段落にする（本文用）
env.addFilter("paras", (s) => new nunjucks.runtime.SafeString(
  String(s ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l) => `<p>${escape(l)}</p>`).join("\n        "),
));
// 見出し用：読点のあと・空白の位置で折り返せるようにする（空白は表示しない）
env.addFilter("heading", (s) => new nunjucks.runtime.SafeString(
  escape(s).trim().replace(/[ 　]+/g, "<wbr>").replace(/、(?!$)/g, "、<wbr>"),
));
// 写真のパスをページの階層に合わせる。content には "images/xxx.jpg" の形で入っている
env.addFilter("media", (src, root) => {
  const s = String(src ?? "").trim();
  if (/^https?:\/\//.test(s)) return s;
  return root + s.replace(/^\/+/, "");
});
env.addFilter("absUrl", (src) => {
  const s = String(src ?? "").trim();
  if (/^https?:\/\//.test(s)) return s;
  return SITE_URL + s.replace(/^\/+/, "");
});
// リンク先は http(s) だけ許す。入力ミスや javascript: などはインスタのトップに置き換える
env.addFilter("safeUrl", (u) => {
  const s = String(u ?? "").trim();
  return /^https?:\/\/[^\s"'<>]+$/.test(s) ? s : "https://www.instagram.com/";
});

// CSS・JS を更新したときにブラウザの古いキャッシュを使わせないための番号
const version = new Date().toISOString().replace(/\D/g, "").slice(0, 12);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const p of PAGES) {
  const html = env.render(p.template, {
    ...content,
    ...p,
    noindex: p.noindex ?? (p.page === "kitchen" && !content.kitchen.published),
    ogp: p.ogp ?? true,
    path: p.out.replace(/index\.html$/, ""),
    siteUrl: SITE_URL,
    version,
  });
  const file = path.join(OUT, p.out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

fs.copyFileSync(path.join(ROOT, "src", "404.html"), path.join(OUT, "404.html"));
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
for (const dir of ["assets", "images"]) {
  fs.cpSync(path.join(ROOT, dir), path.join(OUT, dir), {
    recursive: true,
    filter: (f) => !f.endsWith("README.md"),
  });
}

console.log(`built ${PAGES.length} pages -> _site/`);
