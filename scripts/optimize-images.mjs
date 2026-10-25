// images/ の写真を、サイトに載せられる大きさに直す（上書き保存）
// - 長い辺を 1600px までに縮小する
// - スマホの向き情報に合わせて回転し、撮影場所（GPS）などの情報を消す
// 使い方：npm run images（GitHub Actions が公開前に実行し、変わった写真をコミットし直す）
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = path.resolve(import.meta.dirname, "..", "images");
const MAX = 1600;

let changed = 0;
for (const name of fs.readdirSync(DIR)) {
  const ext = path.extname(name).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) continue;

  const file = path.join(DIR, name);
  const input = fs.readFileSync(file);
  const meta = await sharp(input).metadata();
  const tooBig = Math.max(meta.width ?? 0, meta.height ?? 0) > MAX;
  const hasMeta = Boolean(meta.exif || meta.xmp || meta.iptc);
  if (!tooBig && !hasMeta) continue;

  // 拡張子と中身の形式は変えない（content/*.yml に書かれたパスがそのまま使えるように）
  let img = sharp(input).rotate().resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true });
  if (ext === ".png") img = img.png({ compressionLevel: 9 });
  else if (ext === ".webp") img = img.webp({ quality: 80 });
  else img = img.jpeg({ quality: 80, mozjpeg: true });

  const output = await img.toBuffer();
  fs.writeFileSync(file, output);
  changed++;
  console.log(`${name}: ${meta.width}x${meta.height} ${Math.round(input.length / 1024)}KB -> ${Math.round(output.length / 1024)}KB`);
}

console.log(changed ? `optimized ${changed} image(s)` : "no images to optimize");
