// お問い合わせフォーム
// 送信先：Google Apps Script のウェブアプリのURLを入れる。空のあいだは「準備中」として動く（送信しない）
const ENDPOINT = "";

const form = document.getElementById("contact-form");
// form.name はフォーム自身の name 属性と重なるため、入力欄は elements から取る
const f = form.elements;
const done = document.getElementById("done");
const submit = form.querySelector(".submit");
const isDemo = ENDPOINT === "";

if (isDemo) {
  document.querySelectorAll(".demo-note").forEach((el) => { el.hidden = false; });
}

// 文字数の表示
const message = document.getElementById("f-message");
const count = document.getElementById("count");
message.addEventListener("input", () => { count.textContent = message.value.length; });

// 入力チェック。問題のある欄にメッセージを出し、最初の欄へ移動する
const rules = [
  { id: "name", ok: () => f["name"].value.trim() !== "" },
  { id: "email", ok: () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f["email"].value.trim()) },
  { id: "topic", ok: () => form.querySelector('input[name="topic"]:checked') !== null },
  { id: "message", ok: () => f["message"].value.trim() !== "" },
  { id: "agree", ok: () => f["agree"].checked },
];

function showError(id, show) {
  document.getElementById("e-" + id).hidden = !show;
  const input = form.querySelector(`[name="${id}"]`);
  if (input) input.setAttribute("aria-invalid", show ? "true" : "false");
}

function validate() {
  let first = null;
  for (const rule of rules) {
    const ok = rule.ok();
    showError(rule.id, !ok);
    if (!ok && !first) first = form.querySelector(`[name="${rule.id}"]`);
  }
  if (first) first.focus();
  return first === null;
}

// 直したらすぐにエラー表示を消す
form.addEventListener("input", (e) => {
  const rule = rules.find((r) => r.id === e.target.name);
  if (rule && rule.ok()) showError(rule.id, false);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  document.getElementById("e-send").hidden = true;
  if (!validate()) return;

  // 人には見えない欄に入力がある＝自動送信なので、送ったふりだけする
  const isBot = f["website"].value !== "";

  submit.disabled = true;
  submit.textContent = "送信しています…";

  try {
    if (!isDemo && !isBot) {
      const body = new URLSearchParams({
        name: f["name"].value.trim(),
        email: f["email"].value.trim(),
        topic: form.querySelector('input[name="topic"]:checked').value,
        message: f["message"].value.trim(),
      });
      // Apps Script は別ドメインのため、応答の中身は読まずに送るだけにする
      await fetch(ENDPOINT, { method: "POST", mode: "no-cors", body });
    } else {
      await new Promise((r) => setTimeout(r, 600));
    }
    form.hidden = true;
    done.hidden = false;
    done.focus();
  } catch {
    document.getElementById("e-send").hidden = false;
    submit.disabled = false;
    submit.textContent = "送信する";
  }
});
