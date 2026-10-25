// 作り置きの予約カレンダー
// 送信先：予約用の Google Apps Script のウェブアプリのURLを入れる。
// 空のあいだは見本の空き状況で動き、申し込んでも送らない
const ENDPOINT = "";
const isDemo = ENDPOINT === "";

// 受け付ける期間：今月と来月。直前の予約は受けない（何日前まで受け付けるか）
const MONTHS_AHEAD = 1;
const LEAD_DAYS = 2;

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
const label = (date) => {
  const d = new Date(date + "T00:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`;
};
const hm = (t) => t.replace(/^0/, "");

const today = new Date();
today.setHours(0, 0, 0, 0);
const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const lastMonth = new Date(today.getFullYear(), today.getMonth() + MONTHS_AHEAD, 1);
const earliest = new Date(today);
earliest.setDate(earliest.getDate() + LEAD_DAYS);

let shown = new Date(firstMonth);
let slotsByDate = {};   // { "2026-11-08": [{ id, date, start, end, open }] }
let pickedDate = null;
let pickedSlot = null;

if (isDemo) {
  document.querySelectorAll(".demo-note").forEach((el) => { el.hidden = false; });
}

// ---------- 空き状況の読み込み ----------

async function loadSlots() {
  const from = ymd(earliest);
  const to = ymd(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0));
  $("cal-status").textContent = "空き状況を読み込んでいます…";
  try {
    const slots = isDemo ? demoSlots(from, to) : await fetchSlots(from, to);
    slotsByDate = {};
    for (const s of slots) (slotsByDate[s.date] ||= []).push(s);
    $("cal-status").textContent = "";
    // 最初に開いたときは、◯の日がある最初の月を出す（今月が埋まっていれば来月から見せる）
    const firstOpen = Object.keys(slotsByDate).sort().find((date) => dayState(date) === "open");
    if (firstOpen && !pickedDate) {
      const d = new Date(firstOpen + "T00:00:00");
      shown = new Date(d.getFullYear(), d.getMonth(), 1);
    }
  } catch {
    slotsByDate = {};
    $("cal-status").textContent = "空き状況を読み込めませんでした。時間をおいて、ページを再読み込みしてください。";
  }
  renderCalendar();
}

async function fetchSlots(from, to) {
  const res = await fetch(`${ENDPOINT}?action=slots&from=${from}&to=${to}`);
  const data = await res.json();
  if (!data.ok) throw new Error("slots");
  return data.slots;
}

// 見本の空き状況：土日の午前（9:00〜12:00）と午後（14:00〜17:00。移動と休憩のため2時間あける）。日付から決まった並びで、いくつかを満席にする
function demoSlots(from, to) {
  const out = [];
  for (let d = new Date(from + "T00:00:00"); ymd(d) <= to; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) continue;
    const key = d.getDate() + d.getMonth() * 31;
    const date = ymd(d);
    const isFullDay = key % 4 === 2;
    out.push({ id: `${date}_0900`, date, start: "09:00", end: "12:00", open: !isFullDay && key % 3 !== 0 });
    out.push({ id: `${date}_1400`, date, start: "14:00", end: "17:00", open: !isFullDay && key % 5 !== 0 });
  }
  return out;
}

// ---------- カレンダー ----------

function dayState(date) {
  const slots = slotsByDate[date];
  if (!slots || slots.length === 0) return "none";
  return slots.some((s) => s.open) ? "open" : "full";
}

function renderCalendar() {
  const y = shown.getFullYear();
  const m = shown.getMonth();
  $("cal-title").textContent = `${y}年${m + 1}月`;
  $("cal-prev").disabled = shown <= firstMonth;
  $("cal-next").disabled = shown >= lastMonth;

  const body = $("cal-body");
  body.textContent = "";
  const start = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  let row = document.createElement("tr");
  for (let i = 0; i < start.getDay(); i++) row.append(document.createElement("td"));

  for (let day = 1; day <= days; day++) {
    const d = new Date(y, m, day);
    const date = ymd(d);
    const state = dayState(date);
    const td = document.createElement("td");
    const mark = { open: "◯", full: "×", none: "－" }[state];
    const text = { open: "空きあり", full: "満席", none: "受付なし" }[state];
    const el = document.createElement(state === "open" ? "button" : "span");
    el.className = `day ${state}` + (d.getDay() === 0 ? " sun" : d.getDay() === 6 ? " sat" : "");
    if (date === pickedDate) el.classList.add("picked");
    el.innerHTML = `<span class="num">${day}</span><span class="mark ${state}" aria-hidden="true">${mark}</span>`;
    el.setAttribute("aria-label", `${label(date)} ${text}`);
    if (state === "open") {
      el.type = "button";
      el.addEventListener("click", () => pickDate(date));
    }
    td.append(el);
    row.append(td);
    if (d.getDay() === 6) { body.append(row); row = document.createElement("tr"); }
  }
  if (row.children.length) body.append(row);
}

$("cal-prev").addEventListener("click", () => { shown.setMonth(shown.getMonth() - 1); renderCalendar(); });
$("cal-next").addEventListener("click", () => { shown.setMonth(shown.getMonth() + 1); renderCalendar(); });

// ---------- 時間を選ぶ ----------

function show(step) {
  $("step-hint").hidden = step !== "hint";
  $("step-time").hidden = step !== "time";
  $("reserve-form").hidden = step !== "form";
  $("reserve-done").hidden = step !== "done";
}

function pickDate(date) {
  $("taken-note").hidden = true;
  $("taken-note-day").hidden = true;
  pickedDate = date;
  pickedSlot = null;
  renderCalendar();
  $("time-title").textContent = `${label(date)}の空き時間`;
  const box = $("slots");
  box.textContent = "";
  for (const s of slotsByDate[date]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot" + (s.open ? "" : " full");
    b.disabled = !s.open;
    b.innerHTML = `<span>${hm(s.start)}〜${hm(s.end)}</span><span class="mark ${s.open ? "open" : "full"}">${s.open ? "◯" : "×"}</span>`;
    b.setAttribute("aria-label", `${hm(s.start)}から${hm(s.end)} ${s.open ? "空きあり" : "満席"}`);
    if (s.open) b.addEventListener("click", () => pickSlot(s));
    box.append(b);
  }
  show("time");
  $("time-title").focus();
}

function pickSlot(slot) {
  pickedSlot = slot;
  $("picked").textContent = `${label(slot.date)} ${hm(slot.start)}〜${hm(slot.end)}`;
  $("re-send").hidden = true;
  show("form");
  $("picked").focus();
}

$("back-to-time").addEventListener("click", () => pickDate(pickedDate));

// ---------- 入力して申し込む ----------

const form = $("reserve-form");
const f = form.elements;
const submit = form.querySelector(".submit");
const rules = [
  { id: "name", ok: () => f["name"].value.trim() !== "" },
  { id: "email", ok: () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f["email"].value.trim()) },
  { id: "postal", ok: () => f["postal"].value.trim() === "" || /^\d{3}-?\d{4}$/.test(toHalf(f["postal"].value.trim())) },
  { id: "pref", ok: () => f["pref"].value !== "" },
  { id: "city", ok: () => f["city"].value.trim() !== "" },
  { id: "line1", ok: () => f["line1"].value.trim() !== "" },
  { id: "agree", ok: () => f["agree"].checked },
];

// 全角の数字やハイフンで入力されても受け付ける
const toHalf = (v) => v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[－ー‐−]/g, "-");
const formatPostal = (v) => {
  const digits = toHalf(v.trim()).replace(/-/g, "");
  return digits ? `${digits.slice(0, 3)}-${digits.slice(3)}` : "";
};

function showError(id, on) {
  $("re-" + id).hidden = !on;
  f[id].setAttribute("aria-invalid", on ? "true" : "false");
}

function validate() {
  let first = null;
  for (const r of rules) {
    const ok = r.ok();
    showError(r.id, !ok);
    if (!ok && !first) first = f[r.id];
  }
  if (first) first.focus();
  return first === null;
}

// select は input ではなく change で知らせるので、両方で消す
const clearOnFix = (e) => {
  const r = rules.find((x) => x.id === e.target.name);
  if (r && r.ok()) showError(r.id, false);
};
form.addEventListener("input", clearOnFix);
form.addEventListener("change", clearOnFix);

// 見本では、最初に◯になっている枠を「ほかの人が先に取った」枠として扱い、
// 満席だったときの表示を確かめられるようにする
const demoTakenId = () => Object.values(slotsByDate).flat().find((s) => s.open)?.id;

async function send(payload) {
  if (isDemo) {
    await new Promise((r) => setTimeout(r, 700));
    return payload.slotId === demoTakenId() ? { ok: false, reason: "taken" } : { ok: true };
  }
  // text/plain で送ると、Apps Script でも応答（取れたか・埋まっていたか）を読める
  const res = await fetch(ENDPOINT, { method: "POST", body: JSON.stringify(payload) });
  return res.json();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  $("re-send").hidden = true;
  if (!validate()) return;

  const payload = {
    action: "reserve",
    slotId: pickedSlot.id,
    name: f["name"].value.trim(),
    email: f["email"].value.trim(),
    postal: formatPostal(f["postal"].value),
    address: f["pref"].value + f["city"].value.trim() + f["line1"].value.trim(),
    building: f["line2"].value.trim(),
    note: f["note"].value.trim(),
  };
  const isBot = f["website"].value !== "";

  submit.disabled = true;
  submit.textContent = "申し込んでいます…";
  try {
    const result = isBot ? { ok: true } : await send(payload);
    if (result.ok) {
      $("done-picked").textContent = $("picked").textContent;
      show("done");
      $("reserve-done").focus();
      if (isDemo) pickedSlot.open = false;
      renderCalendar();
    } else if (result.reason === "taken") {
      // ほかの人が先に取っていた。空き状況を読み直して、時間か日にちを選び直してもらう
      pickedSlot.open = false;
      if (!isDemo) await loadSlots();
      if (dayState(pickedDate) === "open") {
        pickDate(pickedDate);
        $("taken-note").hidden = false;
      } else {
        pickedDate = null;
        renderCalendar();
        show("hint");
        $("taken-note-day").hidden = false;
      }
    } else {
      $("re-send").hidden = false;
    }
  } catch {
    $("re-send").hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = "この内容で仮予約する";
  }
});

show("hint");
loadSlots();
